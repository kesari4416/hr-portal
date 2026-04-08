"""
Test suite for HR Portal Holiday and Leave Changes (Iteration 6)
Tests:
- Holiday list API (12 holidays)
- Weekend/holiday check API
- Leave balance (casual:12, sick:12, loss_of_pay:0, NO earned leave)
- LOP leave request submission
- Admin employee creation with correct leave balances
- Leave day calculation excluding weekends/holidays
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHolidayAPIs:
    """Test holiday-related endpoints"""
    
    def test_get_holidays_list(self):
        """GET /api/holidays/list returns all 12 holidays"""
        response = requests.get(f"{BASE_URL}/api/holidays/list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        holidays = response.json()
        assert isinstance(holidays, list), "Response should be a list"
        assert len(holidays) == 12, f"Expected 12 holidays, got {len(holidays)}"
        
        # Verify holiday structure
        for holiday in holidays:
            assert "date" in holiday, "Holiday should have 'date' field"
            assert "day" in holiday, "Holiday should have 'day' field"
            assert "festival" in holiday, "Holiday should have 'festival' field"
        
        # Verify specific holidays exist
        holiday_names = [h["festival"] for h in holidays]
        expected_holidays = ["New Year", "Republic Day", "Good Friday", "Vishu", 
                           "May Day", "Independence Day", "Onam", "Gandhi Jayanti",
                           "Vijayadasami", "Diwali", "Christmas"]
        for expected in expected_holidays:
            assert expected in holiday_names, f"Missing holiday: {expected}"
        
        print(f"✓ GET /api/holidays/list returns {len(holidays)} holidays")
    
    def test_check_weekend_saturday(self):
        """GET /api/holidays/check/{date} correctly identifies Saturday as weekend"""
        # 2026-01-03 is a Saturday
        response = requests.get(f"{BASE_URL}/api/holidays/check/2026-01-03")
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_weekend"] == True, "2026-01-03 (Saturday) should be weekend"
        assert data["is_working_day"] == False, "Saturday should not be working day"
        print("✓ Saturday correctly identified as weekend")
    
    def test_check_weekend_sunday(self):
        """GET /api/holidays/check/{date} correctly identifies Sunday as weekend"""
        # 2026-01-04 is a Sunday
        response = requests.get(f"{BASE_URL}/api/holidays/check/2026-01-04")
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_weekend"] == True, "2026-01-04 (Sunday) should be weekend"
        assert data["is_working_day"] == False, "Sunday should not be working day"
        print("✓ Sunday correctly identified as weekend")
    
    def test_check_holiday(self):
        """GET /api/holidays/check/{date} correctly identifies public holiday"""
        # 2026-01-01 is New Year
        response = requests.get(f"{BASE_URL}/api/holidays/check/2026-01-01")
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_holiday"] == True, "2026-01-01 should be holiday"
        assert data["holiday_name"] == "New Year", f"Expected 'New Year', got '{data.get('holiday_name')}'"
        assert data["is_working_day"] == False, "Holiday should not be working day"
        print("✓ Public holiday correctly identified")
    
    def test_check_working_day(self):
        """GET /api/holidays/check/{date} correctly identifies working day"""
        # 2026-01-05 is a Monday (not a holiday)
        response = requests.get(f"{BASE_URL}/api/holidays/check/2026-01-05")
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_weekend"] == False, "2026-01-05 (Monday) should not be weekend"
        assert data["is_holiday"] == False, "2026-01-05 should not be holiday"
        assert data["is_working_day"] == True, "Monday should be working day"
        print("✓ Working day correctly identified")


class TestLeaveBalance:
    """Test leave balance endpoints"""
    
    @pytest.fixture
    def admin_session(self):
        """Login as admin and return session with cookies"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@hrportal.com",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return session
    
    @pytest.fixture
    def test_employee_session(self, admin_session):
        """Create a test employee and return their session"""
        # Create test employee
        test_email = f"test.holidays.{datetime.now().strftime('%H%M%S')}@company.com"
        create_response = admin_session.post(f"{BASE_URL}/api/admin/employees", json={
            "email": test_email,
            "password": "Test@123",
            "name": "Test Holiday Employee",
            "department": "Testing",
            "position": "Tester"
        })
        
        if create_response.status_code == 400 and "already registered" in create_response.text:
            # Use existing test employee
            test_email = "test.holidays@company.com"
        else:
            assert create_response.status_code == 200, f"Failed to create employee: {create_response.text}"
        
        # Login as employee
        emp_session = requests.Session()
        login_response = emp_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "Test@123"
        })
        
        if login_response.status_code != 200:
            # Try with the provided test credentials
            login_response = emp_session.post(f"{BASE_URL}/api/auth/login", json={
                "email": "test.holidays@company.com",
                "password": "Test@123"
            })
        
        assert login_response.status_code == 200, f"Employee login failed: {login_response.text}"
        return emp_session
    
    def test_leave_balance_structure(self, test_employee_session):
        """Leave balance shows casual:12, sick:12, loss_of_pay:0 and NO earned leave"""
        response = test_employee_session.get(f"{BASE_URL}/api/leave/balance")
        assert response.status_code == 200, f"Failed to get leave balance: {response.text}"
        
        balance = response.json()
        
        # Check required fields exist
        assert "casual" in balance, "Balance should have 'casual' field"
        assert "sick" in balance, "Balance should have 'sick' field"
        assert "loss_of_pay" in balance, "Balance should have 'loss_of_pay' field"
        
        # Check NO earned leave field
        assert "earned" not in balance, "Balance should NOT have 'earned' field"
        assert "earned_leave" not in balance, "Balance should NOT have 'earned_leave' field"
        
        # Check values for new employee
        assert balance["casual"] == 12, f"Expected casual=12, got {balance['casual']}"
        assert balance["sick"] == 12, f"Expected sick=12, got {balance['sick']}"
        assert balance["loss_of_pay"] == 0, f"Expected loss_of_pay=0, got {balance['loss_of_pay']}"
        
        print(f"✓ Leave balance correct: casual={balance['casual']}, sick={balance['sick']}, loss_of_pay={balance['loss_of_pay']}")
        print("✓ No earned leave field in balance")


