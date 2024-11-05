from flask import Blueprint, request, jsonify, g
import os, json
from dotenv import load_dotenv
load_dotenv()
from pyfcm import FCMNotification

import pymongo
from bson.objectid import ObjectId
from bson.errors import *
mongo = pymongo.MongoClient(os.environ['MONGO_URI'])

from argon2 import PasswordHasher
ph = PasswordHasher()

from cryptography.fernet import Fernet
import base64, secrets, datetime

v2 = Blueprint('v2', __name__, url_prefix='/api/v2/')

@v2.before_request
def before_request():
    if request.endpoint == 'v2.login' or request.endpoint == 'v2.refresh':
        return
    
    if not request.headers.get('Authorization'):
        return jsonify({'error': 'no token provided'}), 400

    token = request.headers.get('Authorization').split(' ')[1]
    db = mongo['hcgateway']
    usrStore = db['users']

    user = usrStore.find_one({'token': token})

    if not user:
        return jsonify({'error': 'invalid token'}), 403
    
    if datetime.datetime.now() > user['expiry']:
        return jsonify({'error': 'token expired. Use /api/v2/login to reauthenticate.'}), 403
    
    g.user = user['_id']

    return

@v2.route("/login", methods=['POST'])
def login(): 
    if not request.json or not 'username' in request.json or not 'password' in request.json:
        return jsonify({'error': 'invalid request'}), 400
    username = request.json['username']
    password = request.json['password']
    fcmToken = request.json['fcmToken'] if 'fcmToken' in request.json else None

    db = mongo['hcgateway']
    usrStore = db['users']

    user = usrStore.find_one({'username': username})

    if not user:
        user = usrStore.insert_one({'username': username, 'password': ph.hash(password)}).inserted_id
        usrStore.insert_one({'_id': str(user), 'username': username, 'password': ph.hash(password)})
        usrStore.delete_one({'_id': ObjectId(user)})

        token = secrets.token_urlsafe(32)
        refresh = secrets.token_urlsafe(32)
        expiryDate = datetime.datetime.now() + datetime.timedelta(hours=12)
        usrStore.update_one({'_id': str(user)}, {"$set": {'token': token, 'refresh': refresh, 'expiry': expiryDate}})

        return jsonify({
            "token": token,
            "refresh": refresh,
            "expiry": expiryDate.isoformat()
        }), 201
    
    try:
        ph.verify(user['password'], password)
    except: 
        return jsonify({'error': 'invalid password'}), 403
   
    if fcmToken:
        try:
            usrStore.update_one({'username': username}, {"$set": {'fcmToken': fcmToken}})
        except:
            return jsonify({'error': 'failed to update fcm token'}), 500
        
    sessid = user['_id']

    if datetime.datetime.now() > user['expiry']:
        token = secrets.token_urlsafe(32)
        refresh = secrets.token_urlsafe(32)
        expiryDate = datetime.datetime.now() + datetime.timedelta(hours=12)
        usrStore.update_one({'_id': sessid}, {"$set": {'token': token, 'refresh': refresh, 'expiry': expiryDate}})

    else:
        token = user['token']
        refresh = user['refresh']
        expiryDate = user['expiry']

    return jsonify({
            "token": token,
            "refresh": refresh,
            "expiry": expiryDate.isoformat()
    }), 201


@v2.route("/refresh", methods=['POST'])
def refresh():
    if not request.json or not 'refresh' in request.json:
        return jsonify({'error': 'invalid request'}), 400

    refresh = request.json['refresh']

    db = mongo['hcgateway']
    usrStore = db['users']

    user = usrStore.find_one({'refresh': refresh})

    if not user:
        return jsonify({'error': 'invalid refresh token'}), 403
    
    token = secrets.token_urlsafe(32)
    refresh = secrets.token_urlsafe(32)
    expiryDate = datetime.datetime.now() + datetime.timedelta(hours=12)
    usrStore.update_one({'_id': user['_id']}, {"$set": {'token': token, 'refresh': refresh, 'expiry': expiryDate}})

    return jsonify({
            "token": token,
            "refresh": refresh,
            "expiry": expiryDate.isoformat()
    }), 200

