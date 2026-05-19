import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from contextlib import contextmanager

# 1. 設定基礎路徑與資料庫目錄
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.environ.get("DB_DIR", BASE_DIR)

# 確保資料庫資料夾存在
if not os.path.exists(DB_DIR):
    os.makedirs(DB_DIR, exist_ok=True)

# 2. 建立 ORM 基底
Base = declarative_base()

# 3. 全域引擎快取 (關鍵優化：避免重複建立 Engine)
# 格式: { "username": engine_object }
_engine_cache = {}

def get_db_url(username: str) -> str:
    """產生資料庫連線字串"""
    # 建議：可以在這裡加入對 username 的字元檢查，防止惡意路徑
    return f"sqlite:///{os.path.join(DB_DIR, f'{username}.db')}"

def get_user_engine(username: str):
    """
    取得指定使用者的 Engine。
    如果該使用者的 Engine 已經存在快取中，直接回傳；
    否則建立新的，並初始化資料表。
    """
    if username in _engine_cache:
        return _engine_cache[username]

    # 建立新的 Engine
    url = get_db_url(username)
    engine = create_engine(url, connect_args={"check_same_thread": False})
    
    # 關鍵優化：當第一次連線時，自動確認並建立該使用者的所有資料表
    # 這樣你就不用手動去對每個新的 .db 檔跑遷移指令
    Base.metadata.create_all(bind=engine)
    
    # 存入快取
    _engine_cache[username] = engine
    return engine

@contextmanager
def get_db(username: str):
    """
    產生資料庫 Session 的 Context Manager。
    負責：開啟連線 -> 讓外部使用 -> 發生錯誤自動 Rollback -> 最後自動關閉連線
    """
    engine = get_user_engine(username)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback() # 發生錯誤時回滾
        raise
    finally:
        db.close()    # 無論如何都要關閉連線，釋放 SQLite 檔案鎖定

