import { useEffect, useRef, useState } from "react";
import apiConfig from "@/config/apiConfig";
import { jsonAuthHeaders } from "@/lib/auth";

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
export const useGoogleClientId = (): string | null => {
  const [clientId, setClientId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${apiConfig.baseUrl}/api/player-profile/auth-config`)
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (!cancelled && body?.data?.googleEnabled) setClientId(body.data.googleClientId);
      })
      .catch(() => { /* sign-in stays hidden; password login still works */ });
    return () => { cancelled = true; };
  }, []);
  return clientId;
};

interface Props {
  /**
   * Where to send the Google credential for verification. Players and hosts
   * are separate identities with separate rules — a player account is created
   * on first sign-in, a host is only ever matched to one an administrator
   * already made — so they verify at different endpoints.
   */
  endpoint?: string;
  /** Called with whatever that endpoint returned, once the server verified it. */
  onSignedIn: (data: any) => void;
  onError?: (message: string) => void;
  /**
   * Where Google should POST the credential in redirect mode. Setting this
   * switches off the popup entirely: no popup to block, no window.opener to
   * lose, and nothing for tracking prevention to interfere with. `onSignedIn`
   * never fires in this mode — the browser leaves the page and comes back.
   *
   * Must be registered as an Authorised redirect URI on the OAuth client.
   */
  redirectUri?: string;
}

export const GoogleSignInButton = ({ endpoint = "/api/player-profile/google", onSignedIn, onError, redirectUri }: Props) => {
  const clientId = useGoogleClientId();
  const holder = useRef<HTMLDivElement>(null);
  // Kept in a ref so re-renders never re-initialise GIS with a stale callback.
  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!clientId || !holder.current) return;
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled || !holder.current || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          ...(redirectUri
            ? { ux_mode: "redirect", login_uri: redirectUri }
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
              if (!res.ok) throw new Error(body.message || "Google sign-in failed");
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
  }, [clientId, endpoint, redirectUri]);

  if (!clientId) return null;

  return <div ref={holder} className="flex justify-center min-h-[44px]" />;
};
