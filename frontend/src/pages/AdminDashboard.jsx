import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  SignOut, Users, CalendarCheck, Clock, House, 
  UserPlus, Check, X, Trash, PencilSimple, Timer, Receipt, CurrencyDollar, DownloadSimple,
  ClockClockwise, FileXls, Envelope
} from "@phosphor-icons/react";

const SHIFTS = {
  general: { name: "General Shift", start: "09:30", end: "17:30" },
  morning: { name: "Morning Shift", start: "04:00", end: "12:00" },
  afternoon: { name: "Afternoon Shift", start: "12:00", end: "20:00" },
  night: { name: "Night Shift", start: "20:00", end: "04:00" }
};

export default function AdminDashboard() {
  const { user, logout, api } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [analytics, setAnalytics] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [editEmployeeOpen, setEditEmployeeOpen] = useState(false);
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [generatePayslipOpen, setGeneratePayslipOpen] = useState(false);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [salaryAmount, setSalaryAmount] = useState("");
  const [selectedShift, setSelectedShift] = useState("general");
  const [payslipForm, setPayslipForm] = useState({
    employee_id: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    send_email: false
  });
  const [exportForm, setExportForm] = useState({
    start_date: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"),
    end_date: format(new Date(), "yyyy-MM-dd"),
    employee_id: ""
  });

  const [newEmployee, setNewEmployee] = useState({
    email: "",
    password: "",
    name: "",
    department: "",
    position: ""
  });

  const [editForm, setEditForm] = useState({
    name: "",
    department: "",
    position: "",
    casual_leave: 0,
    sick_leave: 0,
    earned_leave: 0,
    permission_hours: 2
  });

  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, employeesRes, leaveRes, attendanceRes, permRes, payslipsRes] = await Promise.all([
        api.get("/admin/analytics"),
        api.get("/admin/employees"),
        api.get("/admin/leave-requests"),
        api.get("/admin/attendance"),
        api.get("/admin/permissions"),
        api.get("/admin/payslips")
      ]);
      setAnalytics(analyticsRes.data);
      setEmployees(employeesRes.data);
      setLeaveRequests(leaveRes.data);
      setAttendance(attendanceRes.data);
      setPermissionRequests(permRes.data);
      setPayslips(payslipsRes.data);
    } catch (error) {
      console.error("Error fetching admin data:", error);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddEmployee = async () => {
    if (!newEmployee.email || !newEmployee.password || !newEmployee.name) {
      toast.error("Please fill in required fields");
      return;
    }

    setLoading(true);
    try {
      await api.post("/admin/employees", newEmployee);
      toast.success("Employee added successfully!");
      setAddEmployeeOpen(false);
      setNewEmployee({ email: "", password: "", name: "", department: "", position: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add employee");
    } finally {
      setLoading(false);
    }
  };

  const handleEditEmployee = async () => {
    if (!selectedEmployee) return;

    setLoading(true);
    try {
      await api.put(`/admin/employees/${selectedEmployee.id}`, editForm);
      toast.success("Employee updated successfully!");
      setEditEmployeeOpen(false);
      setSelectedEmployee(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update employee");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) return;

    try {
      await api.delete(`/admin/employees/${employeeId}`);
      toast.success("Employee deleted");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete employee");
    }
  };

  const handleLeaveAction = async (leaveId, action) => {
    try {
      await api.put(`/admin/leave-requests/${leaveId}?action=${action}`);
      toast.success(`Leave request ${action}d`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to process leave request");
    }
  };

  const handlePermissionAction = async (permissionId, action) => {
    try {
      await api.put(`/admin/permissions/${permissionId}?action=${action}`);
      toast.success(`Permission request ${action}d`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to process permission request");
    }
  };

  const openEditModal = (employee) => {
    setSelectedEmployee(employee);
    setEditForm({
      name: employee.name,
      department: employee.department || "",
      position: employee.position || "",
      casual_leave: employee.casual_leave || 12,
      sick_leave: employee.sick_leave || 6,
      earned_leave: employee.earned_leave || 15,
      permission_hours: employee.permission_hours || 2
    });
    setEditEmployeeOpen(true);
  };

  const openSalaryModal = async (employee) => {
    setSelectedEmployee(employee);
    try {
      const { data } = await api.get(`/admin/employees/${employee.id}/salary`);
      setSalaryAmount(data.basic_salary?.toString() || "");
    } catch (error) {
      setSalaryAmount("");
    }
    setSalaryDialogOpen(true);
  };

  const handleSetSalary = async () => {
    if (!salaryAmount || isNaN(parseFloat(salaryAmount))) {
      toast.error("Please enter a valid salary amount");
      return;
    }

    setLoading(true);
    try {
      await api.put(`/admin/employees/${selectedEmployee.id}/salary`, {
        basic_salary: parseFloat(salaryAmount)
      });
      toast.success("Salary updated successfully!");
      setSalaryDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update salary");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePayslip = async () => {
    if (!payslipForm.employee_id) {
      toast.error("Please select an employee");
      return;
    }

    setLoading(true);
    try {
      const result = await api.post("/admin/payslip/generate", payslipForm);
      if (payslipForm.send_email && result.data.email_sent) {
        toast.success("Payslip generated and emailed successfully!");
      } else if (payslipForm.send_email && !result.data.email_sent) {
        toast.success("Payslip generated! (Email not configured)");
      } else {
        toast.success("Payslip generated successfully!");
      }
      setGeneratePayslipOpen(false);
      setPayslipForm({
        employee_id: "",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        send_email: false
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to generate payslip");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignShift = async () => {
    if (!selectedEmployee) return;

    setLoading(true);
    try {
      const endpoint = selectedEmployee.shift 
        ? `/admin/employees/${selectedEmployee.id}/shift/change`
        : `/admin/employees/${selectedEmployee.id}/shift`;
      
      await api.put(endpoint, { shift: selectedShift });
      toast.success("Shift assigned successfully!");
      setShiftDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to assign shift");
    } finally {
      setLoading(false);
    }
  };

  const handleExportAttendance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start_date: exportForm.start_date,
        end_date: exportForm.end_date
      });
      if (exportForm.employee_id) {
        params.append("employee_id", exportForm.employee_id);
      }

      const response = await api.get(`/reports/attendance/export?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_report_${exportForm.start_date}_to_${exportForm.end_date}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Attendance report exported!");
      setExportDialogOpen(false);
    } catch (error) {
      toast.error("Failed to export attendance report");
    } finally {
      setLoading(false);
    }
  };

  const openShiftModal = (employee) => {
    setSelectedEmployee(employee);
    setSelectedShift(employee.shift || "general");
    setShiftDialogOpen(true);
  };

  const handleDownloadPayslip = async (payslipId) => {
    try {
      const response = await api.get(`/payslip/download/${payslipId}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip_${payslipId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Payslip downloaded!");
    } catch (error) {
      toast.error("Failed to download payslip");
    }
  };

  const handleDeletePayslip = async (payslipId) => {
    if (!window.confirm("Are you sure you want to delete this payslip?")) return;

    try {
      await api.delete(`/admin/payslips/${payslipId}`);
      toast.success("Payslip deleted");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete payslip");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return <span className="badge-approved">Approved</span>;
      case "rejected":
        return <span className="badge-rejected">Rejected</span>;
      default:
        return <span className="badge-pending">Pending</span>;
    }
  };

  const months = [
    { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
    { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
    { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
    { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" }
  ];

  const navItems = [
    { id: "overview", label: "Overview", icon: House },
    { id: "employees", label: "Employees", icon: Users },
    { id: "payslips", label: "Payslips", icon: Receipt },
    { id: "leaves", label: "Leave Requests", icon: CalendarCheck },
    { id: "permissions", label: "Permissions", icon: Timer },
    { id: "attendance", label: "Attendance", icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 w-64 h-screen bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img 
              src="https://static.prod-images.emergentagent.com/jobs/aaf63ca7-adc6-4c7b-937b-09773c3509ed/images/f54676851e2ae99a51a94037909cd1cec0feddb104a3fbd9c71931cef8478ad0.png" 
              alt="HR Portal Logo"
              className="h-8 w-8"
            />
            <span className="text-xl font-bold text-gray-900 font-['Outfit']">HR Portal</span>
          </div>
          <span className="text-xs font-bold text-[#002FA7] uppercase tracking-wider mt-2 block">Admin Panel</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={activeTab === item.id ? "nav-item-active w-full" : "nav-item w-full"}
            >
              <item.icon className="h-5 w-5" weight="duotone" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <img 
              src={user?.avatar_url || "https://images.unsplash.com/photo-1762522926157-bcc04bf0b10a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBjb3Jwb3JhdGUlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NTY0NjY4M3ww&ixlib=rb-4.1.0&q=85"}
              alt={user?.name}
              className="h-10 w-10 rounded-full object-cover border border-gray-200"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">Administrator</p>
            </div>
          </div>
          <Button
            data-testid="admin-logout-btn"
            onClick={logout}
            variant="outline"
            className="w-full justify-start gap-2 text-gray-600 hover:text-gray-900 border-gray-200"
          >
            <SignOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        {/* Overview Tab */}
        {activeTab === "overview" && analytics && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 font-['Outfit'] tracking-tight">Dashboard Overview</h1>
              <p className="text-gray-500 mt-1">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="metric-card">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-[#002FA7]" weight="duotone" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Employees</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{analytics.total_employees}</p>
              </div>

              <div className="metric-card" style={{ borderLeftColor: '#00C853' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Check className="h-5 w-5 text-[#00C853]" weight="duotone" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Present Today</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{analytics.present_today}</p>
              </div>

              <div className="metric-card" style={{ borderLeftColor: '#FF2E00' }}>
                <div className="flex items-center gap-2 mb-3">
                  <X className="h-5 w-5 text-[#FF2E00]" weight="duotone" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Absent Today</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{analytics.absent_today}</p>
              </div>

              <div className="metric-card" style={{ borderLeftColor: '#FFC107' }}>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarCheck className="h-5 w-5 text-[#FFC107]" weight="duotone" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pending Leaves</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{analytics.pending_leaves}</p>
              </div>
            </div>

            {/* Department Breakdown */}
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 font-['Outfit'] mb-4">Department Breakdown</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {analytics.department_breakdown?.map((dept, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-sm">
                    <p className="text-sm text-gray-500">{dept.department || "General"}</p>
                    <p className="text-2xl font-bold text-gray-900">{dept.count}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Employees Tab */}
        {activeTab === "employees" && (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 font-['Outfit'] tracking-tight">Employees</h1>
                <p className="text-gray-500 mt-1">Manage your team members</p>
              </div>
              <Dialog open={addEmployeeOpen} onOpenChange={setAddEmployeeOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="add-employee-btn" className="bg-[#002FA7] text-white hover:bg-[#001F70] gap-2">
                    <UserPlus className="h-4 w-4" weight="bold" />
                    Add Employee
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-['Outfit']">Add New Employee</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-gray-500 -mt-2">Enter the details for the new employee.</p>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Full Name *</Label>
                      <Input
                        data-testid="new-employee-name"
                        placeholder="John Doe"
                        value={newEmployee.name}
                        onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        data-testid="new-employee-email"
                        type="email"
                        placeholder="john@company.com"
                        value={newEmployee.email}
                        onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <Input
                        data-testid="new-employee-password"
                        type="password"
                        placeholder="Enter password"
                        value={newEmployee.password}
                        onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Input
                          data-testid="new-employee-department"
                          placeholder="Engineering"
                          value={newEmployee.department}
                          onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Position</Label>
                        <Input
                          data-testid="new-employee-position"
                          placeholder="Developer"
                          value={newEmployee.position}
                          onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button
                      data-testid="submit-new-employee"
                      onClick={handleAddEmployee}
                      disabled={loading}
                      className="w-full bg-[#002FA7] text-white hover:bg-[#001F70]"
                    >
                      Add Employee
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Employees Table */}
            <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Employee</th>
                    <th className="table-header">Department</th>
                    <th className="table-header">Shift</th>
                    <th className="table-header">Salary</th>
                    <th className="table-header">Role</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="table-row">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <img 
                            src={emp.avatar_url || "https://images.unsplash.com/photo-1762522926157-bcc04bf0b10a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBjb3Jwb3JhdGUlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NTY0NjY4M3ww&ixlib=rb-4.1.0&q=85"}
                            alt={emp.name}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{emp.name}</p>
                            <p className="text-xs text-gray-500">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">{emp.department || "—"}</td>
                      <td className="table-cell">
                        {emp.shift && SHIFTS[emp.shift] ? (
                          <span className="text-xs px-2 py-1 bg-[#E5ECFF] text-[#002FA7] rounded-full font-medium">
                            {SHIFTS[emp.shift].name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Not assigned</span>
                        )}
                      </td>
                      <td className="table-cell">
                        {emp.basic_salary ? (
                          <span className="text-[#00C853] font-medium">₹{emp.basic_salary.toLocaleString()}</span>
                        ) : (
                          <span className="text-gray-400">Not set</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                          emp.role === "admin" ? "bg-[#E5ECFF] text-[#002FA7]" : "bg-gray-100 text-gray-600"
                        }`}>
                          {emp.role}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          {emp.role !== "admin" && (
                            <>
                              <Button
                                data-testid={`set-shift-${emp.id}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => openShiftModal(emp)}
                                className="text-gray-500 hover:text-[#002FA7]"
                                title="Assign Shift"
                              >
                                <ClockClockwise className="h-4 w-4" />
                              </Button>
                              <Button
                                data-testid={`set-salary-${emp.id}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => openSalaryModal(emp)}
                                className="text-gray-500 hover:text-[#00C853]"
                                title="Set Salary"
                              >
                                <CurrencyDollar className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            data-testid={`edit-employee-${emp.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(emp)}
                            className="text-gray-500 hover:text-[#002FA7]"
                          >
                            <PencilSimple className="h-4 w-4" />
                          </Button>
                          {emp.role !== "admin" && (
                            <Button
                              data-testid={`delete-employee-${emp.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className="text-gray-500 hover:text-red-500"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Edit Employee Dialog */}
            <Dialog open={editEmployeeOpen} onOpenChange={setEditEmployeeOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-['Outfit']">Edit Employee</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-gray-500 -mt-2">Update employee information and leave balances.</p>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      data-testid="edit-employee-name"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input
                        data-testid="edit-employee-department"
                        value={editForm.department}
                        onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Input
                        data-testid="edit-employee-position"
                        value={editForm.position}
                        onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Casual Leave</Label>
                      <Input
                        data-testid="edit-casual-leave"
                        type="number"
                        value={editForm.casual_leave}
                        onChange={(e) => setEditForm({ ...editForm, casual_leave: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sick Leave</Label>
                      <Input
                        data-testid="edit-sick-leave"
                        type="number"
                        value={editForm.sick_leave}
                        onChange={(e) => setEditForm({ ...editForm, sick_leave: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Earned Leave</Label>
                      <Input
                        data-testid="edit-earned-leave"
                        type="number"
                        value={editForm.earned_leave}
                        onChange={(e) => setEditForm({ ...editForm, earned_leave: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <Button
                    data-testid="save-employee-changes"
                    onClick={handleEditEmployee}
                    disabled={loading}
                    className="w-full bg-[#002FA7] text-white hover:bg-[#001F70]"
                  >
                    Save Changes
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Salary Dialog */}
            <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-['Outfit']">Set Employee Salary</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-gray-500 -mt-2">
                  Set monthly basic salary for {selectedEmployee?.name}
                </p>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Basic Salary (₹)</Label>
                    <Input
                      data-testid="salary-amount-input"
                      type="number"
                      placeholder="50000"
                      value={salaryAmount}
                      onChange={(e) => setSalaryAmount(e.target.value)}
                    />
                  </div>
                  <Button
                    data-testid="save-salary-btn"
                    onClick={handleSetSalary}
                    disabled={loading}
                    className="w-full bg-[#00C853] text-white hover:bg-[#00A844]"
                  >
                    Save Salary
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Shift Assignment Dialog */}
            <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-['Outfit']">Assign Shift</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-gray-500 -mt-2">
                  {selectedEmployee?.shift 
                    ? `Change shift for ${selectedEmployee?.name} (currently: ${SHIFTS[selectedEmployee?.shift]?.name})`
                    : `Assign shift to ${selectedEmployee?.name}`}
                </p>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Select Shift</Label>
                    <Select value={selectedShift} onValueChange={setSelectedShift}>
                      <SelectTrigger data-testid="shift-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SHIFTS).map(([key, value]) => (
                          <SelectItem key={key} value={key}>
                            {value.name} ({value.start} - {value.end})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedEmployee?.shift && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      Note: Changing shift requires admin override.
                    </p>
                  )}
                  <Button
                    data-testid="assign-shift-btn"
                    onClick={handleAssignShift}
                    disabled={loading}
                    className="w-full bg-[#002FA7] text-white hover:bg-[#001F70]"
                  >
                    {selectedEmployee?.shift ? "Change Shift" : "Assign Shift"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* Payslips Tab */}
        {activeTab === "payslips" && (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 font-['Outfit'] tracking-tight">Payslips</h1>
                <p className="text-gray-500 mt-1">Generate and manage employee payslips</p>
              </div>
              <Dialog open={generatePayslipOpen} onOpenChange={setGeneratePayslipOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="generate-payslip-btn" className="bg-[#002FA7] text-white hover:bg-[#001F70] gap-2">
                    <Receipt className="h-4 w-4" weight="bold" />
                    Generate Payslip
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-['Outfit']">Generate Payslip</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-gray-500 -mt-2">Select employee and pay period to generate payslip.</p>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Employee</Label>
                      <Select
                        value={payslipForm.employee_id}
                        onValueChange={(value) => setPayslipForm({ ...payslipForm, employee_id: value })}
                      >
                        <SelectTrigger data-testid="payslip-employee-select">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.filter(e => e.role !== "admin" && e.basic_salary > 0).map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name} - ₹{emp.basic_salary?.toLocaleString()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">Only employees with salary set are shown</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Month</Label>
                        <Select
                          value={payslipForm.month.toString()}
                          onValueChange={(value) => setPayslipForm({ ...payslipForm, month: parseInt(value) })}
                        >
                          <SelectTrigger data-testid="payslip-month-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {months.map((m) => (
                              <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Input
                          data-testid="payslip-year-input"
                          type="number"
                          value={payslipForm.year}
                          onChange={(e) => setPayslipForm({ ...payslipForm, year: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-sm">
                      <Checkbox
                        id="send-email"
                        checked={payslipForm.send_email}
                        onCheckedChange={(checked) => setPayslipForm({ ...payslipForm, send_email: checked })}
                      />
                      <div className="flex items-center gap-2">
                        <Envelope className="h-4 w-4 text-gray-500" />
                        <Label htmlFor="send-email" className="text-sm cursor-pointer">
                          Send payslip via email
                        </Label>
                      </div>
                    </div>
                    <Button
                      data-testid="submit-generate-payslip"
                      onClick={handleGeneratePayslip}
                      disabled={loading}
                      className="w-full bg-[#002FA7] text-white hover:bg-[#001F70]"
                    >
                      {payslipForm.send_email ? "Generate & Email Payslip" : "Generate Payslip"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Employee</th>
                    <th className="table-header">Pay Period</th>
                    <th className="table-header">Basic Salary</th>
                    <th className="table-header">Deductions</th>
                    <th className="table-header">Net Pay</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">No payslips generated yet</td>
                    </tr>
                  ) : (
                    payslips.map((ps) => (
                      <tr key={ps.id} className="table-row">
                        <td className="table-cell">
                          <p className="font-medium text-gray-900">{ps.employee_name}</p>
                          <p className="text-xs text-gray-500">{ps.employee_email}</p>
                        </td>
                        <td className="table-cell">{ps.month_name} {ps.year}</td>
                        <td className="table-cell">₹{ps.basic_salary?.toLocaleString()}</td>
                        <td className="table-cell text-[#FF2E00]">-₹{ps.total_deductions?.toLocaleString()}</td>
                        <td className="table-cell font-bold text-[#00C853]">₹{ps.net_pay?.toLocaleString()}</td>
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <Button
                              data-testid={`download-payslip-${ps.id}`}
                              size="sm"
                              onClick={() => handleDownloadPayslip(ps.id)}
                              className="bg-[#002FA7] hover:bg-[#001F70] text-white gap-1"
                            >
                              <DownloadSimple className="h-4 w-4" />
                              PDF
                            </Button>
                            <Button
                              data-testid={`delete-payslip-${ps.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePayslip(ps.id)}
                              className="text-gray-500 hover:text-red-500"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Leave Requests Tab */}
        {activeTab === "leaves" && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 font-['Outfit'] tracking-tight">Leave Requests</h1>
              <p className="text-gray-500 mt-1">Review and manage leave applications</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Employee</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Dates</th>
                    <th className="table-header">Reason</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">No leave requests</td>
                    </tr>
                  ) : (
                    leaveRequests.map((req) => (
                      <tr key={req.id} className="table-row">
                        <td className="table-cell">
                          <p className="font-medium text-gray-900">{req.user_name}</p>
                          <p className="text-xs text-gray-500">{req.user_email}</p>
                        </td>
                        <td className="table-cell capitalize">{req.leave_type}</td>
                        <td className="table-cell">
                          <p>{format(new Date(req.start_date), "MMM d")} - {format(new Date(req.end_date), "MMM d, yyyy")}</p>
                          <p className="text-xs text-gray-500">{req.days} day(s)</p>
                        </td>
                        <td className="table-cell max-w-xs truncate">{req.reason}</td>
                        <td className="table-cell">{getStatusBadge(req.status)}</td>
                        <td className="table-cell">
                          {req.status === "pending" && (
                            <div className="flex items-center gap-2">
                              <Button
                                data-testid={`approve-leave-${req.id}`}
                                size="sm"
                                onClick={() => handleLeaveAction(req.id, "approve")}
                                className="bg-[#00C853] hover:bg-[#00A844] text-white h-8 px-3"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                data-testid={`reject-leave-${req.id}`}
                                size="sm"
                                onClick={() => handleLeaveAction(req.id, "reject")}
                                className="bg-[#FF2E00] hover:bg-[#CC2500] text-white h-8 px-3"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {req.status !== "pending" && req.reviewed_by && (
                            <p className="text-xs text-gray-500">by {req.reviewed_by}</p>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Attendance Tab */}
        {activeTab === "attendance" && (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 font-['Outfit'] tracking-tight">Attendance Records</h1>
                <p className="text-gray-500 mt-1">View employee attendance history</p>
              </div>
              <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="export-attendance-btn" className="bg-[#00C853] text-white hover:bg-[#00A844] gap-2">
                    <FileXls className="h-4 w-4" weight="bold" />
                    Export to Excel
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-['Outfit']">Export Attendance Report</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-gray-500 -mt-2">Select date range and employee to export.</p>
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input
                          data-testid="export-start-date"
                          type="date"
                          value={exportForm.start_date}
                          onChange={(e) => setExportForm({ ...exportForm, start_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input
                          data-testid="export-end-date"
                          type="date"
                          value={exportForm.end_date}
                          onChange={(e) => setExportForm({ ...exportForm, end_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Employee (optional)</Label>
                      <Select
                        value={exportForm.employee_id}
                        onValueChange={(value) => setExportForm({ ...exportForm, employee_id: value })}
                      >
                        <SelectTrigger data-testid="export-employee-select">
                          <SelectValue placeholder="All employees" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All employees</SelectItem>
                          {employees.filter(e => e.role !== "admin").map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      data-testid="download-export-btn"
                      onClick={handleExportAttendance}
                      disabled={loading}
                      className="w-full bg-[#00C853] text-white hover:bg-[#00A844] gap-2"
                    >
                      <DownloadSimple className="h-4 w-4" />
                      Download Excel Report
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Employee</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Clock In</th>
                    <th className="table-header">Clock Out</th>
                    <th className="table-header">Break Time</th>
                    <th className="table-header">Working Hours</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-gray-500">No attendance records</td>
                    </tr>
                  ) : (
                    attendance.slice(0, 50).map((rec, idx) => (
                      <tr key={idx} className="table-row">
                        <td className="table-cell font-medium">{rec.user_name}</td>
                        <td className="table-cell">{format(new Date(rec.date), "MMM d, yyyy")}</td>
                        <td className="table-cell">{format(new Date(rec.clock_in), "h:mm a")}</td>
                        <td className="table-cell">
                          {rec.clock_out ? format(new Date(rec.clock_out), "h:mm a") : "—"}
                        </td>
                        <td className="table-cell">{rec.total_break_minutes || 0} min</td>
                        <td className="table-cell">
                          <span className={rec.working_hours && rec.working_hours < 8 ? "text-[#FF2E00] font-medium" : ""}>
                            {rec.working_hours ? `${rec.working_hours.toFixed(2)}h` : "—"}
                          </span>
                        </td>
                        <td className="table-cell">
                          {rec.is_short_day ? (
                            <span className="badge-rejected">Short Day</span>
                          ) : rec.clock_out ? (
                            <span className="badge-approved">Completed</span>
                          ) : (
                            <span className="badge-pending">Active</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Permissions Tab */}
        {activeTab === "permissions" && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 font-['Outfit'] tracking-tight">Permission Requests</h1>
              <p className="text-gray-500 mt-1">Review and manage permission applications (2 hours/month per employee, max 1 hour per use)</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Employee</th>
                    <th className="table-header">Duration</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Reason</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionRequests.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">No permission requests</td>
                    </tr>
                  ) : (
                    permissionRequests.map((perm) => (
                      <tr key={perm.id} className="table-row">
                        <td className="table-cell">
                          <p className="font-medium text-gray-900">{perm.user_name}</p>
                          <p className="text-xs text-gray-500">{perm.user_email}</p>
                        </td>
                        <td className="table-cell">{perm.duration_minutes} min</td>
                        <td className="table-cell">{format(new Date(perm.date), "MMM d, yyyy")}</td>
                        <td className="table-cell max-w-xs truncate">{perm.reason}</td>
                        <td className="table-cell">{getStatusBadge(perm.status)}</td>
                        <td className="table-cell">
                          {perm.status === "pending" && (
                            <div className="flex items-center gap-2">
                              <Button
                                data-testid={`approve-permission-${perm.id}`}
                                size="sm"
                                onClick={() => handlePermissionAction(perm.id, "approve")}
                                className="bg-[#00C853] hover:bg-[#00A844] text-white h-8 px-3"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                data-testid={`reject-permission-${perm.id}`}
                                size="sm"
                                onClick={() => handlePermissionAction(perm.id, "reject")}
                                className="bg-[#FF2E00] hover:bg-[#CC2500] text-white h-8 px-3"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {perm.status !== "pending" && perm.reviewed_by && (
                            <p className="text-xs text-gray-500">by {perm.reviewed_by}</p>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