@v2.post("/sync/<method>")
def sync(method):
    print(request.json)
    method = method[0].lower() + method[1:]
    if not method:
        return jsonify({'error': 'no method provided'}), 400
    if not "data" in request.json:
        return jsonify({'error': 'no data provided'}), 400
    
    userid = g.user
    print(userid)

    db = mongo['hcgateway']
    usrStore = db['users']

    try: user = usrStore.find_one({'_id': userid})
    except InvalidId: return jsonify({'error': 'invalid user id'}), 400

    print(user)
    hashed_password = user['password']
    key = base64.urlsafe_b64encode(hashed_password.encode("utf-8").ljust(32)[:32])
    fernet = Fernet(key)

    data = request.json['data']
    if type(data) != list:
        data = [data]
    print(method, len(data))

    db = mongo['hcgateway_'+userid]
    collection = db[method]
    
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
        try:
            print("creating")
            collection.insert_one({"_id": itemid, "id": itemid, 'data': encrypted, "app": item['metadata']['dataOrigin'], "start": starttime, "end": endtime})
        except:
            print("updating")
            collection.update_one({"_id": itemid}, {"$set": 
                                                 {'data': encrypted, "app": item['metadata']['dataOrigin'], "start": starttime, "end": endtime}
                                                })

    return jsonify({'success': True}), 200

@v2.route("/fetch/<method>", methods=['POST'])
def fetch(method):
    if not method:
        return jsonify({'error': 'no method provided'}), 400

    userid = g.user
    db = mongo['hcgateway']
    usrStore = db['users']

    try: user = usrStore.find_one({'_id': userid})
    except InvalidId: return jsonify({'error': 'invalid user id'}), 400

    hashed_password = user['password']
    key = base64.urlsafe_b64encode(hashed_password.encode("utf-8").ljust(32)[:32])
    fernet = Fernet(key)

    if not "queries" in request.json:
        queries = []
    else:
        queries = request.json['queries']
    
    db = mongo['hcgateway_'+userid]
    collection = db[method]
    
    docs = []
    for doc in collection.find(queries):
        doc['data'] = json.loads(fernet.decrypt(doc['data'].encode()).decode())
        docs.append(doc)

    return jsonify(docs), 200

@v2.route("/push/<method>", methods=['PUT'])
def pushData(method):
    if not method:
        return jsonify({'error': 'no method provided'}), 400
    if not "data" in request.json:
        return jsonify({'error': 'no data provided'}), 400

    userid = g.user
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

    db = mongo['hcgateway']
    usrStore = db['users']

    try: user = usrStore.find_one({'_id': userid})
    except InvalidId: return jsonify({'error': 'invalid user id'}), 400

    fcmToken = user['fcmToken'] if 'fcmToken' in user else None
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

@v2.route("/delete/<method>", methods=['DELETE'])
def delData(method):
    if not method:
        return jsonify({'error': 'no method provided'}), 400
    if not "uuid" in request.json:
        return jsonify({'error': 'no uuid provided'}), 400

    userid = g.user
    uuids = request.json['uuid']
    if type(uuids) != list:
        uuids = [uuids]

    fixedMethodName = method[0].upper() + method[1:]

    db = mongo['hcgateway']
    usrStore = db['users']

    try: user = usrStore.find_one({'_id': userid})
    except InvalidId: return jsonify({'error': 'invalid user id'}), 400

    fcmToken = user['fcmToken'] if 'fcmToken' in user else None
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
        return jsonify({'error': 'Message delivery failed'}), 500


    return jsonify({'success': True, "message": "request has been sent to device."}), 200


@v2.delete("/sync/<method>")
def delFromDb(method):
    method = method[0].lower() + method[1:]
    if not method:
        return jsonify({'error': 'no method provided'}), 400
    if not "uuid" in request.json:
        return jsonify({'error': 'no uuid provided'}), 400

    userid = g.user
    uuids = request.json['uuid']

    if type(uuids) != list:
        uuids = [uuids]

    db = mongo['hcgateway_'+userid]
    collection = db[method]
    print(collection)
    for uuid in uuids:
        print(uuid)
        try: collection.delete_one({"_id": uuid})
        except Exception as e: print(e)

    return jsonify({'success': True}), 200