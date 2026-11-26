/**
 * Which pages, workspace tabs and actions the signed-in role may see.
 *
 * The list of things and their defaults is shared/visibility-manifest.json; a
 * boss changes them on the Role visibility page. The server answers for the
 * caller's role (GET /api/visibility/me) and this module keeps that answer.
 *
 * This only decides what is SHOWN. The server enforces the same switches for
 * features marked `enforced`, and tournament-level permission separately — so
 * a hidden button is never the only thing standing between a role and an
 * action.
 *
 * While the answer is loading, nothing gated is shown (fail closed). The last
 * answer is kept in localStorage per user, so the second page load paints at
 * once.
 */

import { useEffect, useReducer } from "react";
import apiConfig from "@/config/apiConfig";
import { authHeaders, getSessionToken, getStoredUser } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import manifest from "../../../shared/visibility-manifest.json";

export type ResourceKey = keyof typeof manifest.resources;
export type Role = "boss" | "super_user" | "tournament_host" | "player";

export interface ResourceDef {
  group: string;
  label: string;
  path?: string;
  description?: string;
  ceiling: Role[];
  default: Role[];
  locked?: Role[];
  enforced?: boolean;
}

export const VISIBILITY_MANIFEST = manifest as unknown as {
  roles: Role[];
  roleLabels: Record<Role, string>;
  groups: { id: string; label: string }[];
  resources: Record<ResourceKey, ResourceDef>;
};

const CACHE_KEY = "cricbid_visibility";

interface State {
  /** user id + role the answer belongs to; a different one means refetch */
  owner: string | null;
  visible: Set<string> | null;
  version: string | null;
}

let state: State = { owner: null, visible: null, version: null };
let inflight: Promise<void> | null = null;
let lastFetch = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

const ownerOf = (): string => {
  const u = getStoredUser();
  return getSessionToken() && u ? `${u._id}|${u.role || ""}` : "anonymous";
};

const readCache = (owner: string): Set<string> | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return c && c.owner === owner && Array.isArray(c.visible) ? new Set(c.visible) : null;
  } catch {
    return null;
  }
};

const writeCache = (owner: string, visible: string[], version: string | null) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ owner, visible, version })); } catch { /* private mode */ }
};

/** Fetch this role's answer. Safe to call often; concurrent calls share one request. */
export const refreshVisibility = (force = false): Promise<void> => {
  const owner = ownerOf();
  if (!force && inflight) return inflight;
  if (!force && state.owner === owner && state.visible && Date.now() - lastFetch < 30_000) return Promise.resolve();

  if (state.owner !== owner) {
    // A different person or role: never show the previous one's answer.
    state = { owner, visible: readCache(owner), version: null };
    notify();
  }

  if (owner === "anonymous") {
    state = { owner, visible: new Set(), version: null };
    notify();
    return Promise.resolve();
  }

  lastFetch = Date.now();
  inflight = fetch(`${apiConfig.baseUrl}/api/visibility/me`, { headers: authHeaders() })
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => {
      const data = body?.data;
      if (!data || !Array.isArray(data.visible)) return;
      if (ownerOf() !== owner) return; // signed out or switched while loading
      state = { owner, visible: new Set(data.visible), version: data.version ?? null };
      writeCache(owner, data.visible, state.version);
      notify();
    })
    .catch(() => { /* keep whatever we had; gated items stay hidden if nothing */ })
    .finally(() => { inflight = null; });
  return inflight;
};

let wired = false;
/** Refetch when a boss changes the switches, and when the tab comes back. */
const wireUpdates = () => {
  if (wired || typeof window === "undefined") return;
  wired = true;
  try {
    getSocket().on("visibility:changed", () => { refreshVisibility(true); });
  } catch { /* no socket: focus refresh still applies */ }
  window.addEventListener("focus", () => { refreshVisibility(); });
  // Sign-in, sign-out and role changes all go through localStorage.
  window.addEventListener("storage", () => { refreshVisibility(); });
};

/**
 * The visibility answer for the signed-in role.
 * `can(key)` is undefined until known, then true/false.
 */
export const useVisibility = () => {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    listeners.add(bump);
    wireUpdates();
    refreshVisibility();
    return () => { listeners.delete(bump); };
  }, []);

  // The stored user changes on sign-in and when refreshCurrentUser learns a
  // new role; pick that up on the next render.
  if (state.owner !== null && state.owner !== ownerOf()) {
    queueMicrotask(() => { refreshVisibility(); });
  }

  const ready = state.visible !== null && state.owner === ownerOf();
  return {
    ready,
    can: (key: ResourceKey): boolean | undefined => (ready ? state.visible!.has(key) : undefined),
  };
};

/** Whether the signed-in role sees this; undefined while loading. */
export const useCan = (key: ResourceKey): boolean | undefined => useVisibility().can(key);
