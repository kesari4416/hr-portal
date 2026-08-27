import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { toast } from "sonner";
import { Eye, EyeSlash, Envelope, Lock, Question, UserCircle } from "@phosphor-icons/react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(formData.email, formData.password);
      if (result.success) {
        toast.success("Welcome back!");
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Panel — Form */}
      <div className="w-full lg:w-[52%] flex items-center justify-center px-8 py-12 bg-white">
        <div className="w-full max-w-[420px]">

          {/* Branding */}
          <div className="flex items-center gap-3 mb-12">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: 42,
                height: 42,
                background: 'linear-gradient(135deg, #002FA7 0%, #3B5BDB 100%)',
                boxShadow: '0 4px 14px rgba(0,47,167,0.30)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 10.5C3 6.91 5.91 4 9.5 4s6.5 2.91 6.5 6.5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                <circle cx="9.5" cy="13.5" r="2.5" fill="white"/>
              </svg>
            </div>
            <div>
              <span
                className="text-[22px] font-bold tracking-tight"
                style={{ fontFamily: "'Outfit', sans-serif", color: '#0F172A' }}
              >
                Sparkcurv
              </span>
              <p className="text-[11px] text-slate-400 font-medium tracking-widest uppercase -mt-0.5">HR Portal</p>
            </div>
          </div>

          {/* Headline */}
          <div className="mb-8">
            <h1
              className="text-[36px] font-bold text-slate-900 leading-tight tracking-tight"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Welcome back
            </h1>
            <p className="text-slate-500 mt-2 text-[15px]">
              Sign in with credentials provided by your HR team
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                Work Email
              </Label>
              <div className="relative">
                <Envelope
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400"
                  weight="duotone"
                  style={{ width: 17, height: 17 }}
                />
                <Input
                  id="email"
                  data-testid="login-email-input"
                  type="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 h-12 border-slate-200 bg-slate-50 rounded-xl text-sm focus:bg-white focus:border-[#002FA7] focus:ring-[#002FA7] transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                  Password
                </Label>
                <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#002FA7] hover:text-[#002482] hover:underline transition-colors"
                    >
                      Forgot password?
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                      <DialogTitle
                        className="flex items-center gap-2 text-slate-900"
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                      >
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-50 rounded-lg">
                          <Question className="h-4 w-4 text-[#002FA7]" weight="duotone" />
                        </div>
                        Password Reset
                      </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <p className="text-sm text-slate-700 mb-3 font-medium">
                          Contact the HR department to reset your password:
                        </p>
                        <ul className="space-y-2.5 text-sm">
                          <li className="flex items-center gap-2.5 text-slate-600">
                            <div className="flex items-center justify-center w-7 h-7 bg-white rounded-lg border border-blue-100">
                              <Envelope className="h-3.5 w-3.5 text-[#002FA7]" />
                            </div>
                            <span>Email: <strong className="text-slate-900">hr@company.com</strong></span>
                          </li>
                          <li className="flex items-center gap-2.5 text-slate-600">
                            <div className="flex items-center justify-center w-7 h-7 bg-white rounded-lg border border-blue-100">
                              <UserCircle className="h-3.5 w-3.5 text-[#002FA7]" />
                            </div>
                            <span>Visit HR office during working hours</span>
                          </li>
                        </ul>
                      </div>
                      <p className="text-xs text-slate-400 mt-3">
                        For security, password resets are handled by HR personnel only.
                      </p>
                    </div>
                    <Button
                      onClick={() => setResetDialogOpen(false)}
                      className="w-full bg-[#002FA7] text-white hover:bg-[#002482] rounded-xl font-semibold"
                    >
                      Got it
                    </Button>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  weight="duotone"
                  style={{ width: 17, height: 17 }}
                />
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-11 h-12 border-slate-200 bg-slate-50 rounded-xl text-sm focus:bg-white focus:border-[#002FA7] focus:ring-[#002FA7] transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                >
                  {showPassword
                    ? <EyeSlash style={{ width: 17, height: 17 }} />
                    : <Eye style={{ width: 17, height: 17 }} />
                  }
                </button>
              </div>
            </div>

            <button
              type="submit"
              data-testid="login-submit-btn"
              disabled={loading}
              className="w-full h-12 text-white font-bold text-[15px] rounded-xl transition-all duration-200 mt-2"
              style={{
                background: loading ? '#64748B' : 'linear-gradient(135deg, #002FA7 0%, #3B5BDB 100%)',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(0,47,167,0.35)',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                  <span>Signing in…</span>
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Footer Note */}
          <p className="mt-8 text-center text-slate-400 text-[13px]">
            Don't have an account?{" "}
            <span className="text-slate-600 font-medium">Contact your HR team.</span>
          </p>
        </div>
      </div>

      {/* Right Panel — Visual */}
      <div
        className="hidden lg:block lg:w-[48%] relative overflow-hidden"
        style={{ background: '#002FA7' }}
      >
        {/* Background image with overlay */}
        <img
          src="https://images.unsplash.com/photo-1479293581560-aee98bb24f7f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTB8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBnbGFzcyUyMGFyY2hpdGVjdHVyZSUyMGFic3RyYWN0fGVufDB8fHx8MTc4Nzg1MTM1NXww&ixlib=rb-4.1.0&q=85"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ mixBlendMode: 'multiply', opacity: 0.55 }}
        />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-12">
          {/* Top badge */}
          <div className="flex items-center gap-2">
            <div
              className="px-3 py-1.5 rounded-full text-xs font-bold text-white uppercase tracking-widest"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              HR Management Platform
            </div>
          </div>

          {/* Center Quote */}
          <div className="space-y-6">
            <div
              className="text-[44px] font-bold text-white leading-tight"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Manage your<br />
              <span style={{ color: '#93C5FD' }}>workforce</span><br />
              smarter.
            </div>
            <p className="text-blue-100 text-base leading-relaxed max-w-xs">
              Track attendance, manage leaves, process payroll, and keep your team organized — all in one place.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2.5 mt-6">
              {["Attendance Tracking", "Leave Management", "Payroll", "GPS Geofencing", "Change Requests"].map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1.5 text-xs font-semibold text-white rounded-full"
                  style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.18)' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom stat chips */}
          <div className="flex items-center gap-4">
            {[
              { label: "Employees", value: "Active" },
              { label: "Attendance", value: "Real-time" },
              { label: "Payroll", value: "Automated" }
            ].map(stat => (
              <div
                key={stat.label}
                className="px-4 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <p className="text-[11px] text-blue-200 font-medium uppercase tracking-widest">{stat.label}</p>
                <p className="text-white font-bold text-sm">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
