import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, Loader2, Plus, X } from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { useOverlaySocket } from "@/hooks/useOverlaySocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/**
 * The owner's auction plan — one ranked list per auction category.
 *
 * Phone-first on purpose: an owner uses this sitting in the hall with the
 * auction on a projector, so the purse stays pinned to the top, the player on
 * the block sits right under it, and one category is in view at a time.
 *
 * Read-only on the auction. It listens on the same socket the OBS overlays use
 * (useOverlaySocket never emits anything but the viewer join) and every write
 * goes to /api/planner, which only touches the planner's own tables.
 */

interface PlannerPlayer {
  _id: string;
  name: string | null;
  photo: string | null;
  skill: string | null;
  playerCategory: string | null;
  auctionSerialNumber: number | null;
  sold: boolean;
  amtSold: number | null;
  teamId: string | null;
}

interface PlannerCategory {
  category: string;
  basePrice: number;
  owned: number;
  max: number | null;
  quota: number;
  needed: number;
  closed: boolean;
}

interface PlannerPick {
  playerId: string;
  category: string;
  rank: number;
  plannedAmount: number | null;
  status: "open" | "secured" | "lost";
  soldTo: string | null;
  soldFor: number | null;
  player: PlannerPlayer | null;
}

interface PlannerBoard {
  team: {
    _id: string;
    name: string | null;
    logo: string | null;
    totalSpent: number;
    remainingBudget: number;
    playersCount: number;
  };
  tournament: {
    _id: string;
    name: string | null;
    totalBudget: number | null;
    minPlayersPerTeam: number | null;
  };
  categories: PlannerCategory[];
  picks: PlannerPick[];
  pool: PlannerPlayer[];
  plan: {
    plannedTotal: number;
    placesLeft: number;
    unplannedPlaces: number;
    reservedForRest: number;
    spare: number;
  };
}

const money = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString("en-IN") : "—";

