import type { ReactNode } from "react";
import { useCan, type ResourceKey } from "@/lib/visibility";

/**
 * Renders its children only when the signed-in role may see `k`, per the Role
 * visibility page. Renders nothing while that is still loading — a hidden
 * button that flashes into view and out again is worse than one that appears
 * a moment late.
 *
 * Cosmetic on its own. Pair it with a server check (requireVisible for
 * `enforced` resources, and the route's own role and tournament guards).
 */
export const Gate = ({ k, children, fallback = null }: { k: ResourceKey; children: ReactNode; fallback?: ReactNode }) => {
  const can = useCan(k);
  if (can === undefined) return null;
  return <>{can ? children : fallback}</>;
};

export default Gate;
