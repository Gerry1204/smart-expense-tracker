import os
import sqlite3
import firebase_admin
from firebase_admin import credentials, firestore

def migrate():
    print("=" * 60)
    print("        Flowing Gold - SQLite to Firebase Firestore Migration")
    print("=" * 60)
    
    # 1. Initialize Firebase
    key_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "firebase-key.json")
    if not os.path.exists(key_path) or os.path.getsize(key_path) == 0:
        print(f"\n[ERROR] firebase-key.json not found at: {key_path}")
        print("Please place your Firebase service account private key JSON file there first.")
        print("You can get this from: Firebase Console -> Project Settings -> Service Accounts.\n")
        return
        
    try:
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("[OK] Firebase initialized successfully.")
    except Exception as e:
        print(f"[ERROR] Failed to initialize Firebase: {e}")
        return
        
    # 2. Find databases
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_dir = base_dir
    
    users_db_path = os.path.join(db_dir, "users.db")
    users = []
    
    if not os.path.exists(users_db_path):
        print("[WARNING] users.db not found. Skipping user credentials migration.")
    else:
        print("Reading users from users.db...")
        conn = sqlite3.connect(users_db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT username, password, email FROM users")
            users = cursor.fetchall()
            print(f"Found {len(users)} users in users.db.")
        except sqlite3.OperationalError as e:
            print(f"[WARNING] Error reading users table: {e}")
        finally:
            conn.close()
            
    # Migrate users to Firestore
    migrated_users = 0
    for u in users:
        username, password, email = u
        print(f"  Migrating user account: {username}...")
        try:
            db.collection("users").document(username).set({
                "username": username,
                "password": password,
                "email": email
            })
            migrated_users += 1
        except Exception as e:
            print(f"  [ERROR] Failed to migrate user {username}: {e}")
            
    print(f"Migrated {migrated_users} user accounts.")
    
    # 3. Migrate transactions
    # Scan backend directory for any user db files
    all_files = os.listdir(db_dir)
    db_files = [f for f in all_files if f.endswith(".db") and f not in ["users.db", "test_auth_db.db", "newtestuser.db", "testuser.db", "test_db.db"]]
    
    migrated_transactions_total = 0
    for db_file in db_files:
        username = db_file[:-3] # Remove ".db" extension
        db_path = os.path.join(db_dir, db_file)
        
        print(f"\nReading transactions from {db_file} for user: {username}...")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        txs = []
        try:
            cursor.execute("SELECT id, date, amount, type, category, note FROM transactions")
            txs = cursor.fetchall()
            print(f"Found {len(txs)} transactions in {db_file}.")
        except sqlite3.OperationalError as e:
            print(f"[WARNING] Table transactions does not exist or error reading: {e}")
        finally:
            conn.close()
            
        if not txs:
            continue
            
        migrated_txs = 0
        batch = db.batch()
        count = 0
        
        for tx in txs:
            tx_id, date, amount, tx_type, category, note = tx
            tx_ref = db.collection("users").document(username).collection("transactions").document(str(tx_id))
            
            batch.set(tx_ref, {
                "id": int(tx_id),
                "date": date,
                "amount": float(amount),
                "type": tx_type,
                "category": category,
                "note": note
            })
            count += 1
            migrated_txs += 1
            
            # Firestore batch limit is 500
            if count >= 400:
                try:
                    batch.commit()
                    batch = db.batch()
                    count = 0
                except Exception as e:
                    print(f"  [ERROR] Error committing batch of transactions: {e}")
                    
        if count > 0:
            try:
                batch.commit()
            except Exception as e:
                print(f"  [ERROR] Error committing final batch: {e}")
                
        print(f"[OK] Successfully migrated {migrated_txs} transactions for user: {username}.")
        migrated_transactions_total += migrated_txs
        
    print("\n" + "=" * 60)
    print("Migration finished successfully!")
    print(f"   - Total users migrated: {migrated_users}")
    print(f"   - Total transactions migrated: {migrated_transactions_total}")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    migrate()
