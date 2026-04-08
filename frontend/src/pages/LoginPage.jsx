import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { toast } from "sonner";
import { Eye, EyeSlash, UserCircle, Envelope, Lock, Buildings, MicrosoftOutlookLogo, Question } from "@phosphor-icons/react";
import axios from "axios";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const { login, register } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    department: "General",
    position: "Employee"
  });

  useEffect(() => {
    // Check if Microsoft login is configured
    const checkMicrosoft = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/auth/microsoft/status`);
        setMicrosoftEnabled(data.configured);
      } catch (error) {
        setMicrosoftEnabled(false);
      }
    };
    checkMicrosoft();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const result = await login(formData.email, formData.password);
        if (result.success) {
          toast.success("Welcome back!");
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await register(formData);
        if (result.success) {
          toast.success("Account created successfully!");
        } else {
          toast.error(result.error);
        }
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/auth/microsoft/login`);
      window.location.href = data.auth_url;
    } catch (error) {
      toast.error("Microsoft login not available");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <img 
              src="https://static.prod-images.emergentagent.com/jobs/aaf63ca7-adc6-4c7b-937b-09773c3509ed/images/f54676851e2ae99a51a94037909cd1cec0feddb104a3fbd9c71931cef8478ad0.png" 
              alt="HR Portal Logo"
              className="h-10 w-10"
            />
            <span className="text-2xl font-bold text-gray-900 font-['Outfit']">HR Portal</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-gray-900 mb-2 font-['Outfit'] tracking-tight">
            {isLogin ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-gray-500 mb-8">
            {isLogin ? "Sign in to access your dashboard" : "Register to get started"}
          </p>

          {/* Microsoft Login Button */}
          {isLogin && microsoftEnabled && (
            <div className="mb-6">
              <Button
                type="button"
                onClick={handleMicrosoftLogin}
                variant="outline"
                className="w-full h-12 border-gray-300 hover:bg-gray-50 gap-3"
              >
                <MicrosoftOutlookLogo className="h-5 w-5 text-[#0078D4]" weight="duotone" />
                Sign in with Microsoft
              </Button>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">or continue with email</span>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</Label>
                <div className="relative">
                  <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" weight="duotone" />
                  <Input
                    id="name"
                    data-testid="register-name-input"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10 h-12 border-gray-300 rounded-sm focus:ring-[#002FA7] focus:border-[#002FA7]"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
              <div className="relative">
                <Envelope className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" weight="duotone" />
                <Input
                  id="email"
                  data-testid="login-email-input"
                  type="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 h-12 border-gray-300 rounded-sm focus:ring-[#002FA7] focus:border-[#002FA7]"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                {isLogin && (
                  <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="text-sm text-[#002FA7] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="font-['Outfit'] flex items-center gap-2">
                          <Question className="h-5 w-5 text-[#002FA7]" weight="duotone" />
                          Password Reset
                        </DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <div className="bg-[#E5ECFF] border border-[#002FA7] rounded-sm p-4">
                          <p className="text-sm text-gray-700 mb-3">
                            To reset your password, please contact the HR department:
                          </p>
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2">
                              <Envelope className="h-4 w-4 text-[#002FA7]" />
                              <span>Email: <strong>hr@company.com</strong></span>
                            </li>
                            <li className="flex items-center gap-2">
                              <UserCircle className="h-4 w-4 text-[#002FA7]" />
                              <span>Visit HR office during working hours</span>
                            </li>
                          </ul>
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                          For security reasons, password resets are handled by HR personnel only.
                        </p>
                      </div>
                      <Button
                        onClick={() => setResetDialogOpen(false)}
                        className="w-full bg-[#002FA7] text-white hover:bg-[#001F70]"
                      >
                        Got it
                      </Button>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" weight="duotone" />
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 h-12 border-gray-300 rounded-sm focus:ring-[#002FA7] focus:border-[#002FA7]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeSlash className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department" className="text-sm font-medium text-gray-700">Department</Label>
                  <div className="relative">
                    <Buildings className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" weight="duotone" />
                    <Input
                      id="department"
                      data-testid="register-department-input"
                      type="text"
                      placeholder="Engineering"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="pl-10 h-12 border-gray-300 rounded-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position" className="text-sm font-medium text-gray-700">Position</Label>
                  <Input
                    id="position"
                    data-testid="register-position-input"
                    type="text"
                    placeholder="Developer"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="h-12 border-gray-300 rounded-sm"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              data-testid="login-submit-btn"
              disabled={loading}
              className="w-full h-12 bg-[#002FA7] text-white hover:bg-[#001F70] rounded-sm font-medium text-base"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                isLogin ? "Sign In" : "Create Account"
              )}
            </Button>
          </form>

          {/* Toggle */}
          <div className="mt-8 text-center">
            <p className="text-gray-500">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                data-testid="toggle-auth-mode-btn"
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-[#002FA7] font-medium hover:underline"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Image */}
      <div 
        className="hidden lg:block lg:w-1/2 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://static.prod-images.emergentagent.com/jobs/aaf63ca7-adc6-4c7b-937b-09773c3509ed/images/01c38731262f23f3af4df465ed570f1df44134feaedb2624f68b8cd4d431398f.png')`
        }}
      >
        <div className="h-full w-full bg-[#002FA7]/10 backdrop-blur-[2px]"></div>
      </div>
    </div>
  );
}
