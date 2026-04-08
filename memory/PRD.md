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
- Leave Types: Casual (12 days), Sick (12 days), Loss of Pay (unlimited, salary deducted)
- Earned Leave: REMOVED per user request
- Holiday List: 12 public holidays for 2026
- Weekends: Saturday & Sunday are holidays (clock-in blocked)
- Leave calculation: Excludes weekends and holidays from day count

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

### Phase 3 (Payslips, Exports, Shifts)
- [x] PDF Payslip generation (ReportLab)
- [x] Attendance export to Excel (OpenPyXL)
- [x] Shift management (General, Morning, Afternoon, Night)

### Phase 4 (Auth Cleanup - April 8, 2026)
- [x] Removed Microsoft Outlook OAuth
- [x] Admin-driven employee creation with email/password
- [x] Admin password reset endpoint + UI dialog
- [x] Forgot password "Contact HR" dialog

### Phase 5 (Holidays & Leave Updates - April 8, 2026)
- [x] Holiday List: 12 public holidays for 2026 with date/day/festival
- [x] Holidays tab in Employee and Admin dashboards
- [x] Weekend (Sat/Sun) holiday enforcement - clock-in blocked
- [x] Saturday & Sunday info banner
- [x] Sick Leave changed from 6 to 12 days
- [x] Earned Leave REMOVED entirely
- [x] Loss of Pay (LOP) leave type added
- [x] Leave day calculation excludes weekends and holidays
- [x] LOP deduction included in payslip generation

## Key API Endpoints
- POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
- POST /api/attendance/clock-in, POST /api/attendance/clock-out
- POST /api/attendance/break/start, POST /api/attendance/break/end
- POST /api/admin/employees, POST /api/admin/employees/{id}/reset-password
- GET /api/holidays/list, GET /api/holidays/check/{date}
- POST /api/leave/request, GET /api/leave/balance
- POST /api/payslips/generate, GET /api/payslip/my-payslips
- GET /api/admin/attendance/export

## Backlog
- [ ] Accessibility (aria-describedby on dialogs) - LOW
- [ ] Refactor server.py into route modules - LOW
