APPWRITE_HOST = input("Enter Appwrite Host (ex: https://appwrite.shuchir.dev/v1): ")
APPWRITE_ID = input("Enter Appwrite Project ID: ")
APPWRITE_KEY = input("Enter Appwrite API Key: ")

MONGO_URI = input("Enter MongoDB URI (ex: mongodb://localhost:27017/hcgateway): ")

import pymongo

from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query
from appwrite.services.users import Users

client = (Client()
    .set_endpoint(APPWRITE_HOST)
    .set_project(APPWRITE_ID)
    .set_key(APPWRITE_KEY))
db = Databases(client)
users = Users(client)

mongo = pymongo.MongoClient(MONGO_URI)

def get_all_docs(data, collection, queries=[]):
    docs = []
    offset = 0
    ogq = queries.copy()
    while True:
        queries = ogq.copy()
        queries.append(Query.offset(offset))
        queries.append(Query.limit(100))
        results = db.list_documents(data, collection, queries=queries)
        if len(docs) == results['total']:
            break
        results = results['documents']
        docs += results
        offset += len(results)
    return docs

alldbs = db.list(queries=[Query.limit(100)])['databases']

for dbdata in alldbs:
    dbid = dbdata['$id']
    print(dbid)

    user = users.get(dbid)
    db_ = mongo["hcgateway"]
    collection = db_['users']
    collection.insert_one({
        "_id": dbid,
        "username": user['name'],
        "password": user['password'],
        "fcmToken": user['prefs']['fcmToken'] if 'fcmToken' in user['prefs'] else None
    })

    collections = db.list_collections(dbid, queries=[Query.limit(100)])['collections']
    for collection in collections:
        print(collection['name'])
        cid = collection['$id']
        docs = get_all_docs(dbid, cid)
        print(len(docs), db.list_documents(dbid, cid)['total'])
        if not docs: continue
        for doc in docs:
            del doc['$id']
            del doc['$permissions']
            del doc['$collectionId']
            del doc['$databaseId']
            del doc['$createdAt']
            del doc['$updatedAt']

            doc['_id'] = doc['id']

        db_ = mongo["hcgateway_"+dbid]
        col = db_[collection['name']]
        col.insert_many(docs)
        print("done")