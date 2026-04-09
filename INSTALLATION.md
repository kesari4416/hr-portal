# HR Portal - Installation Guide

## Tech Stack
| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 18, Tailwind CSS, Shadcn UI   |
| Backend    | Python 3.11+, FastAPI, Uvicorn      |
| Database   | MySQL 8.0+ / MariaDB 10.5+         |
| Auth       | JWT (httpOnly cookies), bcrypt      |
| PDF        | ReportLab                           |
| Excel      | OpenPyXL                            |

---

## Prerequisites

- **Node.js** >= 18.x
- **Python** >= 3.11
- **MySQL** >= 8.0 or **MariaDB** >= 10.5
- **Git**

---

## 1. Clone the Repository

```bash
git clone <your-repo-url> hr-portal
cd hr-portal
```

---

## 2. Database Setup

### Install MySQL / MariaDB

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y mariadb-server mariadb-client
sudo systemctl start mariadb
sudo systemctl enable mariadb
```

**macOS (Homebrew):**
```bash
brew install mariadb
brew services start mariadb
```

**Windows:**
Download and install from https://mariadb.org/download/

### Create Database & User

```bash
sudo mysql -u root
```

```sql
CREATE DATABASE hr_portal;
CREATE USER 'hruser'@'localhost' IDENTIFIED BY 'hrpass123';
GRANT ALL PRIVILEGES ON hr_portal.* TO 'hruser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> Tables are auto-created on first backend startup.

---

## 3. Backend Setup

### Navigate to backend

```bash
cd backend
```

### Create virtual environment

```bash
python3 -m venv venv
source venv/bin/activate        # Linux/macOS
# venv\Scripts\activate          # Windows
```

### Install dependencies

```bash
pip install -r requirements.txt
```

### Configure environment variables

Create `backend/.env`:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=hruser
MYSQL_PASSWORD=hrpass123
MYSQL_DB=hr_portal
JWT_SECRET=your-secret-key-change-this-in-production
ADMIN_EMAIL=admin@hrportal.com
ADMIN_PASSWORD=Admin@123
FRONTEND_URL=http://localhost:3000
```

> **Important:** Change `JWT_SECRET` to a strong random string in production.

### Start backend (Development)

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Backend will be available at: `http://localhost:8001`

### Verify backend is running

```bash
curl http://localhost:8001/api/
# Expected: {"message":"HR Portal API"}
```

---

## 4. Frontend Setup

### Navigate to frontend

```bash
cd frontend
```

### Install dependencies

```bash
yarn install
```

> Use `yarn` instead of `npm` to avoid dependency conflicts.

### Configure environment variables

Create `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

> In production, set this to your actual backend URL (e.g., `https://api.yourdomain.com`).

### Start frontend (Development)

```bash
yarn start
```

Frontend will be available at: `http://localhost:3000`

---

## 5. Default Admin Login

After first startup, an admin account is auto-seeded:

| Field    | Value              |
|----------|--------------------|
| Email    | admin@hrportal.com |
| Password | Admin@123          |

---

## 6. Production Deployment

### Backend (Production)

```bash
cd backend
source venv/bin/activate

# Install production ASGI server
pip install gunicorn

# Start with Gunicorn + Uvicorn workers
gunicorn server:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8001 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
```

#### Production `.env` (backend)

```env
MYSQL_HOST=your-db-host
MYSQL_PORT=3306
MYSQL_USER=hruser
MYSQL_PASSWORD=strong-production-password
MYSQL_DB=hr_portal
JWT_SECRET=generate-a-64-char-random-string
ADMIN_EMAIL=admin@hrportal.com
ADMIN_PASSWORD=StrongAdminPassword@2026
FRONTEND_URL=https://yourdomain.com
```

#### Systemd Service (Linux)

Create `/etc/systemd/system/hr-portal-backend.service`:

```ini
[Unit]
Description=HR Portal Backend
After=network.target mariadb.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/hr-portal/backend
Environment="PATH=/opt/hr-portal/backend/venv/bin"
EnvironmentFile=/opt/hr-portal/backend/.env
ExecStart=/opt/hr-portal/backend/venv/bin/gunicorn server:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8001 \
  --timeout 120
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable hr-portal-backend
sudo systemctl start hr-portal-backend
sudo systemctl status hr-portal-backend
```

