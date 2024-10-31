import sentry_sdk
from flask import Flask, abort, request, jsonify
from flask_cors import CORS
import os, json, requests
from dotenv import load_dotenv
load_dotenv()
from pyfcm import FCMNotification

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
        try:
            users.update_prefs(user['$id'], prefs={
                'fcmToken': fcmToken
            })
        except:
            return jsonify({'error': 'failed to update fcm token'}), 500
        
    sessid = user['$id']
    return jsonify({'sessid': sessid}), 201


@app.post("/api/sync/<method>")
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
        if "time" not in r and ("startTime" not in r or "endTime" not in r):
            return jsonify({'error': 'no start time or end time provided. If only one time is to be used, then use the "time" attribute instead.'}), 400
        if ("startTime" in r and "endTime" not in r) or ("startTime" not in r and "endTime" in r):
            return jsonify({'error': 'start time and end time must be provided together.'}), 400

    prefs = users.get_prefs(userid)
    fcmToken = prefs['fcmToken'] if 'fcmToken' in prefs else None
    if not fcmToken:
        return jsonify({'error': 'no fcm token found'}), 404

    fcm = FCMNotification(service_account_file='service-account.json', project_id=os.environ['FCM_PROJECT_ID'])

    try:
        fcm.notify(fcm_token=fcmToken, data_payload={
            "op": "PUSH",
            "data": json.dumps(data),
        })
    except Exception as e:
        return jsonify({'error': 'Message delivery failed', "fcmError": e}), 500

    return jsonify({'success': True, "message": "request has been sent to device."}), 200

@app.route("/api/delete/<method>", methods=['DELETE'])
def delData(method):
    if not "userid" in request.json:
        return jsonify({'error': 'no user id provided'}), 400
    if not method:
        return jsonify({'error': 'no method provided'}), 400
    if not "uuid" in request.json:
        return jsonify({'error': 'no uuid provided'}), 400

    userid = request.json['userid']
    uuids = request.json['uuid']
    if type(uuids) != list:
        uuids = [uuids]

    fixedMethodName = method[0].upper() + method[1:]

    prefs = users.get_prefs(userid)
    fcmToken = prefs['fcmToken'] if 'fcmToken' in prefs else None
    if not fcmToken:
        return jsonify({'error': 'no fcm token found'}), 404

    fcm = FCMNotification(service_account_file='service-account.json', project_id=os.environ['FCM_PROJECT_ID'])

    try:
        fcm.notify(fcm_token=fcmToken, data_payload={
            "op": "DEL",
            "data": json.dumps({
                "uuids": uuids,
                "recordType": fixedMethodName
            }),
        })
    except Exception as e:
        return jsonify({'error': 'Message delivery failed', "fcmError": e}), 500

    return jsonify({'success': True, "message": "request has been sent to device."}), 200


@app.delete("/api/sync/<method>")
def delFromDb(method):
    if not "userid" in request.json:
        return jsonify({'error': 'no user id provided'}), 400
    if not method:
        return jsonify({'error': 'no method provided'}), 400
    if not "uuid" in request.json:
        return jsonify({'error': 'no uuid provided'}), 400

    userid = request.json['userid']
    uuids = request.json['uuid']

    try:
        dbid = db.get(userid)['$id']
    except:
        return jsonify({'error': 'no database found for user'}), 404

    try:
        collectionid = db.get_collection(dbid, method)['$id']
    except:
        return jsonify({'error': 'no collection found for user'}), 404
    print(dbid, collectionid, uuids[0])
    for uuid in uuids:
        try: db.delete_document(dbid, collectionid, uuid)
        except Exception as e: print(e)

    return jsonify({'success': True}), 200

app.run(host=os.environ.get('APP_HOST', '0.0.0.0'), port=int(os.environ.get('APP_PORT', 6644)), debug=bool(os.environ.get('APP_DEBUG', False)))
