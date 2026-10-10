/**
 * Every call carries the session token from login.
 *
 * Login already returns one and it has been sitting unused in localStorage:
 * requests identified the caller by putting a userId in the body instead, so
 * the server had only the client's word for who was asking. /booking/mine and
 * /booking/cancel now authenticate, and ignore any userId in the body.
 */

const sessionToken = (): string | null => {
  try {
    const user = JSON.parse(localStorage.getItem("cricbook_user") || "null");
    return user?.sessionToken || null;
  } catch {
    return null;
  }
};

export const post = async (path: string, body: object) => {
  const token = sessionToken();
  const r = await fetch(`/api/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-session-token": token } : {}),
    },
    body: JSON.stringify(body),
  });
  return r.json();
};
