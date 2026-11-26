import { useEffect, useRef, useState } from "react";
import apiConfig from "@/config/apiConfig";
import { googleNonce, jsonAuthHeaders, rememberGoogleReturn } from "@/lib/auth";

/**
 * "Continue with Google" for player profiles.
 *
 * Renders Google's own button via Google Identity Services, which is a
 * requirement of their branding terms, not a shortcut — a hand-rolled button
 * is not permitted. The GIS library also handles the FedCM flow that replaced
 * third-party cookies, so there is nothing to do about that here.
 *
 * The client id comes from the API rather than a build-time variable, so the
 * same bundle works whether or not sign-in is configured on the server it is
 * talking to. When it is not configured this renders nothing at all.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (opts: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

/** Loads the GIS script once per page, however many buttons ask for it. */
let gisPromise: Promise<void> | null = null;
const loadGis = () => {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google sign-in"));
    document.head.appendChild(script);
  });
  return gisPromise;
};

/**
 * The configured Google client id, or null when sign-in is off.
 *
 * Exported so a caller can hide its own surrounding chrome — a divider reading
 * "or use a mobile number" is nonsense with nothing above it.
 */
interface AuthConfig {
  googleClientId: string | null;
  googleRedirectUri: string | null;
  /** 'mobile' | 'true' | 'false' — which devices skip the popup. */
  googleRedirectOn: string;
}

/**
 * Whether this device should skip the popup.
 *
 * The popup returns the credential through `window.opener`, which mobile
 * browsers routinely prevent — the popup opens, hangs on Google's own
 * /gsi/transform page, and nothing ever comes back. Redirect mode has no popup
 * and no opener, so none of that can happen.
 *
 * Coarse on purpose: a false positive costs a full-page navigation instead of a
 * popup, which is fine. A false negative costs a sign-in that never completes.
 */
const isMobileLike = () => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini/i.test(ua)) return true;
  // iPadOS reports itself as a Mac, so fall back to the touch signal.
  return navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua);
};

/**
 * The app whose built-in browser this page is open in, or null.
 *
 * Google refuses sign-in inside embedded browsers outright ("Error 403:
 * disallowed_useragent"), and CricBid links travel by WhatsApp and Instagram,
 * so this is the common case, not an edge one. `; wv)` is the token every
 * Android WebView carries, which covers in-app browsers that don't name
 * themselves.
 */
export const inAppBrowserName = (): string | null => {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "Facebook";
  if (/WhatsApp/i.test(ua)) return "WhatsApp";
  if (/Snapchat/i.test(ua)) return "Snapchat";
  if (/LinkedInApp/i.test(ua)) return "LinkedIn";
  if (/\bLine\//i.test(ua)) return "LINE";
  if (/; wv\)/.test(ua)) return "this app";
  return null;
};

/**
 * Shown instead of the Google button inside an in-app browser: a way out to a
 * real browser, where Google sign-in works.
 */
