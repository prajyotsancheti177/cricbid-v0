import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, User, LogIn } from "lucide-react";
import apiConfig from "@/config/apiConfig";

interface PlayerProfile {
  id: string;
  mobile: string;
  name?: string;
  age?: number;
  gender?: string;
  photo?: string;
  skill?: string;
  email?: string;
  address?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onProfileLoaded: (profile: PlayerProfile) => void;
}

const STORAGE_KEY = "cricbid_player_token";

export const getStoredPlayerToken = () => localStorage.getItem(STORAGE_KEY);
export const clearPlayerToken = () => localStorage.removeItem(STORAGE_KEY);

export const fetchProfileWithToken = async (token: string): Promise<PlayerProfile | null> => {
  try {
    const res = await fetch(`${apiConfig.baseUrl}/api/player-profile/me`, {
      headers: { "x-player-token": token },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data || null;
  } catch {
    return null;
  }
};

type Mode = "login" | "register";

const PlayerProfileModal = ({ open, onClose, onProfileLoaded }: Props) => {
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const reset = () => {
    setError("");
    setMobile("");
    setPassword("");
    setName("");
    setConfirmPassword("");
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
  };

  const handleLogin = async () => {
    if (!mobile.trim() || !password) {
      setError("Mobile number and password are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/player-profile/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      localStorage.setItem(STORAGE_KEY, data.data.token);
      onProfileLoaded(data.data.profile);
      reset();
      onClose();
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!mobile.trim() || !name.trim() || !password) {
      setError("Mobile number, name, and password are required.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/player-profile/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.trim(), name: name.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");
      // Auto-login after register
      const loginRes = await fetch(`${apiConfig.baseUrl}/api/player-profile/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.trim(), password }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok) {
        localStorage.setItem(STORAGE_KEY, loginData.data.token);
        onProfileLoaded(loginData.data.profile);
      }
      reset();
      onClose();
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "login" ? <LogIn className="w-5 h-5" /> : <User className="w-5 h-5" />}
            {mode === "login" ? "Login to your CricBid Profile" : "Create CricBid Profile"}
          </DialogTitle>
        </DialogHeader>

        {/* Mode switcher */}
        <div className="flex rounded-md border border-border overflow-hidden text-sm">
          <button
            type="button"
            className={`flex-1 py-2 font-medium transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            onClick={() => switchMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`flex-1 py-2 font-medium transition-colors ${mode === "register" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            onClick={() => switchMode("register")}
          >
            Create Profile
          </button>
        </div>

        <div className="space-y-4">
          {mode === "register" && (
            <div className="space-y-1">
              <Label htmlFor="pp-name">Full Name *</Label>
              <Input
                id="pp-name"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="pp-mobile">Mobile Number *</Label>
            <Input
              id="pp-mobile"
              type="tel"
              placeholder="10-digit mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pp-password">Password *</Label>
            <Input
              id="pp-password"
              type="password"
              placeholder={mode === "register" ? "Create a password (min 4 chars)" : "Enter your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {mode === "register" && (
            <div className="space-y-1">
              <Label htmlFor="pp-confirm">Confirm Password *</Label>
              <Input
                id="pp-confirm"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            onClick={mode === "login" ? handleLogin : handleRegister}
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {mode === "login" ? "Login & Fill Details" : "Create Profile & Continue"}
          </Button>

          {mode === "login" && (
            <p className="text-center text-sm text-muted-foreground">
              No profile yet?{" "}
              <button type="button" className="text-primary underline" onClick={() => switchMode("register")}>
                Create one
              </button>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerProfileModal;
