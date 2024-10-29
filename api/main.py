import sentry_sdk
from flask import Flask, abort, request, jsonify
from flask_cors import CORS
import os, json, requests
from dotenv import load_dotenv
load_dotenv()

try:
    sentry_sdk.init(
        dsn=os.environ['SENTRY_DSN'],
        traces_sample_rate=1.0,
    )
except: pass

from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query
from appwrite.services.users import Users
from appwrite.services.messaging import Messaging

from argon2 import PasswordHasher
ph = PasswordHasher()

from cryptography.fernet import Fernet
import base64

client = (Client()
    .set_endpoint(f'{os.environ["APPWRITE_HOST"]}/v1') 
    .set_project(os.environ['APPWRITE_ID'])               
    .set_key(os.environ['APPWRITE_KEY']))   
db = Databases(client)
users = Users(client)
messaging = Messaging(client)

app = Flask(__name__)
CORS(app)

def get_all_docs(data, collection, queries=[]):
    docs = []
    haslimit = False
    for query in queries:
        print(query)
        if query.startswith("limit"): 
            print(int(query.split("limit(")[1].split(")")[0]))
            if int(query.split("limit(")[1].split(")")[0]) <= 100: print("true"); haslimit = True
    
    if not haslimit:
        queries.append(Query.limit(100))
        querylength = len(queries)
        while True:
            if docs:
                queries.append(Query.cursor_after(docs[-1]['$id']))
            try:
                results = db.list_documents(data, collection, queries=queries)
            except: return docs
            if len(results['documents']) == 0:
                break
            results = results['documents']
            docs += results
            print(data, collection, len(docs))
            if len(queries) != querylength:
                queries.pop()
    else:
        return db.list_documents(data, collection, queries=queries)['documents']
    return docs

@app.route("/api/login", methods=['POST'])
def login(): 
    if not request.json or not 'username' in request.json or not 'password' in request.json:
        return jsonify({'error': 'invalid request'}), 400
    username = request.json['username']
    password = request.json['password']
    fcmToken = request.json['fcmToken'] if 'fcmToken' in request.json else None

    allusers = users.list(queries=[Query.equal('name', username)])['users']
    if len(allusers) == 0:
        sessid = users.create('unique()', name=username, password=password)['$id']
        return jsonify({'sessid': sessid}), 201
    
    user = allusers[0]
    try:
        ph.verify(user['password'], password)
    except: 
        return jsonify({'error': 'invalid password'}), 403
   
    if fcmToken:
        session = requests.Session()
        email = user['email']
        if not email:
            email = user['$id'] + "@hcgateway.dev"
            users.update_email(user['$id'], email)
        
        headers = {
            'X-Appwrite-Response-Format': '1.5.0',
            'X-Appwrite-Project': os.environ['APPWRITE_ID'],
            'Content-Type': 'application/json',
        }

        r = session.post(f"{os.environ['APPWRITE_HOST']}/v1/account/sessions/email", headers=headers, data=json.dumps({"email": email, "password": password})).json()
        print(r)
        sId = r['$id']

        payload = json.dumps({
        "targetId": "fcmPush",
        "identifier": fcmToken,
        "providerId": "fcm"
        })

        headers = {
        'X-Appwrite-Response-Format': '1.5.0',
        'X-Appwrite-Project': os.environ['APPWRITE_ID'],
        'X-Appwrite-Session': sId,
        'Content-Type': 'application/json',
        }
        print(headers)
        r = session.post(f"{os.environ['APPWRITE_HOST']}/v1/account/targets/push", headers=headers, data=payload).json()
        print(r)

        if "code" in r and r['code'] == 409:
            print("updating")
            r = session.put(f"{os.environ['APPWRITE_HOST']}/v1/account/targets/fcmPush/push", headers=headers, data=payload).json()
            print(r)

        session.delete(f"{os.environ['APPWRITE_HOST']}/v1/account/sessions/{sId}", headers=headers)

    sessid = user['$id']
    return jsonify({'sessid': sessid}), 201


