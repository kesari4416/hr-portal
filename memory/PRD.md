# HR Portal - Product Requirements Document

## Original Problem Statement
Build HR portal for login all employees with Leave, Login, logout, break etc. Need frontend dashboard for admin and employee login and backend in Python.

## Architecture
- **Backend**: FastAPI (Python) on port 8001
- **Frontend**: React with Tailwind CSS + Shadcn UI on port 3000
- **Database**: MySQL (MariaDB) on localhost:3306 - Database: hr_portal
- **Authentication**: JWT with httpOnly cookies
- **Map**: Leaflet + OpenStreetMap (free, no API key)
- **Geocoding**: Nominatim reverse geocoding (free)

## Role System (3-Tier)
- **Admin**: Full access - manage employees, payslips, shifts, approve leaves/permissions/CRs, attendance export, office settings
- **Manager**: Can approve/reject leaves, permissions, and CRs (step 1)
- **Employee**: Clock in/out, breaks, leave/permission/WFH/CR requests, view payslips, salary structure

## Working Time Rules
- Minimum working hours: 8 hours/day
- Break allowance: 40 minutes (Lunch & break) — breaks within 40 min are not deducted
- Short day: < 8 hours = short day, 3 short days = 0.5 day casual leave deduction
- Flexible working time

## Location Tracking & Geofencing
- GPS location captured on clock-in, clock-out, break start, break end (mandatory)
- Reverse geocoded address stored via Nominatim
- Office geofence: configurable lat/lng + radius (default 500m)
- WFH exception: employees with approved WFH can clock in from anywhere
- Admin map view: interactive Leaflet map showing employee locations per day
- Table view: location address + Office/WFH badge per record
- Break location alert: warning badge when employee breaks outside geofence

## Leave Policy
- Casual Leave: 12 days/year (custom per employee)
- Sick Leave: 3 days/year (custom per employee)
- Loss of Pay: Unlimited (salary deducted per day)
- Half-day leave: supported, 1.5 days/month cap

## Change Request (CR) System
- Types: Installation, Maintenance, Software, Hardware, Access, Policy Change, General, Other
- Anyone can raise a CR
- 2-step approval: Manager → Admin

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
- [x] Holiday list + Weekend clock-in blocking
- [x] Custom CL/SL per employee + WFH limits
- [x] Employee ID series SC24XXX auto-generated
- [x] Company Policy feature
- [x] Payroll Module (Dashboard, Deductions, Process, Payslips sub-tabs)
- [x] Employee Salary Tab (Earnings + Deductions + Net)
- [x] Change Request (CR) System (2-step approval)
- [x] GPS Location Tracking (mandatory on all actions, reverse geocoding, geofencing)
- [x] Interactive Map View (Leaflet, office geofence circle, employee markers)
- [x] Office Geofence Settings (admin configurable)
- [x] **Push Notifications** (Aug 27, 2026): Browser Notification API, 30s polling, red badge count, dropdown with navigation
- [x] **Attendance Heatmap** (Aug 27, 2026): 4-week grid in Overview, on-time/late/short/absent color coding per employee
- [x] **Break Location Alert** (Aug 27, 2026): Orange warning badge in attendance table when break taken outside geofence

## Key API Endpoints
- POST /api/attendance/clock-in (requires lat/lng)
- POST /api/attendance/clock-out (requires lat/lng)
- POST /api/attendance/break/start (requires lat/lng)
- POST /api/attendance/break/end (requires lat/lng)
- GET /api/admin/notifications
- GET /api/admin/attendance/heatmap?weeks=4
- GET /api/admin/attendance/break-alerts?date=YYYY-MM-DD
- GET/PUT /api/admin/office-settings
- GET /api/admin/attendance/locations?date=YYYY-MM-DD
- POST /api/cr/create, GET /api/cr/my-requests

## Database Tables (MySQL)
users, attendance, breaks, leave_requests, permissions, payslips, leave_deductions, custom_deductions, payroll_runs, policies, wfh_requests, change_requests, office_settings

## Backlog
- [ ] Refactor server.py into route modules (~2800 lines) - P2
- [ ] Accessibility improvements (aria attributes) - P2
