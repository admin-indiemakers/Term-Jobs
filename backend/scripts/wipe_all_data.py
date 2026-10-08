"""Complete Database Wipe Script.
Wipes ALL collections in the MongoDB database, including candidates,
interviews, requisitions, accounts (all users including Super Admins),
tenants, notifications, work orders, etc.
"""
from modules.shared.db import _get_client
from modules.shared.config import settings

def wipe_database():
    client = _get_client()
    raw_db = client[settings.mongo_db_name]
    
    collections = raw_db.list_collection_names()
    print(f"Connecting to database: {settings.mongo_db_name}")
    print(f"Found {len(collections)} collection(s).")
    
    total_deleted = 0
    results = {}
    
    for coll_name in sorted(collections):
        if coll_name.startswith("system."):
            continue
        try:
            res = raw_db[coll_name].delete_many({})
            count = res.deleted_count
            results[coll_name] = count
            total_deleted += count
            print(f"  [-] {coll_name}: deleted {count} document(s)")
        except Exception as e:
            print(f"  [!] {coll_name}: error deleting: {e}")
            
    print("\n" + "=" * 50)
    print(f"[OK] Total documents deleted: {total_deleted}")
    print("Database is now completely empty.")
    print("=" * 50)
    return results

if __name__ == "__main__":
    wipe_database()
