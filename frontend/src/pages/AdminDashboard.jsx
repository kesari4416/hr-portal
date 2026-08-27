import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  SignOut, Users, CalendarCheck, Clock, House, 
  UserPlus, Check, X, Trash, PencilSimple, Timer, Receipt, CurrencyDollar, DownloadSimple,
  ClockClockwise, FileXls, Key, CalendarStar, Camera, Scroll, Plus, PencilLine, TrashSimple, Laptop,
  GitPullRequest, MapPin, GearSix, NavigationArrow, Bell, Warning
} from "@phosphor-icons/react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default Leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});
import { useRef } from "react";

// Convert decimal hours (e.g., 8.57) to "Xh Ym" format
const formatHours = (decimalHours) => {
  if (!decimalHours) return "—";
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours}h ${minutes}m`;
};

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";

const getAvatarUrl = (url) => {
  if (!url || url === "") return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
};

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
};

const Avatar = ({ url, name, size = "h-8 w-8", textSize = "text-xs" }) => {
  const src = getAvatarUrl(url);
  if (src) {
    return <img src={src} alt={name} className={`${size} rounded-full object-cover`} />;
  }
  return (
    <div className={`${size} rounded-full bg-[#002FA7] text-white flex items-center justify-center font-bold ${textSize}`}>
      {getInitials(name)}
    </div>
  );
};

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
  const [holidays, setHolidays] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [wfhRequests, setWfhRequests] = useState([]);
  const [payrollSummary, setPayrollSummary] = useState(null);
  const [payrollSubTab, setPayrollSubTab] = useState("dashboard");
  const [selectedEmpDeductions, setSelectedEmpDeductions] = useState([]);
  const [deductionDialogOpen, setDeductionDialogOpen] = useState(false);
  const [selectedDeductionEmp, setSelectedDeductionEmp] = useState(null);
  const [deductionForm, setDeductionForm] = useState({ deduction_name: "", amount: 0, is_percentage: false, percentage: 0 });
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkMonth, setBulkMonth] = useState(new Date().getMonth() + 1);
  const [bulkYear, setBulkYear] = useState(new Date().getFullYear());
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [policyForm, setPolicyForm] = useState({ title: "", category: "", content: "", icon: "article", sort_order: 0 });
  const [loading, setLoading] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [editEmployeeOpen, setEditEmployeeOpen] = useState(false);
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [generatePayslipOpen, setGeneratePayslipOpen] = useState(false);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [salaryAmount, setSalaryAmount] = useState("");
  const [selectedShift, setSelectedShift] = useState("general");
  const avatarInputRef = useRef(null);
  const [uploadingAvatarFor, setUploadingAvatarFor] = useState(null);
  const [payslipForm, setPayslipForm] = useState({
    employee_id: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
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
    position: "",
    role: "employee"
  });

  const [editForm, setEditForm] = useState({
    name: "",
    department: "",
    position: "",
    casual_leave: 0,
    sick_leave: 0,
    permission_hours: 2,
    role: "employee",
    wfh_limit: 4
  });
  const [changeRequests, setChangeRequests] = useState([]);
  const [crActionNotes, setCrActionNotes] = useState("");
  const [attendanceView, setAttendanceView] = useState("table");
  const [locationData, setLocationData] = useState([]);
  const [officeSettings, setOfficeSettings] = useState({ latitude: 10.0159, longitude: 76.3419, radius_km: 0.5, office_name: "Office" });
  const [officeDialogOpen, setOfficeDialogOpen] = useState(false);
  const [officeForm, setOfficeForm] = useState({ latitude: 10.0159, longitude: 76.3419, radius_km: 0.5, office_name: "Office" });
  const [locationDate, setLocationDate] = useState(new Date().toISOString().split("T")[0]);
  const [notifications, setNotifications] = useState({ total: 0, items: [] });
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [heatmapData, setHeatmapData] = useState({ dates: [], employees: [] });

  const fetchData = useCallback(async () => {
    try {
      const promises = [
        api.get("/admin/analytics"),
        api.get("/admin/employees"),
        api.get("/admin/leave-requests"),
        api.get("/admin/attendance"),
        api.get("/admin/permissions"),
        api.get("/holidays/list"),
        api.get("/policy/list"),
        api.get("/admin/wfh-requests"),
        api.get("/admin/payroll/summary"),
        api.get("/admin/change-requests"),
        api.get("/admin/office-settings").catch(() => ({ data: { latitude: 10.0159, longitude: 76.3419, radius_km: 0.5, name: "Office" } })),
        api.get(`/admin/attendance/locations?date=${new Date().toISOString().split("T")[0]}`).catch(() => ({ data: [] }))
      ];
      // Only admins can access payslips
      if (user?.role === "admin") {
        promises.push(api.get("/admin/payslips"));
      }
      const results = await Promise.all(promises);
      setAnalytics(results[0].data);
      setEmployees(results[1].data);
      setLeaveRequests(results[2].data);
      setAttendance(results[3].data);
      setPermissionRequests(results[4].data);
      setHolidays(results[5].data);
      setPolicies(results[6].data);
      setWfhRequests(results[7].data);
      setPayrollSummary(results[8].data);
      setChangeRequests(results[9].data);
      const oSettings = results[10].data;
      setOfficeSettings(oSettings);
      setOfficeForm({ latitude: oSettings.latitude, longitude: oSettings.longitude, radius_km: oSettings.radius_km, office_name: oSettings.name || "Office" });
      setLocationData(results[11].data);
      if (user?.role === "admin" && results[12]) {
        setPayslips(results[12].data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, [api, user?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll notifications every 30 seconds + fetch heatmap
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get("/admin/notifications");
        setNotifications(res.data);
        // Browser notification for new pending items
        if (res.data.total > 0 && Notification.permission === "granted") {
          // Only show if there's a new increase (basic check)
          const prevTotal = parseInt(sessionStorage.getItem("notif_total") || "0");
          if (res.data.total > prevTotal) {
            new Notification("Sparkcurv HR Portal", {
              body: res.data.items.map(i => i.label).join(", "),
              icon: "/favicon.ico"
            });
          }
          sessionStorage.setItem("notif_total", res.data.total.toString());
        }
      } catch {}
    };
    const fetchHeatmap = async () => {
      try {
        const res = await api.get("/admin/attendance/heatmap?weeks=4");
        setHeatmapData(res.data);
      } catch {}
    };
    // Request notification permission
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
    fetchNotifications();
    fetchHeatmap();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

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
      setNewEmployee({ email: "", password: "", name: "", department: "", position: "", role: "employee" });
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

  const handleResetPassword = async () => {
    if (!selectedEmployee || !resetPasswordValue) {
      toast.error("Please enter a new password");
      return;
    }
    if (resetPasswordValue.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/admin/employees/${selectedEmployee.id}/reset-password`, { new_password: resetPasswordValue });
      toast.success(`Password reset for ${selectedEmployee.name}`);
      setResetPasswordOpen(false);
      setResetPasswordValue("");
      setSelectedEmployee(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingAvatarFor) return;
    
    const formData = new FormData();
    formData.append("file", file);
    
    setLoading(true);
    try {
      await api.post(`/admin/employees/${uploadingAvatarFor}/avatar`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success("Photo uploaded successfully");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload photo");
    } finally {
      setLoading(false);
      setUploadingAvatarFor(null);
      e.target.value = "";
    }
  };

  const handleSavePolicy = async () => {
    if (!policyForm.title || !policyForm.content || !policyForm.category) {
      toast.error("Title, category and content are required");
      return;
    }
    setLoading(true);
    try {
      if (editingPolicy) {
        await api.put(`/policy/${editingPolicy.id}`, policyForm);
        toast.success("Policy updated");
      } else {
        await api.post("/policy/create", policyForm);
        toast.success("Policy created");
      }
      setPolicyDialogOpen(false);
      setEditingPolicy(null);
      setPolicyForm({ title: "", category: "", content: "", icon: "article", sort_order: 0 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save policy");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePolicy = async (policyId) => {
    if (!window.confirm("Delete this policy?")) return;
    try {
      await api.delete(`/policy/${policyId}`);
      toast.success("Policy deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete policy");
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

  const handleWfhAction = async (wfhId, action) => {
    try {
      await api.put(`/admin/wfh-requests/${wfhId}?action=${action}`);
      toast.success(`WFH request ${action}d`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to process WFH request");
    }
  };

  // Payroll handlers
  const handleBulkProcess = async () => {
    setBulkProcessing(true);
    try {
      const res = await api.post("/admin/payroll/process", { month: bulkMonth, year: bulkYear });
      toast.success(`Payroll processed: ${res.data.generated} payslips generated, ${res.data.skipped} skipped`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to process payroll");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleLoadDeductions = async (emp) => {
    setSelectedDeductionEmp(emp);
    try {
      const res = await api.get(`/admin/deductions/${emp.id}`);
      setSelectedEmpDeductions(res.data);
      setDeductionDialogOpen(true);
    } catch { setSelectedEmpDeductions([]); setDeductionDialogOpen(true); }
  };

  const handleAddDeduction = async () => {
    if (!deductionForm.deduction_name) { toast.error("Enter deduction name"); return; }
    try {
      await api.post("/admin/deductions", {
        user_id: parseInt(selectedDeductionEmp.id),
        deduction_name: deductionForm.deduction_name,
        amount: deductionForm.is_percentage ? 0 : deductionForm.amount,
        is_percentage: deductionForm.is_percentage,
        percentage: deductionForm.is_percentage ? deductionForm.percentage : 0
      });
      toast.success("Deduction added");
      setDeductionForm({ deduction_name: "", amount: 0, is_percentage: false, percentage: 0 });
      const res = await api.get(`/admin/deductions/${selectedDeductionEmp.id}`);
      setSelectedEmpDeductions(res.data);
    } catch (error) { toast.error(error.response?.data?.detail || "Failed"); }
  };

  const handleDeleteDeduction = async (dedId) => {
    try {
      await api.delete(`/admin/deductions/${dedId}`);
      toast.success("Deduction removed");
      const res = await api.get(`/admin/deductions/${selectedDeductionEmp.id}`);
      setSelectedEmpDeductions(res.data);
    } catch (error) { toast.error("Failed to delete"); }
  };

  const handleCRAction = async (crId, step, action) => {
    try {
      const endpoint = step === "manager"
        ? `/admin/change-requests/${crId}/manager-action?action=${action}&notes=${encodeURIComponent(crActionNotes)}`
        : `/admin/change-requests/${crId}/admin-action?action=${action}&notes=${encodeURIComponent(crActionNotes)}`;
      await api.put(endpoint);
      toast.success(`CR ${action}d successfully`);
      setCrActionNotes("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${action} CR`);
    }
  };

  const handleSaveOfficeSettings = async () => {
    try {
      await api.put("/admin/office-settings", officeForm);
      toast.success("Office location settings saved!");
      setOfficeSettings({ ...officeForm, name: officeForm.office_name });
      setOfficeDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save office settings");
    }
  };

  const fetchLocationData = async (date) => {
    try {
      const res = await api.get(`/admin/attendance/locations?date=${date}`);
      setLocationData(res.data);
    } catch { setLocationData([]); }
  };

  const openEditModal = (employee) => {
    setSelectedEmployee(employee);
    setEditForm({
      name: employee.name,
      department: employee.department || "",
      position: employee.position || "",
      casual_leave: employee.casual_leave || 12,
      sick_leave: employee.sick_leave || 3,
      permission_hours: employee.permission_hours || 2,
      role: employee.role || "employee",
      wfh_limit: employee.wfh_limit ?? 4
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
      await api.post("/admin/payslip/generate", payslipForm);
      toast.success("Payslip generated successfully!");
      setGeneratePayslipOpen(false);
      setPayslipForm({
        employee_id: "",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
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

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";

  const allNavItems = [
    { id: "overview", label: "Overview", icon: House },
    { id: "employees", label: "Employees", icon: Users, adminOnly: true },
    { id: "payroll", label: "Payroll", icon: CurrencyDollar, adminOnly: true },
    { id: "change-requests", label: "Change Requests", icon: GitPullRequest },
    { id: "leaves", label: "Leave Requests", icon: CalendarCheck },
    { id: "wfh", label: "WFH Requests", icon: Laptop },
    { id: "permissions", label: "Permissions", icon: Timer },
    { id: "attendance", label: "Attendance", icon: Clock },
    { id: "holidays", label: "Holidays", icon: CalendarStar },
    { id: "policy", label: "Company Policy", icon: Scroll },
  ];

  const navItems = allNavItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 w-64 h-screen bg-white border-r border-slate-200 flex flex-col" style={{ boxShadow: '4px 0 24px rgba(15,23,42,0.04)' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                background: 'linear-gradient(135deg, #002FA7 0%, #3B5BDB 100%)',
                boxShadow: '0 4px 10px rgba(0,47,167,0.25)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M3 10.5C3 6.91 5.91 4 9.5 4s6.5 2.91 6.5 6.5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                <circle cx="9.5" cy="13.5" r="2.5" fill="white"/>
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-900 font-['Outfit']">Sparkcurv</span>
          </div>
          <span className="text-[10px] font-bold text-[#002FA7] uppercase tracking-widest mt-1.5 block">{isAdmin ? "Admin Panel" : "Manager Panel"}</span>
        </div>

        {/* Notification Bell */}
        <div className="px-4 pt-3 pb-1">
          <button
            data-testid="notification-bell"
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="relative flex items-center gap-2 w-full px-3 py-2 text-sm rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Bell className="h-5 w-5 text-slate-500" weight={notifications.total > 0 ? "fill" : "duotone"} />
            <span className="text-slate-700 font-semibold text-[13px]">Notifications</span>
            {notifications.total > 0 && (
              <span className="ml-auto flex items-center justify-center h-5 min-w-[20px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse">
                {notifications.total}
              </span>
            )}
          </button>
          {notifDropdownOpen && notifications.items.length > 0 && (
            <div className="mx-2 mt-1 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              {notifications.items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setNotifDropdownOpen(false);
                    if (item.type === "leave") setActiveTab("leaves");
                    else if (item.type === "wfh") setActiveTab("wfh");
                    else if (item.type === "cr") setActiveTab("change-requests");
                    else if (item.type === "permission") setActiveTab("permissions");
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-blue-50 border-b last:border-b-0 border-slate-100 flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    item.type === "leave" ? "bg-amber-400" :
                    item.type === "cr" ? "bg-[#002FA7]" :
                    item.type === "wfh" ? "bg-purple-500" :
                    "bg-orange-500"
                  }`} />
                  <span className="text-slate-700 font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={activeTab === item.id ? "nav-item-active w-full" : "nav-item w-full"}
            >
              <item.icon className="h-4.5 w-4.5 flex-shrink-0" weight="duotone" style={{ width: 18, height: 18 }} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3 px-1">
            <Avatar url={user?.avatar_url} name={user?.name} size="h-9 w-9" textSize="text-xs" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">Administrator</p>
            </div>
          </div>
          <Button
            data-testid="admin-logout-btn"
            onClick={logout}
            variant="outline"
            className="w-full justify-start gap-2 text-slate-500 hover:text-slate-900 border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-medium h-9"
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
              <h1 className="text-3xl font-bold text-slate-900 font-['Outfit'] tracking-tight">Dashboard Overview</h1>
              <p className="text-slate-500 mt-1 text-sm">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <div className="metric-card">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50">
                    <Users className="h-5 w-5 text-[#002FA7]" weight="duotone" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Employees</span>
                </div>
                <p className="text-4xl font-bold text-slate-900">{analytics.total_employees}</p>
              </div>

              <div className="metric-card" style={{ borderLeftColor: '#16A34A' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-green-50">
                    <Check className="h-5 w-5 text-green-600" weight="duotone" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Present Today</span>
                </div>
                <p className="text-4xl font-bold text-slate-900">{analytics.present_today}</p>
              </div>

              <div className="metric-card" style={{ borderLeftColor: '#DC2626' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-50">
                    <X className="h-5 w-5 text-red-500" weight="duotone" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Absent Today</span>
                </div>
                <p className="text-4xl font-bold text-slate-900">{analytics.absent_today}</p>
              </div>

              <div className="metric-card" style={{ borderLeftColor: '#D97706' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-50">
                    <CalendarCheck className="h-5 w-5 text-amber-600" weight="duotone" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Leaves</span>
                </div>
                <p className="text-4xl font-bold text-slate-900">{analytics.pending_leaves}</p>
              </div>
            </div>

            {/* Department Breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl p-6" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
              <h2 className="text-base font-bold text-slate-900 font-['Outfit'] mb-4">Department Breakdown</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {analytics.department_breakdown?.map((dept, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-medium mb-1">{dept.department || "General"}</p>
                    <p className="text-2xl font-bold text-slate-900">{dept.count}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Attendance Heatmap */}
            {heatmapData.employees.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }} data-testid="attendance-heatmap">
                <h2 className="text-base font-bold text-slate-900 font-['Outfit'] mb-1">Attendance Heatmap</h2>
                <p className="text-xs text-slate-400 mb-4">Last 4 weeks — on-time, late arrivals, and absences at a glance</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left pr-3 py-1.5 text-gray-500 font-medium sticky left-0 bg-white min-w-[140px]">Employee</th>
                        {heatmapData.dates.map(d => {
                          const dt = new Date(d + "T00:00:00");
                          return (
                            <th key={d} className="text-center px-0.5 py-1.5 text-gray-400 font-normal" style={{ minWidth: 28 }}>
                              <div>{["S","M","T","W","T","F","S"][dt.getDay()]}</div>
                              <div className="text-[10px]">{dt.getDate()}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapData.employees.map(emp => (
                        <tr key={emp.employee_id}>
                          <td className="pr-3 py-1 text-gray-700 font-medium sticky left-0 bg-white truncate max-w-[140px]" title={emp.name}>
                            {emp.name}
                          </td>
                          {emp.days.map(day => (
                            <td key={day.date} className="text-center px-0.5 py-1">
                              <div
                                title={`${day.date}: ${day.status}${day.hours ? ` (${day.hours}h)` : ""}`}
                                className={`w-6 h-6 rounded-sm mx-auto ${
                                  day.status === "ontime" ? "bg-[#00C853]/80" :
                                  day.status === "late" ? "bg-[#FFC107]/80" :
                                  day.status === "short" ? "bg-orange-400/80" :
                                  day.status === "present" ? "bg-blue-400/80" :
                                  "bg-red-100"
                                }`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-4 mt-4 text-[11px] text-gray-500">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#00C853]/80" /> On Time</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#FFC107]/80" /> Late (&gt;10 AM)</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-400/80" /> Short Day</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-100" /> Absent</div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Employees Tab */}
        {activeTab === "employees" && (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 font-['Outfit'] tracking-tight">Employees</h1>
                <p className="text-slate-500 mt-1 text-sm">Manage your team members</p>
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
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={newEmployee.role} onValueChange={(value) => setNewEmployee({ ...newEmployee, role: value })}>
                        <SelectTrigger data-testid="new-employee-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
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
            <input
              type="file"
              ref={avatarInputRef}
              className="hidden"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarUpload}
            />
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
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
                          <div className="relative group">
                            <Avatar url={emp.avatar_url} name={emp.name} />
                            {emp.role !== "admin" && (
                              <button
                                data-testid={`upload-avatar-${emp.id}`}
                                onClick={() => {
                                  setUploadingAvatarFor(emp.id);
                                  avatarInputRef.current?.click();
                                }}
                                className="absolute -bottom-1 -right-1 bg-[#002FA7] text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                title="Upload Photo"
                              >
                                <Camera className="h-3 w-3" weight="bold" />
                              </button>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{emp.name}</p>
                            <p className="text-xs text-slate-400">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-slate-600">{emp.department || "—"}</td>
                      <td className="table-cell">
                        {emp.shift && SHIFTS[emp.shift] ? (
                          <span className="text-xs px-2.5 py-1 bg-blue-50 text-[#002FA7] rounded-full font-semibold border border-blue-100">
                            {SHIFTS[emp.shift].name}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">Not assigned</span>
                        )}
                      </td>
                      <td className="table-cell">
                        {emp.basic_salary ? (
                          <span className="text-green-600 font-semibold">₹{emp.basic_salary.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-300 text-xs">Not set</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                          emp.role === "admin" ? "bg-blue-50 text-[#002FA7] border border-blue-100" : emp.role === "manager" ? "bg-orange-50 text-orange-700 border border-orange-100" : "bg-slate-100 text-slate-600"
                        }`}>
                          {emp.role}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          {emp.role !== "admin" && (
                            <>
                              <Button
                                data-testid={`set-shift-${emp.id}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => openShiftModal(emp)}
                                className="text-slate-400 hover:text-[#002FA7] h-8 w-8 p-0"
                                title="Assign Shift"
                              >
                                <ClockClockwise className="h-4 w-4" />
                              </Button>
                              <Button
                                data-testid={`set-salary-${emp.id}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => openSalaryModal(emp)}
                                className="text-slate-400 hover:text-green-600 h-8 w-8 p-0"
                                title="Set Salary"
                              >
                                <CurrencyDollar className="h-4 w-4" />
                              </Button>
                              <Button
                                data-testid={`reset-password-${emp.id}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedEmployee(emp);
                                  setResetPasswordValue("");
                                  setResetPasswordOpen(true);
                                }}
                                className="text-slate-400 hover:text-orange-500 h-8 w-8 p-0"
                                title="Reset Password"
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            data-testid={`edit-employee-${emp.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(emp)}
                            className="text-slate-400 hover:text-[#002FA7] h-8 w-8 p-0"
                          >
                            <PencilSimple className="h-4 w-4" />
                          </Button>
                          {emp.role !== "admin" && (
                            <Button
                              data-testid={`delete-employee-${emp.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className="text-slate-400 hover:text-red-500 h-8 w-8 p-0"
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
                      <Label>WFH Limit (days/month)</Label>
                      <Input
                        data-testid="edit-wfh-limit"
                        type="number"
                        value={editForm.wfh_limit}
                        onChange={(e) => setEditForm({ ...editForm, wfh_limit: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={editForm.role} onValueChange={(value) => setEditForm({ ...editForm, role: value })}>
                      <SelectTrigger data-testid="edit-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
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

            {/* Reset Password Dialog */}
            <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-['Outfit'] flex items-center gap-2">
                    <Key className="h-5 w-5 text-orange-500" weight="duotone" />
                    Reset Password
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-gray-500 -mt-2">
                  Set a new password for <strong>{selectedEmployee?.name}</strong>
                </p>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <Input
                      data-testid="reset-password-input"
                      type="password"
                      placeholder="Enter new password (min 6 chars)"
                      value={resetPasswordValue}
                      onChange={(e) => setResetPasswordValue(e.target.value)}
                    />
                  </div>
                  <Button
                    data-testid="reset-password-submit-btn"
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="w-full bg-orange-500 text-white hover:bg-orange-600"
                  >
                    Reset Password
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* Payroll Tab */}
        {activeTab === "payroll" && (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-slate-900 font-['Outfit'] tracking-tight">Payroll</h1>
              <p className="text-slate-500 mt-1 text-sm">Manage salaries, deductions, and payslips</p>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit" data-testid="payroll-subtabs">
              {[
                { id: "dashboard", label: "Dashboard" },
                { id: "deductions", label: "Deductions" },
                { id: "process", label: "Process Payroll" },
                { id: "payslips", label: "Payslips" }
              ].map(tab => (
                <button
                  key={tab.id}
                  data-testid={`payroll-subtab-${tab.id}`}
                  onClick={() => setPayrollSubTab(tab.id)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    payrollSubTab === tab.id
                      ? "bg-white text-[#002FA7] shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sub-tab: Dashboard */}
            {payrollSubTab === "dashboard" && (
              <>
                {/* YTD Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">YTD Gross Pay</p>
                    <p className="text-2xl font-bold text-slate-900 mt-2" data-testid="ytd-gross">
                      ₹{(payrollSummary?.ytd?.total_gross || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">YTD Deductions</p>
                    <p className="text-2xl font-bold text-red-500 mt-2" data-testid="ytd-deductions">
                      ₹{(payrollSummary?.ytd?.total_deductions || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">YTD Net Pay</p>
                    <p className="text-2xl font-bold text-green-600 mt-2" data-testid="ytd-net">
                      ₹{(payrollSummary?.ytd?.total_net || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Payslips</p>
                    <p className="text-2xl font-bold text-[#002FA7] mt-2" data-testid="ytd-count">
                      {payrollSummary?.ytd?.total_payslips || 0}
                    </p>
                  </div>
                </div>

                {/* Monthly Breakdown */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-900 font-['Outfit']">Monthly Breakdown — {payrollSummary?.year || new Date().getFullYear()}</h2>
                  </div>
                  {payrollSummary?.monthly?.length > 0 ? (
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="table-header">Month</th>
                          <th className="table-header">Employees</th>
                          <th className="table-header">Gross Pay</th>
                          <th className="table-header">Deductions</th>
                          <th className="table-header">Net Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollSummary.monthly.map((m) => (
                          <tr key={m.month} className="table-row">
                            <td className="table-cell font-semibold">{m.month_name} {m.year}</td>
                            <td className="table-cell">{m.employee_count}</td>
                            <td className="table-cell">₹{m.total_gross.toLocaleString()}</td>
                            <td className="table-cell text-red-500">-₹{m.total_deductions.toLocaleString()}</td>
                            <td className="table-cell font-bold text-green-600">₹{m.total_net.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-10 text-slate-400">
                      <CurrencyDollar className="h-10 w-10 mx-auto mb-2" weight="duotone" />
                      <p className="text-sm">No payroll data for this year yet</p>
                    </div>
                  )}
                </div>

                {/* Department Breakdown */}
                {payrollSummary?.departments?.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                    <div className="px-5 py-4 border-b border-slate-100">
                      <h2 className="text-sm font-bold text-slate-900 font-['Outfit']">Department-wise Breakdown</h2>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="table-header">Department</th>
                          <th className="table-header">Employees</th>
                          <th className="table-header">Total Gross</th>
                          <th className="table-header">Total Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollSummary.departments.map((d, i) => (
                          <tr key={i} className="table-row">
                            <td className="table-cell font-semibold">{d.department}</td>
                            <td className="table-cell">{d.employee_count}</td>
                            <td className="table-cell">₹{d.total_gross.toLocaleString()}</td>
                            <td className="table-cell font-bold text-green-600">₹{d.total_net.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Recent Payroll Runs */}
                {payrollSummary?.runs?.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                    <div className="px-5 py-4 border-b border-slate-100">
                      <h2 className="text-sm font-bold text-slate-900 font-['Outfit']">Payroll Run History</h2>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="table-header">Period</th>
                          <th className="table-header">Employees</th>
                          <th className="table-header">Total Gross</th>
                          <th className="table-header">Total Deductions</th>
                          <th className="table-header">Total Net</th>
                          <th className="table-header">Processed By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollSummary.runs.map((r) => (
                          <tr key={r.id} className="table-row">
                            <td className="table-cell font-semibold">{r.month_name} {r.year}</td>
                            <td className="table-cell">{r.total_employees}</td>
                            <td className="table-cell">₹{parseFloat(r.total_gross || 0).toLocaleString()}</td>
                            <td className="table-cell text-red-500">-₹{parseFloat(r.total_deductions || 0).toLocaleString()}</td>
                            <td className="table-cell font-bold text-green-600">₹{parseFloat(r.total_net || 0).toLocaleString()}</td>
                            <td className="table-cell text-slate-500">{r.processed_by}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* Sub-tab: Deductions */}
            {payrollSubTab === "deductions" && (
              <>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900 font-['Outfit']">Employee Deductions (PF, ESI, TDS, etc.)</h2>
                    <p className="text-xs text-gray-500 mt-1">Click "Manage" to add or remove custom deductions per employee</p>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Employee</th>
                        <th className="table-header">Department</th>
                        <th className="table-header">Basic Salary</th>
                        <th className="table-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.filter(e => e.role !== "admin").length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center py-8 text-gray-500">No employees found</td>
                        </tr>
                      ) : (
                        employees.filter(e => e.role !== "admin").map((emp) => (
                          <tr key={emp.id} className="table-row">
                            <td className="table-cell">
                              <div className="flex items-center gap-3">
                                <Avatar url={emp.avatar_url} name={emp.name} />
                                <div>
                                  <p className="font-medium text-gray-900">{emp.name}</p>
                                  <p className="text-xs text-gray-500">{emp.employee_code || "—"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="table-cell">{emp.department || "—"}</td>
                            <td className="table-cell">₹{(emp.basic_salary || 0).toLocaleString()}</td>
                            <td className="table-cell">
                              <Button
                                data-testid={`manage-deductions-${emp.id}`}
                                size="sm"
                                variant="outline"
                                onClick={() => handleLoadDeductions(emp)}
                                className="gap-1 border-[#002FA7] text-[#002FA7] hover:bg-[#002FA7] hover:text-white"
                              >
                                <PencilSimple className="h-3.5 w-3.5" />
                                Manage
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Deduction Management Dialog */}
                <Dialog open={deductionDialogOpen} onOpenChange={setDeductionDialogOpen}>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="font-['Outfit'] flex items-center gap-2">
                        <CurrencyDollar className="h-5 w-5 text-[#002FA7]" weight="duotone" />
                        Deductions — {selectedDeductionEmp?.name}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      {/* Existing Deductions */}
                      {selectedEmpDeductions.length > 0 ? (
                        <div className="space-y-2">
                          {selectedEmpDeductions.map((ded) => (
                            <div key={ded.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{ded.deduction_name}</p>
                                <p className="text-xs text-gray-500">
                                  {ded.is_percentage ? `${ded.percentage}% of salary` : `₹${parseFloat(ded.amount || 0).toLocaleString()}`}
                                  {!ded.is_active && <span className="ml-2 text-orange-500">(Inactive)</span>}
                                </p>
                              </div>
                              <Button
                                data-testid={`delete-deduction-${ded.id}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDeduction(ded.id)}
                                className="text-gray-400 hover:text-red-500 h-8 w-8 p-0"
                              >
                                <TrashSimple className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-3">No custom deductions set</p>
                      )}

                      {/* Add New Deduction */}
                      <div className="border-t pt-4 space-y-3">
                        <p className="text-sm font-medium text-gray-700">Add Deduction</p>
                        <Input
                          data-testid="deduction-name-input"
                          placeholder="e.g. PF, ESI, TDS"
                          value={deductionForm.deduction_name}
                          onChange={(e) => setDeductionForm({ ...deductionForm, deduction_name: e.target.value })}
                        />
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={deductionForm.is_percentage}
                              onChange={(e) => setDeductionForm({ ...deductionForm, is_percentage: e.target.checked })}
                              className="rounded border-gray-300"
                            />
                            Percentage-based
                          </label>
                        </div>
                        {deductionForm.is_percentage ? (
                          <Input
                            data-testid="deduction-percentage-input"
                            type="number"
                            placeholder="Percentage (e.g. 12)"
                            value={deductionForm.percentage}
                            onChange={(e) => setDeductionForm({ ...deductionForm, percentage: parseFloat(e.target.value) })}
                          />
                        ) : (
                          <Input
                            data-testid="deduction-amount-input"
                            type="number"
                            placeholder="Fixed amount (₹)"
                            value={deductionForm.amount}
                            onChange={(e) => setDeductionForm({ ...deductionForm, amount: parseFloat(e.target.value) })}
                          />
                        )}
                        <Button
                          data-testid="add-deduction-btn"
                          onClick={handleAddDeduction}
                          className="w-full bg-[#002FA7] text-white hover:bg-[#001F70] gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Deduction
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {/* Sub-tab: Process Payroll */}
            {payrollSubTab === "process" && (
              <>
                <div className="max-w-xl">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h2 className="text-base font-semibold text-gray-900 font-['Outfit'] mb-1">Bulk Process Payroll</h2>
                    <p className="text-sm text-gray-500 mb-5">Generate payslips for all eligible employees (salary &gt; 0). Existing payslips for the selected period will be skipped.</p>
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div className="space-y-2">
                        <Label>Month</Label>
                        <Select
                          value={bulkMonth.toString()}
                          onValueChange={(v) => setBulkMonth(parseInt(v))}
                        >
                          <SelectTrigger data-testid="bulk-month-select">
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
                          data-testid="bulk-year-input"
                          type="number"
                          value={bulkYear}
                          onChange={(e) => setBulkYear(parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                    <Button
                      data-testid="process-payroll-btn"
                      onClick={handleBulkProcess}
                      disabled={bulkProcessing}
                      className="w-full bg-[#002FA7] text-white hover:bg-[#001F70] gap-2"
                    >
                      {bulkProcessing ? (
                        <ClockClockwise className="h-4 w-4 animate-spin" />
                      ) : (
                        <CurrencyDollar className="h-4 w-4" weight="bold" />
                      )}
                      {bulkProcessing ? "Processing..." : "Process Payroll"}
                    </Button>
                  </div>

                  <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <p className="text-sm text-blue-800 font-medium mb-1">How it works</p>
                    <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                      <li>Generates payslips for all employees with a salary set</li>
                      <li>Automatically applies custom deductions (PF, ESI, etc.)</li>
                      <li>Calculates LOP and half-day deductions from approved leaves</li>
                      <li>Skips employees who already have a payslip for the period</li>
                    </ul>
                  </div>
                </div>
              </>
            )}

            {/* Sub-tab: Payslips */}
            {payrollSubTab === "payslips" && (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-sm text-gray-500">Generate individual payslips or view all generated payslips</p>
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
                        <Button
                          data-testid="submit-generate-payslip"
                          onClick={handleGeneratePayslip}
                          disabled={loading}
                          className="w-full bg-[#002FA7] text-white hover:bg-[#001F70]"
                        >
                          Generate Payslip
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
          </>
        )}

        {/* Change Requests Tab */}
        {activeTab === "change-requests" && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 font-['Outfit'] tracking-tight">Change Requests</h1>
              <p className="text-slate-500 mt-1 text-sm">Review and approve work/installation requests (2-step approval)</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending</p>
                <p className="text-3xl font-bold text-orange-500 mt-2">{changeRequests.filter(c => c.status === "pending").length}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Manager Approved</p>
                <p className="text-3xl font-bold text-blue-500 mt-2">{changeRequests.filter(c => c.status === "manager_approved").length}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{changeRequests.filter(c => c.status === "approved").length}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rejected</p>
                <p className="text-3xl font-bold text-red-500 mt-2">{changeRequests.filter(c => c.status === "rejected").length}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Requester</th>
                    <th className="table-header">Title</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Priority</th>
                    <th className="table-header">Manager</th>
                    <th className="table-header">Admin</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {changeRequests.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-gray-500">No change requests</td>
                    </tr>
                  ) : (
                    changeRequests.map((cr) => (
                      <tr key={cr.id} className="table-row">
                        <td className="table-cell">
                          <p className="font-medium text-gray-900">{cr.requester_name}</p>
                          <p className="text-xs text-gray-500">{cr.created_at ? format(new Date(cr.created_at), "MMM d, yyyy") : ""}</p>
                        </td>
                        <td className="table-cell">
                          <p className="font-medium text-gray-900 text-sm">{cr.title}</p>
                          <p className="text-xs text-gray-500 line-clamp-1">{cr.description}</p>
                        </td>
                        <td className="table-cell">
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{cr.cr_type}</span>
                        </td>
                        <td className="table-cell">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            cr.priority === "high" ? "bg-red-50 text-red-600" :
                            cr.priority === "low" ? "bg-green-50 text-green-600" :
                            "bg-yellow-50 text-yellow-600"
                          }`}>{cr.priority}</span>
                        </td>
                        <td className="table-cell">
                          <span className={`text-xs font-medium ${
                            cr.manager_approval === "approved" ? "text-[#00C853]" :
                            cr.manager_approval === "rejected" ? "text-[#FF2E00]" :
                            "text-gray-400"
                          }`}>
                            {cr.manager_approval === "approved" ? `Approved${cr.manager_name ? ` (${cr.manager_name})` : ""}` :
                             cr.manager_approval === "rejected" ? "Rejected" : "Pending"}
                          </span>
                          {cr.manager_notes && <p className="text-xs text-gray-400 mt-0.5">{cr.manager_notes}</p>}
                        </td>
                        <td className="table-cell">
                          <span className={`text-xs font-medium ${
                            cr.admin_approval === "approved" ? "text-[#00C853]" :
                            cr.admin_approval === "rejected" ? "text-[#FF2E00]" :
                            "text-gray-400"
                          }`}>
                            {cr.admin_approval === "approved" ? `Approved${cr.admin_name ? ` (${cr.admin_name})` : ""}` :
                             cr.admin_approval === "rejected" ? "Rejected" : "Pending"}
                          </span>
                          {cr.admin_notes && <p className="text-xs text-gray-400 mt-0.5">{cr.admin_notes}</p>}
                        </td>
                        <td className="table-cell">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            cr.status === "approved" ? "bg-green-50 text-[#00C853]" :
                            cr.status === "rejected" ? "bg-red-50 text-[#FF2E00]" :
                            cr.status === "manager_approved" ? "bg-blue-50 text-blue-600" :
                            "bg-orange-50 text-orange-500"
                          }`}>
                            {cr.status === "manager_approved" ? "Awaiting Admin" : cr.status}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex flex-col gap-1">
                            {/* Manager can approve pending CRs */}
                            {cr.manager_approval === "pending" && (
                              <div className="flex gap-1">
                                <Button
                                  data-testid={`cr-mgr-approve-${cr.id}`}
                                  size="sm"
                                  onClick={() => handleCRAction(cr.id, "manager", "approve")}
                                  className="bg-[#00C853] hover:bg-green-600 text-white h-7 text-xs px-2"
                                >
                                  <Check className="h-3 w-3 mr-1" /> Mgr
                                </Button>
                                <Button
                                  data-testid={`cr-mgr-reject-${cr.id}`}
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCRAction(cr.id, "manager", "reject")}
                                  className="text-red-500 hover:text-red-700 h-7 text-xs px-2"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            {/* Admin can approve manager-approved CRs */}
                            {isAdmin && cr.manager_approval === "approved" && cr.admin_approval === "pending" && (
                              <div className="flex gap-1">
                                <Button
                                  data-testid={`cr-admin-approve-${cr.id}`}
                                  size="sm"
                                  onClick={() => handleCRAction(cr.id, "admin", "approve")}
                                  className="bg-[#002FA7] hover:bg-[#001F70] text-white h-7 text-xs px-2"
                                >
                                  <Check className="h-3 w-3 mr-1" /> Admin
                                </Button>
                                <Button
                                  data-testid={`cr-admin-reject-${cr.id}`}
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCRAction(cr.id, "admin", "reject")}
                                  className="text-red-500 hover:text-red-700 h-7 text-xs px-2"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            {(cr.status === "approved" || cr.status === "rejected") && (
                              <span className="text-xs text-gray-400">Done</span>
                            )}
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
              <h1 className="text-3xl font-bold text-slate-900 font-['Outfit'] tracking-tight">Leave Requests</h1>
              <p className="text-slate-500 mt-1 text-sm">Review and manage leave applications</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
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
                      <td colSpan="6" className="text-center py-8 text-slate-400 text-sm">No leave requests</td>
                    </tr>
                  ) : (
                    leaveRequests.map((req) => (
                      <tr key={req.id} className="table-row">
                        <td className="table-cell">
                          <p className="font-semibold text-slate-900 text-sm">{req.user_name}</p>
                          <p className="text-xs text-slate-400">{req.user_email}</p>
                        </td>
                        <td className="table-cell capitalize text-slate-600">{req.leave_type}{req.is_half_day ? " (Half Day)" : ""}</td>
                        <td className="table-cell">
                          <p className="text-sm">{req.is_half_day ? format(new Date(req.start_date), "MMM d, yyyy") : `${format(new Date(req.start_date), "MMM d")} - ${format(new Date(req.end_date), "MMM d, yyyy")}`}</p>
                          <p className="text-xs text-slate-400">{req.days} day(s)</p>
                        </td>
                        <td className="table-cell max-w-xs truncate text-slate-600">{req.reason}</td>
                        <td className="table-cell">{getStatusBadge(req.status)}</td>
                        <td className="table-cell">
                          {req.status === "pending" && (
                            <div className="flex items-center gap-2">
                              <Button
                                data-testid={`approve-leave-${req.id}`}
                                size="sm"
                                onClick={() => handleLeaveAction(req.id, "approve")}
                                className="bg-green-600 hover:bg-green-700 text-white h-8 w-8 p-0 rounded-lg"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                data-testid={`reject-leave-${req.id}`}
                                size="sm"
                                onClick={() => handleLeaveAction(req.id, "reject")}
                                className="bg-red-500 hover:bg-red-600 text-white h-8 w-8 p-0 rounded-lg"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {req.status !== "pending" && req.reviewed_by && (
                            <p className="text-xs text-slate-400">by {req.reviewed_by}</p>
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

        {/* WFH Requests Tab */}
        {activeTab === "wfh" && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 font-['Outfit'] tracking-tight">Work From Home Requests</h1>
              <p className="text-slate-500 mt-1 text-sm">Manage employee WFH requests</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Employee</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Reason</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Reviewed By</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wfhRequests.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">No WFH requests</td></tr>
                  ) : (
                    wfhRequests.map((req) => (
                      <tr key={req.id} data-testid={`wfh-row-${req.id}`} className="table-row">
                        <td className="table-cell font-semibold text-slate-900 text-sm">{req.user_name}</td>
                        <td className="table-cell text-slate-600">{req.date}</td>
                        <td className="table-cell text-slate-600 max-w-[200px] truncate">{req.reason}</td>
                        <td className="table-cell">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            req.status === "approved" ? "bg-green-50 text-green-700 border border-green-200" :
                            req.status === "rejected" ? "bg-red-50 text-red-700 border border-red-200" :
                            "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="table-cell text-slate-500 text-sm">{req.reviewed_by || "-"}</td>
                        <td className="table-cell text-right">
                          {req.status === "pending" && (
                            <div className="flex gap-2 justify-end">
                              <Button
                                data-testid={`wfh-approve-${req.id}`}
                                size="sm"
                                onClick={() => handleWfhAction(req.id, "approve")}
                                className="bg-green-600 hover:bg-green-700 text-white h-8 w-8 p-0 rounded-lg"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                data-testid={`wfh-reject-${req.id}`}
                                size="sm"
                                onClick={() => handleWfhAction(req.id, "reject")}
                                className="bg-red-500 hover:bg-red-600 text-white h-8 w-8 p-0 rounded-lg"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
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
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 font-['Outfit'] tracking-tight">Attendance Records</h1>
                <p className="text-slate-500 mt-1 text-sm">View employee attendance with location tracking</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Dialog open={officeDialogOpen} onOpenChange={setOfficeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="office-settings-btn" variant="outline" className="gap-2 border-slate-200 rounded-xl">
                        <GearSix className="h-4 w-4" />
                        Office Location
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="font-['Outfit']">Office Geofence Settings</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-slate-500 -mt-2">Set office coordinates and allowed radius for clock-in.</p>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Office Name</Label>
                          <Input data-testid="office-name-input" value={officeForm.office_name} onChange={(e) => setOfficeForm({ ...officeForm, office_name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Latitude</Label>
                            <Input data-testid="office-lat-input" type="number" step="0.0001" value={officeForm.latitude} onChange={(e) => setOfficeForm({ ...officeForm, latitude: parseFloat(e.target.value) })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Longitude</Label>
                            <Input data-testid="office-lng-input" type="number" step="0.0001" value={officeForm.longitude} onChange={(e) => setOfficeForm({ ...officeForm, longitude: parseFloat(e.target.value) })} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Allowed Radius (km)</Label>
                          <Input data-testid="office-radius-input" type="number" step="0.1" value={officeForm.radius_km} onChange={(e) => setOfficeForm({ ...officeForm, radius_km: parseFloat(e.target.value) })} />
                          <p className="text-xs text-slate-400">{(officeForm.radius_km * 1000).toFixed(0)} meters</p>
                        </div>
                        <Button data-testid="save-office-btn" onClick={handleSaveOfficeSettings} className="w-full bg-[#002FA7] text-white hover:bg-[#002482] rounded-xl">
                          Save Office Location
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="export-attendance-btn" className="bg-green-600 text-white hover:bg-green-700 gap-2 rounded-xl">
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
                          <Input data-testid="export-start-date" type="date" value={exportForm.start_date} onChange={(e) => setExportForm({ ...exportForm, start_date: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>End Date</Label>
                          <Input data-testid="export-end-date" type="date" value={exportForm.end_date} onChange={(e) => setExportForm({ ...exportForm, end_date: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Employee (optional)</Label>
                        <Select value={exportForm.employee_id || "all"} onValueChange={(value) => setExportForm({ ...exportForm, employee_id: value === "all" ? "" : value })}>
                          <SelectTrigger data-testid="export-employee-select"><SelectValue placeholder="All employees" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All employees</SelectItem>
                            {employees.filter(e => e.role !== "admin").map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button data-testid="download-export-btn" onClick={handleExportAttendance} disabled={loading} className="w-full bg-[#00C853] text-white hover:bg-[#00A844] gap-2">
                        <DownloadSimple className="h-4 w-4" />
                        Download Excel Report
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  data-testid="attendance-table-view"
                  onClick={() => setAttendanceView("table")}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${attendanceView === "table" ? "bg-white text-[#002FA7] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Table View
                </button>
                <button
                  data-testid="attendance-map-view"
                  onClick={() => { setAttendanceView("map"); fetchLocationData(locationDate); }}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${attendanceView === "map" ? "bg-white text-[#002FA7] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Map View
                </button>
              </div>
              {attendanceView === "map" && (
                <Input
                  data-testid="location-date-picker"
                  type="date"
                  value={locationDate}
                  onChange={(e) => { setLocationDate(e.target.value); fetchLocationData(e.target.value); }}
                  className="w-44 rounded-xl"
                />
              )}
            </div>

            {/* Table View */}
            {attendanceView === "table" && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Employee</th>
                      <th className="table-header">Date</th>
                      <th className="table-header">Clock In</th>
                      <th className="table-header">Clock Out</th>
                      <th className="table-header">Location</th>
                      <th className="table-header">Break</th>
                      <th className="table-header">Hours</th>
                      <th className="table-header">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center py-8 text-slate-400 text-sm">No attendance records</td>
                      </tr>
                    ) : (
                      attendance.slice(0, 50).map((rec, idx) => (
                        <tr key={idx} className="table-row">
                          <td className="table-cell font-semibold text-slate-900">{rec.user_name}</td>
                          <td className="table-cell">{format(new Date(rec.date), "MMM d, yyyy")}</td>
                          <td className="table-cell">{format(new Date(rec.clock_in), "h:mm a")}</td>
                          <td className="table-cell">
                            {rec.clock_out ? format(new Date(rec.clock_out), "h:mm a") : "—"}
                          </td>
                          <td className="table-cell">
                            {rec.clock_in_address ? (
                              <div className="max-w-[200px]">
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-[#002FA7] flex-shrink-0" weight="fill" />
                                  <span className="text-xs text-slate-600 truncate" title={rec.clock_in_address}>
                                    {rec.clock_in_address.split(",").slice(0, 3).join(",")}
                                  </span>
                                </div>
                                {rec.location_type && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${
                                    rec.location_type === "Office" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                                  }`}>{rec.location_type}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300">No location</span>
                            )}
                          </td>
                          <td className="table-cell">{rec.total_break_minutes || 0} min</td>
                          <td className="table-cell">
                            <span className={rec.working_hours && rec.working_hours < 8 ? "text-red-500 font-semibold" : "font-medium"}>
                              {rec.working_hours ? formatHours(rec.working_hours) : "—"}
                            </span>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1.5">
                              {rec.is_short_day ? (
                                <span className="badge-rejected">Short Day</span>
                              ) : rec.clock_out ? (
                                <span className="badge-approved">Completed</span>
                              ) : (
                                <span className="badge-pending">Active</span>
                              )}
                              {rec.break_outside_geofence && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 text-[10px] font-semibold border border-orange-100" title="Employee took a break outside office geofence">
                                  <Warning className="h-3 w-3" weight="fill" />
                                  Break
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Map View */}
            {attendanceView === "map" && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <NavigationArrow className="h-4 w-4 text-[#002FA7]" weight="fill" />
                    <span className="text-sm font-semibold text-slate-700">Employee Locations — {format(new Date(locationDate + "T00:00:00"), "MMM d, yyyy")}</span>
                  </div>
                  <span className="text-xs text-slate-400">{locationData.length} records with location</span>
                </div>
                <div style={{ height: "500px", width: "100%" }} data-testid="attendance-map">
                  <MapContainer
                    center={[officeSettings.latitude, officeSettings.longitude]}
                    zoom={14}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {/* Office geofence circle */}
                    <Circle
                      center={[officeSettings.latitude, officeSettings.longitude]}
                      radius={officeSettings.radius_km * 1000}
                      pathOptions={{ color: "#002FA7", fillColor: "#002FA7", fillOpacity: 0.08, weight: 2, dashArray: "5 5" }}
                    />
                    <Marker position={[officeSettings.latitude, officeSettings.longitude]}>
                      <Popup>
                        <strong>{officeSettings.name || "Office"}</strong><br />
                        <span className="text-xs">Geofence: {(officeSettings.radius_km * 1000).toFixed(0)}m radius</span>
                      </Popup>
                    </Marker>
                    {/* Employee clock-in markers */}
                    {locationData.map((rec) => rec.clock_in_lat && (
                      <Marker key={`in-${rec.id}`} position={[rec.clock_in_lat, rec.clock_in_lng]}>
                        <Popup>
                          <div style={{ minWidth: 180 }}>
                            <strong>{rec.user_name}</strong> ({rec.employee_code})<br />
                            <span style={{ fontSize: 11 }}>Clock In: {format(new Date(rec.clock_in), "h:mm a")}</span><br />
                            {rec.clock_out && <><span style={{ fontSize: 11 }}>Clock Out: {format(new Date(rec.clock_out), "h:mm a")}</span><br /></>}
                            <span style={{ fontSize: 11, color: "#666" }}>{rec.clock_in_address?.split(",").slice(0, 3).join(",")}</span><br />
                            {rec.location_type && <span style={{ fontSize: 10, background: rec.location_type === "Office" ? "#e3f2fd" : "#f3e5f5", padding: "2px 6px", borderRadius: 8 }}>{rec.location_type}</span>}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    {/* Clock-out markers */}
                    {locationData.filter(r => r.clock_out_lat).map((rec) => (
                      <Marker key={`out-${rec.id}`} position={[rec.clock_out_lat, rec.clock_out_lng]}>
                        <Popup>
                          <div style={{ minWidth: 180 }}>
                            <strong>{rec.user_name}</strong> — Clock Out<br />
                            <span style={{ fontSize: 11 }}>{format(new Date(rec.clock_out), "h:mm a")}</span><br />
                            <span style={{ fontSize: 11, color: "#666" }}>{rec.clock_out_address?.split(",").slice(0, 3).join(",")}</span>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
                {/* Location legend */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-6 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full border-2 border-[#002FA7] bg-[#002FA7]/10"></div>
                    Office Geofence
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-blue-600" weight="fill" />
                    Clock In
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-red-500" weight="fill" />
                    Clock Out
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Permissions Tab */}
        {activeTab === "permissions" && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 font-['Outfit'] tracking-tight">Permission Requests</h1>
              <p className="text-slate-500 mt-1 text-sm">Review and manage permission applications (2 hours/month per employee, max 1 hour per use)</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
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
                      <td colSpan="6" className="text-center py-8 text-slate-400 text-sm">No permission requests</td>
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

        {/* Holidays Tab */}
        {activeTab === "holidays" && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 font-['Outfit'] tracking-tight">Holiday List 2026</h1>
              <p className="text-slate-500 mt-1 text-sm">Public holidays and weekly offs for all employees</p>
            </div>

            {/* Weekend Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2">
                <CalendarStar className="h-5 w-5 text-[#002FA7]" weight="duotone" />
                <p className="text-sm font-semibold text-[#002FA7]">
                  Saturday & Sunday are weekly holidays for all employees
                </p>
              </div>
            </div>

            {/* Holidays Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">#</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Day</th>
                    <th className="table-header">Festival</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((holiday, index) => {
                    const holidayDate = new Date(holiday.date + "T00:00:00");
                    const isPast = holidayDate < new Date(new Date().toDateString());
                    return (
                      <tr key={index} className={`table-row ${isPast ? "opacity-50" : ""}`}>
                        <td className="table-cell text-slate-400">{index + 1}</td>
                        <td className="table-cell font-semibold">
                          {format(holidayDate, "dd MMM yyyy")}
                        </td>
                        <td className="table-cell text-slate-600">{holiday.day}</td>
                        <td className="table-cell">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#002FA7]"></span>
                            {holiday.festival}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            isPast ? "bg-slate-100 text-slate-500" : "bg-green-50 text-green-600 border border-green-200"
                          }`}>
                            {isPast ? "Passed" : "Upcoming"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm text-slate-500">
              Total public holidays: <strong className="text-slate-900">{holidays.length}</strong>
            </div>
          </>
        )}

        {/* Company Policy Tab */}
        {activeTab === "policy" && (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 font-['Outfit'] tracking-tight">Company Policy</h1>
                <p className="text-slate-500 mt-1 text-sm">Rules and guidelines for all employees</p>
              </div>
              {isAdmin && (
                <Button
                  data-testid="add-policy-btn"
                  onClick={() => {
                    setEditingPolicy(null);
                    setPolicyForm({ title: "", category: "", content: "", icon: "article", sort_order: policies.length + 1 });
                    setPolicyDialogOpen(true);
                  }}
                  className="bg-[#002FA7] text-white hover:bg-[#002482] gap-2 rounded-xl"
                >
                  <Plus className="h-4 w-4" /> Add Policy
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {policies.map((policy) => (
                <div key={policy.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Scroll className="h-5 w-5 text-[#002FA7]" weight="duotone" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 font-['Outfit']">{policy.title}</h3>
                        <span className="text-xs font-semibold text-[#002FA7] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{policy.category}</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`edit-policy-${policy.id}`}
                          onClick={() => {
                            setEditingPolicy(policy);
                            setPolicyForm({ title: policy.title, category: policy.category, content: policy.content, icon: policy.icon || "article", sort_order: policy.sort_order || 0 });
                            setPolicyDialogOpen(true);
                          }}
                          className="text-slate-400 hover:text-[#002FA7] h-8 w-8 p-0"
                        >
                          <PencilLine className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`delete-policy-${policy.id}`}
                          onClick={() => handleDeletePolicy(policy.id)}
                          className="text-slate-400 hover:text-red-500 h-8 w-8 p-0"
                        >
                          <TrashSimple className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                    {policy.content}
                  </div>
                </div>
              ))}
            </div>

            {policies.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Scroll className="h-12 w-12 mx-auto mb-3" weight="duotone" />
                <p className="font-semibold">No policies added yet</p>
                {isAdmin && <p className="text-sm mt-1">Click "Add Policy" to create company policies</p>}
              </div>
            )}

            {/* Policy Add/Edit Dialog */}
            <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-['Outfit']">
                    {editingPolicy ? "Edit Policy" : "Add New Policy"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      data-testid="policy-title-input"
                      placeholder="e.g., Leave Policy"
                      value={policyForm.title}
                      onChange={(e) => setPolicyForm({ ...policyForm, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={policyForm.category} onValueChange={(v) => setPolicyForm({ ...policyForm, category: v })}>
                      <SelectTrigger data-testid="policy-category-select">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Leave">Leave</SelectItem>
                        <SelectItem value="Attendance">Attendance</SelectItem>
                        <SelectItem value="Shift">Shift</SelectItem>
                        <SelectItem value="Permission">Permission</SelectItem>
                        <SelectItem value="Holiday">Holiday</SelectItem>
                        <SelectItem value="Payroll">Payroll</SelectItem>
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Conduct">Conduct</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <textarea
                      data-testid="policy-content-input"
                      className="flex min-h-[160px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="Write the policy details here..."
                      value={policyForm.content}
                      onChange={(e) => setPolicyForm({ ...policyForm, content: e.target.value })}
                    />
                  </div>
                  <Button
                    data-testid="save-policy-btn"
                    onClick={handleSavePolicy}
                    disabled={loading}
                    className="w-full bg-[#002FA7] text-white hover:bg-[#002482] rounded-xl"
                  >
                    {editingPolicy ? "Update Policy" : "Add Policy"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </main>
    </div>
  );
}
