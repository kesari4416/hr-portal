import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  SignOut, Clock, Coffee, CalendarBlank, TreePalm, Heartbeat, 
  Briefcase, House, ClockCounterClockwise, CalendarCheck,
  CaretDown, Hourglass, Warning, Timer, ChartBar, Receipt, DownloadSimple
} from "@phosphor-icons/react";

export default function EmployeeDashboard() {
  const { user, logout, api } = useAuth();
  const [attendanceStatus, setAttendanceStatus] = useState({ clocked_in: false, on_break: false, attendance: null });
  const [leaveBalance, setLeaveBalance] = useState({ casual: 0, sick: 0, earned: 0 });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [permissionBalance, setPermissionBalance] = useState({ remaining_minutes: 120, used_minutes: 0 });
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [workingSummary, setWorkingSummary] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [breakElapsedTime, setBreakElapsedTime] = useState(0);
  const [activeTab, setActiveTab] = useState("dashboard");

  const [leaveForm, setLeaveForm] = useState({
    leave_type: "casual",
    start_date: null,
    end_date: null,
    reason: ""
  });

  const [permissionForm, setPermissionForm] = useState({
    duration_minutes: 60,
    reason: "",
    date: format(new Date(), "yyyy-MM-dd")
  });

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, balanceRes, requestsRes, historyRes, permBalRes, permReqRes, summaryRes, payslipsRes] = await Promise.all([
        api.get("/attendance/status"),
        api.get("/leave/balance"),
        api.get("/leave/my-requests"),
        api.get("/attendance/history"),
        api.get("/permission/balance"),
        api.get("/permission/my-requests"),
        api.get("/attendance/working-hours-summary"),
        api.get("/payslip/my-payslips")
      ]);
      setAttendanceStatus(statusRes.data);
      setLeaveBalance(balanceRes.data);
      setLeaveRequests(requestsRes.data);
      setAttendanceHistory(historyRes.data);
      setPermissionBalance(permBalRes.data);
      setPermissionRequests(permReqRes.data);
      setWorkingSummary(summaryRes.data);
      setPayslips(payslipsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Timer for work duration
  useEffect(() => {
    let interval;
    if (attendanceStatus.clocked_in && attendanceStatus.attendance?.clock_in && !attendanceStatus.on_break) {
      interval = setInterval(() => {
        const clockIn = new Date(attendanceStatus.attendance.clock_in);
        const breakMinutes = attendanceStatus.attendance?.total_break_minutes || 0;
        const elapsed = Math.floor((Date.now() - clockIn.getTime()) / 1000) - (breakMinutes * 60);
        setElapsedTime(Math.max(0, elapsed));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [attendanceStatus]);

  // Timer for break duration
  useEffect(() => {
    let interval;
    if (attendanceStatus.on_break && attendanceStatus.attendance?.breaks) {
      const currentBreak = attendanceStatus.attendance.breaks.find(b => !b.end);
      if (currentBreak) {
        interval = setInterval(() => {
          const breakStart = new Date(currentBreak.start);
          const elapsed = Math.floor((Date.now() - breakStart.getTime()) / 1000);
          setBreakElapsedTime(elapsed);
        }, 1000);
      }
    } else {
      setBreakElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [attendanceStatus]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClockIn = async () => {
    setLoading(true);
    try {
      await api.post("/attendance/clock-in");
      toast.success("Clocked in successfully!");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to clock in");
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      const response = await api.post("/attendance/clock-out");
      const workingHours = response.data?.working_hours || 0;
      if (workingHours < 8) {
        toast.warning(`Clocked out with ${workingHours.toFixed(2)} hours (less than 8 hours required)`);
      } else {
        toast.success("Clocked out successfully!");
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to clock out");
    } finally {
      setLoading(false);
    }
  };

  const handleStartBreak = async () => {
    setLoading(true);
    try {
      await api.post("/attendance/break/start");
      toast.success("Break started!");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to start break");
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreak = async () => {
    setLoading(true);
    try {
      await api.post("/attendance/break/end");
      toast.success("Break ended!");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to end break");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRequest = async () => {
    if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await api.post("/leave/request", {
        leave_type: leaveForm.leave_type,
        start_date: format(leaveForm.start_date, "yyyy-MM-dd"),
        end_date: format(leaveForm.end_date, "yyyy-MM-dd"),
        reason: leaveForm.reason
      });
      toast.success("Leave request submitted!");
      setLeaveDialogOpen(false);
      setLeaveForm({ leave_type: "casual", start_date: null, end_date: null, reason: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit leave request");
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionRequest = async () => {
    if (!permissionForm.reason || !permissionForm.date) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await api.post("/permission/request", permissionForm);
      toast.success("Permission request submitted!");
      setPermissionDialogOpen(false);
      setPermissionForm({ duration_minutes: 60, reason: "", date: format(new Date(), "yyyy-MM-dd") });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit permission request");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelLeave = async (leaveId) => {
    try {
      await api.delete(`/leave/${leaveId}`);
      toast.success("Leave request cancelled");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to cancel leave request");
    }
  };

  const handleCancelPermission = async (permissionId) => {
    try {
      await api.delete(`/permission/${permissionId}`);
      toast.success("Permission request cancelled");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to cancel permission request");
    }
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

  // Calculate current working hours
  const currentWorkingHours = elapsedTime / 3600;
  const isShortDay = currentWorkingHours < 8 && attendanceStatus.clocked_in;

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
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={activeTab === "dashboard" ? "nav-item-active w-full" : "nav-item w-full"}
          >
            <House className="h-5 w-5" weight="duotone" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab("payslips")}
            className={activeTab === "payslips" ? "nav-item-active w-full" : "nav-item w-full"}
          >
            <Receipt className="h-5 w-5" weight="duotone" />
            <span>Payslips</span>
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            className={activeTab === "summary" ? "nav-item-active w-full" : "nav-item w-full"}
          >
            <ChartBar className="h-5 w-5" weight="duotone" />
            <span>Work Summary</span>
          </button>
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
              <p className="text-xs text-gray-500 truncate">{user?.department}</p>
            </div>
          </div>
          <Button
            data-testid="logout-btn"
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
        {activeTab === "dashboard" && (
          <>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 font-['Outfit'] tracking-tight">
                Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]}
              </h1>
              <p className="text-gray-500 mt-1">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
            </div>

            {/* Working Hours Alert */}
            {workingSummary && workingSummary.short_days_count > 0 && (
              <div className="mb-6 p-4 bg-[#FFF9E6] border border-[#FFC107] rounded-sm flex items-center gap-3">
                <Warning className="h-5 w-5 text-[#D4A000]" weight="duotone" />
                <div>
                  <p className="font-medium text-gray-900">
                    You have {workingSummary.short_days_count} short working day(s) this month
                  </p>
                  <p className="text-sm text-gray-600">
                    {workingSummary.short_days_count >= 3 
                      ? `${Math.floor(workingSummary.short_days_count / 3) * 0.5} half-day(s) have been deducted from your casual leave.`
                      : `${3 - (workingSummary.short_days_count % 3)} more short day(s) will result in 0.5 day leave deduction.`
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Clock Widget - Large */}
              <div className="lg:col-span-5 bg-white border border-gray-200 rounded-sm p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Clock className="h-5 w-5 text-[#002FA7]" weight="duotone" />
                  <h2 className="text-lg font-bold text-gray-900 font-['Outfit']">Time Tracker</h2>
                </div>

                {/* Timer Display */}
                <div className="text-center mb-6">
                  <div className={`text-5xl font-bold font-['JetBrains_Mono'] mb-2 ${
                    isShortDay && !attendanceStatus.on_break ? 'text-[#FF2E00]' : 'text-gray-900'
                  }`}>
                    {attendanceStatus.on_break ? formatTime(breakElapsedTime) : formatTime(elapsedTime)}
                  </div>
                  <p className="text-sm text-gray-500 uppercase tracking-wider">
                    {attendanceStatus.on_break ? "Break Duration" : attendanceStatus.clocked_in ? "Working Time" : "Not Clocked In"}
                  </p>
                  {attendanceStatus.clocked_in && !attendanceStatus.on_break && (
                    <p className={`text-xs mt-1 ${currentWorkingHours >= 8 ? 'text-[#00C853]' : 'text-[#FF2E00]'}`}>
                      {currentWorkingHours >= 8 ? "Minimum 8 hours reached" : `Need ${(8 - currentWorkingHours).toFixed(1)} more hours for minimum`}
                    </p>
                  )}
                </div>

                {/* Progress Bar for 8.5 hours */}
                {attendanceStatus.clocked_in && !attendanceStatus.on_break && (
                  <div className="mb-6">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>{Math.min(100, (currentWorkingHours / 8.5 * 100)).toFixed(0)}% of 8:30</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          currentWorkingHours >= 8 ? 'bg-[#00C853]' : 'bg-[#FFC107]'
                        }`}
                        style={{ width: `${Math.min(100, currentWorkingHours / 8.5 * 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0h</span>
                      <span className="text-[#FF2E00]">8h min</span>
                      <span>8:30</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  {!attendanceStatus.clocked_in ? (
                    <button
                      data-testid="clock-in-btn"
                      onClick={handleClockIn}
                      disabled={loading}
                      className="btn-clock-in"
                    >
                      <Clock className="inline h-5 w-5 mr-2" weight="bold" />
                      Clock In
                    </button>
                  ) : (
                    <>
                      {!attendanceStatus.on_break ? (
                        <button
                          data-testid="start-break-btn"
                          onClick={handleStartBreak}
                          disabled={loading || (attendanceStatus.remaining_break_minutes || 0) <= 0}
                          className={`btn-break ${(attendanceStatus.remaining_break_minutes || 0) <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Coffee className="inline h-5 w-5 mr-2" weight="bold" />
                          {(attendanceStatus.remaining_break_minutes || 0) <= 0 
                            ? "Break Limit Reached" 
                            : `Start Break (${attendanceStatus.remaining_break_minutes || 30} min left)`}
                        </button>
                      ) : (
                        <button
                          data-testid="end-break-btn"
                          onClick={handleEndBreak}
                          disabled={loading}
                          className="btn-break"
                        >
                          <Coffee className="inline h-5 w-5 mr-2" weight="bold" />
                          End Break
                        </button>
                      )}
                      <button
                        data-testid="clock-out-btn"
                        onClick={handleClockOut}
                        disabled={loading}
                        className="btn-clock-out"
                      >
                        <SignOut className="inline h-5 w-5 mr-2" weight="bold" />
                        Clock Out
                      </button>
                    </>
                  )}
                </div>

                {/* Today's Summary */}
                {attendanceStatus.attendance && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Clock In</p>
                        <p className="font-medium text-gray-900">
                          {format(new Date(attendanceStatus.attendance.clock_in), "h:mm a")}
                        </p>
                      </div>
                      {attendanceStatus.attendance.clock_out && (
                        <div>
                          <p className="text-gray-500">Clock Out</p>
                          <p className="font-medium text-gray-900">
                            {format(new Date(attendanceStatus.attendance.clock_out), "h:mm a")}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-500">Break Time</p>
                        <p className={`font-medium ${(attendanceStatus.attendance.total_break_minutes || 0) >= 30 ? 'text-[#FF2E00]' : 'text-gray-900'}`}>
                          {attendanceStatus.attendance.total_break_minutes || 0} / 30 min
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Leave & Permission Balance Cards */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="metric-card">
                  <div className="flex items-center gap-2 mb-3">
                    <TreePalm className="h-5 w-5 text-[#002FA7]" weight="duotone" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Casual Leave</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{leaveBalance.casual}</p>
                  <p className="text-sm text-gray-500">days remaining</p>
                </div>

                <div className="metric-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Heartbeat className="h-5 w-5 text-[#002FA7]" weight="duotone" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sick Leave</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{leaveBalance.sick}</p>
                  <p className="text-sm text-gray-500">days remaining</p>
                </div>

                <div className="metric-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="h-5 w-5 text-[#002FA7]" weight="duotone" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Earned Leave</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{leaveBalance.earned}</p>
                  <p className="text-sm text-gray-500">days remaining</p>
                </div>

                {/* Permission Hours Card */}
                <div className="metric-card" style={{ borderLeftColor: '#FFC107' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Hourglass className="h-5 w-5 text-[#FFC107]" weight="duotone" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Permission Hours</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{(permissionBalance.remaining_minutes / 60).toFixed(1)}h</p>
                  <p className="text-sm text-gray-500">of 2 hours remaining</p>
                  <p className="text-xs text-gray-400 mt-1">Max 1 hour per use</p>
                </div>

                {/* Request Buttons */}
                <div className="sm:col-span-1">
                  <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        data-testid="request-leave-btn"
                        className="w-full h-12 bg-[#002FA7] text-white hover:bg-[#001F70] rounded-sm"
                      >
                        <CalendarBlank className="h-5 w-5 mr-2" weight="duotone" />
                        Request Leave
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="font-['Outfit']">Request Leave</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-gray-500 -mt-2">Fill in the details below to submit a leave request.</p>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Leave Type</Label>
                          <Select
                            value={leaveForm.leave_type}
                            onValueChange={(value) => setLeaveForm({ ...leaveForm, leave_type: value })}
                          >
                            <SelectTrigger data-testid="leave-type-select" className="h-10">
                              <SelectValue placeholder="Select leave type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="casual">Casual Leave ({leaveBalance.casual} left)</SelectItem>
                              <SelectItem value="sick">Sick Leave ({leaveBalance.sick} left)</SelectItem>
                              <SelectItem value="earned">Earned Leave ({leaveBalance.earned} left)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  data-testid="leave-start-date-btn"
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal h-10"
                                >
                                  {leaveForm.start_date ? format(leaveForm.start_date, "MMM d, yyyy") : "Select date"}
                                  <CaretDown className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={leaveForm.start_date}
                                  onSelect={(date) => setLeaveForm({ ...leaveForm, start_date: date })}
                                  disabled={(date) => date < new Date()}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>

                          <div className="space-y-2">
                            <Label>End Date</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  data-testid="leave-end-date-btn"
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal h-10"
                                >
                                  {leaveForm.end_date ? format(leaveForm.end_date, "MMM d, yyyy") : "Select date"}
                                  <CaretDown className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={leaveForm.end_date}
                                  onSelect={(date) => setLeaveForm({ ...leaveForm, end_date: date })}
                                  disabled={(date) => date < (leaveForm.start_date || new Date())}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Reason</Label>
                          <Textarea
                            data-testid="leave-reason-input"
                            placeholder="Enter the reason for leave..."
                            value={leaveForm.reason}
                            onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                            rows={3}
                          />
                        </div>

                        <Button
                          data-testid="submit-leave-request-btn"
                          onClick={handleLeaveRequest}
                          disabled={loading}
                          className="w-full bg-[#002FA7] text-white hover:bg-[#001F70]"
                        >
                          Submit Request
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Permission Request Button */}
                <div className="sm:col-span-1">
                  <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        data-testid="request-permission-btn"
                        variant="outline"
                        className="w-full h-12 border-[#FFC107] text-gray-900 hover:bg-[#FFF9E6] rounded-sm"
                      >
                        <Hourglass className="h-5 w-5 mr-2 text-[#FFC107]" weight="duotone" />
                        Request Permission
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="font-['Outfit']">Request Permission</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-gray-500 -mt-2">
                        You have {permissionBalance.remaining_minutes} minutes remaining this month. Max 1 hour per request.
                      </p>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Duration</Label>
                          <Select
                            value={permissionForm.duration_minutes.toString()}
                            onValueChange={(value) => setPermissionForm({ ...permissionForm, duration_minutes: parseInt(value) })}
                          >
                            <SelectTrigger data-testid="permission-duration-select" className="h-10">
                              <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="60">1 hour</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Input
                            data-testid="permission-date-input"
                            type="date"
                            value={permissionForm.date}
                            onChange={(e) => setPermissionForm({ ...permissionForm, date: e.target.value })}
                            min={format(new Date(), "yyyy-MM-dd")}
                            className="h-10"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Reason</Label>
                          <Textarea
                            data-testid="permission-reason-input"
                            placeholder="Enter the reason for permission..."
                            value={permissionForm.reason}
                            onChange={(e) => setPermissionForm({ ...permissionForm, reason: e.target.value })}
                            rows={3}
                          />
                        </div>

                        <Button
                          data-testid="submit-permission-request-btn"
                          onClick={handlePermissionRequest}
                          disabled={loading || permissionBalance.remaining_minutes < permissionForm.duration_minutes}
                          className="w-full bg-[#FFC107] text-black hover:bg-[#E6AE06]"
                        >
                          Submit Request
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Leave Requests */}
              <div className="lg:col-span-6 bg-white border border-gray-200 rounded-sm">
                <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-[#002FA7]" weight="duotone" />
                  <h2 className="text-lg font-bold text-gray-900 font-['Outfit']">Leave Requests</h2>
                </div>
                <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                  {leaveRequests.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No leave requests yet
                    </div>
                  ) : (
                    leaveRequests.slice(0, 5).map((request) => (
                      <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900 capitalize">{request.leave_type} Leave</p>
                            <p className="text-sm text-gray-500">
                              {format(new Date(request.start_date), "MMM d")} - {format(new Date(request.end_date), "MMM d, yyyy")}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">{request.reason}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(request.status)}
                            {request.status === "pending" && (
                              <Button
                                data-testid={`cancel-leave-${request.id}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelLeave(request.id)}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Permission Requests */}
              <div className="lg:col-span-6 bg-white border border-gray-200 rounded-sm">
                <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                  <Timer className="h-5 w-5 text-[#FFC107]" weight="duotone" />
                  <h2 className="text-lg font-bold text-gray-900 font-['Outfit']">Permission Requests</h2>
                </div>
                <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                  {permissionRequests.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No permission requests yet
                    </div>
                  ) : (
                    permissionRequests.slice(0, 5).map((perm) => (
                      <div key={perm.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{perm.duration_minutes} minutes</p>
                            <p className="text-sm text-gray-500">{format(new Date(perm.date), "MMM d, yyyy")}</p>
                            <p className="text-sm text-gray-500 mt-1">{perm.reason}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(perm.status)}
                            {perm.status === "pending" && (
                              <Button
                                data-testid={`cancel-permission-${perm.id}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelPermission(perm.id)}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Attendance History */}
              <div className="lg:col-span-12 bg-white border border-gray-200 rounded-sm">
                <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                  <ClockCounterClockwise className="h-5 w-5 text-[#002FA7]" weight="duotone" />
                  <h2 className="text-lg font-bold text-gray-900 font-['Outfit']">Attendance History</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Date</th>
                        <th className="table-header">Clock In</th>
                        <th className="table-header">Clock Out</th>
                        <th className="table-header">Break</th>
                        <th className="table-header">Working Hours</th>
                        <th className="table-header">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceHistory.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-8 text-gray-500">No attendance records yet</td>
                        </tr>
                      ) : (
                        attendanceHistory.slice(0, 10).map((record, idx) => (
                          <tr key={idx} className="table-row">
                            <td className="table-cell font-medium">{format(new Date(record.date), "MMM d, yyyy")}</td>
                            <td className="table-cell">{format(new Date(record.clock_in), "h:mm a")}</td>
                            <td className="table-cell">{record.clock_out ? format(new Date(record.clock_out), "h:mm a") : "—"}</td>
                            <td className="table-cell">{record.total_break_minutes || 0} min</td>
                            <td className="table-cell">
                              <span className={record.working_hours && record.working_hours < 8 ? "text-[#FF2E00]" : ""}>
                                {record.working_hours ? `${record.working_hours.toFixed(2)}h` : "—"}
                              </span>
                            </td>
                            <td className="table-cell">
                              {record.is_short_day ? (
                                <span className="badge-rejected">Short Day</span>
                              ) : record.clock_out ? (
                                <span className="badge-approved">Complete</span>
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
              </div>
            </div>
          </>
        )}

        {/* Work Summary Tab */}
        {activeTab === "summary" && workingSummary && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 font-['Outfit'] tracking-tight">Work Summary</h1>
              <p className="text-gray-500 mt-1">Your monthly working hours overview</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="metric-card">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarCheck className="h-5 w-5 text-[#002FA7]" weight="duotone" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Working Days</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{workingSummary.total_working_days}</p>
                <p className="text-sm text-gray-500">this month</p>
              </div>

              <div className="metric-card" style={{ borderLeftColor: '#00C853' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-5 w-5 text-[#00C853]" weight="duotone" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Hours</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{workingSummary.total_working_hours}h</p>
                <p className="text-sm text-gray-500">avg {workingSummary.average_hours_per_day}h/day</p>
              </div>

              <div className="metric-card" style={{ borderLeftColor: '#FF2E00' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Warning className="h-5 w-5 text-[#FF2E00]" weight="duotone" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Short Days</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{workingSummary.short_days_count}</p>
                <p className="text-sm text-gray-500">less than 8 hours</p>
              </div>

              <div className="metric-card" style={{ borderLeftColor: '#FFC107' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Hourglass className="h-5 w-5 text-[#FFC107]" weight="duotone" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Half Days Deducted</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{workingSummary.half_days_deducted}</p>
                <p className="text-sm text-gray-500">from casual leave</p>
              </div>
            </div>

            {/* Policy Info */}
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 font-['Outfit'] mb-4">Working Hours Policy</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Daily Requirements</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#002FA7]"></div>
                      Total working hours: <strong>{workingSummary.total_hours_per_day} hours</strong> (8:30)
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#FF2E00]"></div>
                      Minimum required: <strong>{workingSummary.required_hours_per_day} hours</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#FFC107]"></div>
                      Less than 8 hours = <strong>Short Day</strong>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Short Day Policy</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#FF2E00]"></div>
                      {workingSummary.short_days_for_half_leave} short days in a month = <strong>0.5 day leave deduction</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#FFC107]"></div>
                      Deducted automatically from casual leave
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Permission Hours</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#FFC107]"></div>
                      Monthly allowance: <strong>2 hours</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#FFC107]"></div>
                      Max per use: <strong>1 hour</strong> (use twice per month)
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Break Time</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#002FA7]"></div>
                      Daily break allowance: <strong>30 minutes</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#FFC107]"></div>
                      Can be taken in multiple breaks
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Payslips Tab */}
        {activeTab === "payslips" && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 font-['Outfit'] tracking-tight">My Payslips</h1>
              <p className="text-gray-500 mt-1">View and download your salary slips</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Pay Period</th>
                    <th className="table-header">Basic Salary</th>
                    <th className="table-header">Deductions</th>
                    <th className="table-header">Net Pay</th>
                    <th className="table-header">Generated On</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">
                        No payslips available yet
                      </td>
                    </tr>
                  ) : (
                    payslips.map((ps) => (
                      <tr key={ps.id} className="table-row">
                        <td className="table-cell font-medium">{ps.month_name} {ps.year}</td>
                        <td className="table-cell">₹{ps.basic_salary?.toLocaleString()}</td>
                        <td className="table-cell text-[#FF2E00]">-₹{ps.total_deductions?.toLocaleString()}</td>
                        <td className="table-cell font-bold text-[#00C853]">₹{ps.net_pay?.toLocaleString()}</td>
                        <td className="table-cell text-sm text-gray-500">
                          {format(new Date(ps.created_at), "MMM d, yyyy")}
                        </td>
                        <td className="table-cell">
                          <Button
                            data-testid={`download-payslip-${ps.id}`}
                            size="sm"
                            onClick={() => handleDownloadPayslip(ps.id)}
                            className="bg-[#002FA7] hover:bg-[#001F70] text-white gap-2"
                          >
                            <DownloadSimple className="h-4 w-4" />
                            PDF
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Payslip Details */}
            {payslips.length > 0 && (
              <div className="mt-6 bg-white border border-gray-200 rounded-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 font-['Outfit'] mb-4">Latest Payslip Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-gray-50 rounded-sm">
                    <p className="text-sm text-gray-500 mb-1">Basic Salary</p>
                    <p className="text-2xl font-bold text-gray-900">₹{payslips[0]?.basic_salary?.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-[#FFEBE6] rounded-sm">
                    <p className="text-sm text-gray-500 mb-1">Total Deductions</p>
                    <p className="text-2xl font-bold text-[#FF2E00]">-₹{payslips[0]?.total_deductions?.toLocaleString()}</p>
                    {payslips[0]?.deduction_details?.length > 0 && (
                      <ul className="mt-2 text-xs text-gray-500">
                        {payslips[0].deduction_details.map((d, i) => (
                          <li key={i}>{d.description}: ₹{d.amount}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="p-4 bg-[#E6FFEE] rounded-sm">
                    <p className="text-sm text-gray-500 mb-1">Net Pay</p>
                    <p className="text-2xl font-bold text-[#00C853]">₹{payslips[0]?.net_pay?.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
