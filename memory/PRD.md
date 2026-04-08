# HR Portal - Product Requirements Document

## Original Problem Statement
Build HR portal for login all employees with Leave, Login, logout, break etc. Need frontend dashboard for admin and employee login and backend in Python.

## Updated Requirements
- Permission hours: 2 hours/month per employee, max 1 hour per use
- Working hours: 8:30 total, minimum 8 hours required
- Short day policy: Less than 8 hours = short day, 3 short days = 0.5 day casual leave deduction
- Break time: 30 minutes maximum per day
- PDF Payslips via ReportLab
- Attendance export to Excel via OpenPyXL
- Shift management: General, Morning, Afternoon, Night
- Password reset: Contact HR flow on login + Admin-driven reset in dashboard
- Auth: Admin creates employee accounts with email/password (NO Microsoft OAuth, NO email notifications)

## User Choices
- Authentication: JWT-based custom auth (email/password) with httpOnly cookies
- Employee Features: Leave requests, Attendance tracking, Break management, View leave balance, Permission hours
- Admin Features: Approve/reject leave & permissions, View attendance, Manage employees, View analytics, Generate payslips, Export attendance, Assign shifts, Reset employee passwords
- Leave Types: Casual (12), Sick (6), Earned (15)
- Design: Swiss & High-Contrast theme with Outfit font

## Architecture
- **Backend**: FastAPI (Python) on port 8001
- **Frontend**: React with Tailwind CSS + Shadcn UI on port 3000
- **Database**: MongoDB (Motor async driver)
- **Authentication**: JWT with httpOnly cookies

## What's Been Implemented

### Phase 1 (Initial MVP)
- [x] JWT authentication with secure cookies
- [x] Employee dashboard with clock in/out
- [x] Break management (start/end, 30-min limit)
- [x] Leave request submission
- [x] Leave balance tracking
- [x] Admin dashboard with analytics
- [x] Employee management (CRUD)
- [x] Leave approval/rejection

### Phase 2 (Enhanced Features)
- [x] Permission hours tracking (2h/month, max 1h per use)
- [x] Permission request/approval workflow
- [x] Working hours calculation on clock out
- [x] Short day detection (< 8 hours)
- [x] Auto half-day leave deduction (3 short days = 0.5 day)
- [x] Work Summary page with monthly stats
- [x] Progress bar for 8:30 hour target
- [x] Working hours policy display

### Phase 3 (Payslips, Exports, Shifts)
- [x] PDF Payslip generation (ReportLab)
- [x] Attendance export to Excel (OpenPyXL)
- [x] Shift management (General, Morning, Afternoon, Night)
- [x] Salary assignment per employee

### Phase 4 (Auth Cleanup - April 8, 2026)
- [x] Removed Microsoft Outlook OAuth completely (msal, aiohttp, MS routes)
- [x] Admin-driven employee creation with email/password
- [x] Admin password reset endpoint + UI dialog
- [x] Forgot password "Contact HR" dialog on login page
- [x] Employee creation now includes permission_hours, half_day_leave, shift fields

## Prioritized Backlog

### P0 (Critical) - ALL COMPLETED
- [x] All core features implemented

### P1 (High Priority) 
- [x] Password reset functionality (Admin-driven + Contact HR flow)
- [x] Half-day leave logic verified

### P2 (Medium Priority)
- [ ] Accessibility improvements (aria-describedby on dialogs)
- [ ] Refactor server.py into separate route modules

### P3 (Low Priority)
- [ ] Dark mode support
- [ ] Multi-language support
- [ ] Audit logs

## Key API Endpoints
- POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
- POST /api/attendance/clock-in, POST /api/attendance/clock-out
- POST /api/attendance/break/start, POST /api/attendance/break/end
- POST /api/admin/employees, PUT /api/admin/employees/{id}, DELETE /api/admin/employees/{id}
- POST /api/admin/employees/{id}/reset-password
- POST /api/payslips/generate, GET /api/payslips/download/{id}
- GET /api/admin/attendance/export (Excel)