const initials = (name: string | null) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const call = async <T,>(path: string, body: Record<string, unknown>): Promise<T> => {
  const res = await fetch(`${apiConfig.baseUrl}/api/planner${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || "Something went wrong");
  }
  return json.data as T;
};

const OwnerPlanner = () => {
  const { token } = useParams<{ token: string }>();
  const [board, setBoard] = useState<PlannerBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setBoard(await call<PlannerBoard>("/board", { token }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open this plan");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const { auctionState, soldEvent, unsoldEvent, clearSoldEvent, clearUnsoldEvent } =
    useOverlaySocket(board?.tournament._id);

  // Any result changes who owns what, so the plan is refetched rather than
  // patched locally — the server is the only thing that knows the new maths.
  useEffect(() => {
    if (!soldEvent) return;
    clearSoldEvent();
    load();
  }, [soldEvent, clearSoldEvent, load]);

  useEffect(() => {
    if (!unsoldEvent) return;
    clearUnsoldEvent();
    load();
  }, [unsoldEvent, clearUnsoldEvent, load]);

  useEffect(() => {
    if (!board || activeCategory) return;
    const firstOpen = board.categories.find((c) => !c.closed) || board.categories[0];
    setActiveCategory(firstOpen ? firstOpen.category : null);
  }, [board, activeCategory]);

  const mutate = async (path: string, body: Record<string, unknown>, ok?: string) => {
    if (!token) return;
    setBusy(true);
    try {
      setBoard(await call<PlannerBoard>(path, { token, ...body }));
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const category = useMemo(
    () => board?.categories.find((c) => c.category === activeCategory) || null,
    [board, activeCategory]
  );

  const picksHere = useMemo(
    () =>
      (board?.picks || [])
        .filter((p) => p.category === activeCategory)
        .sort((a, b) => a.rank - b.rank),
    [board, activeCategory]
  );

  const availableHere = useMemo(() => {
    if (!board || !activeCategory) return [];
    const picked = new Set(board.picks.map((p) => p.playerId));
    return board.pool.filter(
      (p) => p.playerCategory === activeCategory && !p.sold && !picked.has(p._id)
    );
  }, [board, activeCategory]);

  const onBlock = auctionState?.currentPlayer || null;
  const onBlockPick = useMemo(() => {
    const id = onBlock ? (onBlock as unknown as { _id?: string })._id : null;
    return id ? (board?.picks || []).find((p) => p.playerId === id) || null : null;
  }, [onBlock, board]);

  const move = (index: number, delta: number) => {
    const next = [...picksHere];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    mutate("/reorder", {
      category: activeCategory,
      playerIds: next.map((p) => p.playerId),
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f16] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f16] px-6 text-center text-white">
        <div>
          <p className="text-lg font-semibold">This plan could not be opened</p>
          <p className="mt-2 text-sm text-white/60">{error}</p>
          <p className="mt-4 text-xs text-white/40">
            Ask the tournament host for your planner link again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0f0f16] text-white">
      {/* Who you are, and what is left */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#121219]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold sm:text-base">{board.team.name}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  auctionState?.isActive ? "bg-emerald-400" : "bg-white/30"
                }`}
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  auctionState?.isActive ? "text-emerald-400" : "text-white/40"
                }`}
              >
                {auctionState?.isActive
                  ? `Live · lot ${auctionState.playerNumber || 0}`
                  : "Auction not running"}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Purse</p>
            <p className="text-lg font-extrabold tabular-nums text-emerald-400">
              {money(board.team.remainingBudget)}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-4">
        {/* On the block, with your number against it */}
        {onBlock && (
          <div className="mt-3 rounded-xl border border-violet-600 bg-[#1b1526] p-3.5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-extrabold text-white/80">
                {initials(onBlock.name as string | null)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-300">
                  On the block
                </p>
                <p className="truncate text-base font-extrabold">{onBlock.name}</p>
              </div>
            </div>
            <div className="mt-2.5 flex gap-2">
              <div className="flex-1 rounded-lg bg-black/30 px-2.5 py-2">
                <p className="text-[10px] text-white/50">Current bid</p>
                <p className="text-base font-extrabold tabular-nums">
                  {money(auctionState?.currentBid)}
                </p>
              </div>
              <div className="flex-1 rounded-lg bg-black/30 px-2.5 py-2">
                <p className="text-[10px] text-amber-400">You planned</p>
                <p className="text-base font-extrabold tabular-nums text-amber-400">
                  {onBlockPick ? money(onBlockPick.plannedAmount) : "not on list"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* One category at a time */}
        <div className="-mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4 pb-1">
          {board.categories.map((c) => {
            const active = c.category === activeCategory;
            return (
              <button
                key={c.category}
                type="button"
                onClick={() => setActiveCategory(c.category)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors duration-150 ease-out active:scale-[0.97] ${
                  active
                    ? "bg-violet-600 text-white"
                    : c.closed
                      ? "border border-emerald-900 text-emerald-400"
                      : "border border-white/15 text-white/70"
                }`}
              >
                {c.category} {c.owned}/{c.quota}
              </button>
            );
          })}
        </div>

        {/* The ranking */}
        {category && (
          <div className="mt-3.5 flex flex-col gap-1.5">
            {category.closed && (
              <p className="rounded-xl border border-emerald-900 bg-emerald-950/40 px-3.5 py-3 text-[13px] text-emerald-300">
                Your {category.category} places are filled ({category.owned} of {category.quota}).
                Nothing left to rank here.
              </p>
            )}

            {picksHere.length === 0 && !category.closed && (
              <p className="rounded-xl bg-white/[0.03] px-3.5 py-6 text-center text-[13px] text-white/40">
                Nobody ranked for {category.category} yet. You need {category.needed}.
              </p>
            )}

            {picksHere.map((pick, i) => {
              const cut = category.needed > 0 && i === category.needed;
              const key = pick.playerId;
              return (
                <div key={key}>
                  {cut && (
                    <div className="my-1.5 flex items-center gap-2">
                      <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,#4a4a5e_0_5px,transparent_5px_10px)]" />
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-white/40">
                        {category.needed} more needed
                      </span>
                      <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,#4a4a5e_0_5px,transparent_5px_10px)]" />
                    </div>
                  )}
                  <div
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors duration-150 ease-out ${
                      pick.status === "secured"
                        ? "border-emerald-900 bg-[#16161d]"
                        : pick.status === "lost"
                          ? "border-red-900/70 bg-[#16161d] opacity-70"
                          : i < category.needed
                            ? "border-white/15 bg-[#16161d]"
                            : "border-transparent bg-white/[0.03]"
                    }`}
                  >
                    <span
                      className={`w-4 text-xs font-extrabold ${
                        pick.status === "secured" ? "text-emerald-400" : "text-white/40"
                      }`}
                    >
                      {pick.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-semibold ${
                          pick.status === "lost" ? "text-white/50 line-through" : ""
                        }`}
                      >
                        {pick.player?.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-white/40">
                        {pick.status === "secured" && (
                          <span className="text-emerald-400">yours · {money(pick.soldFor)}</span>
                        )}
                        {pick.status === "lost" && (
                          <span className="text-red-300">
                            {pick.soldTo || "another team"} paid {money(pick.soldFor)}
                          </span>
                        )}
                        {pick.status === "open" &&
                          (pick.player?.auctionSerialNumber
                            ? `lot ${pick.player.auctionSerialNumber}`
                            : "not in the order yet")}
                      </p>
                    </div>

                    {pick.status === "secured" ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : pick.status === "lost" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => mutate("/pick-remove", { playerId: pick.playerId })}
                        className="shrink-0 rounded-md p-1.5 text-white/40 transition-colors duration-150 ease-out active:scale-[0.97] hover:text-white"
                        aria-label={`Remove ${pick.player?.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1">
                        <Input
                          inputMode="numeric"
                          value={amounts[key] ?? (pick.plannedAmount ?? "").toString()}
                          onChange={(e) =>
                            setAmounts((a) => ({ ...a, [key]: e.target.value.replace(/\D/g, "") }))
                          }
                          onBlur={() => {
                            const raw = amounts[key];
                            if (raw === undefined) return;
                            setAmounts((a) => {
                              const next = { ...a };
                              delete next[key];
                              return next;
                            });
                            if (Number(raw || 0) === (pick.plannedAmount || 0)) return;
                            mutate("/pick-amount", {
                              playerId: pick.playerId,
                              plannedAmount: Number(raw || 0),
                            });
                          }}
                          className="h-8 w-16 border-white/15 bg-black/30 px-2 text-right text-sm font-bold tabular-nums text-violet-200"
                          placeholder={String(category.basePrice || 0)}
                          aria-label={`Amount planned for ${pick.player?.name}`}
                        />
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={busy || i === 0}
                            onClick={() => move(i, -1)}
                            className="rounded p-0.5 text-white/40 transition-colors duration-150 ease-out disabled:opacity-20 hover:text-white"
                            aria-label="Move up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busy || i === picksHere.length - 1}
                            onClick={() => move(i, 1)}
                            className="rounded p-0.5 text-white/40 transition-colors duration-150 ease-out disabled:opacity-20 hover:text-white"
                            aria-label="Move down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => mutate("/pick-remove", { playerId: pick.playerId })}
                          className="rounded-md p-1 text-white/30 transition-colors duration-150 ease-out hover:text-white"
                          aria-label={`Remove ${pick.player?.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pool for this category, opened on demand */}
            {!category.closed && adding && (
              <div className="mt-2 rounded-xl border border-white/10 bg-[#13131a] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-white/50">
                    Unsold {category.category} players
                  </p>
                  <button
                    type="button"
                    onClick={() => setAdding(false)}
                    className="text-white/40 transition-colors duration-150 ease-out hover:text-white"
                    aria-label="Close list"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {availableHere.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-white/40">
                    No unsold {category.category} players left.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {availableHere.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          mutate(
                            "/pick",
                            { playerId: p._id, plannedAmount: category.basePrice },
                            `${p.name} added to your ${category.category} list`
                          )
                        }
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left transition-colors duration-150 ease-out active:scale-[0.99] hover:bg-white/5"
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                        <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                        <span className="shrink-0 text-[11px] text-white/40">
                          {p.auctionSerialNumber ? `lot ${p.auctionSerialNumber}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Where the plan stands, and the one action */}
      <footer className="sticky bottom-0 border-t border-white/10 bg-[#121219]/95 px-4 pb-5 pt-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-center text-[11px] text-white/40">
            {board.plan.spare >= 0 ? (
              <>
                Plan fits ·{" "}
                <span className="font-bold text-emerald-400">
                  {money(board.plan.spare)} spare
                </span>{" "}
                after every pick
              </>
            ) : (
              <>
                Plan is{" "}
                <span className="font-bold text-red-300">
                  {money(Math.abs(board.plan.spare))} over
                </span>{" "}
                your purse
              </>
            )}
          </p>
          {category && !category.closed && !adding && (
            <Button
              type="button"
              onClick={() => setAdding(true)}
              className="h-12 w-full rounded-xl bg-violet-600 text-[15px] font-bold transition-transform duration-150 ease-out active:scale-[0.98] hover:bg-violet-500"
            >
              <Plus className="mr-2 h-4 w-4" />
              Rank another {category.category}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default OwnerPlanner;
