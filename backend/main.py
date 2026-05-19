from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from fastapi import Header
import os


import models
import database

# Create tables in the global database (for users) explicitly on startup
# We treats 'users' as the default/global db name
engine = database.get_user_engine("users")

# Try to run ALTER TABLE to add the email column if it doesn't exist
try:
    from sqlalchemy import text
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR"))
        print("Successfully added email column to users table.")
except Exception as e:
    # If the column already exists, it will raise an error, which is safe to ignore
    pass

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class TransactionBase(BaseModel):
    date: str
    amount: float
    type: str
    category: str
    note: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: int

    class Config:
        from_attributes = True

class YearlyStats(BaseModel):
    highest_spending_day: Optional[Dict[str, Any]] = None
    most_frequent_day: Optional[Dict[str, Any]] = None
    highest_category: Optional[Dict[str, Any]] = None

class UserAuth(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    username: str
    email: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

# Dependency
def get_db(x_username: Optional[str] = Header(None)):
    # Security check: Validate username format to prevent path traversal or injection
    if x_username and not x_username.isalnum():
        raise HTTPException(status_code=400, detail="Invalid username header format")

    # Determine which database to use
    # If no header, fallback to 'users' (public/default)
    current_db_name = x_username if x_username else "users"
    
    # Get engine (this also ensures tables exist)
    engine = database.get_user_engine(current_db_name)
    
    # Create session
    SessionLocal = database.sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Dependency for global DB (users)
def get_global_db():
    # Always use 'users' db for user auth stuff
    engine = database.get_user_engine("users")
    SessionLocal = database.sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/register")
def register(auth: UserAuth, db: Session = Depends(get_global_db)):
    # Validate username
    if not auth.username.isalnum():
        raise HTTPException(status_code=400, detail="Username must contain only letters and numbers")
        
    # Validate email
    if not auth.email or "@" not in auth.email:
        raise HTTPException(status_code=400, detail="Invalid email address")
        
    # Check if user exists
    existing_user = db.query(models.User).filter(models.User.username == auth.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
        
    # Check if email exists
    existing_email = db.query(models.User).filter(models.User.email == auth.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = models.User(username=auth.username, password=auth.password, email=auth.email)
    db.add(new_user)
    db.commit()
    
    # Initialize the user's specific database
    # get_user_engine automatically runs create_all, so just calling it is enough
    database.get_user_engine(auth.username)
    
    return {"message": "User registered successfully"}

@app.post("/login")
def login(auth: UserAuth, db: Session = Depends(get_global_db)):
    # Validate username format
    if not auth.username.isalnum():
         raise HTTPException(status_code=400, detail="Username must contain only letters and numbers")

    user = db.query(models.User).filter(models.User.username == auth.username).first()
    if not user or user.password != auth.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"username": user.username, "message": "Login successful"}

import smtplib
from email.mime.text import MIMEText
import random
import string

def generate_temp_password(length=8):
    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for i in range(length))

def send_temp_password_email(email_to: str, username: str, temp_password: str):
    # Print clearly to console for local testing
    print("\n" + "="*60)
    print(f"  [EMAIL MOCK] Sending mail to: {email_to}")
    print(f"  [EMAIL MOCK] Dear {username}, your temporary password is: {temp_password}")
    print("="*60 + "\n")
    
    # Try sending via standard SMTP
    SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
    SMTP_USER = os.environ.get("SMTP_USER", "")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
    
    if not SMTP_USER or not SMTP_PASSWORD:
        return False
        
    msg = MIMEText(f"Dear {username},\n\nYour temporary password for Flowing Gold is: {temp_password}\n\nPlease log in and change your password immediately.\n\nBest regards,\nFlowing Gold Team")
    msg['Subject'] = 'Flowing Gold - Temporary Password'
    msg['From'] = SMTP_USER
    msg['To'] = email_to
    
    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, [email_to], msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"[SMTP ERROR] Failed to send email via SMTP: {e}")
        return False

