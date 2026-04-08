import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Eye, EyeSlash, UserCircle, Envelope, Lock, Buildings } from "@phosphor-icons/react";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    department: "General",
    position: "Employee"
  });

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
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
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
