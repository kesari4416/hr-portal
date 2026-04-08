from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import secrets

ROOT_DIR = Path(__file__).parent

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
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
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
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

# Create the main app
app = FastAPI()

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth")
employees_router = APIRouter(prefix="/employees")
attendance_router = APIRouter(prefix="/attendance")
leave_router = APIRouter(prefix="/leave")
admin_router = APIRouter(prefix="/admin")
permission_router = APIRouter(prefix="/permission")

# Constants for working hours
REQUIRED_WORK_HOURS = 8.0  # Minimum 8 hours
TOTAL_WORK_HOURS = 8.5  # 8:30 hours total
MONTHLY_PERMISSION_HOURS = 2  # 2 hours per month
MAX_PERMISSION_PER_USE = 1  # Max 1 hour per permission
SHORT_DAYS_FOR_HALF_LEAVE = 3  # 3 short days = 1 half day leave

# Pydantic Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    department: Optional[str] = "General"
    position: Optional[str] = "Employee"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    department: str
    position: str
    avatar_url: Optional[str] = None

class LeaveRequest(BaseModel):
    leave_type: str  # casual, sick, earned
    start_date: str
    end_date: str
    reason: str

class LeaveResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    leave_type: str
    start_date: str
    end_date: str
    reason: str
    status: str
    created_at: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    casual_leave: Optional[int] = None
    sick_leave: Optional[int] = None
    earned_leave: Optional[int] = None
    permission_hours: Optional[float] = None

class PermissionRequest(BaseModel):
    duration_minutes: int  # 60 for 1 hour
    reason: str
    date: str  # YYYY-MM-DD

# Auth Routes
@auth_router.post("/register")
async def register(user_data: UserRegister, response: Response):
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(user_data.password)
    avatar_urls = [
        "https://images.unsplash.com/photo-1762522926157-bcc04bf0b10a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBjb3Jwb3JhdGUlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NTY0NjY4M3ww&ixlib=rb-4.1.0&q=85",
        "https://images.pexels.com/photos/14589344/pexels-photo-14589344.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "https://images.pexels.com/photos/36645466/pexels-photo-36645466.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    ]
    
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": user_data.name,
        "role": "employee",
        "department": user_data.department,
        "position": user_data.position,
        "avatar_url": avatar_urls[hash(email) % len(avatar_urls)],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "casual_leave": 12,
        "sick_leave": 6,
        "earned_leave": 15,
        "permission_hours": MONTHLY_PERMISSION_HOURS,
        "half_day_leave": 0
    }
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email, "employee")
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {
        "id": user_id,
        "email": email,
        "name": user_data.name,
        "role": "employee",
        "department": user_data.department,
        "position": user_data.position,
        "avatar_url": user_doc["avatar_url"]
    }

@auth_router.post("/login")
async def login(user_data: UserLogin, response: Response):
    email = user_data.email.lower()
    user = await db.users.find_one({"email": email})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email, user["role"])
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {
        "id": user_id,
        "email": email,
        "name": user["name"],
        "role": user["role"],
        "department": user.get("department", "General"),
        "position": user.get("position", "Employee"),
        "avatar_url": user.get("avatar_url")
    }

@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "Logged out successfully"}

