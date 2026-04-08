# HR Portal - Product Requirements Document

## Original Problem Statement
Build HR portal for login all employees with Leave, Login, logout, break etc. Need frontend dashboard for admin and employee login and backend in Python.

## User Choices
- Authentication: JWT-based custom auth (email/password)
- Employee Features: All (Leave requests, Attendance tracking, Break management, View leave balance)
- Admin Features: All (Approve/reject leave, View attendance, Manage employees, View analytics)
- Leave Types: Default set (Casual, Sick, Earned)
- Design: Best dashboard (Swiss & High-Contrast theme)

## Architecture
- **Backend**: FastAPI (Python) on port 8001
- **Frontend**: React with Tailwind CSS on port 3000
- **Database**: MongoDB
- **Authentication**: JWT with httpOnly cookies

## User Personas
1. **Employee**: Regular staff who clock in/out, take breaks, and request leaves
2. **Admin**: HR manager who approves leaves, manages employees, and views analytics

## Core Requirements (Static)
- [x] JWT authentication with secure cookies
- [x] Employee dashboard with clock in/out
- [x] Break management (start/end)
- [x] Leave request submission
- [x] Leave balance tracking
- [x] Admin dashboard with analytics
- [x] Employee management (CRUD)
- [x] Leave approval/rejection
- [x] Attendance records view

## What's Been Implemented (April 8, 2026)

### Backend (FastAPI)
- JWT authentication with bcrypt password hashing
- Admin user auto-seeding on startup
- Attendance tracking (clock in/out, breaks)
- Leave management APIs
- Employee CRUD operations
- Analytics endpoint

### Frontend (React)
- Login page with 50/50 split layout
- Employee dashboard with:
  - Real-time clock timer
  - Leave balance cards
  - Leave request dialog
  - Attendance history
- Admin dashboard with:
  - Analytics overview (employees, present, absent, pending leaves)
  - Employee management table
  - Leave request approval queue
  - Attendance records

### Design
- Swiss & High-Contrast theme
- Outfit font for headings, Manrope for body
- Phosphor icons (duotone style)
- Traffic light color coding (Green=approved, Yellow=pending, Red=rejected)

## Prioritized Backlog

### P0 (Critical) - COMPLETED
- [x] Authentication system
- [x] Clock in/out functionality
- [x] Leave request submission
- [x] Admin leave approval

### P1 (High Priority) - For Next Phase
- [ ] Password reset functionality
- [ ] Email notifications for leave approvals
- [ ] Bulk attendance import
- [ ] Employee profile page

### P2 (Medium Priority)
- [ ] Attendance reports export (CSV/PDF)
- [ ] Leave calendar view
- [ ] Overtime tracking
- [ ] Mobile responsive improvements

### P3 (Low Priority)
- [ ] Dark mode support
- [ ] Multi-language support
- [ ] Audit logs
- [ ] API rate limiting

## Next Tasks
1. Add password reset flow
2. Implement email notifications
3. Add employee profile edit page
4. Create attendance reports export feature
