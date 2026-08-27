# HR Portal - Product Requirements Document

## Original Problem Statement
Build HR portal for login all employees with Leave, Login, logout, break etc. Need frontend dashboard for admin and employee login and backend in Python.

## Architecture
- **Backend**: FastAPI (Python) on port 8001
- **Frontend**: React with Tailwind CSS + Shadcn UI on port 3000
- **Database**: MySQL (MariaDB) on localhost:3306 - Database: hr_portal
- **Authentication**: JWT with httpOnly cookies

## Role System (3-Tier)
- **Admin**: Full access - manage employees, payslips, shifts, approve leaves/permissions/CRs, attendance export
- **Manager**: Can approve/reject leaves, permissions, and CRs (step 1). Cannot manage employees or payslips
- **Employee**: Clock in/out, breaks, leave/permission/WFH/CR requests, view payslips, salary structure

## Working Time Rules
- Minimum working hours: 8 hours/day
- Break allowance: 40 minutes (Lunch & break) — breaks within 40 min are not deducted
- Short day: < 8 hours = short day, 3 short days = 0.5 day casual leave deduction
- Flexible working time (no fixed shift enforcement)

## Leave Policy
- Casual Leave: 12 days/year (custom per employee)
- Sick Leave: 3 days/year (custom per employee)
- Loss of Pay: Unlimited (salary deducted per day)
- Half-day leave: supported, 1.5 days/month cap
- Weekends (Sat/Sun) and public holidays excluded from leave day count

## What's Been Implemented
- [x] JWT authentication with httpOnly cookies (secure for HTTPS)
- [x] 3-tier role system (Admin, Manager, Employee)
- [x] Employee dashboard: clock in/out, breaks (40-min limit), leave/permission requests
- [x] Admin dashboard: CRUD employees, analytics, payroll, shifts, attendance export
- [x] Manager dashboard: approve/reject leaves, permissions, CRs
- [x] Permission hours: 2h/month, max 1h per use
- [x] PDF Payslip generation (ReportLab, Sparkcurv-branded)
- [x] Attendance export to Excel (OpenPyXL)
- [x] Shift management (General, Morning, Afternoon, Night)
- [x] Holiday list
- [x] Weekend clock-in blocking
- [x] Admin password reset for employees
- [x] Loss of Pay leave type
- [x] MySQL database (aiomysql)
- [x] Custom CL/SL per employee
- [x] Work From Home feature with limits
- [x] Employee ID series SC24XXX auto-generated
- [x] Payslip redesigned to match Sparkcurv format
- [x] Cookie secure=True for HTTPS deployments
- [x] Company Policy feature
- [x] **Payroll Module** (Aug 27, 2026): Dashboard (YTD, monthly, dept breakdown), Deductions (PF/ESI/TDS per employee), Bulk Process, Payslips sub-tab
- [x] **Employee Salary Tab** (Aug 27, 2026): Earnings breakdown (Basic, HRA, Medical, Conveyance, Special) + deductions
- [x] **Change Request (CR) System** (Aug 27, 2026): 2-step approval (Manager → Admin), configurable types, employee raise/track
- [x] **Working Time Update** (Aug 27, 2026): 8 hours min + 40 min break allowance

## Key API Endpoints
- POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
- POST /api/attendance/clock-in, POST /api/attendance/clock-out
- POST /api/attendance/break/start, POST /api/attendance/break/end
- GET/POST /api/admin/employees
- POST /api/admin/employees/{id}/reset-password
- GET/PUT /api/admin/leave-requests/{id}?action=approve|reject
- POST /api/admin/payslip/generate
- POST /api/admin/payroll/process (bulk)
- GET /api/admin/payroll/summary
- POST/GET/DELETE /api/admin/deductions
- GET /api/admin/change-requests
- PUT /api/admin/change-requests/{id}/manager-action?action=approve|reject
- PUT /api/admin/change-requests/{id}/admin-action?action=approve|reject
- POST /api/cr/create, GET /api/cr/my-requests, DELETE /api/cr/{id}, GET /api/cr/types
- GET /api/payslip/my-salary-structure
- GET /api/holidays/list
- GET /api/reports/attendance/export

## Database Tables (MySQL)
users, attendance, breaks, leave_requests, permissions, payslips, leave_deductions, custom_deductions, payroll_runs, policies, wfh_requests, change_requests

## Backlog
- [ ] Refactor server.py into route modules (~2500 lines) - P2
- [ ] Accessibility improvements (aria attributes) - P2
