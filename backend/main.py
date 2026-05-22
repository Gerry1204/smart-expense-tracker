import time
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from google.cloud import firestore
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import os
import database

# Initialize FastAPI App
app = FastAPI()

# Pre-initialize Firebase during server startup
try:
    database.init_firebase()
except Exception as e:
    print(f"Warning: Firebase could not be initialized on startup: {e}")

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


# Dependency to get Firestore client
def get_firestore_db():
    try:
        return database.get_db()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

# Dependency to get current username from header
def get_current_username(x_username: Optional[str] = Header(None)):
    if x_username:
        # Security check: Validate username format to prevent injection
        if not x_username.isalnum():
            raise HTTPException(status_code=400, detail="Invalid username header format")
        return x_username
    # Fallback to 'users' to maintain backward compatibility
    return "users"


@app.post("/register")
def register(auth: UserAuth, db = Depends(get_firestore_db)):
    # Validate username
    if not auth.username.isalnum():
        raise HTTPException(status_code=400, detail="Username must contain only letters and numbers")
        
    # Validate email
    if not auth.email or "@" not in auth.email:
        raise HTTPException(status_code=400, detail="Invalid email address")
        
    # Check if user exists
    user_ref = db.collection("users").document(auth.username)
    if user_ref.get().exists:
        raise HTTPException(status_code=400, detail="Username already exists")
        
    # Check if email exists
    email_query = db.collection("users").where("email", "==", auth.email).limit(1).get()
    if len(email_query) > 0:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Save new user in Firestore
    user_ref.set({
        "username": auth.username,
        "password": auth.password,
        "email": auth.email
    })
    
    return {"message": "User registered successfully"}


@app.post("/login")
def login(auth: UserAuth, db = Depends(get_firestore_db)):
    # Validate username format
    if not auth.username.isalnum():
         raise HTTPException(status_code=400, detail="Username must contain only letters and numbers")

    user_ref = db.collection("users").document(auth.username)
    user_doc = user_ref.get()
    
    if not user_doc.exists:
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    user_data = user_doc.to_dict()
    if user_data.get("password") != auth.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    return {"username": auth.username, "message": "Login successful"}


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
def forgot_password(req: ForgotPasswordRequest, db = Depends(get_firestore_db)):
    user_ref = db.collection("users").document(req.username)
    user_doc = user_ref.get()
    
    if not user_doc.exists:
        raise HTTPException(status_code=400, detail="Username and email do not match our records")
        
    user_data = user_doc.to_dict()
    if user_data.get("email") != req.email:
        raise HTTPException(status_code=400, detail="Username and email do not match our records")
        
    temp_pwd = generate_temp_password()
    user_ref.update({"password": temp_pwd})
    
    sent_successfully = send_temp_password_email(req.email, req.username, temp_pwd)
    
    return {
        "success": True, 
        "message": "Temporary password sent to your email" if sent_successfully else "Temporary password generated (printed in server logs for local testing)"
    }


@app.post("/change-password")
def change_password(req: ChangePasswordRequest, x_username: str = Depends(get_current_username), db = Depends(get_firestore_db)):
    if x_username == "users":
        raise HTTPException(status_code=401, detail="Authentication required")
        
    user_ref = db.collection("users").document(x_username)
    user_doc = user_ref.get()
    
    if not user_doc.exists:
        raise HTTPException(status_code=400, detail="User not found")
        
    user_data = user_doc.to_dict()
    if user_data.get("password") != req.old_password:
        raise HTTPException(status_code=400, detail="Incorrect old password")
        
    user_ref.update({"password": req.new_password})
    
    return {"success": True, "message": "Password changed successfully"}


@app.get("/transactions/", response_model=List[Transaction])
def read_transactions(skip: int = 0, limit: int = 100, x_username: str = Depends(get_current_username), db = Depends(get_firestore_db)):
    tx_ref = db.collection("users").document(x_username).collection("transactions")
    
    # Query from Firestore.
    # To avoid needing composite index in Firestore for date + id sorting, 
    # we fetch sorted by date DESC and then sort by id DESC in memory.
    docs = tx_ref.order_by("date", direction=firestore.Query.DESCENDING).offset(skip).limit(limit).stream()
    
    transactions = []
    for doc in docs:
        transactions.append(doc.to_dict())
        
    # Consistent in-memory sorting: date descending, then id descending
    transactions.sort(key=lambda x: (x.get("date", ""), x.get("id", 0)), reverse=True)
    
    return transactions


@app.post("/transactions/", response_model=Transaction)
def create_transaction(transaction: TransactionCreate, x_username: str = Depends(get_current_username), db = Depends(get_firestore_db)):
    # Generate unique 64-bit style ID using millisecond timestamp
    tx_id = int(time.time() * 1000)
    
    tx_data = transaction.model_dump()
    tx_data["id"] = tx_id
    
    # Store document in sub-collection
    db.collection("users").document(x_username).collection("transactions").document(str(tx_id)).set(tx_data)
    
    return tx_data


@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, x_username: str = Depends(get_current_username), db = Depends(get_firestore_db)):
    tx_ref = db.collection("users").document(x_username).collection("transactions").document(str(transaction_id))
    if not tx_ref.get().exists:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    tx_ref.delete()
    return {"ok": True}


@app.get("/stats/year/{year}", response_model=YearlyStats)
def get_yearly_stats(year: str, x_username: str = Depends(get_current_username), db = Depends(get_firestore_db)):
    # Fetch all transactions of the user for that specific year using date boundaries
    tx_ref = db.collection("users").document(x_username).collection("transactions")
    
    # String date format prefix matching in Firestore
    docs = tx_ref.where("date", ">=", f"{year}-01-01").where("date", "<=", f"{year}-12-31").stream()
    
    day_spending = {}  # { date: total_amount } for expenses
    day_freq = {}      # { date: tx_count } for expenses
    cat_spending = {}  # { category: total_amount } for expenses
    
    for doc in docs:
        tx = doc.to_dict()
        if tx.get("type") == "expense":
            date = tx.get("date")
            amount = tx.get("amount", 0.0)
            category = tx.get("category")
            
            day_spending[date] = day_spending.get(date, 0.0) + amount
            day_freq[date] = day_freq.get(date, 0) + 1
            cat_spending[category] = cat_spending.get(category, 0.0) + amount
            
    highest_spending_day = None
    if day_spending:
        highest_day = max(day_spending, key=day_spending.get)
        highest_spending_day = {"date": highest_day, "amount": day_spending[highest_day]}
        
    most_frequent_day = None
    if day_freq:
        freq_day = max(day_freq, key=day_freq.get)
        most_frequent_day = {"date": freq_day, "count": day_freq[freq_day]}
        
    highest_category = None
    if cat_spending:
        highest_cat = max(cat_spending, key=cat_spending.get)
        highest_category = {"category": highest_cat, "amount": cat_spending[highest_cat]}
        
    return YearlyStats(
        highest_spending_day=highest_spending_day,
        most_frequent_day=most_frequent_day,
        highest_category=highest_category
    )


# Serve static frontend files
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
