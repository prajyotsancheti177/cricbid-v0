import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield } from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { GoogleSignInButton, useGoogleClientId, type GoogleSignInFailure } from "@/components/auth/GoogleSignInButton";
import { trackEvent } from "@/lib/eventTracker";
import { clearSession, jsonAuthHeaders, storeSession, takeGoogleRedirectState } from "@/lib/auth";

/**
 * What to say for each sign-in failure code. The redirect callback reports
 * failures as `?error=<CODE>` and only codes are ever rendered from the URL:
 * the page used to print whatever text the link carried, so anyone could send
 * a cricbid.online/login link with their own words ("call this number…") on it.
 */
const SIGN_IN_ERRORS: Record<string, string> = {
  CSRF: "That sign-in could not be verified. Please try again.",
  INVALID_TOKEN: "Could not verify that Google sign-in. Please try again.",
  UNVERIFIED_EMAIL: "That Google account has no verified email address.",
  DEACTIVATED: "Your account has been deactivated. Please contact support.",
  SUB_CONFLICT: "Another Google account is already linked to this CricBid account. Ask an administrator to unlink it.",
  LINK_REQUIRES_PASSWORD: "This email belongs to an admin account. Sign in with your password once to link Google to it.",
  REPLAYED: "That Google sign-in was already used. Please sign in again.",
  EXPIRED_CODE: "That sign-in took too long. Please try again.",
  NOT_CONFIGURED: "Google sign-in is not available right now. Use your password.",
  RATE_LIMITED: "Too many attempts. Please wait a few minutes and try again.",
  GOOGLE_FAILED: "Google sign-in failed. Please try again.",
};
const messageForCode = (code: string | null | undefined) =>
  (code && SIGN_IN_ERRORS[code]) || SIGN_IN_ERRORS.GOOGLE_FAILED;

/** The email inside a Google ID token, read only to prefill the form. */
const emailInCredential = (credential: string): string => {
  try {
    const payload = JSON.parse(atob(credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.email === "string" ? payload.email : "";
  } catch {
    return "";
  }
};

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const googleEnabled = Boolean(useGoogleClientId());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // A Google credential waiting to be linked once the password proves the
  // account is theirs (LINK_REQUIRES_PASSWORD, popup mode).
  const [pendingLink, setPendingLink] = useState<string | null>(null);

  // Redirect if already authenticated — but not while a sign-in is landing
  // here, or a stale stored user would be sent off before the new one loads.
  useEffect(() => {
    if (/[#&]code=/.test(window.location.hash) || window.location.search.includes("error=")) return;
    const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
    const userStr = localStorage.getItem("user");

    if (isAuthenticated && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === 'boss' || user.role === 'super_user') {
          navigate("/users");
        } else {
          navigate("/tournaments");
        }
      } catch {
        // If parsing fails, clear storage
        clearSession();
      }
    }
  }, [navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError("");
  };

  /** Everything that happens once a login is accepted, whichever way it came. */
  /**
   * @param returnTo - where a redirect sign-in started (a registration link,
   *   say); otherwise the role decides
   */
  const completeLogin = (user: any, method: "password" | "google", returnTo?: string | null) => {
    // storeSession keeps the session token out of the user object it saves, so
    // nothing renders it and only authHeaders() ever reads it.
    storeSession(user);

    trackEvent("login", { role: user.role, userId: user._id, method });

    toast({
      title: "Login Successful",
      description: `Welcome back, ${user.name || user.email}!`,
    });

    if (returnTo) {
      navigate(returnTo);
    } else if (user.role === 'boss' || user.role === 'super_user') {
      navigate("/users");
    } else {
      navigate("/tournaments");
    }
  };

  /**
   * Redirect-mode sign-in lands back here with a one-time code in the URL
   * fragment (never sent to a server), or an ?error=<CODE>. Both are stripped
   * from the address bar at once.
   *
   * The code is exchanged together with the nonce this tab generated before it
   * left for Google; the server refuses unless the ID token carries that same
   * nonce. A link or page that lands someone here with a code they did not
   * start therefore signs no one in. (The old `#token=` form is not accepted
   * any more for the same reason: a link carrying a token signed the visitor
   * into whoever's token it was.)
   */
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = hash.get("code");
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");

    if (err) {
      setError(messageForCode(err));
      window.history.replaceState({}, "", "/login");
      return;
    }
    if (!code) return;

    window.history.replaceState({}, "", "/login");
    const { nonce, returnTo } = takeGoogleRedirectState();
    setIsLoading(true);
    fetch(`${apiConfig.baseUrl}/api/user/google-exchange`, {
      method: "POST",
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ code, nonce }),
    })
      .then(async r => ({ ok: r.ok, body: await r.json().catch(() => null) }))
      .then(({ ok, body }) => {
        if (!ok || !body?.data?.sessionToken) {
          if (body?.code === "LINK_REQUIRES_PASSWORD") {
            setNotice(messageForCode(body.code));
          } else {
            setError(messageForCode(body?.code));
          }
          return;
        }
        completeLogin(body.data, "google", returnTo);
      })
      .catch(() => setError("Failed to connect to server. Please try again."))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A popup Google sign-in failed. One failure is a next step, not an error. */
  const handleGoogleError = (message: string, failure?: GoogleSignInFailure) => {
    if (failure?.code === "LINK_REQUIRES_PASSWORD" && failure.credential) {
      setPendingLink(failure.credential);
      setError("");
      setNotice(messageForCode(failure.code));
      const email = emailInCredential(failure.credential);
      if (email) setFormData(prev => ({ ...prev, email }));
      return;
    }
    setNotice("");
    setError(failure?.code ? messageForCode(failure.code) : message);
  };

  /** After a password sign-in, attach the Google account that asked for it. */
  const linkPendingGoogle = async (sessionToken: string) => {
    if (!pendingLink) return;
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/user/link-google`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": sessionToken },
        body: JSON.stringify({ credential: pendingLink }),
      });
      const body = await res.json().catch(() => null);
      toast(res.ok
        ? { title: "Google linked", description: "Next time you can sign in with Google." }
        : { title: "Google not linked", description: body?.message || "You are signed in, but Google could not be linked.", variant: "destructive" });
    } catch {
      /* signed in either way; linking can be retried */
    } finally {
      setPendingLink(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${apiConfig.baseUrl}/api/user/login`, {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        if (pendingLink && data.data?.sessionToken) await linkPendingGoogle(data.data.sessionToken);
        completeLogin(data.data, "password");
      } else if (data.code === "RATE_LIMITED") {
        setError(messageForCode(data.code));
      } else {
        // The specific reason (deactivated, Google-only account) is in `error`;
        // `message` is only ever "Login failed".
        setError((typeof data.error === "string" && data.error) || data.message || "Login failed. Please check your credentials.");
      }
    } catch (err) {
      setError("Failed to connect to server. Please try again.");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-gradient-primary p-3">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Auction Management System
          </CardTitle>
          <CardDescription className="text-center">
            Login to access your dashboard
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {notice && !error && (
            <Alert className="mb-4">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {googleEnabled && (
            <div className="space-y-3 mb-4">
              <GoogleSignInButton
                endpoint="/api/user/google-login"
                onSignedIn={(user) => completeLogin(user, "google")}
                onError={handleGoogleError}
              />
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or use your password
                <span className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={handleInputChange}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleInputChange}
                disabled={isLoading}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Contact your administrator for account access</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
