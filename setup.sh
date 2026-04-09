#!/bin/bash
# =============================================
# HR Portal - Quick Setup Script
# =============================================
# Run: chmod +x setup.sh && sudo ./setup.sh
# =============================================

set -e

echo "=========================================="
echo "  HR Portal - Setup Script"
echo "=========================================="

# 1. Check if MariaDB/MySQL is installed
echo ""
echo "[1/5] Checking MariaDB..."
if ! command -v mariadb &> /dev/null && ! command -v mysql &> /dev/null; then
    echo "  MariaDB not found. Installing..."
    apt-get update -qq
    apt-get install -y mariadb-server mariadb-client
    systemctl start mariadb
    systemctl enable mariadb
    echo "  MariaDB installed and started."
else
    echo "  MariaDB/MySQL found."
    systemctl start mariadb 2>/dev/null || systemctl start mysql 2>/dev/null || true
fi

# 2. Setup database
echo ""
echo "[2/5] Setting up database..."
mariadb -u root < database_setup.sql 2>/dev/null || mysql -u root < database_setup.sql
echo "  Database 'hr_portal' created with user 'hruser'."

# 3. Setup backend
echo ""
echo "[3/5] Setting up backend..."
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  Virtual environment created."
fi

source venv/bin/activate
pip install -r requirements.txt -q
echo "  Python dependencies installed."

# Create .env if not exists
if [ ! -f ".env" ]; then
    cat > .env << 'ENVEOF'
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=hruser
MYSQL_PASSWORD=hrpass123
MYSQL_DB=hr_portal
JWT_SECRET=change-this-to-a-strong-random-string-in-production
ADMIN_EMAIL=admin@hrportal.com
ADMIN_PASSWORD=Admin@123
FRONTEND_URL=http://localhost:3000
ENVEOF
    echo "  Backend .env created. IMPORTANT: Change JWT_SECRET for production!"
else
    echo "  Backend .env already exists."
fi

cd ..

# 4. Setup frontend
echo ""
echo "[4/5] Setting up frontend..."
cd frontend

yarn install --silent 2>/dev/null || npm install --silent
echo "  Frontend dependencies installed."

# Create .env if not exists
if [ ! -f ".env" ]; then
    cat > .env << 'ENVEOF'
REACT_APP_BACKEND_URL=http://localhost:8001
ENVEOF
    echo "  Frontend .env created."
else
    echo "  Frontend .env already exists."
fi

cd ..

# 5. Done
echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "  Start backend:  cd backend && source venv/bin/activate && uvicorn server:app --host 0.0.0.0 --port 8001 --reload"
echo "  Start frontend: cd frontend && yarn start"
echo ""
echo "  Admin Login:"
echo "    Email:    admin@hrportal.com"
echo "    Password: Admin@123"
echo ""
echo "  Database: mysql -u hruser -phrpass123 hr_portal"
echo "=========================================="
