import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, Plus, User, ChevronRight } from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { GoogleSignInButton, useGoogleClientId } from "@/components/auth/GoogleSignInButton";

/**
 * Sign in, then choose which player you are registering.
 *
 * One account can own several players — a parent registers two children from a
 * single Google login — so signing in leads to a picker, not straight to a
 * form.
 *
 * There is no password. Google today, WhatsApp OTP later.
 */

export interface PlayerProfile {
  id: string;
  name?: string;
  age?: number;
  gender?: string;
  photo?: string;
  skill?: string;
  email?: string;
  address?: string;
  mobile?: string;
}

export interface PlayerAccount {
  id: string;
  email?: string;
  mobile?: string;
  profiles: PlayerProfile[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onProfileLoaded: (profile: PlayerProfile) => void;
}

const STORAGE_KEY = "cricbid_player_token";

export const getStoredPlayerToken = () => localStorage.getItem(STORAGE_KEY);
export const clearPlayerToken = () => localStorage.removeItem(STORAGE_KEY);

/** The signed-in account, or null when the token is missing or expired. */
export const fetchAccountWithToken = async (token: string): Promise<PlayerAccount | null> => {
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

type Step = "signin" | "pick" | "add";

const PlayerProfileModal = ({ open, onClose, onProfileLoaded }: Props) => {
  const googleEnabled = Boolean(useGoogleClientId());
  const [step, setStep] = useState<Step>("signin");
  const [account, setAccount] = useState<PlayerAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");

  // An existing session skips the sign-in step.
  useEffect(() => {
    if (!open) return;
    const token = getStoredPlayerToken();
    if (!token) return;
    fetchAccountWithToken(token).then(acc => {
      if (!acc) { clearPlayerToken(); return; }
      setAccount(acc);
      setStep(acc.profiles.length ? "pick" : "add");
    });
  }, [open]);

  const reset = () => {
    setError("");
    setName("");
    setMobile("");
  };

  const closeAll = () => { reset(); onClose(); };

  const handleGoogleSignedIn = (result: { token: string; account: PlayerAccount }) => {
    setError("");
    localStorage.setItem(STORAGE_KEY, result.token);
    // Same token the rest of the app authenticates with — one identity now.
    localStorage.setItem("cricbid_session_token", result.token);
    setAccount(result.account);
    // A new account owns nobody yet, so go straight to adding a player rather
    // than showing an empty list.
    setStep(result.account.profiles.length ? "pick" : "add");
  };

  const choose = (profile: PlayerProfile) => {
    onProfileLoaded(profile);
    closeAll();
  };

  const addPlayer = async () => {
    if (!name.trim()) { setError("Enter the player's name"); return; }
    const token = getStoredPlayerToken();
    if (!token) { setError("Please sign in again"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/player-profile/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-player-token": token },
        body: JSON.stringify({ name: name.trim(), mobile: mobile.replace(/\D/g, "") }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Could not add that player");
      setAccount(prev => prev ? { ...prev, profiles: [...prev.profiles, body.data] } : prev);
      choose(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that player");
    } finally {
      setLoading(false);
    }
  };

  const title =
    step === "signin" ? "Sign in to CricBid"
      : step === "pick" ? "Who are you registering?"
        : "Add a player";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) closeAll(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "signin" ? <LogIn className="w-5 h-5" /> : <User className="w-5 h-5" />}
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* ── Sign in ─────────────────────────────────────────── */}
        {step === "signin" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign in once and your details are saved for every tournament you enter.
            </p>
            {googleEnabled ? (
              <GoogleSignInButton onSignedIn={handleGoogleSignedIn} onError={setError} />
            ) : (
              <Alert>
                <AlertDescription>
                  Sign-in is not available yet — you can still fill in the form below.
                </AlertDescription>
              </Alert>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Signing in with a mobile number is coming soon.
            </p>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          </div>
        )}

        {/* ── Pick a player ───────────────────────────────────── */}
        {step === "pick" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Choose who this form is for, or add someone new.
            </p>
            <div className="space-y-2">
              {account?.profiles.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choose(p)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/60 hover:bg-muted"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {(p.name || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[p.age ? `${p.age} yrs` : null, p.skill, p.mobile].filter(Boolean).join(" · ") || "No details yet"}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={() => { reset(); setStep("add"); }}>
              <Plus className="mr-1 h-4 w-4" />
              Add another player
            </Button>
          </div>
        )}

        {/* ── Add a player ────────────────────────────────────── */}
        {step === "add" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {account?.profiles.length
                ? "Registering a second child or a teammate? Add them here."
                : "Tell us who is playing. You can add more players to this account later."}
            </p>
            <div className="space-y-1">
              <Label htmlFor="pp-name">Player name *</Label>
              <Input
                id="pp-name"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pp-mobile">Contact number</Label>
              <Input
                id="pp-mobile"
                type="tel"
                inputMode="numeric"
                placeholder="10-digit mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addPlayer(); }}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                One parent's number can be used for more than one player.
              </p>
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="flex gap-2">
              {!!account?.profiles.length && (
                <Button variant="ghost" onClick={() => { reset(); setStep("pick"); }} disabled={loading}>
                  Back
                </Button>
              )}
              <Button className="flex-1" onClick={addPlayer} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save &amp; Continue
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlayerProfileModal;
