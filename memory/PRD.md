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
- Admin Leave Balance Editor (per-employee)
- Worker Org Tree with images
- Role-based Tab Access Control (Manager/Employee tabs togglable by Admin)

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
│   ├── server.py              # All routes (~3100 lines, needs future refactor)
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── index.css          # Design system + component classes
│   │   ├── contexts/AuthContext.jsx
│   │   ├── contexts/ThemeContext.jsx
│   │   ├── components/
│   │   │   ├── CRApproveDialog.jsx   # CR Admin approve dialog (extracted)
│   │   │   └── OrgTreeNode.jsx       # Org tree rendering (extracted)
│   │   └── pages/
│   │       ├── LoginPage.jsx
│   │       ├── EmployeeDashboard.jsx
│   │       └── AdminDashboard.jsx
├── database_setup.sql
└── setup.sh
```

## Key DB Schema
- `users`: {id, employee_code, name, email, role, department, basic_salary, shift, casual_leave, sick_leave, loss_of_pay, permission_hours, wfh_limit}
- `attendance`: {id, user_id, clock_in, clock_out, latitude, longitude, address, break_outside_geofence, working_hours}
- `breaks`: {id, attendance_id, start/end lat/lng, start/end address}
- `leave_requests`: {id, user_id, leave_type, start_date, end_date, is_half_day, status}
- `change_requests`: {id, requester_id, title, description, cr_type, status, manager_approval, admin_approval, metadata, applied_changes}
- `payslips`: {id, user_id, month, year, basic_salary, total_deductions, net_pay}
- `office_settings`: {id, latitude, longitude, radius_km, name}
- `org_chart`: {id, parent_id, employee_name, job_title, image_url, description, sort_order, **level_num**}
- `org_levels`: {id, level_num, label} — maps numeric levels to custom admin-defined names (L1=CEO, L2=Director, etc.)
- `role_permissions`: {id, role, feature_key, enabled}

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
- ✅ **GUI Redesign** (Feb 2026): Rebranded Sparkcurve → Sparkcurv
- ✅ **Dark Mode Toggle** (Feb 2026): Full dark/light mode toggle, persisted in localStorage
- ✅ **Leave Balance Editor** (Feb 2026): Admin can edit casual/sick/LOP/permission/WFH per employee
- ✅ **Worker Org Tree** (Feb 2026): Visual hierarchy with images
- ✅ **Role-Based Tab Access** (Feb 2026): Admin toggles which tabs Manager/Employee can see
- ✅ **CR Auto-Apply** (Feb 2026): On admin approval, Salary/Leave/Shift changes auto-apply to DB
- ✅ **Employee ID (employee_code)** (Aug 2026): SC24001 series, auto-gen with manual override
- ✅ **HQ Location → Nagercoil** (Aug 2026): `office_settings` updated to 8.1815, 77.4294
- ✅ **Geofence Bypass Mode** (Aug 2026): Admin toggle to allow clock-in from any location; `geofence_bypass` column in `office_settings`
- ✅ **Auto Detect Location** (Aug 2026): Admin opens Office Settings → clicks "Auto Detect My Current Location" → browser GPS fills lat/lng + reverse geocoded address
- ✅ **GPS Status Panel** (Aug 2026): Employee dashboard shows live distance from office + within/outside geofence indicator before clicking Clock In
- ✅ **Check-Location Endpoint** (Aug 2026): `POST /api/attendance/check-location` returns distance/within_geofence/bypass status

## Pending Items (Prioritized)

### P1 - High  
- [ ] **Refactor server.py** into `/app/backend/routes/` modules (auth, employees, attendance, leaves, payroll, change_requests, admin)

### P2 - Medium
- [ ] **Accessibility improvements** (aria attributes) across dashboards

## Key API Endpoints
- Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- Attendance: `POST /api/attendance/clock-in`, `POST /api/attendance/clock-out`, `POST /api/attendance/break`, `POST /api/attendance/check-location`
- Leaves: `GET/POST /api/leaves`, `PUT /api/admin/leaves/{id}`
- Leave Balance: `GET/PUT /api/admin/employees/{id}/leave-balance`
- Payroll: `GET /api/admin/payroll/summary`, `POST /api/admin/payroll/generate`
- Change Requests: `GET/POST /api/change-requests`, `PUT /api/admin/change-requests/{id}/manager-action`, `PUT /api/admin/change-requests/{id}/admin-action`
- Org Chart: `GET/POST/PUT/DELETE /api/admin/org-chart`
- Role Perms: `GET/PUT /api/admin/role-permissions`, `GET /api/my-permissions`
- Office: `GET/PUT /api/admin/office-settings` (supports `geofence_bypass` field)
- Notifications: `GET /api/admin/notifications`
- Heatmap: `GET /api/admin/attendance/heatmap`
