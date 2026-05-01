import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import PublicLayout from "@/components/PublicLayout";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const u = await login(email, password);
      const dest =
        u.role === "super_admin" ? "/dashboard/super-admin" :
        u.role === "admin" ? "/dashboard/admin" :
        "/dashboard/student";
      nav(loc.state?.from || dest, { replace: true });
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <section className="max-w-md mx-auto px-6 py-20" data-testid="login-page">
        <div className="text-center mb-10">
          <span className="hinomaru-dot inline-block mb-4" />
          <h1 className="font-serif text-5xl tracking-tight">Login</h1>
          <p className="text-[#4A4A4A] mt-2 text-sm">Enter the dojo.</p>
        </div>
        <form onSubmit={submit} className="space-y-5 border border-[#E0DCD0] bg-[#F7F5F0] p-8">
          <div>
            <label className="text-[10px] uppercase tracking-[0.24em] text-[#4A4A4A] block mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="login-email-input"
              className="w-full border border-[#E0DCD0] bg-white px-4 py-3 focus:outline-none focus:border-[#1A1A1A] transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.24em] text-[#4A4A4A] block mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="login-password-input"
              className="w-full border border-[#E0DCD0] bg-white px-4 py-3 focus:outline-none focus:border-[#1A1A1A] transition-colors"
            />
          </div>
          {err && <div className="text-[#C1121F] text-sm" data-testid="login-error">{err}</div>}
          <button type="submit" className="btn-primary w-full" disabled={loading} data-testid="login-submit-btn">
            {loading ? "Entering…" : "Enter Dojo"}
          </button>
          <div className="text-sm text-[#4A4A4A] text-center pt-2">
            Have an access code? <Link to="/register" className="ink-underline text-[#1A1A1A]">Enroll here</Link>
          </div>
        </form>
      </section>
    </PublicLayout>
  );
}
