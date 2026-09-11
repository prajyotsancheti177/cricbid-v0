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