@app.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_global_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user or user.email != req.email:
        raise HTTPException(status_code=400, detail="Username and email do not match our records")
        
    temp_pwd = generate_temp_password()
    user.password = temp_pwd
    db.commit()
    
    sent_successfully = send_temp_password_email(req.email, req.username, temp_pwd)
    
    return {
        "success": True, 
        "message": "Temporary password sent to your email" if sent_successfully else "Temporary password generated (printed in server logs for local testing)"
    }

@app.post("/change-password")
def change_password(req: ChangePasswordRequest, x_username: Optional[str] = Header(None), db: Session = Depends(get_global_db)):
    if not x_username:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    user = db.query(models.User).filter(models.User.username == x_username).first()
    if not user or user.password != req.old_password:
        raise HTTPException(status_code=400, detail="Incorrect old password")
        
    user.password = req.new_password
    db.commit()
    
    return {"success": True, "message": "Password changed successfully"}

@app.get("/transactions/", response_model=List[Transaction])
def read_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    transactions = db.query(models.Transaction).order_by(desc(models.Transaction.date), desc(models.Transaction.id)).offset(skip).limit(limit).all()
    return transactions

@app.post("/transactions/", response_model=Transaction)
def create_transaction(transaction: TransactionCreate, db: Session = Depends(get_db)):
    db_transaction = models.Transaction(**transaction.model_dump())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(db_transaction)
    db.commit()
    return {"ok": True}

@app.get("/stats/year/{year}", response_model=YearlyStats)
def get_yearly_stats(year: str, db: Session = Depends(get_db)):
    year_filter = models.Transaction.date.like(f"{year}-%")

    # 1. Highest Spending Day
    highest_day_query = (
        db.query(
            models.Transaction.date,
            func.sum(models.Transaction.amount).label("total_amount")
        )
        .filter(year_filter, models.Transaction.type == "expense")
        .group_by(models.Transaction.date)
        .order_by(desc("total_amount"))
        .first()
    )

    highest_spending_day = None
    if highest_day_query:
        highest_spending_day = {"date": highest_day_query.date, "amount": highest_day_query.total_amount}

    # 2. Most Frequent Day (Most items purchased - expenses)
    most_freq_query = (
        db.query(
            models.Transaction.date,
            func.count(models.Transaction.id).label("tx_count")
        )
        .filter(year_filter, models.Transaction.type == "expense")
        .group_by(models.Transaction.date)
        .order_by(desc("tx_count"))
        .first()
    )

    most_frequent_day = None
    if most_freq_query:
        most_frequent_day = {"date": most_freq_query.date, "count": most_freq_query.tx_count}

    # 3. Highest Category
    highest_cat_query = (
        db.query(
            models.Transaction.category,
            func.sum(models.Transaction.amount).label("total_amount")
        )
        .filter(year_filter, models.Transaction.type == "expense")
        .group_by(models.Transaction.category)
        .order_by(desc("total_amount"))
        .first()
    )

    highest_category = None
    if highest_cat_query:
        highest_category = {"category": highest_cat_query.category, "amount": highest_cat_query.total_amount}

    return YearlyStats(
        highest_spending_day=highest_spending_day,
        most_frequent_day=most_frequent_day,
        highest_category=highest_category
    )

# Serve static frontend files
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# frontend dist path is located at "../frontend/dist" relative to this backend/main.py file
dist_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")

if os.path.exists(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")
    
    # Catch-all route to serve index.html for React router / HTML pages
    @app.get("/{catchall:path}")
    def serve_frontend(catchall: str):
        if catchall.startswith("assets/"):
            raise HTTPException(status_code=404, detail="Asset not found")
        # If it's a specific file in the dist folder (like favicon.ico, etc.)
        file_path = os.path.join(dist_path, catchall)
        if catchall and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_path, "index.html"))
else:
    @app.get("/")
    def read_root():
        return {"message": "Welcome to Local Expense Tracker API (Frontend not built)"}
