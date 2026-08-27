# Sparkcurv HR Portal — PRD

## Original Problem Statement
Build an HR portal for all employees with Leave, Login, logout, break etc., frontend dashboard for admin and employee login, and backend in Python.

## Product Requirements
- 3-tier roles: Admin, Manager, Employee
- Attendance & hours tracking (8 hours/day minimum, 40 min allowed break)
- Leave logic (Casual, Sick, Half-day support)
- WFH limits/requests
- Custom PDF Payslips
- Shift management + Employee IDs
- Payroll system (custom deductions)
- Change Request (CR) system with 2-step approval (Manager → Admin) + auto-apply
- Geofenced GPS Location Tracking (maps & geocoding via Nominatim + Leaflet)
- Push/Polling Notifications
- Attendance Heatmaps (4-week view, on-time vs late)
- Break Location Alert badge

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI, Leaflet (react-leaflet), @phosphor-icons/react
- **Backend**: FastAPI, Python, JWT Auth
- **Database**: MySQL/MariaDB via `aiomysql` (raw SQL, no ORM)
- **Fonts**: Outfit (headings), Manrope (body), JetBrains Mono (timers)
- **Brand Color**: #002FA7 (deep royal blue)

## Code Architecture
```
/app/
├── backend/
│   ├── server.py              # All routes (>2700 lines, needs refactor)
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── index.css          # Design system + component classes
│   │   ├── contexts/AuthContext.jsx
│   │   └── pages/
│   │       ├── LoginPage.jsx
│   │       ├── EmployeeDashboard.jsx
│   │       └── AdminDashboard.jsx
├── database_setup.sql
└── setup.sh
```

## Key DB Schema
- `users`: {id, employee_code, name, email, role, department, basic_salary, shift}
- `attendance`: {id, user_id, clock_in, clock_out, latitude, longitude, address, break_outside_geofence, working_hours}
- `breaks`: {id, attendance_id, start/end lat/lng, start/end address}
- `leave_requests`: {id, user_id, leave_type, start_date, end_date, is_half_day, status}
- `change_requests`: {id, requester_id, title, description, cr_type, status, manager_approval, admin_approval, metadata}
- `payslips`: {id, user_id, month, year, basic_salary, total_deductions, net_pay}
- `office_settings`: {id, latitude, longitude, radius_km, name}

## What's Been Implemented

### 2025-2026 (all sessions)
- ✅ Email/Password JWT Auth, Role-based routing (Admin/Manager/Employee)
- ✅ Attendance: Clock In/Out, Break, "Short Day" logic (< 8h), 40-min break limit
- ✅ Leave Management: Casual/Sick/Half-day, Admin approval, leave balance deduction
- ✅ WFH requests with approval
- ✅ Permission requests (2h/month limit, max 1h per use)
- ✅ Payroll: Salary setup, Custom deductions, Bulk processing, PDF payslips
- ✅ Change Request (CR) system — 2-step approval flow (Manager → Admin)
- ✅ GPS Geofenced Attendance — mandatory location capture, Nominatim geocoding
- ✅ Interactive Leaflet Map — Admin attendance map view with geofence circle
- ✅ Attendance Heatmap — 4-week overview (on-time/late/absent)
- ✅ Break Location Alert — badge in admin attendance table
- ✅ Polling Notifications — bell with badge for pending approvals
- ✅ Company Policy CRUD
- ✅ Holiday list
- ✅ Admin: Employee management (add/edit/delete/assign shift/set salary/reset password/upload avatar)
- ✅ **GUI Redesign** (Feb 2026): Rebranded Sparkcurve → Sparkcurv, modern split login page, updated CSS design system (rounded-xl cards, improved nav, better badges/tables/buttons), consistent layout across all tabs
- ✅ **Dark Mode Toggle** (Feb 2026): Full dark/light mode toggle in sidebar footer of both dashboards. CSS variable-based design system flips entire app. Preference persisted in localStorage. Dark palette: slate-950 page bg, slate-900 sidebar, slate-800 cards, blue-accented nav active state.
- ✅ **Avatar Storage** (Feb 2026): Migrated from pod-local file storage → Emergent Object Storage (`/api/admin/avatars/{path}` proxy endpoint)

## Pending Items (Prioritized)

### P0 - Critical
- [ ] **CR Auto-Apply logic**: When Admin approves a CR, auto-apply the change to DB (e.g., salary_revision → update basic_salary). Check `approve_cr_admin` endpoint in server.py.

### P1 - High  
- [ ] **Refactor server.py** into `/app/backend/routes/` modules (auth, employees, attendance, leaves, payroll, change_requests, admin) — User approved this.

### P2 - Medium
- [ ] **Accessibility improvements** (aria attributes) across dashboards — User approved.

## Key API Endpoints
- Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- Attendance: `POST /api/attendance/clock-in`, `POST /api/attendance/clock-out`, `POST /api/attendance/break`
- Leaves: `GET/POST /api/leaves`, `PUT /api/admin/leaves/{id}`
- Payroll: `GET /api/admin/payroll/summary`, `POST /api/admin/payroll/generate`
- Change Requests: `GET/POST /api/change-requests`, `PUT /api/admin/change-requests/{id}/manager-action`, `PUT /api/admin/change-requests/{id}/admin-action`
- Office: `GET/PUT /api/admin/office-settings`
- Notifications: `GET /api/admin/notifications`
- Heatmap: `GET /api/admin/attendance/heatmap`
