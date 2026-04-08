import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  SignOut, Users, CalendarCheck, ChartBar, Clock, House, 
  UserPlus, Check, X, Coffee, Trash, PencilSimple
} from "@phosphor-icons/react";

export default function AdminDashboard() {
  const { user, logout, api } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [analytics, setAnalytics] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [editEmployeeOpen, setEditEmployeeOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

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
    earned_leave: 0
  });

  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, employeesRes, leaveRes, attendanceRes] = await Promise.all([
        api.get("/admin/analytics"),
        api.get("/admin/employees"),
        api.get("/admin/leave-requests"),
        api.get("/admin/attendance")
      ]);
      setAnalytics(analyticsRes.data);
      setEmployees(employeesRes.data);
      setLeaveRequests(leaveRes.data);
      setAttendance(attendanceRes.data);
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

  const openEditModal = (employee) => {
    setSelectedEmployee(employee);
    setEditForm({
      name: employee.name,
      department: employee.department || "",
      position: employee.position || "",
      casual_leave: employee.casual_leave || 12,
      sick_leave: employee.sick_leave || 6,
      earned_leave: employee.earned_leave || 15
    });
    setEditEmployeeOpen(true);
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

  const navItems = [
    { id: "overview", label: "Overview", icon: House },
    { id: "employees", label: "Employees", icon: Users },
    { id: "leaves", label: "Leave Requests", icon: CalendarCheck },
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
                    <th className="table-header">Position</th>
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
                      <td className="table-cell">{emp.position || "—"}</td>
                      <td className="table-cell">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                          emp.role === "admin" ? "bg-[#E5ECFF] text-[#002FA7]" : "bg-gray-100 text-gray-600"
                        }`}>
                          {emp.role}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
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
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 font-['Outfit'] tracking-tight">Attendance Records</h1>
              <p className="text-gray-500 mt-1">View employee attendance history</p>
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
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">No attendance records</td>
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
                          {rec.clock_out ? (
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
      </main>
    </div>
  );
}
