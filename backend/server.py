from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import aiomysql
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

ROOT_DIR = Path(__file__).parent

# MySQL connection pool
pool = None

async def get_pool():
    global pool
    if pool is None:
        pool = await aiomysql.create_pool(
            host=os.environ.get("MYSQL_HOST", "localhost"),
            port=int(os.environ.get("MYSQL_PORT", 3306)),
            user=os.environ.get("MYSQL_USER", "hruser"),
            password=os.environ.get("MYSQL_PASSWORD", "hrpass123"),
            db=os.environ.get("MYSQL_DB", "hr_portal"),
            autocommit=True,
            minsize=2,
            maxsize=10,
            charset='utf8mb4'
        )
    return pool

async def execute_query(query, args=None, fetch_one=False, fetch_all=False, last_id=False):
    p = await get_pool()
    async with p.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(query, args)
            if last_id:
                return cur.lastrowid
            if fetch_one:
                return await cur.fetchone()
            if fetch_all:
                return await cur.fetchall()
            return cur.rowcount

# JWT Config
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

# Password utilities
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# JWT utilities
def create_access_token(user_id: int, email: str, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

# Auth dependency
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await execute_query(
            "SELECT id, email, name, role, department, position, avatar_url, casual_leave, sick_leave, loss_of_pay, permission_hours, half_day_leave, shift, basic_salary FROM users WHERE id = %s",
            (int(payload["sub"]),), fetch_one=True
        )
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["id"])
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_admin_or_manager(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    return user

# Create the main app
app = FastAPI()

# Uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads" / "avatars"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Serve uploaded files as static
app.mount("/uploads", StaticFiles(directory=str(ROOT_DIR / "uploads")), name="uploads")

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth")
employees_router = APIRouter(prefix="/employees")
attendance_router = APIRouter(prefix="/attendance")
leave_router = APIRouter(prefix="/leave")
admin_router = APIRouter(prefix="/admin")
permission_router = APIRouter(prefix="/permission")
payslip_router = APIRouter(prefix="/payslip")
reports_router = APIRouter(prefix="/reports")
holidays_router = APIRouter(prefix="/holidays")

# Constants
REQUIRED_WORK_HOURS = 8.0
TOTAL_WORK_HOURS = 8.5
MONTHLY_PERMISSION_HOURS = 2
MAX_PERMISSION_PER_USE = 1
SHORT_DAYS_FOR_HALF_LEAVE = 3
MAX_BREAK_MINUTES = 30
WORKING_DAYS_PER_MONTH = 22

# Holiday List
HOLIDAYS = [
    {"date": "2026-01-01", "day": "Thursday", "festival": "New Year"},
    {"date": "2026-01-26", "day": "Monday", "festival": "Republic Day"},
    {"date": "2026-04-03", "day": "Friday", "festival": "Good Friday"},
    {"date": "2026-04-14", "day": "Tuesday", "festival": "Vishu"},
    {"date": "2026-05-01", "day": "Friday", "festival": "May Day"},
    {"date": "2026-05-27", "day": "Wednesday", "festival": "Bakrid (Tentative)"},
    {"date": "2026-08-15", "day": "Saturday", "festival": "Independence Day"},
    {"date": "2026-08-25", "day": "Tuesday", "festival": "Onam"},
    {"date": "2026-10-02", "day": "Friday", "festival": "Gandhi Jayanti"},
    {"date": "2026-10-20", "day": "Tuesday", "festival": "Vijayadasami"},
    {"date": "2026-11-08", "day": "Sunday", "festival": "Diwali"},
    {"date": "2026-12-25", "day": "Friday", "festival": "Christmas"},
]

def is_weekend(date_str: str) -> bool:
    d = datetime.strptime(date_str, "%Y-%m-%d")
    return d.weekday() in (5, 6)

def is_holiday(date_str: str) -> bool:
    return any(h["date"] == date_str for h in HOLIDAYS)

def get_holiday_name(date_str: str) -> str:
    for h in HOLIDAYS:
        if h["date"] == date_str:
            return h["festival"]
    return ""

SHIFTS = {
    "general": {"name": "General Shift", "start": "09:30", "end": "17:30"},
    "morning": {"name": "Morning Shift", "start": "04:00", "end": "12:00"},
    "afternoon": {"name": "Afternoon Shift", "start": "12:00", "end": "20:00"},
    "night": {"name": "Night Shift", "start": "20:00", "end": "04:00"}
}

# Pydantic Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    department: Optional[str] = "General"
    position: Optional[str] = "Employee"
    role: Optional[str] = "employee"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class LeaveRequest(BaseModel):
    leave_type: str
    start_date: str
    end_date: str
    reason: str

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    casual_leave: Optional[int] = None
    sick_leave: Optional[int] = None
    permission_hours: Optional[float] = None
    shift: Optional[str] = None
    role: Optional[str] = None

class PermissionRequest(BaseModel):
    duration_minutes: int
    reason: str
    date: str

class SalaryUpdate(BaseModel):
    basic_salary: float

class PayslipGenerate(BaseModel):
    employee_id: str
    month: int
    year: int

class ShiftAssign(BaseModel):
    shift: str

class PasswordReset(BaseModel):
    new_password: str

# ============== AUTH ROUTES ==============

@auth_router.post("/register")
async def register(user_data: UserRegister, response: Response):
    email = user_data.email.lower()
    existing = await execute_query("SELECT id FROM users WHERE email = %s", (email,), fetch_one=True)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = hash_password(user_data.password)
    user_id = await execute_query(
        """INSERT INTO users (email, password_hash, name, role, department, position, avatar_url, created_at, casual_leave, sick_leave, loss_of_pay, permission_hours, half_day_leave, shift)
           VALUES (%s, %s, %s, %s, %s, %s, '', %s, 12, 3, 0, %s, 0, '')""",
        (email, hashed, user_data.name, "employee", user_data.department, user_data.position, datetime.now(timezone.utc).isoformat(), MONTHLY_PERMISSION_HOURS),
        last_id=True
    )

    access_token = create_access_token(user_id, email, "employee")
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

    return {"id": str(user_id), "email": email, "name": user_data.name, "role": "employee", "department": user_data.department, "position": user_data.position, "avatar_url": ""}

@auth_router.post("/login")
async def login(user_data: UserLogin, response: Response):
    email = user_data.email.lower()
    user = await execute_query("SELECT * FROM users WHERE email = %s", (email,), fetch_one=True)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(user["id"], email, user["role"])
    refresh_token = create_refresh_token(user["id"])
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

    return {"id": str(user["id"]), "email": email, "name": user["name"], "role": user["role"], "department": user.get("department", "General"), "position": user.get("position", "Employee"), "avatar_url": user.get("avatar_url")}

@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "Logged out successfully"}

