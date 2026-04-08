# HR Portal - Product Requirements Document

## Original Problem Statement
Build HR portal for login all employees with Leave, Login, logout, break etc. Need frontend dashboard for admin and employee login and backend in Python.

## Architecture
- **Backend**: FastAPI (Python) on port 8001
- **Frontend**: React with Tailwind CSS + Shadcn UI on port 3000
- **Database**: MySQL (MariaDB) on localhost:3306 - Database: hr_portal
- **Authentication**: JWT with httpOnly cookies

## Role System (3-Tier)
- **Admin**: Full access - manage employees, payslips, shifts, approve leaves/permissions, attendance export
- **Manager**: Can approve/reject leaves and permissions for department, view attendance/analytics. Cannot manage employees or payslips
- **Employee**: Clock in/out, breaks, leave/permission requests, view payslips, holidays

## Leave Policy
- Casual Leave: 12 days/year
- Sick Leave: 3 days/year
- Loss of Pay: Unlimited (salary deducted per day)
- Earned Leave: REMOVED
- Short day: < 8 hours = short day, 3 short days = 0.5 day casual leave deduction
- Weekends (Sat/Sun) and public holidays excluded from leave day count

## Holidays (2026)
New Year (Jan 1), Republic Day (Jan 26), Good Friday (Apr 3), Vishu (Apr 14), May Day (May 1), Bakrid (May 27), Independence Day (Aug 15), Onam (Aug 25), Gandhi Jayanti (Oct 2), Vijayadasami (Oct 20), Diwali (Nov 8), Christmas (Dec 25)

## What's Been Implemented
- [x] JWT authentication with httpOnly cookies
- [x] 3-tier role system (Admin, Manager, Employee)
- [x] Employee dashboard: clock in/out, breaks (30-min limit), leave/permission requests
- [x] Admin dashboard: CRUD employees with role selection, analytics, payslips, shifts, attendance export
- [x] Manager dashboard: approve/reject leaves & permissions, view attendance (no employee CRUD or payslips)
- [x] Permission hours: 2h/month, max 1h per use
- [x] PDF Payslip generation (ReportLab)
- [x] Attendance export to Excel (OpenPyXL)
- [x] Shift management (General, Morning, Afternoon, Night)
- [x] Holiday list with Holidays tab in both dashboards
- [x] Weekend (Sat/Sun) clock-in blocking
- [x] Admin password reset for employees
- [x] Loss of Pay leave type
- [x] **MySQL (MariaDB) database migration from MongoDB** (April 8, 2026)
- [x] **3-tier role privileges: Admin, Manager, Employee** (April 8, 2026)

## Key API Endpoints
- POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
- POST /api/attendance/clock-in, POST /api/attendance/clock-out
- POST /api/attendance/break/start, POST /api/attendance/break/end
- GET/POST /api/admin/employees (with role field)
- POST /api/admin/employees/{id}/reset-password
- GET/PUT /api/admin/leave-requests/{id}?action=approve|reject
- GET/PUT /api/admin/permissions/{id}?action=approve|reject
- POST /api/admin/payslip/generate
- GET /api/holidays/list
- GET /api/reports/attendance/export

## Database Tables (MySQL)
users, attendance, breaks, leave_requests, permissions, payslips, leave_deductions

## Backlog
- [ ] Accessibility (aria-describedby on dialogs) - LOW
- [ ] Refactor server.py into route modules - LOW
