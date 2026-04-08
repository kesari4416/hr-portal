#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta

class HRPortalAPITester:
    def __init__(self, base_url="https://workforce-dash-18.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.employee_token = None
        self.employee_id = None
        self.leave_request_id = None
        self.attendance_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, cookies=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers, cookies=cookies)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers, cookies=cookies)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.content else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@hrportal.com", "password": "Admin@123"}
        )
        if success and 'id' in response:
            print(f"   Admin user ID: {response['id']}")
            print(f"   Admin role: {response.get('role', 'unknown')}")
            return True
        return False

    def test_admin_analytics(self):
        """Test admin analytics endpoint"""
        success, response = self.run_test(
            "Admin Analytics",
            "GET",
            "admin/analytics",
            200
        )
        if success:
            print(f"   Total employees: {response.get('total_employees', 0)}")
            print(f"   Present today: {response.get('present_today', 0)}")
            print(f"   Pending leaves: {response.get('pending_leaves', 0)}")
        return success

    def test_get_employees(self):
        """Test getting all employees"""
        success, response = self.run_test(
            "Get All Employees",
            "GET",
            "admin/employees",
            200
        )
        if success:
            print(f"   Found {len(response)} employees")
        return success

    def test_create_employee(self):
        """Test creating a new employee"""
        test_employee = {
            "email": f"test.employee.{datetime.now().strftime('%H%M%S')}@hrportal.com",
            "password": "TestPass123!",
            "name": "Test Employee",
            "department": "Testing",
            "position": "QA Tester"
        }
        
        success, response = self.run_test(
            "Create Employee",
            "POST",
            "admin/employees",
            200,
            data=test_employee
        )
        if success and 'id' in response:
            self.employee_id = response['id']
            print(f"   Created employee ID: {self.employee_id}")
            print(f"   Employee email: {response.get('email')}")
            return True
        return False

    def test_employee_login(self):
        """Test employee login"""
        if not self.employee_id:
            print("❌ No employee created, skipping login test")
            return False
            
        # Get employee details first
        success, employees = self.run_test(
            "Get Employee for Login",
            "GET",
            "admin/employees",
            200
        )
        
        if not success:
            return False
            
        test_employee = None
        for emp in employees:
            if emp['id'] == self.employee_id:
                test_employee = emp
                break
                
        if not test_employee:
            print("❌ Test employee not found")
            return False

        success, response = self.run_test(
            "Employee Login",
            "POST",
            "auth/login",
            200,
            data={"email": test_employee['email'], "password": "TestPass123!"}
        )
        if success and 'id' in response:
            print(f"   Employee logged in: {response.get('name')}")
            return True
        return False

    def test_attendance_flow(self):
        """Test attendance clock in/out flow"""
        # Test clock in
        success, response = self.run_test(
            "Clock In",
            "POST",
            "attendance/clock-in",
            200
        )
        if not success:
            return False
            
        print(f"   Clocked in at: {response.get('clock_in')}")
        
        # Test attendance status
        success, status = self.run_test(
            "Attendance Status",
            "GET",
            "attendance/status",
            200
        )
        if success:
            print(f"   Clocked in: {status.get('clocked_in')}")
            print(f"   On break: {status.get('on_break')}")

        # Test start break
        success, break_response = self.run_test(
            "Start Break",
            "POST",
            "attendance/break/start",
            200
        )
        if success:
            print(f"   Break started")

        # Test end break
        success, break_end = self.run_test(
            "End Break",
            "POST",
            "attendance/break/end",
            200
        )
        if success:
            print(f"   Break ended")

        # Test clock out
        success, clock_out = self.run_test(
            "Clock Out",
            "POST",
            "attendance/clock-out",
            200
        )
        if success:
            print(f"   Clocked out at: {clock_out.get('clock_out')}")
            
        return success

    def test_leave_management(self):
        """Test leave request and approval flow"""
        # Test leave balance
        success, balance = self.run_test(
            "Leave Balance",
            "GET",
            "leave/balance",
            200
        )
        if success:
            print(f"   Casual leave: {balance.get('casual', 0)}")
            print(f"   Sick leave: {balance.get('sick', 0)}")
            print(f"   Earned leave: {balance.get('earned', 0)}")

        # Test leave request
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        day_after = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        
        leave_data = {
            "leave_type": "casual",
            "start_date": tomorrow,
            "end_date": day_after,
            "reason": "Test leave request"
        }
        
        success, leave_response = self.run_test(
            "Create Leave Request",
            "POST",
            "leave/request",
            200,
            data=leave_data
        )
        if success and 'id' in leave_response:
            self.leave_request_id = leave_response['id']
            print(f"   Leave request ID: {self.leave_request_id}")
            print(f"   Status: {leave_response.get('status')}")

        # Test get my leave requests
        success, my_requests = self.run_test(
            "Get My Leave Requests",
            "GET",
            "leave/my-requests",
            200
        )
        if success:
            print(f"   Found {len(my_requests)} leave requests")

        return success

    def test_admin_leave_approval(self):
        """Test admin leave approval"""
        if not self.leave_request_id:
            print("❌ No leave request to approve")
            return False

        # First login as admin again
        self.test_admin_login()

        # Get all leave requests
        success, all_requests = self.run_test(
            "Get All Leave Requests",
            "GET",
            "admin/leave-requests",
            200
        )
        if success:
            print(f"   Found {len(all_requests)} total leave requests")

        # Approve the leave request
        success, approval = self.run_test(
            "Approve Leave Request",
            "PUT",
            f"admin/leave-requests/{self.leave_request_id}?action=approve",
            200
        )
        if success:
            print(f"   Leave request approved")

        return success

    def test_admin_attendance_view(self):
        """Test admin attendance viewing"""
        success, attendance = self.run_test(
            "Get All Attendance",
            "GET",
            "admin/attendance",
            200
        )
        if success:
            print(f"   Found {len(attendance)} attendance records")
        return success

    def test_employee_update(self):
        """Test updating employee details"""
        if not self.employee_id:
            print("❌ No employee to update")
            return False

        update_data = {
            "name": "Updated Test Employee",
            "department": "Updated Testing",
            "position": "Senior QA Tester",
            "casual_leave": 15
        }

        success, response = self.run_test(
            "Update Employee",
            "PUT",
            f"admin/employees/{self.employee_id}",
            200,
            data=update_data
        )
        if success:
            print(f"   Updated employee: {response.get('name')}")
            print(f"   New department: {response.get('department')}")
        return success

    def test_employee_deletion(self):
        """Test deleting employee"""
        if not self.employee_id:
            print("❌ No employee to delete")
            return False

        success, response = self.run_test(
            "Delete Employee",
            "DELETE",
            f"admin/employees/{self.employee_id}",
            200
        )
        if success:
            print(f"   Employee deleted successfully")
        return success

def main():
    print("🚀 Starting HR Portal API Tests")
    print("=" * 50)
    
    tester = HRPortalAPITester()
    
    # Test sequence
    tests = [
        ("Admin Authentication", tester.test_admin_login),
        ("Admin Analytics", tester.test_admin_analytics),
        ("Get Employees", tester.test_get_employees),
        ("Create Employee", tester.test_create_employee),
        ("Employee Login", tester.test_employee_login),
        ("Attendance Flow", tester.test_attendance_flow),
        ("Leave Management", tester.test_leave_management),
        ("Admin Leave Approval", tester.test_admin_leave_approval),
        ("Admin Attendance View", tester.test_admin_attendance_view),
        ("Employee Update", tester.test_employee_update),
        ("Employee Deletion", tester.test_employee_deletion),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print summary
    print(f"\n{'='*50}")
    print(f"📊 Test Summary")
    print(f"{'='*50}")
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed test categories:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print(f"\n✅ All test categories passed!")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())