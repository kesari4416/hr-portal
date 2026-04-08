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
  Briefcase, User, House, ClockCounterClockwise, CalendarCheck,
  CaretDown
} from "@phosphor-icons/react";

export default function EmployeeDashboard() {
  const { user, logout, api } = useAuth();
  const [attendanceStatus, setAttendanceStatus] = useState({ clocked_in: false, on_break: false, attendance: null });
  const [leaveBalance, setLeaveBalance] = useState({ casual: 0, sick: 0, earned: 0 });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [breakElapsedTime, setBreakElapsedTime] = useState(0);

  const [leaveForm, setLeaveForm] = useState({
    leave_type: "casual",
    start_date: null,
    end_date: null,
    reason: ""
  });

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, balanceRes, requestsRes, historyRes] = await Promise.all([
        api.get("/attendance/status"),
        api.get("/leave/balance"),
        api.get("/leave/my-requests"),
        api.get("/attendance/history")
      ]);
      setAttendanceStatus(statusRes.data);
      setLeaveBalance(balanceRes.data);
      setLeaveRequests(requestsRes.data);
      setAttendanceHistory(historyRes.data);
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
      await api.post("/attendance/clock-out");
      toast.success("Clocked out successfully!");
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

  const handleCancelLeave = async (leaveId) => {
    try {
      await api.delete(`/leave/${leaveId}`);
      toast.success("Leave request cancelled");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to cancel leave request");
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
          <div className="nav-item-active">
            <House className="h-5 w-5" weight="duotone" />
            <span>Dashboard</span>
          </div>
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 font-['Outfit'] tracking-tight">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 mt-1">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>

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
              <div className="text-5xl font-bold text-gray-900 font-['JetBrains_Mono'] mb-2">
                {attendanceStatus.on_break ? formatTime(breakElapsedTime) : formatTime(elapsedTime)}
              </div>
              <p className="text-sm text-gray-500 uppercase tracking-wider">
                {attendanceStatus.on_break ? "Break Duration" : attendanceStatus.clocked_in ? "Working Time" : "Not Clocked In"}
              </p>
            </div>

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
                      disabled={loading}
                      className="btn-break"
                    >
                      <Coffee className="inline h-5 w-5 mr-2" weight="bold" />
                      Start Break
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
                    <p className="font-medium text-gray-900">
                      {attendanceStatus.attendance.total_break_minutes || 0} min
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Leave Balance Cards */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            {/* Request Leave Button */}
            <div className="sm:col-span-3">
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
          </div>

          {/* Leave Requests */}
          <div className="lg:col-span-6 bg-white border border-gray-200 rounded-sm">
            <div className="p-4 border-b border-gray-200 flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-[#002FA7]" weight="duotone" />
              <h2 className="text-lg font-bold text-gray-900 font-['Outfit']">Leave Requests</h2>
            </div>
            <div className="divide-y divide-gray-100">
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

          {/* Attendance History */}
          <div className="lg:col-span-6 bg-white border border-gray-200 rounded-sm">
            <div className="p-4 border-b border-gray-200 flex items-center gap-2">
              <ClockCounterClockwise className="h-5 w-5 text-[#002FA7]" weight="duotone" />
              <h2 className="text-lg font-bold text-gray-900 font-['Outfit']">Attendance History</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {attendanceHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No attendance records yet
                </div>
              ) : (
                attendanceHistory.slice(0, 5).map((record, idx) => (
                  <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {format(new Date(record.date), "EEEE, MMM d")}
                        </p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(record.clock_in), "h:mm a")} - {record.clock_out ? format(new Date(record.clock_out), "h:mm a") : "Active"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Break: {record.total_break_minutes || 0} min</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