const OpenInBrowser = ({ app }: { app: string }) => {
  const [copied, setCopied] = useState(false);
  const isAndroid = /Android/i.test(navigator.userAgent || "");
  const { host, pathname, search, protocol, href } = window.location;
  // Chrome's intent URL opens the same page in Chrome, falling back to the
  // plain URL if Chrome is not installed.
  const intentUrl = `intent://${host}${pathname}${search}#Intent;scheme=${protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      window.prompt("Copy this link and open it in your browser:", href);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm space-y-2 text-left">
      <p className="font-medium">Google sign-in doesn't work inside {app}'s browser.</p>
      {isAndroid ? (
        <a href={intentUrl} className="inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground">
          Open in Chrome
        </a>
      ) : (
        <p className="text-muted-foreground">
          Tap <span className="font-semibold">•••</span> or the share button and choose <span className="font-semibold">Open in Safari</span>, then sign in there.
        </p>
      )}
      <button type="button" onClick={copy} className="w-full rounded-md border border-border px-3 py-2 text-muted-foreground hover:bg-muted">
        {copied ? "Link copied — paste it into your browser" : "Copy link"}
      </button>
    </div>
  );
};

/**
 * The server's sign-in config.
 *
 * `googleRedirectUri` is null unless redirect mode is switched on server-side,
 * because it only works once that URL is registered under the OAuth client's
 * Authorised redirect URIs. Sending Google an unregistered one fails the
 * sign-in outright, so the popup stays the default.
 */
export const useAuthConfig = (): AuthConfig => {
  const [cfg, setCfg] = useState<AuthConfig>({
    googleClientId: null, googleRedirectUri: null, googleRedirectOn: "false",
  });
  useEffect(() => {
    let cancelled = false;
    fetch(`${apiConfig.baseUrl}/api/player-profile/auth-config`)
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (cancelled || !body?.data?.googleEnabled) return;
        setCfg({
          googleClientId: body.data.googleClientId,
          googleRedirectUri: body.data.googleRedirectUri ?? null,
          googleRedirectOn: String(body.data.googleRedirectOn ?? "false"),
        });
      })
      .catch(() => { /* sign-in stays hidden; password login still works */ });
    return () => { cancelled = true; };
  }, []);
  return cfg;
};

/** Just the client id — most callers only need to know whether sign-in is on. */
export const useGoogleClientId = (): string | null => useAuthConfig().googleClientId;

/** What a failed sign-in reports, beyond the message. */
export interface GoogleSignInFailure {
  /** Stable reason from the server, e.g. LINK_REQUIRES_PASSWORD. */
  code?: string;
  /** The Google credential, so a caller can finish a flow (link after password). */
  credential?: string;
}

interface Props {
  /**
   * Where to send the Google credential for verification (popup mode): the
   * admin login page uses /api/user/google-login, the registration modal
   * /api/player-profile/google. Redirect mode always comes back through
   * /login, which finishes the sign-in and returns here.
   */
  endpoint?: string;
  /** Called with whatever that endpoint returned, once the server verified it. */
  onSignedIn: (data: any) => void;
  onError?: (message: string, failure?: GoogleSignInFailure) => void;
  /**
   * Redirect mode only: a marker the page reads after coming back (see
   * takeGoogleResume), so it can pick up where the person left off.
   */
  resume?: string;
}

export const GoogleSignInButton = ({ endpoint = "/api/player-profile/google", onSignedIn, onError, resume }: Props) => {
  const { googleClientId: clientId, googleRedirectUri, googleRedirectOn } = useAuthConfig();
  const [inApp] = useState(inAppBrowserName);

  // Redirect where the popup cannot work; popup where it does.
  const useRedirect = Boolean(googleRedirectUri) && (
    googleRedirectOn === "true" || (googleRedirectOn === "mobile" && isMobileLike())
  );
  const holder = useRef<HTMLDivElement>(null);
  // Kept in a ref so re-renders never re-initialise GIS with a stale callback.
  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!clientId || inApp || !holder.current) return;
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled || !holder.current || !window.google?.accounts?.id) return;

        // Redirect mode leaves this page. Note where it was, so the person
        // comes back here — /login itself is never a destination.
        if (useRedirect && !window.location.pathname.startsWith("/login")) {
          rememberGoogleReturn(resume);
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          // Written into the ID token by Google; the redirect exchange only
          // accepts a token carrying this tab's nonce.
          nonce: googleNonce(),
          ...(useRedirect
            ? { ux_mode: "redirect", login_uri: googleRedirectUri }
            : {}),
          // Never sign someone in without them asking.
          auto_select: false,
          // Helps Safari and other browsers with tracking prevention, where the
          // sign-in popup otherwise cannot read its own storage.
          itp_support: true,
          /**
           * Without this, a failure inside Google's own flow is completely
           * silent — the popup opens, hangs, and the page says nothing. That is
           * what "stuck on the Google screen" looks like, and it left no way to
           * tell an unpublished OAuth app from a blocked popup.
           */
          error_callback: (err: { type?: string; message?: string }) => {
            const type = err?.type || "";
            if (type === "popup_closed") {
              onErrorRef.current?.("Sign-in was cancelled.");
            } else if (type === "popup_failed_to_open") {
              onErrorRef.current?.("Your browser blocked the Google sign-in window. Allow popups for this site and try again.");
            } else {
              onErrorRef.current?.(
                "Google could not complete the sign-in. If it hangs on the Google screen, allow third-party cookies for accounts.google.com, or try a different browser."
              );
            }
            // Kept for diagnosis: the type is the only thing that distinguishes
            // these cases, and it is not shown to the user verbatim.
            console.warn("[google sign-in] failed:", err);
          },
          callback: async (response: { credential?: string }) => {
            if (!response?.credential) {
              onErrorRef.current?.("Google did not return a sign-in");
              return;
            }
            try {
              const res = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
                method: "POST",
                headers: jsonAuthHeaders(),
                body: JSON.stringify({ credential: response.credential }),
              });
              const body = await res.json();
              if (!res.ok) {
                onErrorRef.current?.(body.message || "Google sign-in failed", {
                  code: body.code,
                  credential: response.credential,
                });
                return;
              }
              onSignedInRef.current(body.data);
            } catch (err) {
              onErrorRef.current?.(err instanceof Error ? err.message : "Google sign-in failed");
            }
          },
        });

        window.google.accounts.id.renderButton(holder.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 320,
        });
      })
      .catch(err => onErrorRef.current?.(err.message));

    return () => { cancelled = true; };
  }, [clientId, endpoint, useRedirect, googleRedirectUri, inApp, resume]);

  if (!clientId) return null;
  if (inApp) return <OpenInBrowser app={inApp} />;

  return <div ref={holder} className="flex justify-center min-h-[44px]" />;
};
