import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, User, LogIn } from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { GoogleSignInButton, useGoogleClientId } from "@/components/auth/GoogleSignInButton";

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

type Mode = "login" | "register" | "mobile";

const PlayerProfileModal = ({ open, onClose, onProfileLoaded }: Props) => {
  const [mode, setMode] = useState<Mode>("login");
  const googleEnabled = Boolean(useGoogleClientId());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [mobile, setMobile] = useState("");
  /** Session from a Google sign-in that still owes us a phone number. */
  const [pendingGoogle, setPendingGoogle] = useState<{ token: string; profile: PlayerProfile } | null>(null);
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

  /**
   * Google has verified who they are; we still need the number, because that is
   * what ties a profile to tournament registrations and to WhatsApp. Asked once,
   * and stored unverified until an OTP can prove it.
   */
  const handleGoogleSignedIn = (result: { token: string; profile: any; needsMobile: boolean }) => {
    setError("");
    localStorage.setItem(STORAGE_KEY, result.token);
    if (result.needsMobile) {
      setPendingGoogle({ token: result.token, profile: result.profile });
      setMode("mobile");
      return;
    }
    onProfileLoaded(result.profile);
    reset();
    onClose();
  };

  const saveGoogleMobile = async () => {
    const digits = mobile.replace(/\D/g, "");
    if (digits.length < 10) { setError("Enter a valid 10-digit mobile number"); return; }
    if (!pendingGoogle) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/player-profile/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-player-token": pendingGoogle.token },
        body: JSON.stringify({ mobile: digits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not save your number");
      onProfileLoaded(data.data);
      setPendingGoogle(null);
      reset();
      onClose();
    } catch (err: any) {
      setError(err.message || "Could not save your number");
    } finally {
      setLoading(false);
    }
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
            {mode === "mobile" ? "One last thing"
              : mode === "login" ? "Login to your CricBid Profile" : "Create CricBid Profile"}
          </DialogTitle>
        </DialogHeader>

        {/* Google first — it is one tap and needs nothing remembered. */}
        {mode !== "mobile" && googleEnabled && (
          <div className="space-y-3">
            <GoogleSignInButton onSignedIn={handleGoogleSignedIn} onError={setError} />
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or use a mobile number
              <span className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        {/* Google is verified; we still need the number that ties this profile
            to registrations and WhatsApp. */}
        {mode === "mobile" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{pendingGoogle?.profile?.name || pendingGoogle?.profile?.email}</span>.
              Add your mobile number so hosts can reach you about your registrations.
            </p>
            <div className="space-y-1">
              <Label htmlFor="pp-google-mobile">Mobile Number *</Label>
              <Input
                id="pp-google-mobile"
                type="tel"
                inputMode="numeric"
                placeholder="10-digit mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveGoogleMobile(); }}
              />
            </div>
            {error && (
              <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            )}
            <Button className="w-full" onClick={saveGoogleMobile} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save & Continue
            </Button>
          </div>
        )}

        {/* Mode switcher */}
        {mode !== "mobile" && (
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
        )}

        {mode !== "mobile" && (
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlayerProfileModal;