@app.route("/api/sync/<method>", methods=['POST'])
def sync(method):
    print(request.json)
    method = method[0].lower() + method[1:]
    if not "userid" in request.json:
        return jsonify({'error': 'no user id provided'}), 400
    if not method:
        return jsonify({'error': 'no method provided'}), 400
    if not "data" in request.json:
        return jsonify({'error': 'no data provided'}), 400
    
    userid = request.json['userid']
    print(userid)
    user = users.get(userid)
    hashed_password = user['password']
    key = base64.urlsafe_b64encode(hashed_password.encode("utf-8").ljust(32)[:32])
    fernet = Fernet(key)

    data = request.json['data']
    if type(data) != list:
        data = [data]
    print(method, len(data))

    try:
        dbid = db.get(userid)['$id']
    except:
        try:
            dbid = db.create(userid, userid)['$id']
        except:
            try:
                dbid = db.list(queries=[Query.equal('name', userid)])['databases'][0]['$id']
            except:
                requests.post("http://localhost:6644/api/sync/"+method, json=request.json)
    
    # print(dbid)
    try:
        collectionid = db.get_collection(dbid, method)['$id']
    except:
        collectionid = db.create_collection(dbid, method, method, [], False)['$id']
        # print(collectionid)
        db.create_string_attribute(dbid, collectionid, "id", "99", True, array=False)
        db.create_string_attribute(dbid, collectionid, "data", "9999999", True, array=False)
        db.create_string_attribute(dbid, collectionid, "app", "999", True, array=False)
        db.create_datetime_attribute(dbid, collectionid, "start", False, array=False)
        db.create_datetime_attribute(dbid, collectionid, "end", False, array=False)
    
    print(dbid, collectionid)
    
    for item in data:
        # print(item)
        itemid = item['metadata']['id']
        dataObj = {}
        for k, v in item.items():
            if k != "metadata" and k != "time" and k != "startTime" and k != "endTime":
                dataObj[k] = v

        if "time" in item:
            starttime = item['time']
            endtime = None
        else:
            starttime = item['startTime']
            endtime = item['endTime']

        toencrypt = json.dumps(dataObj).encode()
        encrypted = fernet.encrypt(toencrypt).decode()

        # fernet.decrypt(encrypted.encode()).decode()

        # print(starttime, endtime)
        r = db.list_documents(dbid, collectionid, queries=[Query.equal("id", itemid)])
        if r['total'] > 0:
            print("updating")
            db.update_document(dbid, collectionid, itemid, {"id": itemid, 'data': encrypted, "app": item['metadata']['dataOrigin'], "start": starttime, "end": endtime})
        else:
            print("creating")
            try: db.create_document(dbid, collectionid, itemid, {"id": itemid, 'data': encrypted, "app": item['metadata']['dataOrigin'], "start": starttime, "end": endtime})
            except: pass

    return jsonify({'success': True}), 200

@app.route("/api/fetch/<method>", methods=['POST'])
def fetch(method):
    if not "userid" in request.json:
        return jsonify({'error': 'no user id provided'}), 400
    if not method:
        return jsonify({'error': 'no method provided'}), 400

    userid = request.json['userid']
    user = users.get(userid)
    hashed_password = user['password']
    key = base64.urlsafe_b64encode(hashed_password.encode("utf-8").ljust(32)[:32])
    fernet = Fernet(key)

    if not "queries" in request.json:
        queries = []
    else:
        queries = request.json['queries']
    
    try:
        dbid = db.get(userid)['$id']
    except:
        return jsonify({'error': 'no database found for user'}), 404

    try:
        collectionid = db.get_collection(dbid, method)['$id']
    except:
        return jsonify({'error': 'no collection found for user'}), 404

    docs = get_all_docs(dbid, collectionid, queries=queries)
    for doc in docs:
        doc['data'] = json.loads(fernet.decrypt(doc['data'].encode()).decode())
    return jsonify(docs), 200

@app.route("/api/push/<method>", methods=['PUT'])
def pushData(method):
    if not "userid" in request.json:
        return jsonify({'error': 'no user id provided'}), 400
    if not method:
        return jsonify({'error': 'no method provided'}), 400
    if not "data" in request.json:
        return jsonify({'error': 'no data provided'}), 400

    userid = request.json['userid']
    data = request.json['data']
    if type(data) != list:
        data = [data]

    fixedMethodName = method[0].upper() + method[1:]
    for r in data:
        r['recordType'] = fixedMethodName
        if "startTime" not in r or "endTime" not in r:
            return jsonify({'error': 'no start or end time provided'}), 400

    try:
        messaging.create_push("unique()", "PUSH", json.dumps(data), users = [userid])
    except Exception as e:
        return jsonify({'error': 'Message delivery failed', "appwriteError": e}), 500

    return jsonify({'success': True, "message": "request has been sent to device."}), 200

app.run(host=os.environ.get('APP_HOST', '0.0.0.0'), port=int(os.environ.get('APP_PORT', 6644)), debug=bool(os.environ.get('APP_DEBUG', False)))
