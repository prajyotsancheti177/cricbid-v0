/**
 * Who the browser is, and how it proves it.
 *
 * The session token is the proof. It is issued at login, stored on the user row
 * server-side, and sent as `x-session-token`. It replaces `x-user-id`, which the
 * server used to believe: sending someone else's id made you that person.
 *
 * Everything that calls an authenticated endpoint should build its headers with
 * `authHeaders()` rather than assembling them by hand, so there is exactly one
 * place that knows how a request is authenticated.
 */

import { useEffect, useReducer } from "react";
import apiConfig from "@/config/apiConfig";

const API_BASE = apiConfig.baseUrl;

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach(fn => fn());

let refreshPromise: Promise<StoredUser | null> | null = null;
let refreshed = false;

const TOKEN_KEY = "cricbid_session_token";
const USER_KEY = "user";
const AUTH_FLAG = "isAuthenticated";

// Player screens stored the same token under their own key first. Read it as a
// fallback so someone signed in as a player is not signed out by this change.
const PLAYER_TOKEN_KEY = "cricbid_player_token";

export interface StoredUser {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
  permissions?: Record<string, boolean>;
}

export const getSessionToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(PLAYER_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const getStoredUser = (): StoredUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Save everything a signed-in session needs. Both login methods end here. */
export const storeSession = (user: StoredUser & { sessionToken?: string }) => {
  const { sessionToken, ...safeUser } = user;
  if (sessionToken) localStorage.setItem(TOKEN_KEY, sessionToken);
  localStorage.setItem(USER_KEY, JSON.stringify(safeUser));
  localStorage.setItem(AUTH_FLAG, "true");
};

export const clearSession = () => {
  refreshPromise = null;
  refreshed = false;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PLAYER_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(AUTH_FLAG);
};

/**
 * Headers for an authenticated request.
 *
 * @param extra - merged in, so a caller can add Content-Type or its own headers
 */
export const authHeaders = (extra: Record<string, string> = {}): Record<string, string> => {
  const token = getSessionToken();
  return {
    ...(token ? { "x-session-token": token } : {}),
    ...extra,
  };
};

/** Headers for a JSON request. The common case. */
export const jsonAuthHeaders = (extra: Record<string, string> = {}) =>
  authHeaders({ "Content-Type": "application/json", ...extra });

/**
 * True when a response says the session is no longer good.
 *
 * Callers should clear and send the user to the login page rather than showing
 * a confusing failure on a screen they can no longer load.
 */
export const isSessionExpired = (status: number, body?: { code?: string }) =>
  status === 401 && (!body?.code || String(body.code).startsWith("SESSION") || body.code === "NO_SESSION");

/** Clear the session and go to login. Safe to call from anywhere. */
export const forceSignOut = () => {
  clearSession();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
};

/**
 * Sign the user out the moment the server says their session is gone.
 *
 * Installed once at app start. Without it an expired session produced a page
 * that still looked signed in while every request failed — "session expired"
 * over and over, with no way out but clearing storage by hand. Now the first
 * such response ends the session and returns them to the login page.
 *
 * Only session codes trigger it. A 403 for lacking permission is a different
 * thing and must not log anyone out.
 */
export const installSessionExpiryHandler = () => {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __cricbidAuthHooked?: boolean };
  if (w.__cricbidAuthHooked) return;
  w.__cricbidAuthHooked = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);

    if (response.status === 401 && getSessionToken()) {
      // Read a clone so the caller still gets an unconsumed body.
      try {
        const body = await response.clone().json();
        const code = String(body?.code || "");
        if (code === "SESSION_EXPIRED" || code === "SESSION_INVALID" || code === "NO_SESSION") {
          forceSignOut();
        }
      } catch {
        /* not JSON — leave it to the caller */
      }
    }

    return response;
  };
};

/* ────────────────────────────────────────────────────────────────────────────
 * Keeping the stored user current
 *
 * The user object — including the role every screen gate reads — used to be
 * written once at sign-in and never touched again. So promoting somebody in
 * Grant access did nothing for a browser that was already signed in: the server
 * knew they were a super_user, their browser still said `player`, and the app
 * bounced them off every admin screen. The only cure was signing out and back
 * in, which nobody would think to try.
 *
 * The role now comes from the server on every page load. One request, once,
 * shared by every component that asks.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Pull the current user from the server and update what is stored. */
export const refreshCurrentUser = (): Promise<StoredUser | null> => {
  if (refreshPromise) return refreshPromise;

  const token = getSessionToken();
  if (!token) {
    refreshed = true;
    refreshPromise = Promise.resolve(null);
    return refreshPromise;
  }

  refreshPromise = fetch(`${API_BASE}/api/user/detail`, {
    method: "POST",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({}),
  })
    .then(res => (res.ok ? res.json() : null))
    .then(body => {
      const fresh = body?.data as StoredUser | undefined;
      if (!fresh) return getStoredUser();
      // Keep whatever else was stored; the server is the authority on role.
      const merged = { ...(getStoredUser() || {}), ...fresh };
      localStorage.setItem(USER_KEY, JSON.stringify(merged));
      return merged as StoredUser;
    })
    .catch(() => getStoredUser())   // offline: carry on with what we have
    .finally(() => { refreshed = true; notify(); });

  return refreshPromise;
};

/**
 * The signed-in user, revalidated against the server once per page load.
 *
 * `ready` is false only until that first check settles, so a gate can wait
 * rather than deny someone on a stale role.
 */
export const useCurrentUser = (): { user: StoredUser | null; ready: boolean } => {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    listeners.add(bump);
    refreshCurrentUser();
    return () => { listeners.delete(bump); };
  }, []);

  return { user: getStoredUser(), ready: refreshed || !getSessionToken() };
};
