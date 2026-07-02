import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "../lib/api";
import { CalendarCheck, Lock } from "lucide-react";

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) { setError("Email and password required"); return; }
    setLoading(true); setError("");
    const r = await post("user/login", { email, password }).catch(() => null);
    setLoading(false);
    if (r?.success) {
      localStorage.setItem("cricbook_auth", "true");
      localStorage.setItem("cricbook_user", JSON.stringify(r.data));
      navigate("/admin");
    } else {
      setError(r?.message || "Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-panel border border-bdr rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-2 mb-8">
          <CalendarCheck className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold text-white">CricBook</span>
        </div>
        <p className="text-sm text-muted mb-6">Venue owner login — same credentials as CricBid</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted font-medium">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted font-medium">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="input mt-1"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={handleLogin} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
