import os
import firebase_admin
from firebase_admin import credentials, firestore

db = None
firebase_initialized = False

def init_firebase():
    """
    Initializes the Firebase Admin SDK.
    Attempts to read the service account key from firebase-key.json.
    If not found, falls back to Google Application Default Credentials (ADC).
    """
    global db, firebase_initialized
    if firebase_initialized:
        return db

    # Path to service account key
    key_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "firebase-key.json")
    
    if os.path.exists(key_path) and os.path.getsize(key_path) > 0:
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(key_path)
                firebase_admin.initialize_app(cred)
            db = firestore.client()
            firebase_initialized = True
            print("Successfully initialized Firebase Admin SDK with service account JSON.")
        except Exception as e:
            print(f"Error initializing Firebase with service account key: {e}")
            raise e
    else:
        # Fallback to default credentials or environment variables (e.g. for cloud deployment)
        try:
            if not firebase_admin._apps:
                firebase_admin.initialize_app()
            db = firestore.client()
            firebase_initialized = True
            print("Successfully initialized Firebase Admin SDK with Google Application Default Credentials.")
        except Exception as e:
            print("Firebase credentials file (firebase-key.json) not found in backend directory, and no default credentials available.")
            firebase_initialized = False
            db = None
    return db

def get_db():
    """
    Retrieves the active Firestore database client.
    Raises RuntimeError if Firebase is not properly initialized.
    """
    client = init_firebase()
    if client is None:
        raise RuntimeError(
            "Firebase is not initialized. Please place your service account credentials private key "
            "as 'firebase-key.json' in the 'backend' directory of the project."
        )
    return client
