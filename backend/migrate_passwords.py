import database
import models
from passlib.context import CryptContext

def migrate():
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    engine = database.get_user_engine("users")
    SessionLocal = database.sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        users = db.query(models.User).all()
        migrated_count = 0
        for user in users:
            # Check if the password is already hashed with bcrypt
            # bcrypt hashes typically start with $2b$ or $2a$ and are 60 characters long
            if not (user.password.startswith("$2b$") or user.password.startswith("$2a$")) or len(user.password) != 60:
                print(f"Migrating password for user: {user.username}")
                hashed_password = pwd_context.hash(user.password)
                user.password = hashed_password
                migrated_count += 1
            else:
                print(f"User {user.username} already migrated.")
        
        db.commit()
        print(f"Migration completed. {migrated_count} users migrated.")
    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
