import requests
import sys
import json
from datetime import datetime

class HRPortalAPITester:
    def __init__(self, base_url="https://workforce-dash-18.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.employee_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.employee_id = None
        self.payslip_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, response_type='json'):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if response_type == 'json' and response.content:
                    try:
                        return success, response.json()
                    except:
                        return success, {}
                else:
                    return success, response.content
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.content:
                    try:
                        error_data = response.json()
                        print(f"   Error: {error_data}")
                    except:
                        print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login and get token"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@hrportal.com", "password": "Admin@123"}
        )
        if success and 'id' in response:
            # For cookie-based auth, we need to extract cookies
            login_response = requests.post(f"{self.base_url}/api/auth/login", 
                                         json={"email": "admin@hrportal.com", "password": "Admin@123"})
            if login_response.status_code == 200:
                self.admin_cookies = login_response.cookies
                print(f"   Admin logged in successfully")
                return True
        return False

    def test_employee_login(self):
        """Test employee login and get token"""
        success, response = self.run_test(
            "Employee Login",
            "POST",
            "auth/login",
            200,
            data={"email": "john@company.com", "password": "Test@123"}
        )
        if success and 'id' in response:
            # For cookie-based auth, we need to extract cookies
            login_response = requests.post(f"{self.base_url}/api/auth/login", 
                                         json={"email": "john@company.com", "password": "Test@123"})
            if login_response.status_code == 200:
                self.employee_cookies = login_response.cookies
                self.employee_id = response['id']
                print(f"   Employee logged in successfully, ID: {self.employee_id}")
                return True
        return False

    def test_get_employees(self):
        """Get all employees to find a test employee"""
        url = f"{self.base_url}/api/admin/employees"
        try:
            response = requests.get(url, cookies=self.admin_cookies)
            if response.status_code == 200:
                employees = response.json()
                # Find a non-admin employee
                for emp in employees:
                    if emp.get('role') != 'admin':
                        self.employee_id = emp['id']
                        print(f"✅ Found test employee: {emp['name']} (ID: {self.employee_id})")
                        self.tests_passed += 1
                        self.tests_run += 1
                        return True
                print("❌ No non-admin employees found")
                self.tests_run += 1
                return False
            else:
                print(f"❌ Failed to get employees - Status: {response.status_code}")
                self.tests_run += 1
                return False
        except Exception as e:
            print(f"❌ Failed to get employees - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_set_employee_salary(self):
        """Test setting employee salary"""
        if not self.employee_id:
            print("❌ No employee ID available for salary test")
            self.tests_run += 1
            return False

        url = f"{self.base_url}/api/admin/employees/{self.employee_id}/salary"
        try:
            response = requests.put(url, 
                                  json={"basic_salary": 50000}, 
                                  cookies=self.admin_cookies,
                                  headers={'Content-Type': 'application/json'})
            
            self.tests_run += 1
            if response.status_code == 200:
                print(f"✅ Set employee salary successfully")
                self.tests_passed += 1
                return True
            else:
                print(f"❌ Failed to set salary - Status: {response.status_code}")
                if response.content:
                    try:
                        print(f"   Error: {response.json()}")
                    except:
                        print(f"   Error: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Failed to set salary - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_get_employee_salary(self):
        """Test getting employee salary"""
        if not self.employee_id:
            print("❌ No employee ID available for salary check")
            self.tests_run += 1
            return False

        url = f"{self.base_url}/api/admin/employees/{self.employee_id}/salary"
        try:
            response = requests.get(url, cookies=self.admin_cookies)
            
            self.tests_run += 1
            if response.status_code == 200:
                salary_data = response.json()
                print(f"✅ Retrieved employee salary: ₹{salary_data.get('basic_salary', 0)}")
                self.tests_passed += 1
                return True
            else:
                print(f"❌ Failed to get salary - Status: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Failed to get salary - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_generate_payslip(self):
        """Test generating payslip"""
        if not self.employee_id:
            print("❌ No employee ID available for payslip generation")
            self.tests_run += 1
            return False

        current_date = datetime.now()
        url = f"{self.base_url}/api/admin/payslip/generate"
        try:
            response = requests.post(url, 
                                   json={
                                       "employee_id": self.employee_id,
                                       "month": current_date.month,
                                       "year": current_date.year
                                   }, 
                                   cookies=self.admin_cookies,
                                   headers={'Content-Type': 'application/json'})
            
            self.tests_run += 1
            if response.status_code == 200:
                payslip_data = response.json()
                self.payslip_id = payslip_data.get('id')
                print(f"✅ Generated payslip successfully - ID: {self.payslip_id}")
                print(f"   Basic Salary: ₹{payslip_data.get('basic_salary', 0)}")
                print(f"   Net Pay: ₹{payslip_data.get('net_pay', 0)}")
                self.tests_passed += 1
                return True
            else:
                print(f"❌ Failed to generate payslip - Status: {response.status_code}")
                if response.content:
                    try:
                        print(f"   Error: {response.json()}")
                    except:
                        print(f"   Error: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Failed to generate payslip - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_admin_get_payslips(self):
        """Test admin getting all payslips"""
        url = f"{self.base_url}/api/admin/payslips"
        try:
            response = requests.get(url, cookies=self.admin_cookies)
            
            self.tests_run += 1
            if response.status_code == 200:
                payslips = response.json()
                print(f"✅ Retrieved {len(payslips)} payslips as admin")
                self.tests_passed += 1
                return True
            else:
                print(f"❌ Failed to get payslips as admin - Status: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Failed to get payslips as admin - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_employee_get_payslips(self):
        """Test employee getting their payslips"""
        url = f"{self.base_url}/api/payslip/my-payslips"
        try:
            response = requests.get(url, cookies=self.employee_cookies)
            
            self.tests_run += 1
            if response.status_code == 200:
                payslips = response.json()
                print(f"✅ Employee retrieved {len(payslips)} payslips")
                self.tests_passed += 1
                return True
            else:
                print(f"❌ Failed to get employee payslips - Status: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Failed to get employee payslips - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_download_payslip_admin(self):
        """Test admin downloading payslip PDF"""
        if not self.payslip_id:
            print("❌ No payslip ID available for download test")
            self.tests_run += 1
            return False

        url = f"{self.base_url}/api/payslip/download/{self.payslip_id}"
        try:
            response = requests.get(url, cookies=self.admin_cookies)
            
            self.tests_run += 1
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'pdf' in content_type.lower():
                    print(f"✅ Admin downloaded payslip PDF successfully ({len(response.content)} bytes)")
                    self.tests_passed += 1
                    return True
                else:
                    print(f"❌ Downloaded content is not PDF - Content-Type: {content_type}")
                    return False
            else:
                print(f"❌ Failed to download payslip as admin - Status: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Failed to download payslip as admin - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_download_payslip_employee(self):
        """Test employee downloading their payslip PDF"""
        if not self.payslip_id:
            print("❌ No payslip ID available for employee download test")
            self.tests_run += 1
            return False

        url = f"{self.base_url}/api/payslip/download/{self.payslip_id}"
        try:
            response = requests.get(url, cookies=self.employee_cookies)
            
            self.tests_run += 1
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'pdf' in content_type.lower():
                    print(f"✅ Employee downloaded payslip PDF successfully ({len(response.content)} bytes)")
                    self.tests_passed += 1
                    return True
                else:
                    print(f"❌ Downloaded content is not PDF - Content-Type: {content_type}")
                    return False
            else:
                print(f"❌ Failed to download payslip as employee - Status: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Failed to download payslip as employee - Error: {str(e)}")
            self.tests_run += 1
            return False

def main():
    print("🚀 Starting HR Portal Payslip API Tests")
    print("=" * 50)
    
    tester = HRPortalAPITester()
    
    # Test sequence
    tests = [
        ("Admin Login", tester.test_admin_login),
        ("Employee Login", tester.test_employee_login),
        ("Get Employees", tester.test_get_employees),
        ("Set Employee Salary", tester.test_set_employee_salary),
        ("Get Employee Salary", tester.test_get_employee_salary),
        ("Generate Payslip", tester.test_generate_payslip),
        ("Admin Get All Payslips", tester.test_admin_get_payslips),
        ("Employee Get My Payslips", tester.test_employee_get_payslips),
        ("Admin Download Payslip PDF", tester.test_download_payslip_admin),
        ("Employee Download Payslip PDF", tester.test_download_payslip_employee),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            success = test_func()
            if not success:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS")
    print("=" * 50)
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed tests:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n🎉 All tests passed!")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())