@auth_router.get("/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    user.pop("password_hash", None)
    user.pop("basic_salary", None)
    return user

@auth_router.get("/password-reset-info")
async def password_reset_info():
    return {"message": "To reset your password, please contact HR department.", "contact_email": "hr@company.com", "contact_method": "Email HR or visit HR office during working hours"}

# ============== ATTENDANCE ROUTES ==============

@attendance_router.post("/clock-in")
async def clock_in(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if is_weekend(today):
        raise HTTPException(status_code=400, detail="Cannot clock in on weekends (Saturday/Sunday)")
    if is_holiday(today):
        raise HTTPException(status_code=400, detail=f"Cannot clock in on holiday: {get_holiday_name(today)}")

    existing = await execute_query(
        "SELECT id FROM attendance WHERE user_id = %s AND date = %s AND clock_out IS NULL", (user["id"], today), fetch_one=True
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already clocked in")

    att_id = await execute_query(
        "INSERT INTO attendance (user_id, user_name, date, clock_in, total_break_minutes) VALUES (%s, %s, %s, %s, 0)",
        (user["id"], user["name"], today, datetime.now(timezone.utc).isoformat()), last_id=True
    )

    return {"id": str(att_id), "user_id": str(user["id"]), "user_name": user["name"], "date": today, "clock_in": datetime.now(timezone.utc).isoformat(), "clock_out": None, "breaks": [], "total_break_minutes": 0}

@attendance_router.post("/clock-out")
async def clock_out(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    attendance = await execute_query(
        "SELECT * FROM attendance WHERE user_id = %s AND date = %s AND clock_out IS NULL", (user["id"], today), fetch_one=True
    )
    if not attendance:
        raise HTTPException(status_code=400, detail="Not clocked in")

    clock_out_time = datetime.now(timezone.utc)

    # End any active break
    active_break = await execute_query(
        "SELECT id, break_start FROM breaks WHERE attendance_id = %s AND break_end IS NULL", (attendance["id"],), fetch_one=True
    )
    if active_break:
        await execute_query("UPDATE breaks SET break_end = %s WHERE id = %s", (clock_out_time.isoformat(), active_break["id"]))

    # Calculate total break minutes
    breaks_list = await execute_query(
        "SELECT break_start, break_end FROM breaks WHERE attendance_id = %s", (attendance["id"],), fetch_all=True
    )
    total_break = 0
    for brk in (breaks_list or []):
        if brk["break_start"] and brk["break_end"]:
            s = datetime.fromisoformat(brk["break_start"])
            e = datetime.fromisoformat(brk["break_end"])
            total_break += (e - s).total_seconds() / 60

    clock_in_time = datetime.fromisoformat(attendance["clock_in"])
    total_time_minutes = (clock_out_time - clock_in_time).total_seconds() / 60
    working_minutes = total_time_minutes - total_break
    working_hours = working_minutes / 60
    is_short_day = 1 if working_hours < REQUIRED_WORK_HOURS else 0

    await execute_query(
        "UPDATE attendance SET clock_out = %s, total_break_minutes = %s, working_hours = %s, is_short_day = %s WHERE id = %s",
        (clock_out_time.isoformat(), int(total_break), round(working_hours, 2), is_short_day, attendance["id"])
    )

    if is_short_day:
        await check_and_deduct_half_day_leave(user["id"])

    breaks_formatted = [{"start": b["break_start"], "end": b["break_end"]} for b in (breaks_list or [])]
    return {"id": str(attendance["id"]), "user_id": str(user["id"]), "user_name": user["name"], "date": today, "clock_in": attendance["clock_in"], "clock_out": clock_out_time.isoformat(), "breaks": breaks_formatted, "total_break_minutes": int(total_break), "working_hours": round(working_hours, 2), "is_short_day": bool(is_short_day)}

async def check_and_deduct_half_day_leave(user_id: int):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).strftime("%Y-%m-%d")

    result = await execute_query(
        "SELECT COUNT(*) as cnt FROM attendance WHERE user_id = %s AND is_short_day = 1 AND date >= %s",
        (user_id, month_start), fetch_one=True
    )
    short_days_count = result["cnt"] if result else 0

    if short_days_count > 0 and short_days_count % SHORT_DAYS_FOR_HALF_LEAVE == 0:
        await execute_query(
            "UPDATE users SET casual_leave = casual_leave - 0.5, half_day_leave = half_day_leave + 0.5 WHERE id = %s", (user_id,)
        )
        await execute_query(
            "INSERT INTO leave_deductions (user_id, type, amount, reason, date) VALUES (%s, %s, %s, %s, %s)",
            (user_id, "half_day_short_work", 0.5, f"Auto-deducted for {SHORT_DAYS_FOR_HALF_LEAVE} short working days", now.isoformat())
        )

@attendance_router.post("/break/start")
async def start_break(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    attendance = await execute_query(
        "SELECT * FROM attendance WHERE user_id = %s AND date = %s AND clock_out IS NULL", (user["id"], today), fetch_one=True
    )
    if not attendance:
        raise HTTPException(status_code=400, detail="Not clocked in")

    active = await execute_query(
        "SELECT id FROM breaks WHERE attendance_id = %s AND break_end IS NULL", (attendance["id"],), fetch_one=True
    )
    if active:
        raise HTTPException(status_code=400, detail="Already on break")

    total_break_used = attendance.get("total_break_minutes", 0) or 0
    if total_break_used >= MAX_BREAK_MINUTES:
        raise HTTPException(status_code=400, detail=f"Break limit reached. Maximum {MAX_BREAK_MINUTES} minutes break allowed per day.")

    await execute_query(
        "INSERT INTO breaks (attendance_id, break_start) VALUES (%s, %s)",
        (attendance["id"], datetime.now(timezone.utc).isoformat())
    )

    breaks_list = await execute_query("SELECT break_start, break_end FROM breaks WHERE attendance_id = %s", (attendance["id"],), fetch_all=True)
    breaks_formatted = [{"start": b["break_start"], "end": b["break_end"]} for b in (breaks_list or [])]

    return {"message": "Break started", "breaks": breaks_formatted, "remaining_break_minutes": MAX_BREAK_MINUTES - total_break_used, "max_break_minutes": MAX_BREAK_MINUTES}

@attendance_router.post("/break/end")
async def end_break(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    attendance = await execute_query(
        "SELECT * FROM attendance WHERE user_id = %s AND date = %s AND clock_out IS NULL", (user["id"], today), fetch_one=True
    )
    if not attendance:
        raise HTTPException(status_code=400, detail="Not clocked in")

    active = await execute_query(
        "SELECT id FROM breaks WHERE attendance_id = %s AND break_end IS NULL", (attendance["id"],), fetch_one=True
    )
    if not active:
        raise HTTPException(status_code=400, detail="Not on break")

    await execute_query("UPDATE breaks SET break_end = %s WHERE id = %s", (datetime.now(timezone.utc).isoformat(), active["id"]))

    breaks_list = await execute_query("SELECT break_start, break_end FROM breaks WHERE attendance_id = %s", (attendance["id"],), fetch_all=True)
    total_break = 0
    for brk in (breaks_list or []):
        if brk["break_start"] and brk["break_end"]:
            s = datetime.fromisoformat(brk["break_start"])
            e = datetime.fromisoformat(brk["break_end"])
            total_break += (e - s).total_seconds() / 60

    await execute_query("UPDATE attendance SET total_break_minutes = %s WHERE id = %s", (int(total_break), attendance["id"]))

    breaks_formatted = [{"start": b["break_start"], "end": b["break_end"]} for b in (breaks_list or [])]
    return {"message": "Break ended", "breaks": breaks_formatted, "total_break_minutes": int(total_break)}

@attendance_router.get("/status")
async def get_attendance_status(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    attendance = await execute_query(
        "SELECT * FROM attendance WHERE user_id = %s AND date = %s ORDER BY id DESC LIMIT 1",
        (user["id"], today), fetch_one=True
    )

    if not attendance:
        return {"clocked_in": False, "on_break": False, "attendance": None, "max_break_minutes": MAX_BREAK_MINUTES, "remaining_break_minutes": MAX_BREAK_MINUTES}

    breaks_list = await execute_query("SELECT break_start, break_end FROM breaks WHERE attendance_id = %s", (attendance["id"],), fetch_all=True)
    breaks_formatted = [{"start": b["break_start"], "end": b["break_end"]} for b in (breaks_list or [])]

    on_break = any(b["end"] is None for b in breaks_formatted)
    total_break_used = attendance.get("total_break_minutes", 0) or 0
    remaining_break = max(0, MAX_BREAK_MINUTES - total_break_used)

    att_data = {
        "user_id": str(attendance["user_id"]),
        "user_name": attendance["user_name"],
        "date": attendance["date"],
        "clock_in": attendance["clock_in"],
        "clock_out": attendance["clock_out"],
        "breaks": breaks_formatted,
        "total_break_minutes": total_break_used,
        "working_hours": attendance.get("working_hours"),
        "is_short_day": bool(attendance.get("is_short_day"))
    }

    return {"clocked_in": attendance.get("clock_out") is None, "on_break": on_break, "attendance": att_data, "max_break_minutes": MAX_BREAK_MINUTES, "remaining_break_minutes": remaining_break}

@attendance_router.get("/history")
async def get_attendance_history(request: Request, limit: int = 30):
    user = await get_current_user(request)
    records = await execute_query(
        "SELECT * FROM attendance WHERE user_id = %s ORDER BY date DESC LIMIT %s",
        (user["id"], limit), fetch_all=True
    )

    result = []
    for rec in (records or []):
        breaks_list = await execute_query("SELECT break_start, break_end FROM breaks WHERE attendance_id = %s", (rec["id"],), fetch_all=True)
        result.append({
            "user_id": str(rec["user_id"]),
            "user_name": rec["user_name"],
            "date": rec["date"],
            "clock_in": rec["clock_in"],
            "clock_out": rec["clock_out"],
            "breaks": [{"start": b["break_start"], "end": b["break_end"]} for b in (breaks_list or [])],
            "total_break_minutes": rec.get("total_break_minutes", 0),
            "working_hours": rec.get("working_hours"),
            "is_short_day": bool(rec.get("is_short_day"))
        })
    return result

@attendance_router.get("/working-hours-summary")
async def get_working_hours_summary(request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).strftime("%Y-%m-%d")

    records = await execute_query(
        "SELECT working_hours, is_short_day FROM attendance WHERE user_id = %s AND date >= %s AND clock_out IS NOT NULL",
        (user["id"], month_start), fetch_all=True
    )

    total_working_hours = sum(r.get("working_hours", 0) or 0 for r in (records or []))
    short_days = sum(1 for r in (records or []) if r.get("is_short_day"))
    count = len(records or [])

    deductions = await execute_query(
        "SELECT amount FROM leave_deductions WHERE user_id = %s AND date >= %s",
        (user["id"], now.replace(day=1).isoformat()), fetch_all=True
    )
    total_deducted = sum(d.get("amount", 0) for d in (deductions or []))

    return {
        "total_working_days": count,
        "total_working_hours": round(total_working_hours, 2),
        "average_hours_per_day": round(total_working_hours / count, 2) if count else 0,
        "short_days_count": short_days,
        "half_days_deducted": total_deducted,
        "required_hours_per_day": REQUIRED_WORK_HOURS,
        "total_hours_per_day": TOTAL_WORK_HOURS,
        "short_days_for_half_leave": SHORT_DAYS_FOR_HALF_LEAVE
    }

@attendance_router.get("/my-shift")
async def get_my_shift(request: Request):
    user = await get_current_user(request)
    shift_key = user.get("shift") or "general"
    shift_info = SHIFTS.get(shift_key, SHIFTS["general"])
    return {"shift": shift_key, "name": shift_info["name"], "start_time": shift_info["start"], "end_time": shift_info["end"]}

# ============== LEAVE ROUTES ==============

@leave_router.get("/balance")
async def get_leave_balance(request: Request):
    user = await get_current_user(request)
    return {"casual": user.get("casual_leave", 12), "sick": user.get("sick_leave", 3), "loss_of_pay": user.get("loss_of_pay", 0)}

@leave_router.post("/request")
async def create_leave_request(leave_data: LeaveRequest, request: Request):
    user = await get_current_user(request)

    start = datetime.strptime(leave_data.start_date, "%Y-%m-%d")
    end = datetime.strptime(leave_data.end_date, "%Y-%m-%d")
    working_days = 0
    current = start
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        if not is_weekend(date_str) and not is_holiday(date_str):
            working_days += 1
        current += timedelta(days=1)

    if working_days == 0:
        raise HTTPException(status_code=400, detail="Selected dates only contain weekends/holidays")

    if leave_data.leave_type != "loss_of_pay":
        leave_field = f"{leave_data.leave_type}_leave"
        current_balance = user.get(leave_field, 0)
        if working_days > current_balance:
            raise HTTPException(status_code=400, detail=f"Insufficient {leave_data.leave_type} leave balance")

    leave_id = await execute_query(
        """INSERT INTO leave_requests (user_id, user_name, user_email, leave_type, start_date, end_date, days, reason, status, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s)""",
        (user["id"], user["name"], user.get("email", ""), leave_data.leave_type, leave_data.start_date, leave_data.end_date, working_days, leave_data.reason, datetime.now(timezone.utc).isoformat()),
        last_id=True
    )

    return {"id": str(leave_id), "user_id": str(user["id"]), "user_name": user["name"], "user_email": user.get("email", ""), "leave_type": leave_data.leave_type, "start_date": leave_data.start_date, "end_date": leave_data.end_date, "days": working_days, "reason": leave_data.reason, "status": "pending", "created_at": datetime.now(timezone.utc).isoformat(), "reviewed_by": None, "reviewed_at": None}

@leave_router.get("/my-requests")
async def get_my_leave_requests(request: Request):
    user = await get_current_user(request)
    rows = await execute_query(
        "SELECT * FROM leave_requests WHERE user_id = %s ORDER BY created_at DESC",
        (user["id"],), fetch_all=True
    )
    result = []
    for r in (rows or []):
        result.append({
            "id": str(r["id"]), "user_id": str(r["user_id"]), "user_name": r["user_name"], "user_email": r["user_email"],
            "leave_type": r["leave_type"], "start_date": r["start_date"], "end_date": r["end_date"],
            "days": r["days"], "reason": r["reason"], "status": r["status"],
            "created_at": r["created_at"], "reviewed_by": r["reviewed_by"], "reviewed_at": r["reviewed_at"]
        })
    return result

@leave_router.delete("/{leave_id}")
async def cancel_leave_request(leave_id: str, request: Request):
    user = await get_current_user(request)
    leave_req = await execute_query("SELECT * FROM leave_requests WHERE id = %s", (int(leave_id),), fetch_one=True)
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if leave_req["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if leave_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")
    await execute_query("DELETE FROM leave_requests WHERE id = %s", (int(leave_id),))
    return {"message": "Leave request cancelled"}

# ============== ADMIN ROUTES ==============

@admin_router.get("/employees")
async def get_all_employees(request: Request):
    await require_admin_or_manager(request)
    rows = await execute_query("SELECT id, email, name, role, department, position, avatar_url, created_at, casual_leave, sick_leave, loss_of_pay, permission_hours, half_day_leave, shift, basic_salary FROM users ORDER BY created_at DESC", fetch_all=True)
    result = []
    for emp in (rows or []):
        e = dict(emp)
        e["id"] = str(e.pop("id"))
        result.append(e)
    return result

@admin_router.post("/employees")
async def create_employee(user_data: UserRegister, request: Request):
    await require_admin(request)
    email = user_data.email.lower()
    existing = await execute_query("SELECT id FROM users WHERE email = %s", (email,), fetch_one=True)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    role = user_data.role if user_data.role in ("employee", "manager") else "employee"
    hashed = hash_password(user_data.password)

    user_id = await execute_query(
        """INSERT INTO users (email, password_hash, name, role, department, position, avatar_url, created_at, casual_leave, sick_leave, loss_of_pay, permission_hours, half_day_leave, shift)
           VALUES (%s, %s, %s, %s, %s, %s, '', %s, 12, 3, 0, %s, 0, '')""",
        (email, hashed, user_data.name, role, user_data.department, user_data.position, datetime.now(timezone.utc).isoformat(), MONTHLY_PERMISSION_HOURS),
        last_id=True
    )

    return {"id": str(user_id), "email": email, "name": user_data.name, "role": role, "department": user_data.department, "position": user_data.position, "avatar_url": "", "casual_leave": 12, "sick_leave": 3, "loss_of_pay": 0, "permission_hours": MONTHLY_PERMISSION_HOURS, "half_day_leave": 0, "shift": ""}

@admin_router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, update_data: EmployeeUpdate, request: Request):
    await require_admin(request)
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")

    # Validate role if being changed
    if "role" in update_dict and update_dict["role"] not in ("employee", "manager", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    set_clause = ", ".join([f"{k} = %s" for k in update_dict])
    values = list(update_dict.values()) + [int(employee_id)]
    await execute_query(f"UPDATE users SET {set_clause} WHERE id = %s", tuple(values))

    emp = await execute_query("SELECT id, email, name, role, department, position, avatar_url, casual_leave, sick_leave, loss_of_pay, permission_hours, half_day_leave, shift, basic_salary FROM users WHERE id = %s", (int(employee_id),), fetch_one=True)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp["id"] = str(emp.pop("id"))
    return emp

@admin_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, request: Request):
    await require_admin(request)
    result = await execute_query("DELETE FROM users WHERE id = %s AND role != 'admin'", (int(employee_id),))
    if result == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deleted"}

@admin_router.post("/employees/{employee_id}/reset-password")
async def reset_employee_password(employee_id: str, data: PasswordReset, request: Request):
    await require_admin(request)
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    hashed = hash_password(data.new_password)
    result = await execute_query("UPDATE users SET password_hash = %s WHERE id = %s AND role != 'admin'", (hashed, int(employee_id)))
    if result == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Password reset successfully"}

@admin_router.post("/employees/{employee_id}/avatar")
async def upload_employee_avatar(employee_id: str, request: Request, file: UploadFile = File(...)):
    await require_admin(request)
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, GIF images allowed")
    
    # Validate file size (max 5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be under 5MB")
    
    # Check employee exists
    emp = await execute_query("SELECT id FROM users WHERE id = %s", (int(employee_id),), fetch_one=True)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Save file
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    filename = f"avatar_{employee_id}.{ext}"
    filepath = UPLOAD_DIR / filename
    
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Build URL - use FRONTEND_URL for production compatibility
    avatar_url = f"/uploads/avatars/{filename}"
    
    await execute_query("UPDATE users SET avatar_url = %s WHERE id = %s", (avatar_url, int(employee_id)))
    
    return {"message": "Avatar uploaded", "avatar_url": avatar_url}

@admin_router.get("/leave-requests")
async def get_all_leave_requests(request: Request, status: Optional[str] = None):
    user = await require_admin_or_manager(request)
    query = "SELECT * FROM leave_requests"
    args = []
    conditions = []
    if status:
        conditions.append("status = %s")
        args.append(status)
    # Managers only see leave requests from their department employees
    if user["role"] == "manager":
        conditions.append("user_id IN (SELECT id FROM users WHERE department = %s)")
        args.append(user.get("department", ""))
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY created_at DESC"
    rows = await execute_query(query, tuple(args) if args else None, fetch_all=True)
    result = []
    for r in (rows or []):
        d = dict(r)
        d["id"] = str(d.pop("id"))
        d["user_id"] = str(d["user_id"])
        result.append(d)
    return result

@admin_router.put("/leave-requests/{leave_id}")
async def review_leave_request(leave_id: str, request: Request, action: str):
    reviewer = await require_admin_or_manager(request)
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Invalid action")

    leave_req = await execute_query("SELECT * FROM leave_requests WHERE id = %s", (int(leave_id),), fetch_one=True)
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if leave_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Leave request already processed")

    new_status = "approved" if action == "approve" else "rejected"
    await execute_query(
        "UPDATE leave_requests SET status = %s, reviewed_by = %s, reviewed_at = %s WHERE id = %s",
        (new_status, reviewer["name"], datetime.now(timezone.utc).isoformat(), int(leave_id))
    )

    if action == "approve":
        if leave_req["leave_type"] == "loss_of_pay":
            await execute_query("UPDATE users SET loss_of_pay = loss_of_pay + %s WHERE id = %s", (leave_req["days"], leave_req["user_id"]))
        else:
            leave_field = f"{leave_req['leave_type']}_leave"
            await execute_query(f"UPDATE users SET {leave_field} = {leave_field} - %s WHERE id = %s", (leave_req["days"], leave_req["user_id"]))

    return {"message": f"Leave request {new_status}"}

@admin_router.get("/attendance")
async def get_all_attendance(request: Request, date: Optional[str] = None):
    await require_admin_or_manager(request)
    query = "SELECT * FROM attendance"
    args = []
    if date:
        query += " WHERE date = %s"
        args.append(date)
    query += " ORDER BY date DESC LIMIT 1000"
    rows = await execute_query(query, tuple(args) if args else None, fetch_all=True)

    result = []
    for rec in (rows or []):
        breaks_list = await execute_query("SELECT break_start, break_end FROM breaks WHERE attendance_id = %s", (rec["id"],), fetch_all=True)
        result.append({
            "user_id": str(rec["user_id"]), "user_name": rec["user_name"], "date": rec["date"],
            "clock_in": rec["clock_in"], "clock_out": rec["clock_out"],
            "breaks": [{"start": b["break_start"], "end": b["break_end"]} for b in (breaks_list or [])],
            "total_break_minutes": rec.get("total_break_minutes", 0),
            "working_hours": rec.get("working_hours"), "is_short_day": bool(rec.get("is_short_day"))
        })
    return result

@admin_router.get("/analytics")
async def get_analytics(request: Request):
    await require_admin_or_manager(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    total_emp = await execute_query("SELECT COUNT(*) as cnt FROM users WHERE role IN ('employee', 'manager')", fetch_one=True)
    present = await execute_query("SELECT COUNT(*) as cnt FROM attendance WHERE date = %s", (today,), fetch_one=True)
    pending = await execute_query("SELECT COUNT(*) as cnt FROM leave_requests WHERE status = 'pending'", fetch_one=True)

    # On break
    today_att = await execute_query("SELECT id FROM attendance WHERE date = %s AND clock_out IS NULL", (today,), fetch_all=True)
    on_break = 0
    for att in (today_att or []):
        ab = await execute_query("SELECT id FROM breaks WHERE attendance_id = %s AND break_end IS NULL", (att["id"],), fetch_one=True)
        if ab:
            on_break += 1

    # Department breakdown
    dept = await execute_query("SELECT department, COUNT(*) as count FROM users WHERE role IN ('employee', 'manager') GROUP BY department", fetch_all=True)

    total = total_emp["cnt"] if total_emp else 0
    return {
        "total_employees": total,
        "present_today": present["cnt"] if present else 0,
        "absent_today": total - (present["cnt"] if present else 0),
        "pending_leaves": pending["cnt"] if pending else 0,
        "on_break": on_break,
        "department_breakdown": [{"department": d["department"], "count": d["count"]} for d in (dept or [])]
    }

# ============== PERMISSION ROUTES ==============

@permission_router.get("/balance")
async def get_permission_balance(request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).strftime("%Y-%m-%d")

    rows = await execute_query(
        "SELECT duration_minutes FROM permissions WHERE user_id = %s AND date >= %s AND status IN ('approved', 'pending')",
        (user["id"], month_start), fetch_all=True
    )
    used_minutes = sum(r["duration_minutes"] for r in (rows or []))
    return {
        "monthly_allowance_hours": MONTHLY_PERMISSION_HOURS, "used_minutes": used_minutes,
        "used_hours": used_minutes / 60, "remaining_minutes": (MONTHLY_PERMISSION_HOURS * 60) - used_minutes,
        "remaining_hours": MONTHLY_PERMISSION_HOURS - (used_minutes / 60), "max_per_use_minutes": MAX_PERMISSION_PER_USE * 60
    }

@permission_router.post("/request")
async def request_permission(perm_data: PermissionRequest, request: Request):
    user = await get_current_user(request)
    if perm_data.duration_minutes > MAX_PERMISSION_PER_USE * 60:
        raise HTTPException(status_code=400, detail=f"Maximum permission duration is {MAX_PERMISSION_PER_USE} hour(s)")
    if perm_data.duration_minutes <= 0:
        raise HTTPException(status_code=400, detail="Invalid duration")

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    rows = await execute_query(
        "SELECT duration_minutes FROM permissions WHERE user_id = %s AND date >= %s AND status IN ('approved', 'pending')",
        (user["id"], month_start), fetch_all=True
    )
    used_minutes = sum(r["duration_minutes"] for r in (rows or []))
    remaining = (MONTHLY_PERMISSION_HOURS * 60) - used_minutes
    if perm_data.duration_minutes > remaining:
        raise HTTPException(status_code=400, detail=f"Insufficient permission balance. Remaining: {remaining} minutes")

    perm_id = await execute_query(
        "INSERT INTO permissions (user_id, user_name, user_email, duration_minutes, reason, date, status, created_at) VALUES (%s, %s, %s, %s, %s, %s, 'pending', %s)",
        (user["id"], user["name"], user.get("email", ""), perm_data.duration_minutes, perm_data.reason, perm_data.date, now.isoformat()),
        last_id=True
    )
    return {"id": str(perm_id), "user_id": str(user["id"]), "user_name": user["name"], "user_email": user.get("email", ""), "duration_minutes": perm_data.duration_minutes, "reason": perm_data.reason, "date": perm_data.date, "status": "pending", "created_at": now.isoformat(), "reviewed_by": None, "reviewed_at": None}

@permission_router.get("/my-requests")
async def get_my_permissions(request: Request):
    user = await get_current_user(request)
    rows = await execute_query("SELECT * FROM permissions WHERE user_id = %s ORDER BY created_at DESC", (user["id"],), fetch_all=True)
    result = []
    for r in (rows or []):
        d = dict(r)
        d["id"] = str(d.pop("id"))
        d["user_id"] = str(d["user_id"])
        result.append(d)
    return result

@permission_router.delete("/{permission_id}")
async def cancel_permission(permission_id: str, request: Request):
    user = await get_current_user(request)
    perm = await execute_query("SELECT * FROM permissions WHERE id = %s", (int(permission_id),), fetch_one=True)
    if not perm:
        raise HTTPException(status_code=404, detail="Permission request not found")
    if perm["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if perm["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")
    await execute_query("DELETE FROM permissions WHERE id = %s", (int(permission_id),))
    return {"message": "Permission request cancelled"}

@admin_router.get("/permissions")
async def get_all_permissions(request: Request, status: Optional[str] = None):
    user = await require_admin_or_manager(request)
    query = "SELECT * FROM permissions"
    args = []
    conditions = []
    if status:
        conditions.append("status = %s")
        args.append(status)
    if user["role"] == "manager":
        conditions.append("user_id IN (SELECT id FROM users WHERE department = %s)")
        args.append(user.get("department", ""))
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY created_at DESC"
    rows = await execute_query(query, tuple(args) if args else None, fetch_all=True)
    result = []
    for r in (rows or []):
        d = dict(r)
        d["id"] = str(d.pop("id"))
        d["user_id"] = str(d["user_id"])
        result.append(d)
    return result

@admin_router.put("/permissions/{permission_id}")
async def review_permission(permission_id: str, request: Request, action: str):
    reviewer = await require_admin_or_manager(request)
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Invalid action")
    perm = await execute_query("SELECT * FROM permissions WHERE id = %s", (int(permission_id),), fetch_one=True)
    if not perm:
        raise HTTPException(status_code=404, detail="Permission request not found")
    if perm["status"] != "pending":
        raise HTTPException(status_code=400, detail="Permission already processed")
    new_status = "approved" if action == "approve" else "rejected"
    await execute_query(
        "UPDATE permissions SET status = %s, reviewed_by = %s, reviewed_at = %s WHERE id = %s",
        (new_status, reviewer["name"], datetime.now(timezone.utc).isoformat(), int(permission_id))
    )
    return {"message": f"Permission request {new_status}"}

# ============== PAYSLIP ROUTES ==============

@payslip_router.get("/my-payslips")
async def get_my_payslips(request: Request):
    user = await get_current_user(request)
    rows = await execute_query("SELECT * FROM payslips WHERE employee_id = %s ORDER BY created_at DESC", (user["id"],), fetch_all=True)
    result = []
    for ps in (rows or []):
        d = dict(ps)
        d["id"] = str(d.pop("id"))
        d["employee_id"] = str(d["employee_id"])
        if isinstance(d.get("deduction_details"), str):
            d["deduction_details"] = json.loads(d["deduction_details"])
        result.append(d)
    return result

@payslip_router.get("/download/{payslip_id}")
async def download_payslip(payslip_id: str, request: Request):
    user = await get_current_user(request)
    payslip = await execute_query("SELECT * FROM payslips WHERE id = %s", (int(payslip_id),), fetch_one=True)
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    if payslip["employee_id"] != user["id"] and user.get("role") not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Not authorized")

    ps = dict(payslip)
    if isinstance(ps.get("deduction_details"), str):
        ps["deduction_details"] = json.loads(ps["deduction_details"])
    pdf_buffer = generate_payslip_pdf(ps)
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=payslip_{ps['month']}_{ps['year']}.pdf"})

def generate_payslip_pdf(payslip: dict) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=50, bottomMargin=50)
    elements = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=1, spaceAfter=20)
    elements.append(Paragraph("PAYSLIP", title_style))
    elements.append(Spacer(1, 10))

    company_style = ParagraphStyle('Company', parent=styles['Normal'], alignment=1, fontSize=10)
    elements.append(Paragraph("HR Portal Company", company_style))
    elements.append(Paragraph(f"Payslip for {payslip['month_name']} {payslip['year']}", company_style))
    elements.append(Spacer(1, 20))

    emp_data = [
        ["Employee Name:", payslip['employee_name']],
        ["Employee ID:", str(payslip['employee_id'])],
        ["Department:", payslip.get('department', 'N/A')],
        ["Position:", payslip.get('position', 'N/A')],
        ["Pay Period:", f"{payslip['month_name']} {payslip['year']}"],
    ]
    emp_table = Table(emp_data, colWidths=[2*inch, 4*inch])
    emp_table.setStyle(TableStyle([('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    elements.append(emp_table)
    elements.append(Spacer(1, 20))

    elements.append(Paragraph("EARNINGS", styles['Heading2']))
    earnings_data = [["Description", "Amount"], ["Basic Salary", f"{payslip['basic_salary']:,.2f}"]]
    earnings_table = Table(earnings_data, colWidths=[4*inch, 2*inch])
    earnings_table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.grey), ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke), ('ALIGN', (1, 0), (1, -1), 'RIGHT'), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 8), ('GRID', (0, 0), (-1, -1), 1, colors.black)]))
    elements.append(earnings_table)
    elements.append(Spacer(1, 15))

    elements.append(Paragraph("DEDUCTIONS", styles['Heading2']))
    deductions_data = [["Description", "Amount"]]
    for ded in payslip.get('deduction_details', []):
        deductions_data.append([ded['description'], f"{ded['amount']:,.2f}"])
    deductions_data.append(["Total Deductions", f"{payslip['total_deductions']:,.2f}"])
    ded_table = Table(deductions_data, colWidths=[4*inch, 2*inch])
    ded_table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.grey), ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke), ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey), ('ALIGN', (1, 0), (1, -1), 'RIGHT'), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 8), ('GRID', (0, 0), (-1, -1), 1, colors.black)]))
    elements.append(ded_table)
    elements.append(Spacer(1, 20))

    net_data = [["NET PAY", f"{payslip['net_pay']:,.2f}"]]
    net_table = Table(net_data, colWidths=[4*inch, 2*inch])
    net_table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#002FA7')), ('TEXTCOLOR', (0, 0), (-1, -1), colors.whitesmoke), ('ALIGN', (1, 0), (1, -1), 'RIGHT'), ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 12), ('PADDING', (0, 0), (-1, -1), 12)]))
    elements.append(net_table)
    elements.append(Spacer(1, 30))

    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=1, textColor=colors.grey)
    elements.append(Paragraph(f"Generated on {datetime.now().strftime('%B %d, %Y')}", footer_style))
    elements.append(Paragraph("This is a computer-generated payslip and does not require a signature.", footer_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer

# Admin Payslip Routes
@admin_router.put("/employees/{employee_id}/salary")
async def set_employee_salary(employee_id: str, salary_data: SalaryUpdate, request: Request):
    await require_admin(request)
    result = await execute_query("UPDATE users SET basic_salary = %s WHERE id = %s", (salary_data.basic_salary, int(employee_id)))
    if result == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Salary updated successfully"}

@admin_router.get("/employees/{employee_id}/salary")
async def get_employee_salary(employee_id: str, request: Request):
    await require_admin(request)
    emp = await execute_query("SELECT basic_salary FROM users WHERE id = %s", (int(employee_id),), fetch_one=True)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"basic_salary": emp.get("basic_salary", 0) or 0}

@admin_router.post("/payslip/generate")
async def generate_payslip(data: PayslipGenerate, request: Request):
    admin = await require_admin(request)
    employee = await execute_query("SELECT * FROM users WHERE id = %s", (int(data.employee_id),), fetch_one=True)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    basic_salary = employee.get("basic_salary", 0) or 0
    if basic_salary <= 0:
        raise HTTPException(status_code=400, detail="Employee salary not set")

    existing = await execute_query("SELECT id FROM payslips WHERE employee_id = %s AND month = %s AND year = %s", (int(data.employee_id), data.month, data.year), fetch_one=True)
    if existing:
        raise HTTPException(status_code=400, detail="Payslip already exists for this month")

    deductions = []
    total_deductions = 0
    month_start = datetime(data.year, data.month, 1, tzinfo=timezone.utc)
    month_end = datetime(data.year + 1, 1, 1, tzinfo=timezone.utc) if data.month == 12 else datetime(data.year, data.month + 1, 1, tzinfo=timezone.utc)
    per_day_salary = basic_salary / WORKING_DAYS_PER_MONTH
    half_day_salary = per_day_salary / 2

    # Half-day deductions
    leave_deds = await execute_query(
        "SELECT amount FROM leave_deductions WHERE user_id = %s AND date >= %s AND date < %s",
        (int(data.employee_id), month_start.isoformat(), month_end.isoformat()), fetch_all=True
    )
    half_day_amount = sum(d.get("amount", 0) for d in (leave_deds or []))
    if half_day_amount > 0:
        amount = half_day_amount * half_day_salary
        deductions.append({"description": f"Half-day deduction ({half_day_amount} days)", "amount": round(amount, 2)})
        total_deductions += amount

    # LOP deductions
    lop_leaves = await execute_query(
        "SELECT days FROM leave_requests WHERE user_id = %s AND status = 'approved' AND leave_type = 'loss_of_pay' AND start_date >= %s AND start_date < %s",
        (int(data.employee_id), month_start.strftime("%Y-%m-%d"), month_end.strftime("%Y-%m-%d")), fetch_all=True
    )
    lop_days = sum(leave.get("days", 0) for leave in (lop_leaves or []))
    if lop_days > 0:
        lop_amount = lop_days * per_day_salary
        deductions.append({"description": f"Loss of Pay ({lop_days} days)", "amount": round(lop_amount, 2)})
        total_deductions += lop_amount

    month_names = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    net_pay = basic_salary - total_deductions

    payslip_id = await execute_query(
        """INSERT INTO payslips (employee_id, employee_name, employee_email, department, position, month, year, month_name, basic_salary, deduction_details, total_deductions, net_pay, generated_by, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (int(data.employee_id), employee["name"], employee.get("email", ""), employee.get("department", ""), employee.get("position", ""),
         data.month, data.year, month_names[data.month], basic_salary, json.dumps(deductions), round(total_deductions, 2), round(net_pay, 2),
         admin["name"], datetime.now(timezone.utc).isoformat()),
        last_id=True
    )

    return {"id": str(payslip_id), "employee_id": str(data.employee_id), "employee_name": employee["name"], "month": data.month, "year": data.year, "month_name": month_names[data.month], "basic_salary": basic_salary, "deduction_details": deductions, "total_deductions": round(total_deductions, 2), "net_pay": round(net_pay, 2), "generated_by": admin["name"], "created_at": datetime.now(timezone.utc).isoformat()}

@admin_router.get("/payslips")
async def get_all_payslips(request: Request, month: Optional[int] = None, year: Optional[int] = None):
    await require_admin(request)
    query = "SELECT * FROM payslips"
    conditions = []
    args = []
    if month:
        conditions.append("month = %s")
        args.append(month)
    if year:
        conditions.append("year = %s")
        args.append(year)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY created_at DESC"
    rows = await execute_query(query, tuple(args) if args else None, fetch_all=True)
    result = []
    for ps in (rows or []):
        d = dict(ps)
        d["id"] = str(d.pop("id"))
        d["employee_id"] = str(d["employee_id"])
        if isinstance(d.get("deduction_details"), str):
            d["deduction_details"] = json.loads(d["deduction_details"])
        result.append(d)
    return result

@admin_router.delete("/payslips/{payslip_id}")
async def delete_payslip(payslip_id: str, request: Request):
    await require_admin(request)
    result = await execute_query("DELETE FROM payslips WHERE id = %s", (int(payslip_id),))
    if result == 0:
        raise HTTPException(status_code=404, detail="Payslip not found")
    return {"message": "Payslip deleted"}

# ============== SHIFT ROUTES ==============

@admin_router.get("/shifts")
async def get_shifts(request: Request):
    await require_admin(request)
    return SHIFTS

@admin_router.put("/employees/{employee_id}/shift")
async def assign_shift(employee_id: str, shift_data: ShiftAssign, request: Request):
    await require_admin(request)
    if shift_data.shift not in SHIFTS:
        raise HTTPException(status_code=400, detail=f"Invalid shift. Available: {list(SHIFTS.keys())}")
    employee = await execute_query("SELECT shift FROM users WHERE id = %s", (int(employee_id),), fetch_one=True)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if employee.get("shift") and employee.get("shift") != "":
        raise HTTPException(status_code=400, detail="Shift already assigned and cannot be changed. Contact HR for shift changes.")
    await execute_query("UPDATE users SET shift = %s WHERE id = %s", (shift_data.shift, int(employee_id)))
    return {"message": f"Shift '{SHIFTS[shift_data.shift]['name']}' assigned successfully"}

@admin_router.put("/employees/{employee_id}/shift/change")
async def change_shift(employee_id: str, shift_data: ShiftAssign, request: Request):
    await require_admin(request)
    if shift_data.shift not in SHIFTS:
        raise HTTPException(status_code=400, detail=f"Invalid shift. Available: {list(SHIFTS.keys())}")
    result = await execute_query("UPDATE users SET shift = %s WHERE id = %s", (shift_data.shift, int(employee_id)))
    if result == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": f"Shift changed to '{SHIFTS[shift_data.shift]['name']}'"}

# ============== REPORTS ==============

@reports_router.get("/attendance/export")
async def export_attendance_report(request: Request, start_date: str, end_date: str, employee_id: Optional[str] = None):
    await require_admin(request)
    query = "SELECT * FROM attendance WHERE date >= %s AND date <= %s"
    args = [start_date, end_date]
    if employee_id:
        query += " AND user_id = %s"
        args.append(int(employee_id))
    query += " ORDER BY date ASC, user_name ASC"
    records = await execute_query(query, tuple(args), fetch_all=True)

    wb = Workbook()
    ws = wb.active
    ws.title = "Attendance Report"
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="002FA7", end_color="002FA7", fill_type="solid")
    thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

    headers = ["Employee Name", "Date", "Clock In", "Clock Out", "Working Hours", "Break Time (min)", "Short Day", "Total Hours"]
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
        cell.border = thin_border

    total_hours_all = 0
    for row_num, record in enumerate(records or [], 2):
        clock_in = datetime.fromisoformat(record["clock_in"]).strftime("%I:%M %p") if record.get("clock_in") else "-"
        clock_out = datetime.fromisoformat(record["clock_out"]).strftime("%I:%M %p") if record.get("clock_out") else "-"
        wh = record.get("working_hours", 0) or 0
        total_hours_all += wh
        row_data = [record.get("user_name", ""), record.get("date", ""), clock_in, clock_out, f"{wh:.2f}" if wh else "-", record.get("total_break_minutes", 0), "Yes" if record.get("is_short_day") else "No", f"{wh:.2f}" if wh else "-"]
        for col, value in enumerate(row_data, 1):
            cell = ws.cell(row=row_num, column=col, value=value)
            cell.border = thin_border

    for w, c in [('A', 20), ('B', 12), ('C', 12), ('D', 12), ('E', 15), ('F', 15), ('G', 12), ('H', 12)]:
        ws.column_dimensions[w].width = c

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename=attendance_{start_date}_to_{end_date}.xlsx"})

# ============== HOLIDAY ROUTES ==============

@holidays_router.get("/list")
async def get_holidays():
    return HOLIDAYS

@holidays_router.get("/check/{date}")
async def check_date(date: str):
    weekend = is_weekend(date)
    holiday = is_holiday(date)
    return {"date": date, "is_weekend": weekend, "is_holiday": holiday, "holiday_name": get_holiday_name(date) if holiday else "", "is_working_day": not weekend and not holiday}

# ============== INCLUDE ROUTERS ==============

api_router.include_router(auth_router)
api_router.include_router(attendance_router)
api_router.include_router(leave_router)
api_router.include_router(admin_router)
api_router.include_router(employees_router)
api_router.include_router(permission_router)
api_router.include_router(payslip_router)
api_router.include_router(reports_router)
api_router.include_router(holidays_router)

@api_router.get("/")
async def root():
    return {"message": "HR Portal API"}

@api_router.get("/health")
async def health_check():
    """Health check endpoint to verify DB connection"""
    try:
        result = await execute_query("SELECT COUNT(*) as cnt FROM users", fetch_one=True)
        return {"status": "ok", "database": "connected", "users_count": result["cnt"] if result else 0}
    except Exception as e:
        return {"status": "error", "database": "disconnected", "error": str(e)}

app.include_router(api_router)

# CORS - Allow frontend URL
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
allowed_origins = [frontend_url]
# Also allow without trailing slash
if frontend_url.endswith("/"):
    allowed_origins.append(frontend_url.rstrip("/"))
else:
    allowed_origins.append(frontend_url + "/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== DATABASE INIT ==============

async def init_database():
    p = await get_pool()
    async with p.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    role ENUM('admin', 'manager', 'employee') DEFAULT 'employee',
                    department VARCHAR(255) DEFAULT 'General',
                    position VARCHAR(255) DEFAULT 'Employee',
                    avatar_url TEXT,
                    created_at VARCHAR(64),
                    casual_leave FLOAT DEFAULT 12,
                    sick_leave FLOAT DEFAULT 3,
                    loss_of_pay FLOAT DEFAULT 0,
                    permission_hours FLOAT DEFAULT 2,
                    half_day_leave FLOAT DEFAULT 0,
                    shift VARCHAR(50) DEFAULT '',
                    basic_salary FLOAT DEFAULT 0
                )
            """)
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS attendance (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    user_name VARCHAR(255),
                    date VARCHAR(20),
                    clock_in VARCHAR(64),
                    clock_out VARCHAR(64),
                    total_break_minutes INT DEFAULT 0,
                    working_hours FLOAT,
                    is_short_day TINYINT DEFAULT 0,
                    INDEX idx_user_date (user_id, date)
                )
            """)
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS breaks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    attendance_id INT NOT NULL,
                    break_start VARCHAR(64),
                    break_end VARCHAR(64),
                    INDEX idx_attendance (attendance_id)
                )
            """)
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS leave_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    user_name VARCHAR(255),
                    user_email VARCHAR(255),
                    leave_type VARCHAR(50),
                    start_date VARCHAR(20),
                    end_date VARCHAR(20),
                    days INT DEFAULT 0,
                    reason TEXT,
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at VARCHAR(64),
                    reviewed_by VARCHAR(255),
                    reviewed_at VARCHAR(64),
                    INDEX idx_user_status (user_id, status)
                )
            """)
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS permissions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    user_name VARCHAR(255),
                    user_email VARCHAR(255),
                    duration_minutes INT,
                    reason TEXT,
                    date VARCHAR(20),
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at VARCHAR(64),
                    reviewed_by VARCHAR(255),
                    reviewed_at VARCHAR(64),
                    INDEX idx_user_date (user_id, date)
                )
            """)
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS payslips (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    employee_id INT NOT NULL,
                    employee_name VARCHAR(255),
                    employee_email VARCHAR(255),
                    department VARCHAR(255),
                    position VARCHAR(255),
                    month INT,
                    year INT,
                    month_name VARCHAR(20),
                    basic_salary FLOAT,
                    deduction_details TEXT,
                    total_deductions FLOAT DEFAULT 0,
                    net_pay FLOAT DEFAULT 0,
                    generated_by VARCHAR(255),
                    created_at VARCHAR(64),
                    UNIQUE KEY uk_emp_month_year (employee_id, month, year)
                )
            """)
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS leave_deductions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    type VARCHAR(50),
                    amount FLOAT,
                    reason TEXT,
                    date VARCHAR(64)
                )
            """)