---

### Frontend (Production Build)

```bash
cd frontend

# Build for production
REACT_APP_BACKEND_URL=https://api.yourdomain.com yarn build
```

This creates an optimized `build/` folder.

#### Serve with Nginx

Install Nginx:
```bash
sudo apt install -y nginx
```

Create `/etc/nginx/sites-available/hr-portal`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend (React build)
    root /opt/hr-portal/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hr-portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Add SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 7. Quick Reference Commands

| Action                     | Command                                                    |
|----------------------------|------------------------------------------------------------|
| Start DB (MariaDB)        | `sudo systemctl start mariadb`                             |
| Start Backend (Dev)       | `cd backend && uvicorn server:app --port 8001 --reload`    |
| Start Frontend (Dev)      | `cd frontend && yarn start`                                |
| Build Frontend (Prod)     | `cd frontend && yarn build`                                |
| Start Backend (Prod)      | `sudo systemctl start hr-portal-backend`                   |
| View Backend Logs         | `sudo journalctl -u hr-portal-backend -f`                  |
| MySQL Console             | `mysql -u hruser -p hr_portal`                             |
| Run Backend Tests         | `cd backend && python -m pytest tests/ -v`                 |
| Check API Health          | `curl http://localhost:8001/api/`                          |

---

## 8. Project Structure

```
hr-portal/
├── backend/
│   ├── server.py              # FastAPI app (all routes & models)
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Backend config (DB, JWT, etc.)
│   └── tests/                 # Pytest test files
├── frontend/
│   ├── src/
│   │   ├── App.js             # React router & auth guards
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx # Auth state management
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── AdminDashboard.jsx   # Admin + Manager dashboard
│   │   │   └── EmployeeDashboard.jsx
│   │   └── components/ui/     # Shadcn UI components
│   ├── package.json
│   └── .env                   # Frontend config (API URL)
└── README.md
```

---

## 9. User Roles

| Role     | Access                                                         |
|----------|----------------------------------------------------------------|
| Admin    | Full access: employees, payslips, shifts, leaves, permissions  |
| Manager  | Approve/reject leaves & permissions, view attendance/analytics |
| Employee | Clock in/out, breaks, request leaves/permissions, view payslips|

---

## 10. Troubleshooting

| Issue                          | Solution                                                  |
|--------------------------------|-----------------------------------------------------------|
| Backend won't start            | Check `.env` values, ensure MySQL is running              |
| CORS errors in browser         | Verify `FRONTEND_URL` in backend `.env` matches frontend  |
| Login fails after deploy       | Ensure cookies work: check `secure` flag & `samesite`     |
| Tables not created             | Backend auto-creates on startup; check MySQL permissions   |
| Frontend blank after build     | Ensure `REACT_APP_BACKEND_URL` was set before `yarn build`|

### Cannot Login? Follow these steps:

**Step 1: Check if backend is running**
```bash
curl http://your-server:8001/api/health
# Expected: {"status":"ok","database":"connected","users_count":1}
```

**Step 2: If database is disconnected, check MySQL**
```bash
sudo systemctl status mariadb
# If not running:
sudo systemctl start mariadb
```

**Step 3: Verify database and user exist**
```bash
mysql -u root -e "SHOW DATABASES;" | grep hr_portal
mysql -u hruser -phrpass123 hr_portal -e "SELECT id, email, role FROM users;"
```

**Step 4: If users table is empty, restart backend**
```bash
# The backend auto-creates tables and seeds admin on startup
sudo systemctl restart hr-portal-backend
# Check logs:
sudo journalctl -u hr-portal-backend -n 50
# You should see: "Admin login ready - Email: admin@hrportal.com"
```

**Step 5: If still not working, run the SQL setup manually**
```bash
mysql -u root < database_setup.sql
sudo systemctl restart hr-portal-backend
```

**Step 6: Test login directly with curl**
```bash
curl -X POST http://your-server:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hrportal.com","password":"Admin@123"}'
# Expected: JSON with id, email, name, role
```