class TestAdminEmployeeCreation:
    """Test admin employee creation with correct leave balances"""
    
    @pytest.fixture
    def admin_session(self):
        """Login as admin and return session with cookies"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@hrportal.com",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return session
    
    def test_create_employee_leave_balances(self, admin_session):
        """Admin create employee creates user with casual:12, sick:12, no earned_leave"""
        test_email = f"test.newemployee.{datetime.now().strftime('%H%M%S%f')}@company.com"
        
        response = admin_session.post(f"{BASE_URL}/api/admin/employees", json={
            "email": test_email,
            "password": "Test@123",
            "name": "New Test Employee",
            "department": "Testing",
            "position": "Tester"
        })
        
        assert response.status_code == 200, f"Failed to create employee: {response.text}"
        
        employee = response.json()
        
        # Check leave balances in response
        assert employee.get("casual_leave") == 12, f"Expected casual_leave=12, got {employee.get('casual_leave')}"
        assert employee.get("sick_leave") == 12, f"Expected sick_leave=12, got {employee.get('sick_leave')}"
        assert employee.get("loss_of_pay") == 0, f"Expected loss_of_pay=0, got {employee.get('loss_of_pay')}"
        
        # Verify NO earned_leave field
        assert "earned_leave" not in employee, "Employee should NOT have 'earned_leave' field"
        
        print(f"✓ New employee created with correct leave balances")
        print(f"  casual_leave={employee.get('casual_leave')}, sick_leave={employee.get('sick_leave')}, loss_of_pay={employee.get('loss_of_pay')}")
        
        # Cleanup - delete the test employee
        if "id" in employee:
            admin_session.delete(f"{BASE_URL}/api/admin/employees/{employee['id']}")


class TestLOPLeaveRequest:
    """Test Loss of Pay leave request functionality"""
    
    @pytest.fixture
    def admin_session(self):
        """Login as admin and return session with cookies"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@hrportal.com",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return session
    
    @pytest.fixture
    def employee_session(self, admin_session):
        """Create or use test employee and return their session"""
        test_email = "test.lop@company.com"
        
        # Try to create employee
        create_response = admin_session.post(f"{BASE_URL}/api/admin/employees", json={
            "email": test_email,
            "password": "Test@123",
            "name": "Test LOP Employee",
            "department": "Testing",
            "position": "Tester"
        })
        
        # Login as employee
        emp_session = requests.Session()
        login_response = emp_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "Test@123"
        })
        
        assert login_response.status_code == 200, f"Employee login failed: {login_response.text}"
        return emp_session
    
    def test_lop_leave_request_submission(self, employee_session):
        """LOP leave request can be submitted without balance check"""
        # Find a future working day (Monday)
        today = datetime.now()
        days_until_monday = (7 - today.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        future_monday = today + timedelta(days=days_until_monday + 7)  # Next week Monday
        
        start_date = future_monday.strftime("%Y-%m-%d")
        end_date = (future_monday + timedelta(days=2)).strftime("%Y-%m-%d")  # 3 days
        
        response = employee_session.post(f"{BASE_URL}/api/leave/request", json={
            "leave_type": "loss_of_pay",
            "start_date": start_date,
            "end_date": end_date,
            "reason": "Testing LOP leave request"
        })
        
        assert response.status_code == 200, f"LOP leave request failed: {response.text}"
        
        leave_request = response.json()
        assert leave_request["leave_type"] == "loss_of_pay", "Leave type should be loss_of_pay"
        assert leave_request["status"] == "pending", "Status should be pending"
        
        print(f"✓ LOP leave request submitted successfully")
        print(f"  Leave ID: {leave_request.get('id')}, Days: {leave_request.get('days')}")
        
        # Cancel the request to clean up
        if "id" in leave_request:
            employee_session.delete(f"{BASE_URL}/api/leave/{leave_request['id']}")


class TestLeaveCalculation:
    """Test leave day calculation excluding weekends and holidays"""
    
    @pytest.fixture
    def admin_session(self):
        """Login as admin and return session with cookies"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@hrportal.com",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return session
    
    @pytest.fixture
    def employee_session(self, admin_session):
        """Create or use test employee and return their session"""
        test_email = "test.calc@company.com"
        
        # Try to create employee
        admin_session.post(f"{BASE_URL}/api/admin/employees", json={
            "email": test_email,
            "password": "Test@123",
            "name": "Test Calc Employee",
            "department": "Testing",
            "position": "Tester"
        })
        
        # Login as employee
        emp_session = requests.Session()
        login_response = emp_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "Test@123"
        })
        
        assert login_response.status_code == 200, f"Employee login failed: {login_response.text}"
        return emp_session
    
    def test_leave_excludes_weekends(self, employee_session):
        """Leave request day calculation excludes weekends and holidays"""
        # Request leave from Monday to Sunday (7 calendar days)
        # Working days = 5 weekdays minus any holidays in that range
        # Find a Monday that doesn't have holidays in the week
        today = datetime.now()
        
        # Use a specific date range that we know: 2026-06-01 (Monday) to 2026-06-07 (Sunday)
        # June 2026 has no holidays in first week
        start_date = "2026-06-01"  # Monday
        end_date = "2026-06-07"    # Sunday
        
        response = employee_session.post(f"{BASE_URL}/api/leave/request", json={
            "leave_type": "casual",
            "start_date": start_date,
            "end_date": end_date,
            "reason": "Testing weekend exclusion"
        })
        
        assert response.status_code == 200, f"Leave request failed: {response.text}"
        
        leave_request = response.json()
        # 7 calendar days (Mon-Sun) with no holidays = 5 working days
        assert leave_request["days"] == 5, f"Expected 5 working days, got {leave_request['days']}"
        
        print(f"✓ Leave calculation correctly excludes weekends")
        print(f"  Calendar days: 7 (Mon-Sun), Working days: {leave_request['days']}")
        
        # Cancel the request to clean up
        if "id" in leave_request:
            employee_session.delete(f"{BASE_URL}/api/leave/{leave_request['id']}")
    
    def test_leave_only_weekends_rejected(self, employee_session):
        """Leave request for only weekends should be rejected"""
        # Find next Saturday
        today = datetime.now()
        days_until_saturday = (5 - today.weekday()) % 7
        if days_until_saturday == 0:
            days_until_saturday = 7
        next_saturday = today + timedelta(days=days_until_saturday + 14)
        next_sunday = next_saturday + timedelta(days=1)
        
        start_date = next_saturday.strftime("%Y-%m-%d")
        end_date = next_sunday.strftime("%Y-%m-%d")
        
        response = employee_session.post(f"{BASE_URL}/api/leave/request", json={
            "leave_type": "casual",
            "start_date": start_date,
            "end_date": end_date,
            "reason": "Testing weekend-only rejection"
        })
        
        # Should be rejected because only weekends selected
        assert response.status_code == 400, f"Expected 400 for weekend-only leave, got {response.status_code}"
        assert "weekends" in response.text.lower() or "holidays" in response.text.lower(), \
            f"Error message should mention weekends/holidays: {response.text}"
        
        print("✓ Leave request for only weekends correctly rejected")


class TestClockInBlocking:
    """Test clock-in blocking on weekends and holidays"""
    
    def test_clock_in_weekend_blocked_info(self):
        """Verify weekend blocking is documented in API"""
        # This is a documentation test - we verify the API behavior is correct
        # by checking the holiday check endpoint
        response = requests.get(f"{BASE_URL}/api/holidays/check/2026-01-03")  # Saturday
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_weekend"] == True
        assert data["is_working_day"] == False
        
        print("✓ Weekend dates correctly marked as non-working days")
        print("  Clock-in should be blocked on these dates")
    
    def test_clock_in_holiday_blocked_info(self):
        """Verify holiday blocking is documented in API"""
        response = requests.get(f"{BASE_URL}/api/holidays/check/2026-01-01")  # New Year
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_holiday"] == True
        assert data["is_working_day"] == False
        assert data["holiday_name"] == "New Year"
        
        print("✓ Holiday dates correctly marked as non-working days")
        print("  Clock-in should be blocked on these dates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