@app.on_event("startup")
async def startup():
    import traceback
    try:
        logger.info("Connecting to MySQL...")
        logger.info(f"  Host: {os.environ.get('MYSQL_HOST', 'localhost')}")
        logger.info(f"  Port: {os.environ.get('MYSQL_PORT', '3306')}")
        logger.info(f"  Database: {os.environ.get('MYSQL_DB', 'hr_portal')}")
        logger.info(f"  User: {os.environ.get('MYSQL_USER', 'hruser')}")

        await init_database()
        logger.info("All tables created/verified successfully")

        # Seed admin
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@hrportal.com")
        admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")

        existing = await execute_query("SELECT id, password_hash FROM users WHERE email = %s", (admin_email,), fetch_one=True)
        if existing is None:
            hashed = hash_password(admin_password)
            await execute_query(
                """INSERT INTO users (email, password_hash, name, role, department, position, avatar_url, created_at, casual_leave, sick_leave, loss_of_pay)
                   VALUES (%s, %s, 'Admin', 'admin', 'Administration', 'System Admin', '', %s, 12, 3, 0)""",
                (admin_email, hashed, datetime.now(timezone.utc).isoformat())
            )
            logger.info(f"Admin user created: {admin_email} / {admin_password}")
        elif not verify_password(admin_password, existing["password_hash"]):
            await execute_query("UPDATE users SET password_hash = %s WHERE email = %s", (hash_password(admin_password), admin_email))
            logger.info("Admin password updated")
        else:
            logger.info(f"Admin user exists: {admin_email}")

        # Verify admin can login
        admin_check = await execute_query("SELECT id, email, role FROM users WHERE email = %s AND role = 'admin'", (admin_email,), fetch_one=True)
        if admin_check:
            logger.info(f"Admin login ready - Email: {admin_email}, Password: {admin_password}")
        else:
            logger.error("CRITICAL: Admin user not found after seeding!")

    except Exception as e:
        logger.error(f"STARTUP ERROR: {str(e)}")
        logger.error(traceback.format_exc())
        logger.error("Make sure MySQL is running and .env has correct MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB")

@app.on_event("shutdown")
async def shutdown():
    global pool
    if pool:
        pool.close()
        await pool.wait_closed()
