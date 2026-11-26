/**
 * Which tournaments the signed-in user may manage, according to the server.
 *
 * Screens used to decide this by comparing the tournament's creator with the
 * signed-in user. That missed everyone a boss granted a tournament to on the
 * Grant access screen: the server let them manage it, but the workspace hid
 * "Add player" and "Bulk upload", the tournament list hid the announce button,
 * and the live-auction lobby left the tournament out of their dropdown.
 *
 * The answer comes from POST /api/tournament/managed-ids, which applies the
 * same rule as every management route (owned or granted; boss and super_user
 * also every public tournament). This only decides what is shown — the server
 * checks every action again.
 */

import { useEffect, useReducer } from "react";
import apiConfig from "@/config/apiConfig";
import { getSessionToken, getStoredUser, jsonAuthHeaders } from "@/lib/auth";

interface State {
  owner: string | null;
  ids: Set<string> | null;
}

let state: State = { owner: null, ids: null };
let inflight: Promise<void> | null = null;
let lastFetch = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

const MANAGING_ROLES = ["boss", "super_user", "tournament_host"];

const ownerOf = (): string => {
  const u = getStoredUser();
  return getSessionToken() && u ? `${u._id}|${u.role || ""}` : "anonymous";
};

/** Refetch; concurrent calls share one request. */
export const refreshManagedTournaments = (force = false): Promise<void> => {
  const owner = ownerOf();
  if (!force && inflight) return inflight;
  if (!force && state.owner === owner && state.ids && Date.now() - lastFetch < 30_000) return Promise.resolve();

  const role = getStoredUser()?.role || "";
  // Nobody to ask about: signed out, or a role that manages nothing.
  if (owner === "anonymous" || !MANAGING_ROLES.includes(role)) {
    state = { owner, ids: new Set() };
    notify();
    return Promise.resolve();
  }
  if (state.owner !== owner) {
    state = { owner, ids: null };
    notify();
  }

  lastFetch = Date.now();
  inflight = fetch(`${apiConfig.baseUrl}/api/tournament/managed-ids`, {
    method: "POST",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({}),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => {
      if (ownerOf() !== owner || !Array.isArray(body?.data)) return;
      state = { owner, ids: new Set(body.data.map(String)) };
      notify();
    })
    .catch(() => { /* keep what we had; controls stay hidden if nothing */ })
    .finally(() => { inflight = null; });
  return inflight;
};

let wired = false;
const wireUpdates = () => {
  if (wired || typeof window === "undefined") return;
  wired = true;
  // A grant given or taken away shows up the next time the tab is used.
  window.addEventListener("focus", () => { refreshManagedTournaments(); });
};

/**
 * `canManage(id)` is undefined until the answer arrives, then true/false.
 */
export const useManagedTournaments = () => {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    listeners.add(bump);
    wireUpdates();
    refreshManagedTournaments();
    return () => { listeners.delete(bump); };
  }, []);

  if (state.owner !== null && state.owner !== ownerOf()) {
    queueMicrotask(() => { refreshManagedTournaments(); });
  }

  const ready = state.ids !== null && state.owner === ownerOf();
  return {
    ready,
    canManage: (tournamentId: string | null | undefined): boolean | undefined =>
      !ready ? undefined : Boolean(tournamentId && state.ids!.has(String(tournamentId))),
  };
};
