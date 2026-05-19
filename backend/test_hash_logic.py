import database
import models
from main import register, login, UserAuth
from passlib.context import CryptContext
from sqlalchemy.orm import Session

def run_tests():
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    # Use a temporary clean DB for testing
    engine = database.get_user_engine("test_auth_db")
    SessionLocal = database.sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    # Clear test DB if it had data
    db.query(models.User).delete()
    db.commit()
    
    try:
        # 1. Test Register
        print("Testing registration...")
        auth_data = UserAuth(username="newtestuser", password="securepassword123")
        reg_response = register(auth_data, db)
        print("Registration response:", reg_response)
        
        # Verify database record
        user_record = db.query(models.User).filter(models.User.username == "newtestuser").first()
        assert user_record is not None, "User was not created in database"
        assert user_record.password != "securepassword123", "Password was stored in plain text!"
        assert pwd_context.verify("securepassword123", user_record.password), "Password hash cannot be verified!"
        print("Password successfully hashed and verified in DB.")
        
        # 2. Test Login
        print("Testing login with correct password...")
        login_response = login(auth_data, db)
        print("Login response:", login_response)
        assert login_response["username"] == "newtestuser", "Login failed for valid user"
        
        # 3. Test Login with incorrect password
        print("Testing login with incorrect password...")
        from fastapi import HTTPException
        try:
            wrong_auth = UserAuth(username="newtestuser", password="wrongpassword")
            login(wrong_auth, db)
            print("FAILED: Allowed login with wrong password!")
            assert False
        except HTTPException as e:
            print(f"Success: Correctly raised HTTP {e.status_code}: {e.detail}")
            assert e.status_code == 401
            
        print("All tests passed successfully!")
        
    finally:
        # Clean up
        db.query(models.User).delete()
        db.commit()
        db.close()

if __name__ == "__main__":
    run_tests()
