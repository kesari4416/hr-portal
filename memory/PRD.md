# HR Portal - Product Requirements Document

## Original Problem Statement
Build HR portal for login all employees with Leave, Login, logout, break etc. Need frontend dashboard for admin and employee login and backend in Python.

## Updated Requirements (April 8, 2026)
- Permission hours: 2 hours/month per employee, max 1 hour per use
- Working hours: 8:30 total, minimum 8 hours required
- Short day policy: Less than 8 hours = short day, 3 short days = 0.5 day casual leave deduction

## User Choices
- Authentication: JWT-based custom auth (email/password)
- Employee Features: All (Leave requests, Attendance tracking, Break management, View leave balance, Permission hours)
- Admin Features: All (Approve/reject leave & permissions, View attendance, Manage employees, View analytics)
- Leave Types: Default set (Casual, Sick, Earned)
- Design: Best dashboard (Swiss & High-Contrast theme)

## Architecture
- **Backend**: FastAPI (Python) on port 8001
- **Frontend**: React with Tailwind CSS on port 3000
- **Database**: MongoDB
- **Authentication**: JWT with httpOnly cookies

## What's Been Implemented

### Phase 1 (Initial MVP)
- [x] JWT authentication with secure cookies
- [x] Employee dashboard with clock in/out
- [x] Break management (start/end)
- [x] Leave request submission
- [x] Leave balance tracking
- [x] Admin dashboard with analytics
- [x] Employee management (CRUD)
- [x] Leave approval/rejection

### Phase 2 (April 8, 2026)
- [x] Permission hours tracking (2h/month, max 1h per use)
- [x] Permission request/approval workflow
- [x] Working hours calculation on clock out
- [x] Short day detection (< 8 hours)
- [x] Auto half-day leave deduction (3 short days = 0.5 day)
- [x] Work Summary page with monthly stats
- [x] Progress bar for 8:30 hour target
- [x] Working hours policy display

## Prioritized Backlog

### P0 (Critical) - COMPLETED
- [x] All core features implemented

### P1 (High Priority)
- [ ] Password reset functionality
- [ ] Email notifications for approvals
- [ ] Monthly permission reset automation

### P2 (Medium Priority)
- [ ] Attendance reports export (CSV/PDF)
- [ ] Leave calendar view
- [ ] Overtime tracking
- [ ] Mobile responsive improvements

### P3 (Low Priority)
- [ ] Dark mode support
- [ ] Multi-language support
- [ ] Audit logs

## Next Tasks
1. Add password reset flow
2. Implement email notifications
3. Create attendance reports export feature
