/**
 * The scorer's session token, saved with the user at login.
 *
 * Every write the scorer makes (start innings, record a ball, undo) is behind
 * the API's session check, and this client used to send no token at all — so
 * each of them was refused with "Authentication required".
 */
const sessionToken = (): string | null => {
  try {
    const user = JSON.parse(localStorage.getItem("scoring_user") || "null");
    return typeof user?.sessionToken === "string" ? user.sessionToken : null;
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