@auth_router.get("/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

# Attendance Routes
@attendance_router.post("/clock-in")
async def clock_in(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    existing = await db.attendance.find_one({
        "user_id": user["_id"],
        "date": today,
        "clock_out": None
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already clocked in")
    
    attendance = {
        "user_id": user["_id"],
        "user_name": user["name"],
        "date": today,
        "clock_in": datetime.now(timezone.utc).isoformat(),
        "clock_out": None,
        "breaks": [],
        "total_break_minutes": 0
    }
    
    result = await db.attendance.insert_one(attendance)
    attendance["id"] = str(result.inserted_id)
    attendance.pop("_id", None)
    
    return attendance

@attendance_router.post("/clock-out")
async def clock_out(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    attendance = await db.attendance.find_one({
        "user_id": user["_id"],
        "date": today,
        "clock_out": None
    })
    
    if not attendance:
        raise HTTPException(status_code=400, detail="Not clocked in")
    
    clock_out_time = datetime.now(timezone.utc)
    
    # End any active break
    breaks = attendance.get("breaks", [])
    for brk in breaks:
        if brk.get("end") is None:
            brk["end"] = clock_out_time.isoformat()
    
    # Calculate total break minutes
    total_break = 0
    for brk in breaks:
        if brk.get("start") and brk.get("end"):
            start = datetime.fromisoformat(brk["start"])
            end = datetime.fromisoformat(brk["end"])
            total_break += (end - start).total_seconds() / 60
    
    # Calculate total working hours
    clock_in_time = datetime.fromisoformat(attendance["clock_in"])
    total_time_minutes = (clock_out_time - clock_in_time).total_seconds() / 60
    working_minutes = total_time_minutes - total_break
    working_hours = working_minutes / 60
    
    # Check if it's a short day (less than 8 hours)
    is_short_day = working_hours < REQUIRED_WORK_HOURS
    
    await db.attendance.update_one(
        {"_id": attendance["_id"]},
        {"$set": {
            "clock_out": clock_out_time.isoformat(),
            "breaks": breaks,
            "total_break_minutes": int(total_break),
            "working_hours": round(working_hours, 2),
            "is_short_day": is_short_day
        }}
    )
    
    # If short day, check monthly short days and deduct half-day leave if needed
    if is_short_day:
        await check_and_deduct_half_day_leave(user["_id"])
    
    updated = await db.attendance.find_one({"_id": attendance["_id"]}, {"_id": 0})
    updated["id"] = str(attendance["_id"])
    return updated

async def check_and_deduct_half_day_leave(user_id: str):
    """Check if employee has 3 short days this month and deduct half-day leave"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Count short days this month
    short_days_count = await db.attendance.count_documents({
        "user_id": user_id,
        "is_short_day": True,
        "date": {"$gte": month_start.strftime("%Y-%m-%d")}
    })
    
    # For every 3 short days, deduct 0.5 from casual leave
    if short_days_count > 0 and short_days_count % SHORT_DAYS_FOR_HALF_LEAVE == 0:
        # Record the half-day deduction
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$inc": {"casual_leave": -0.5, "half_day_leave": 0.5}}
        )
        
        # Log the deduction
        await db.leave_deductions.insert_one({
            "user_id": user_id,
            "type": "half_day_short_work",
            "amount": 0.5,
            "reason": f"Auto-deducted for {SHORT_DAYS_FOR_HALF_LEAVE} short working days",
            "date": now.isoformat()
        })

@attendance_router.post("/break/start")
async def start_break(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    attendance = await db.attendance.find_one({
        "user_id": user["_id"],
        "date": today,
        "clock_out": None
    })
    
    if not attendance:
        raise HTTPException(status_code=400, detail="Not clocked in")
    
    breaks = attendance.get("breaks", [])
    for brk in breaks:
        if brk.get("end") is None:
            raise HTTPException(status_code=400, detail="Already on break")
    
    breaks.append({"start": datetime.now(timezone.utc).isoformat(), "end": None})
    
    await db.attendance.update_one(
        {"_id": attendance["_id"]},
        {"$set": {"breaks": breaks}}
    )
    
    return {"message": "Break started", "breaks": breaks}

@attendance_router.post("/break/end")
async def end_break(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    attendance = await db.attendance.find_one({
        "user_id": user["_id"],
        "date": today,
        "clock_out": None
    })
    
    if not attendance:
        raise HTTPException(status_code=400, detail="Not clocked in")
    
    breaks = attendance.get("breaks", [])
    active_break = None
    for brk in breaks:
        if brk.get("end") is None:
            brk["end"] = datetime.now(timezone.utc).isoformat()
            active_break = brk
            break
    
    if not active_break:
        raise HTTPException(status_code=400, detail="Not on break")
    
    # Calculate total break minutes
    total_break = 0
    for brk in breaks:
        if brk.get("start") and brk.get("end"):
            start = datetime.fromisoformat(brk["start"])
            end = datetime.fromisoformat(brk["end"])
            total_break += (end - start).total_seconds() / 60
    
    await db.attendance.update_one(
        {"_id": attendance["_id"]},
        {"$set": {"breaks": breaks, "total_break_minutes": int(total_break)}}
    )
    
    return {"message": "Break ended", "breaks": breaks, "total_break_minutes": int(total_break)}

@attendance_router.get("/status")
async def get_attendance_status(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    attendance = await db.attendance.find_one({
        "user_id": user["_id"],
        "date": today
    }, {"_id": 0})
    
    if not attendance:
        return {"clocked_in": False, "on_break": False, "attendance": None}
    
    on_break = False
    for brk in attendance.get("breaks", []):
        if brk.get("end") is None:
            on_break = True
            break
    
    return {
        "clocked_in": attendance.get("clock_out") is None,
        "on_break": on_break,
        "attendance": attendance
    }

@attendance_router.get("/history")
async def get_attendance_history(request: Request, limit: int = 30):
    user = await get_current_user(request)
    
    records = await db.attendance.find(
        {"user_id": user["_id"]},
        {"_id": 0}
    ).sort("date", -1).limit(limit).to_list(limit)
    
    return records

# Leave Routes
@leave_router.get("/balance")
async def get_leave_balance(request: Request):
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"_id": ObjectId(user["_id"])})
    
    return {
        "casual": user_doc.get("casual_leave", 12),
        "sick": user_doc.get("sick_leave", 6),
        "earned": user_doc.get("earned_leave", 15)
    }

@leave_router.post("/request")
async def create_leave_request(leave_data: LeaveRequest, request: Request):
    user = await get_current_user(request)
    
    # Calculate days
    start = datetime.strptime(leave_data.start_date, "%Y-%m-%d")
    end = datetime.strptime(leave_data.end_date, "%Y-%m-%d")
    days = (end - start).days + 1
    
    # Check balance
    user_doc = await db.users.find_one({"_id": ObjectId(user["_id"])})
    leave_field = f"{leave_data.leave_type}_leave"
    current_balance = user_doc.get(leave_field, 0)
    
    if days > current_balance:
        raise HTTPException(status_code=400, detail=f"Insufficient {leave_data.leave_type} leave balance")
    
    leave_doc = {
        "user_id": user["_id"],
        "user_name": user["name"],
        "user_email": user.get("email", ""),
        "leave_type": leave_data.leave_type,
        "start_date": leave_data.start_date,
        "end_date": leave_data.end_date,
        "days": days,
        "reason": leave_data.reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": None,
        "reviewed_at": None
    }
    
    result = await db.leave_requests.insert_one(leave_doc)
    leave_doc["id"] = str(result.inserted_id)
    leave_doc.pop("_id", None)
    
    return leave_doc

@leave_router.get("/my-requests")
async def get_my_leave_requests(request: Request):
    user = await get_current_user(request)
    
    requests = await db.leave_requests.find(
        {"user_id": user["_id"]}
    ).sort("created_at", -1).to_list(100)
    
    result = []
    for req in requests:
        req["id"] = str(req["_id"])
        del req["_id"]
        result.append(req)
    
    return result

@leave_router.delete("/{leave_id}")
async def cancel_leave_request(leave_id: str, request: Request):
    user = await get_current_user(request)
    
    leave_req = await db.leave_requests.find_one({"_id": ObjectId(leave_id)})
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    if leave_req["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if leave_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")
    
    await db.leave_requests.delete_one({"_id": ObjectId(leave_id)})
    return {"message": "Leave request cancelled"}

# Admin Routes
@admin_router.get("/employees")
async def get_all_employees(request: Request):
    await require_admin(request)
    
    employees = await db.users.find(
        {},
        {"password_hash": 0}
    ).to_list(1000)
    
    result = []
    for emp in employees:
        emp["id"] = str(emp["_id"])
        del emp["_id"]
        result.append(emp)
    
    return result

@admin_router.post("/employees")
async def create_employee(user_data: UserRegister, request: Request):
    await require_admin(request)
    
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(user_data.password)
    avatar_urls = [
        "https://images.unsplash.com/photo-1762522926157-bcc04bf0b10a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBjb3Jwb3JhdGUlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NTY0NjY4M3ww&ixlib=rb-4.1.0&q=85",
        "https://images.pexels.com/photos/14589344/pexels-photo-14589344.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "https://images.pexels.com/photos/36645466/pexels-photo-36645466.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    ]
    
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": user_data.name,
        "role": "employee",
        "department": user_data.department,
        "position": user_data.position,
        "avatar_url": avatar_urls[hash(email) % len(avatar_urls)],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "casual_leave": 12,
        "sick_leave": 6,
        "earned_leave": 15
    }
    
    result = await db.users.insert_one(user_doc)
    user_doc["id"] = str(result.inserted_id)
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)
    
    return user_doc

@admin_router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, update_data: EmployeeUpdate, request: Request):
    await require_admin(request)
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.users.update_one(
        {"_id": ObjectId(employee_id)},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee = await db.users.find_one({"_id": ObjectId(employee_id)}, {"password_hash": 0})
    employee["id"] = str(employee["_id"])
    del employee["_id"]
    
    return employee

@admin_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, request: Request):
    await require_admin(request)
    
    result = await db.users.delete_one({"_id": ObjectId(employee_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return {"message": "Employee deleted"}

@admin_router.get("/leave-requests")
async def get_all_leave_requests(request: Request, status: Optional[str] = None):
    await require_admin(request)
    
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.leave_requests.find(query).sort("created_at", -1).to_list(1000)
    
    result = []
    for req in requests:
        req["id"] = str(req["_id"])
        del req["_id"]
        result.append(req)
    
    return result

@admin_router.put("/leave-requests/{leave_id}")
async def review_leave_request(leave_id: str, request: Request, action: str):
    admin = await require_admin(request)
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    leave_req = await db.leave_requests.find_one({"_id": ObjectId(leave_id)})
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    if leave_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Leave request already processed")
    
    new_status = "approved" if action == "approve" else "rejected"
    
    await db.leave_requests.update_one(
        {"_id": ObjectId(leave_id)},
        {"$set": {
            "status": new_status,
            "reviewed_by": admin["name"],
            "reviewed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # If approved, deduct leave balance
    if action == "approve":
        leave_field = f"{leave_req['leave_type']}_leave"
        await db.users.update_one(
            {"_id": ObjectId(leave_req["user_id"])},
            {"$inc": {leave_field: -leave_req["days"]}}
        )
    
    return {"message": f"Leave request {new_status}"}

@admin_router.get("/attendance")
async def get_all_attendance(request: Request, date: Optional[str] = None):
    await require_admin(request)
    
    query = {}
    if date:
        query["date"] = date
    
    records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return records

@admin_router.get("/analytics")
async def get_analytics(request: Request):
    await require_admin(request)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Total employees
    total_employees = await db.users.count_documents({"role": "employee"})
    
    # Present today
    present_today = await db.attendance.count_documents({"date": today})
    
    # Pending leave requests
    pending_leaves = await db.leave_requests.count_documents({"status": "pending"})
    
    # On break
    on_break = 0
    today_attendance = await db.attendance.find({"date": today, "clock_out": None}).to_list(1000)
    for att in today_attendance:
        for brk in att.get("breaks", []):
            if brk.get("end") is None:
                on_break += 1
                break
    
    # Department breakdown
    dept_pipeline = [
        {"$match": {"role": "employee"}},
        {"$group": {"_id": "$department", "count": {"$sum": 1}}}
    ]
    dept_breakdown = await db.users.aggregate(dept_pipeline).to_list(100)
    
    return {
        "total_employees": total_employees,
        "present_today": present_today,
        "absent_today": total_employees - present_today,
        "pending_leaves": pending_leaves,
        "on_break": on_break,
        "department_breakdown": [{"department": d["_id"], "count": d["count"]} for d in dept_breakdown]
    }

# Permission Routes
@permission_router.get("/balance")
async def get_permission_balance(request: Request):
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"_id": ObjectId(user["_id"])})
    
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get used permissions this month
    used_permissions = await db.permissions.find({
        "user_id": user["_id"],
        "date": {"$gte": month_start.strftime("%Y-%m-%d")},
        "status": {"$in": ["approved", "pending"]}
    }).to_list(100)
    
    used_minutes = sum(p.get("duration_minutes", 0) for p in used_permissions)
    
    return {
        "monthly_allowance_hours": MONTHLY_PERMISSION_HOURS,
        "used_minutes": used_minutes,
        "used_hours": used_minutes / 60,
        "remaining_minutes": (MONTHLY_PERMISSION_HOURS * 60) - used_minutes,
        "remaining_hours": MONTHLY_PERMISSION_HOURS - (used_minutes / 60),
        "max_per_use_minutes": MAX_PERMISSION_PER_USE * 60
    }

@permission_router.post("/request")
async def request_permission(perm_data: PermissionRequest, request: Request):
    user = await get_current_user(request)
    
    # Validate duration (max 1 hour per use)
    if perm_data.duration_minutes > MAX_PERMISSION_PER_USE * 60:
        raise HTTPException(status_code=400, detail=f"Maximum permission duration is {MAX_PERMISSION_PER_USE} hour(s)")
    
    if perm_data.duration_minutes <= 0:
        raise HTTPException(status_code=400, detail="Invalid duration")
    
    # Check monthly balance
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    used_permissions = await db.permissions.find({
        "user_id": user["_id"],
        "date": {"$gte": month_start.strftime("%Y-%m-%d")},
        "status": {"$in": ["approved", "pending"]}
    }).to_list(100)
    
    used_minutes = sum(p.get("duration_minutes", 0) for p in used_permissions)
    remaining_minutes = (MONTHLY_PERMISSION_HOURS * 60) - used_minutes
    
    if perm_data.duration_minutes > remaining_minutes:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient permission balance. Remaining: {remaining_minutes} minutes"
        )
    
    perm_doc = {
        "user_id": user["_id"],
        "user_name": user["name"],
        "user_email": user.get("email", ""),
        "duration_minutes": perm_data.duration_minutes,
        "reason": perm_data.reason,
        "date": perm_data.date,
        "status": "pending",
        "created_at": now.isoformat(),
        "reviewed_by": None,
        "reviewed_at": None
    }
    
    result = await db.permissions.insert_one(perm_doc)
    perm_doc["id"] = str(result.inserted_id)
    perm_doc.pop("_id", None)
    
    return perm_doc

@permission_router.get("/my-requests")
async def get_my_permissions(request: Request):
    user = await get_current_user(request)
    
    permissions = await db.permissions.find(
        {"user_id": user["_id"]}
    ).sort("created_at", -1).to_list(100)
    
    result = []
    for perm in permissions:
        perm["id"] = str(perm["_id"])
        del perm["_id"]
        result.append(perm)
    
    return result

@permission_router.delete("/{permission_id}")
async def cancel_permission(permission_id: str, request: Request):
    user = await get_current_user(request)
    
    perm = await db.permissions.find_one({"_id": ObjectId(permission_id)})
    if not perm:
        raise HTTPException(status_code=404, detail="Permission request not found")
    
    if perm["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if perm["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")
    
    await db.permissions.delete_one({"_id": ObjectId(permission_id)})
    return {"message": "Permission request cancelled"}

# Admin Permission Routes
@admin_router.get("/permissions")
async def get_all_permissions(request: Request, status: Optional[str] = None):
    await require_admin(request)
    
    query = {}
    if status:
        query["status"] = status
    
    permissions = await db.permissions.find(query).sort("created_at", -1).to_list(1000)
    
    result = []
    for perm in permissions:
        perm["id"] = str(perm["_id"])
        del perm["_id"]
        result.append(perm)
    
    return result

@admin_router.put("/permissions/{permission_id}")
async def review_permission(permission_id: str, request: Request, action: str):
    admin = await require_admin(request)
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    perm = await db.permissions.find_one({"_id": ObjectId(permission_id)})
    if not perm:
        raise HTTPException(status_code=404, detail="Permission request not found")
    
    if perm["status"] != "pending":
        raise HTTPException(status_code=400, detail="Permission already processed")
    
    new_status = "approved" if action == "approve" else "rejected"
    
    await db.permissions.update_one(
        {"_id": ObjectId(permission_id)},
        {"$set": {
            "status": new_status,
            "reviewed_by": admin["name"],
            "reviewed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Permission request {new_status}"}

# Working hours summary endpoint
@attendance_router.get("/working-hours-summary")
async def get_working_hours_summary(request: Request):
    user = await get_current_user(request)
    
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get this month's attendance
    attendance_records = await db.attendance.find({
        "user_id": user["_id"],
        "date": {"$gte": month_start.strftime("%Y-%m-%d")},
        "clock_out": {"$ne": None}
    }).to_list(100)
    
    total_working_hours = 0
    short_days = 0
    
    for record in attendance_records:
        hours = record.get("working_hours", 0)
        total_working_hours += hours
        if record.get("is_short_day", False):
            short_days += 1
    
    # Get deductions
    deductions = await db.leave_deductions.find({
        "user_id": user["_id"],
        "date": {"$gte": month_start.isoformat()}
    }).to_list(100)
    
    total_deducted = sum(d.get("amount", 0) for d in deductions)
    
    return {
        "total_working_days": len(attendance_records),
        "total_working_hours": round(total_working_hours, 2),
        "average_hours_per_day": round(total_working_hours / len(attendance_records), 2) if attendance_records else 0,
        "short_days_count": short_days,
        "half_days_deducted": total_deducted,
        "required_hours_per_day": REQUIRED_WORK_HOURS,
        "total_hours_per_day": TOTAL_WORK_HOURS,
        "short_days_for_half_leave": SHORT_DAYS_FOR_HALF_LEAVE
    }

# Include routers (MUST be after all route definitions)
api_router.include_router(auth_router)
api_router.include_router(attendance_router)
api_router.include_router(leave_router)
api_router.include_router(admin_router)
api_router.include_router(employees_router)
api_router.include_router(permission_router)

@api_router.get("/")
async def root():
    return {"message": "HR Portal API"}

app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Startup event
@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.attendance.create_index([("user_id", 1), ("date", 1)])
    await db.leave_requests.create_index([("user_id", 1), ("status", 1)])
    
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@hrportal.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "department": "Administration",
            "position": "System Admin",
            "avatar_url": "https://images.unsplash.com/photo-1762522926157-bcc04bf0b10a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBjb3Jwb3JhdGUlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NTY0NjY4M3ww&ixlib=rb-4.1.0&q=85",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "casual_leave": 12,
            "sick_leave": 6,
            "earned_leave": 15
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info("Admin password updated")
    
    # Write test credentials
    creds_path = Path("/app/memory/test_credentials.md")
    creds_path.parent.mkdir(parents=True, exist_ok=True)
    creds_path.write_text(f"""# HR Portal Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
""")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
