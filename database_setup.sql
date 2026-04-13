-- =============================================
-- HR PORTAL - MySQL Database Setup Script
-- =============================================
-- Run this script to create the database, user and all tables
-- Command: sudo mysql -u root < database_setup.sql
-- =============================================

-- Create database
CREATE DATABASE IF NOT EXISTS hr_portal;

-- Create user and grant privileges
CREATE USER IF NOT EXISTS 'hruser'@'localhost' IDENTIFIED BY 'hrpass123';
GRANT ALL PRIVILEGES ON hr_portal.* TO 'hruser'@'localhost';
FLUSH PRIVILEGES;

USE hr_portal;

-- =============================================
-- 1. USERS TABLE
-- Stores Admin, Manager and Employee accounts
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'manager', 'employee') DEFAULT 'employee',
    department VARCHAR(255) DEFAULT 'General',
    position VARCHAR(255) DEFAULT 'Employee',
    avatar_url TEXT,
    created_at VARCHAR(64),
    casual_leave FLOAT DEFAULT 12,
    sick_leave FLOAT DEFAULT 3,
    loss_of_pay FLOAT DEFAULT 0,
    permission_hours FLOAT DEFAULT 2,
    half_day_leave FLOAT DEFAULT 0,
    shift VARCHAR(50) DEFAULT '',
    basic_salary FLOAT DEFAULT 0,
    employee_code VARCHAR(20) DEFAULT ''
);

-- =============================================
-- 2. ATTENDANCE TABLE
-- Daily clock in/out and working hours tracking
-- =============================================
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    user_name VARCHAR(255),
    date VARCHAR(20),
    clock_in VARCHAR(64),
    clock_out VARCHAR(64),
    total_break_minutes INT DEFAULT 0,
    working_hours FLOAT,
    is_short_day TINYINT DEFAULT 0,
    INDEX idx_user_date (user_id, date)
);

-- =============================================
-- 3. BREAKS TABLE
-- Break start/end times linked to attendance
-- =============================================
CREATE TABLE IF NOT EXISTS breaks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attendance_id INT NOT NULL,
    break_start VARCHAR(64),
    break_end VARCHAR(64),
    INDEX idx_attendance (attendance_id)
);

-- =============================================
-- 4. LEAVE REQUESTS TABLE
-- Leave types: casual, sick, loss_of_pay
-- =============================================
CREATE TABLE IF NOT EXISTS leave_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    user_name VARCHAR(255),
    user_email VARCHAR(255),
    leave_type VARCHAR(50),
    start_date VARCHAR(20),
    end_date VARCHAR(20),
    days INT DEFAULT 0,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at VARCHAR(64),
    reviewed_by VARCHAR(255),
    reviewed_at VARCHAR(64),
    INDEX idx_user_status (user_id, status)
);

-- =============================================
-- 5. PERMISSIONS TABLE
-- Permission hours requests (max 2hrs/month)
-- =============================================
CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    user_name VARCHAR(255),
    user_email VARCHAR(255),
    duration_minutes INT,
    reason TEXT,
    date VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending',
    created_at VARCHAR(64),
    reviewed_by VARCHAR(255),
    reviewed_at VARCHAR(64),
    INDEX idx_user_date (user_id, date)
);

-- =============================================
-- 6. PAYSLIPS TABLE
-- Monthly salary slips with deduction details
-- =============================================
CREATE TABLE IF NOT EXISTS payslips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    employee_name VARCHAR(255),
    employee_email VARCHAR(255),
    department VARCHAR(255),
    position VARCHAR(255),
    month INT,
    year INT,
    month_name VARCHAR(20),
    basic_salary FLOAT,
    deduction_details TEXT,
    total_deductions FLOAT DEFAULT 0,
    net_pay FLOAT DEFAULT 0,
    generated_by VARCHAR(255),
    created_at VARCHAR(64),
    UNIQUE KEY uk_emp_month_year (employee_id, month, year)
);

-- =============================================
-- 7. LEAVE DEDUCTIONS TABLE
-- Auto half-day deductions for short working days
-- =============================================
CREATE TABLE IF NOT EXISTS leave_deductions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50),
    amount FLOAT,
    reason TEXT,
    date VARCHAR(64)
);

-- =============================================
-- 8. POLICIES TABLE
-- Company policies editable by Admin
-- =============================================
CREATE TABLE IF NOT EXISTS policies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    content TEXT,
    icon VARCHAR(50) DEFAULT 'article',
    sort_order INT DEFAULT 0,
    created_at VARCHAR(64),
    updated_at VARCHAR(64)
);

-- =============================================
-- VERIFY TABLES
-- =============================================
SHOW TABLES;

-- =============================================
-- NOTE: Admin user and default policies are 
-- auto-seeded when the backend starts.
-- Just run: python server.py or use gunicorn
-- =============================================
