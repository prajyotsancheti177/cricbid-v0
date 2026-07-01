import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "../lib/api";
import {
  ArrowLeft, ArrowRight, Check, Shuffle,
  Eye, Zap, RefreshCw, Plus, Minus, GripVertical,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team { _id: string; name: string }
interface Tournament { _id: string; name: string }

type FormatType = "single_rr" | "double_rr" | "group_ko" | "knockout";

interface Group { id: string; label: string; teams: Team[] }

interface GeneratedMatch {
  matchNumber: number;
  round: string;
  teamA: Team | null;
  teamB: Team | null;
  isTBD: boolean;
  note?: string;
  scheduledAt?: string;
}

// ─── Round-robin generator ────────────────────────────────────────────────────

function roundRobin(teams: Team[]): [Team, Team][] {
  const t = teams.length % 2 === 0 ? [...teams] : [...teams, null as unknown as Team];
  const n = t.length;
  const pairs: [Team, Team][] = [];
  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      if (a && b) pairs.push([a, b]);
    }
    t.splice(1, 0, t.pop()!);
  }
  return pairs;
}

// ─── Date scheduler ───────────────────────────────────────────────────────────

function assignDates(
  matches: Omit<GeneratedMatch, "scheduledAt">[],
  firstDate: string, firstTime: string,
  matchesPerDay: number, durationMins: number, gapMins: number,
): GeneratedMatch[] {
  if (!firstDate) return matches.map(m => ({ ...m }));
  let dt = new Date(`${firstDate}T${firstTime || "09:00"}`);
  let todayCount = 0;
  return matches.map(m => {
    const scheduledAt = dt.toISOString();
    todayCount++;
    if (todayCount >= matchesPerDay) {
      dt = new Date(dt);
      dt.setDate(dt.getDate() + 1);
      dt.setHours(parseInt(firstTime?.split(":")[0] ?? "9"), parseInt(firstTime?.split(":")[1] ?? "0"), 0, 0);
      todayCount = 0;
    } else {
      dt = new Date(dt.getTime() + (durationMins + gapMins) * 60000);
    }
    return { ...m, scheduledAt };
  });
}

// ─── Playoff bracket builder ──────────────────────────────────────────────────

function buildPlayoffMatches(
  groups: Group[], qualPerGroup: number,
  hasQF: boolean, hasSF: boolean, hasFinal: boolean, hasThirdPlace: boolean,
  startMatchNum: number,
): GeneratedMatch[] {
  const slots: string[] = [];
  groups.forEach(g => {
    for (let q = 1; q <= qualPerGroup; q++) {
      const suffix = q === 1 ? "Winner" : q === 2 ? "Runner-up" : `${q}th – ${g.label}`;
      slots.push(q === 1 ? `Winner ${g.label}` : q === 2 ? `Runner-up ${g.label}` : suffix);
    }
  });

  const matches: GeneratedMatch[] = [];
  let num = startMatchNum;

  const tbd = (note: string): GeneratedMatch => ({
    matchNumber: num++, round: "", teamA: null, teamB: null, isTBD: true, note,
  });

  if (hasQF && slots.length >= 8) {
    matches.push(
      { ...tbd(`${slots[0]} vs ${slots[7]}`), round: "Quarter-final 1" },
      { ...tbd(`${slots[3]} vs ${slots[4]}`), round: "Quarter-final 2" },
      { ...tbd(`${slots[1]} vs ${slots[6]}`), round: "Quarter-final 3" },
      { ...tbd(`${slots[2]} vs ${slots[5]}`), round: "Quarter-final 4" },
    );
    if (hasSF) {
      matches.push(
        { ...tbd("Winner QF1 vs Winner QF2"), round: "Semi-final 1" },
        { ...tbd("Winner QF3 vs Winner QF4"), round: "Semi-final 2" },
      );
    }
  } else if (hasSF && slots.length >= 4) {
    const sf1a = slots[0] || "Team 1", sf1b = slots[3] || "Team 4";
    const sf2a = slots[1] || "Team 2", sf2b = slots[2] || "Team 3";
    matches.push(
      { ...tbd(`${sf1a} vs ${sf1b}`), round: "Semi-final 1" },
      { ...tbd(`${sf2a} vs ${sf2b}`), round: "Semi-final 2" },
    );
  } else if (hasSF && slots.length === 2) {
    matches.push({ ...tbd(`${slots[0]} vs ${slots[1]}`), round: "Semi-final" });
  }

  if (hasFinal) {
    const finalNote = hasSF ? "Winner SF1 vs Winner SF2"
      : slots.length >= 2 ? `${slots[0]} vs ${slots[1]}`
      : "Final";
    matches.push({ ...tbd(finalNote), round: "Final" });
    if (hasThirdPlace) {
      matches.push({ ...tbd("Loser SF1 vs Loser SF2"), round: "3rd Place Playoff" });
    }
  }
  return matches;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

const STEPS = [
  { key: "format",   label: "Format"   },
  { key: "groups",   label: "Groups"   },
  { key: "playoffs", label: "Playoffs" },
  { key: "settings", label: "Settings" },
  { key: "preview",  label: "Preview"  },
];

type StepKey = "format" | "groups" | "playoffs" | "settings" | "preview";

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScheduleBuilder() {
  const navigate = useNavigate();

  // Tournament + teams
  const [tournaments, setTournaments]   = useState<Tournament[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [teams, setTeams]               = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Wizard step
  const [step, setStep] = useState<StepKey>("format");

  // Step 1: Format
  const [format, setFormat]     = useState<FormatType>("group_ko");

  // Step 2: Groups
  const [numGroups, setNumGroups] = useState(2);
  const [groups, setGroups]       = useState<Group[]>([]);
  const [unassigned, setUnassigned] = useState<Team[]>([]);

  // Step 3: Playoffs
  const [qualPerGroup, setQualPerGroup] = useState(2);
  const [hasQF, setHasQF]               = useState(false);
  const [hasSF, setHasSF]               = useState(true);
  const [hasFinal, setHasFinal]         = useState(true);
  const [hasThirdPlace, setHasThirdPlace] = useState(true);

  // Step 4: Settings
  const [venue, setVenue]               = useState("");
  const [matchFormat, setMatchFormat]   = useState("T20");
  const [totalOvers, setTotalOvers]     = useState(20);
  const [firstDate, setFirstDate]       = useState("");
  const [firstTime, setFirstTime]       = useState("09:00");
  const [matchesPerDay, setMatchesPerDay] = useState(2);
  const [durationMins, setDurationMins] = useState(180);
  const [gapMins, setGapMins]           = useState(30);

  // Step 5: Preview + Create
  const [creating, setCreating] = useState(false);
  const [created, setCreated]   = useState(false);
  const [createProgress, setCreateProgress] = useState(0);

  // Drag state
  const dragTeam    = useRef<Team | null>(null);
  const dragFromGrp = useRef<string | null>(null); // group id or "pool"

  // ── Load tournaments ────────────────────────────────────────────────────────

  useEffect(() => {
    post("tournament/all", {}).then(r => { if (r.success) setTournaments(r.data || []); });
  }, []);

  useEffect(() => {
    if (!tournamentId) { setTeams([]); return; }
    setLoadingTeams(true);
    post("team/names", { touranmentId: tournamentId })
      .then(r => {
        const t: Team[] = (r.data || []).map((x: any) => ({ _id: x._id, name: x.name }));
        setTeams(t);
        setUnassigned(t);
        // Build empty groups
        const labels = ["A","B","C","D","E","F"];
        setGroups(Array.from({ length: numGroups }, (_, i) => ({ id: labels[i], label: `Group ${labels[i]}`, teams: [] })));
      })
      .finally(() => setLoadingTeams(false));
  }, [tournamentId]);

  // Re-init groups when numGroups changes (preserve existing assignments)
  useEffect(() => {
    const labels = ["A","B","C","D","E","F"];
    setGroups(prev => {
      const existing = prev.slice(0, numGroups);
      const freed: Team[] = prev.slice(numGroups).flatMap(g => g.teams);
      const newGroups = Array.from({ length: numGroups }, (_, i) =>
        existing[i] ?? { id: labels[i], label: `Group ${labels[i]}`, teams: [] }
      );
      if (freed.length) setUnassigned(u => [...u, ...freed]);
      return newGroups;
    });
  }, [numGroups]);

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  const onDragStart = (team: Team, fromGroupId: string) => {
    dragTeam.current    = team;
    dragFromGrp.current = fromGroupId;
  };

  const onDropIntoGroup = (toGroupId: string) => {
    const team = dragTeam.current;
    const from = dragFromGrp.current;
    if (!team || from === toGroupId) return;

    // Remove from source
    if (from === "pool") {
      setUnassigned(u => u.filter(t => t._id !== team._id));
    } else {
      setGroups(gs => gs.map(g => g.id === from ? { ...g, teams: g.teams.filter(t => t._id !== team._id) } : g));
    }
    // Add to target
    if (toGroupId === "pool") {
      setUnassigned(u => [...u, team]);
    } else {
      setGroups(gs => gs.map(g => g.id === toGroupId ? { ...g, teams: [...g.teams, team] } : g));
    }
    dragTeam.current = null;
    dragFromGrp.current = null;
  };

  // Auto-distribute teams evenly across groups
  const autoDistribute = () => {
    const all = [...unassigned, ...groups.flatMap(g => g.teams)];
    const labels = ["A","B","C","D","E","F"];
    const newGroups: Group[] = Array.from({ length: numGroups }, (_, i) => ({
      id: labels[i], label: `Group ${labels[i]}`, teams: [],
    }));
    all.forEach((team, i) => newGroups[i % numGroups].teams.push(team));
    setGroups(newGroups);
    setUnassigned([]);
  };

  // ── Generate schedule (useMemo — always current, no stale closures) ────────────

  const preview = useMemo((): GeneratedMatch[] => {
    if (step !== "preview") return [];
    const result: GeneratedMatch[] = [];
    let num = 1;

    if (format === "single_rr" || format === "double_rr") {
      const pairs = roundRobin(teams);
      pairs.forEach(([a, b]) => {
        result.push({ matchNumber: num++, round: "League", teamA: a, teamB: b, isTBD: false });
      });
      if (format === "double_rr") {
        pairs.forEach(([a, b]) => {
          result.push({ matchNumber: num++, round: "League", teamA: b, teamB: a, isTBD: false });
        });
      }
    } else if (format === "group_ko") {
      groups.forEach(g => {
        const pairs = roundRobin(g.teams);
        pairs.forEach(([a, b]) => {
          result.push({ matchNumber: num++, round: g.label, teamA: a, teamB: b, isTBD: false });
        });
      });
      const playoffMatches = buildPlayoffMatches(
        groups, qualPerGroup, hasQF, hasSF, hasFinal, hasThirdPlace, num,
      );
      playoffMatches.forEach(m => result.push(m));
    } else if (format === "knockout") {
      const n = teams.length;
      const rounds = Math.ceil(Math.log2(n));
      let currentRound = teams.map(t => t);
      for (let r = rounds; r >= 1; r--) {
        const rName = r === 1 ? "Final" : r === 2 ? "Semi-final" : r === 3 ? "Quarter-final" : `Round of ${Math.pow(2, r)}`;
        const count = Math.pow(2, r - 1);
        for (let i = 0; i < count; i++) {
          const a = currentRound[i] ?? null;
          const b = currentRound[Math.pow(2, r) - 1 - i] ?? null;
          if (r === rounds && a && b) {
            result.push({ matchNumber: num++, round: rName, teamA: a, teamB: b, isTBD: false });
          } else {
            result.push({ matchNumber: num++, round: rName, teamA: null, teamB: null, isTBD: true, note: `Match ${num - 2} winner vs Match ${num - 3} winner` });
          }
        }
        currentRound = [];
      }
    }

    return assignDates(result, firstDate, firstTime, matchesPerDay, durationMins, gapMins);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, format, groups, teams, qualPerGroup, hasQF, hasSF, hasFinal, hasThirdPlace, firstDate, firstTime, matchesPerDay, durationMins, gapMins]);

  const goToPreview = () => setStep("preview");

  // ── Create matches ────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    const realMatches = preview.filter(m => !m.isTBD && m.teamA && m.teamB);
    setCreating(true);
    setCreateProgress(0);

    const CHUNK = 10;
    let done = 0;
    for (let i = 0; i < realMatches.length; i += CHUNK) {
      const batch = realMatches.slice(i, i + CHUNK).map(m => ({
        tournamentId,
        matchNumber: m.matchNumber,
        round:       m.round,
        venue:       venue || undefined,
        scheduledAt: m.scheduledAt,
        format:      matchFormat,
        totalOvers,
        teamAId:     m.teamA!._id,
        teamBId:     m.teamB!._id,
      }));
      await post("match/bulk-create", { matches: batch });
      done += batch.length;
      setCreateProgress(Math.round((done / realMatches.length) * 100));
    }
    setCreating(false);
    setCreated(true);
  };

  // ── Step validation ───────────────────────────────────────────────────────────

  const canNext: Record<StepKey, boolean> = {
    format:   !!tournamentId && teams.length > 0,
    groups:   format !== "group_ko" || (unassigned.length === 0 && groups.every(g => g.teams.length > 0)),
    playoffs: true,
    settings: true,
    preview:  false,
  };

  const visibleSteps = format === "group_ko"
    ? STEPS
    : STEPS.filter(s => s.key !== "groups" && s.key !== "playoffs");

  const stepIdx   = visibleSteps.findIndex(s => s.key === step);
  const isLast    = step === "settings";

  const next = () => {
    const keys = visibleSteps.map(s => s.key) as StepKey[];
    const idx  = keys.indexOf(step);
    if (idx < keys.length - 1) setStep(keys[idx + 1]);
    else goToPreview();
  };

  const back = () => {
    const keys = visibleSteps.map(s => s.key) as StepKey[];
    const idx  = keys.indexOf(step);
    if (step === "preview") setStep(keys[keys.length - 1]);
    else if (idx > 0) setStep(keys[idx - 1]);
  };

  const groupStageCount   = preview.filter(m => !m.isTBD).length;
  const playoffCount      = preview.filter(m => m.isTBD).length;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-panel border-b border-bdr sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
          <span className="font-bold text-white">Schedule Builder</span>
          {tournamentId && (
            <span className="text-xs text-muted ml-1 truncate">
              — {tournaments.find(t => t._id === tournamentId)?.name}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Tournament selector (always visible) */}
        {step !== "preview" && (
          <div className="mb-6 flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted font-semibold uppercase tracking-wide">Tournament</label>
              <select value={tournamentId} onChange={e => setTournamentId(e.target.value)}
                className="w-full mt-1.5 bg-panel border border-bdr rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary">
                <option value="">Select a tournament…</option>
                {tournaments.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
            {loadingTeams && <span className="text-xs text-muted pb-2.5">Loading teams…</span>}
            {teams.length > 0 && <span className="text-xs text-green-400 pb-2.5">{teams.length} teams loaded</span>}
          </div>
        )}

        {/* Stepper */}
        {step !== "preview" && tournamentId && (
          <div className="flex items-center gap-1 mb-8">
            {visibleSteps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition
                  ${s.key === step ? "bg-primary text-white" : i < stepIdx ? "bg-green-500/15 text-green-400" : "bg-panel2 text-muted"}`}>
                  {i < stepIdx ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
                  <span>{s.label}</span>
                </div>
                {i < visibleSteps.length - 1 && <div className="w-4 h-px bg-bdr" />}
              </div>
            ))}
          </div>
        )}

        {/* ── Step: Format ── */}
        {step === "format" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Choose tournament format</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: "single_rr" as FormatType, icon: "🔄", title: "Single Round Robin", desc: "Every team plays every other team once. Best for 4–8 teams.", badge: "Simple" },
                { key: "double_rr" as FormatType, icon: "🔁", title: "Double Round Robin", desc: "Home & away — everyone plays everyone twice. Best for 4–6 teams.", badge: "Extended" },
                { key: "group_ko" as FormatType,  icon: "🏟️", title: "Group Stage + Knockouts", desc: "Divide teams into groups, then top teams advance to playoffs.", badge: "Most Popular" },
                { key: "knockout" as FormatType,  icon: "⚡", title: "Pure Knockout", desc: "Win or go home. Single-elimination bracket from the first match.", badge: "Fast" },
              ].map(f => (
                <button key={f.key} onClick={() => setFormat(f.key)}
                  className={`text-left p-4 rounded-2xl border transition relative ${format === f.key ? "border-primary bg-primary/10" : "border-bdr bg-panel hover:border-primary/50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-2xl">{f.icon}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-panel2 text-muted">{f.badge}</span>
                  </div>
                  <p className="font-bold text-white mt-2">{f.title}</p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">{f.desc}</p>
                  {format === f.key && <div className="absolute top-3 right-3 w-4 h-4 bg-primary rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
                </button>
              ))}
            </div>

            {/* Group count selector — only for group_ko */}
            {format === "group_ko" && (
              <div className="bg-panel border border-bdr rounded-2xl p-5 space-y-3 mt-4">
                <p className="font-semibold text-white text-sm">How many groups?</p>
                <div className="flex gap-2">
                  {[2, 3, 4].map(n => (
                    <button key={n} onClick={() => setNumGroups(n)}
                      className={`w-14 h-14 rounded-xl font-black text-xl transition ${numGroups === n ? "bg-primary text-white" : "bg-panel2 text-muted hover:text-white"}`}>
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted">
                  {teams.length > 0
                    ? `${teams.length} teams → ~${Math.ceil(teams.length / numGroups)} teams per group`
                    : "Select a tournament above to see team count"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Step: Groups ── */}
        {step === "groups" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Assign teams to groups</h2>
                <p className="text-xs text-muted mt-0.5">Drag teams between groups, or use auto-distribute</p>
              </div>
              <button onClick={autoDistribute}
                className="flex items-center gap-2 px-3 py-2 bg-panel2 border border-bdr rounded-xl text-xs text-muted hover:text-white transition">
                <Shuffle className="w-3.5 h-3.5" /> Auto-distribute
              </button>
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(numGroups, 2)}, 1fr)` }}>
              {groups.map(g => (
                <DropZone key={g.id} label={g.label} teams={g.teams} groupId={g.id}
                  onDragStart={onDragStart} onDrop={onDropIntoGroup} />
              ))}
            </div>

            {/* Unassigned pool */}
            {unassigned.length > 0 && (
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-2">
                  Unassigned ({unassigned.length})
                </p>
                <DropZone label="Team Pool" teams={unassigned} groupId="pool"
                  isPool onDragStart={onDragStart} onDrop={onDropIntoGroup} />
              </div>
            )}

            {unassigned.length === 0 && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <Check className="w-4 h-4" /> All teams assigned
              </div>
            )}
          </div>
        )}

        {/* ── Step: Playoffs ── */}
        {step === "playoffs" && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-white">Configure knockouts</h2>

            <div className="bg-panel border border-bdr rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-white mb-2">Teams qualifying per group</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(n => {
                    const total = n * numGroups;
                    return (
                      <button key={n} onClick={() => {
                        setQualPerGroup(n);
                        const tot = n * numGroups;
                        setHasQF(tot >= 8);
                        setHasSF(tot >= 4);
                      }}
                        className={`flex flex-col items-center px-4 py-3 rounded-xl border transition ${qualPerGroup === n ? "border-primary bg-primary/10 text-white" : "border-bdr bg-panel2 text-muted hover:text-white"}`}>
                        <span className="font-black text-xl">{n}</span>
                        <span className="text-[10px] mt-0.5">{total} total</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted mt-2">
                  {qualPerGroup * numGroups} teams qualify → {qualPerGroup * numGroups >= 8 ? "QF → " : ""}{qualPerGroup * numGroups >= 4 ? "SF → " : ""}Final
                </p>
              </div>

              <hr className="border-bdr" />

              <div>
                <p className="text-sm font-semibold text-white mb-3">Knockout rounds</p>
                <div className="space-y-2.5">
                  {[
                    { label: "Quarter-finals", state: hasQF, set: setHasQF, disabled: qualPerGroup * numGroups < 8 },
                    { label: "Semi-finals",    state: hasSF,  set: setHasSF,  disabled: qualPerGroup * numGroups < 4 },
                    { label: "Final",          state: hasFinal, set: setHasFinal, disabled: true },
                    { label: "3rd Place Playoff", state: hasThirdPlace, set: setHasThirdPlace, disabled: !hasSF },
                  ].map(r => (
                    <label key={r.label} className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer
                      ${r.state ? "border-primary/50 bg-primary/5" : "border-bdr bg-panel2"}
                      ${r.disabled && r.label !== "Final" ? "opacity-40 cursor-not-allowed" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition
                          ${r.state ? "bg-primary border-primary" : "border-bdr"}`}>
                          {r.state && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="text-sm text-white">{r.label}</span>
                      </div>
                      <input type="checkbox" className="hidden" checked={r.state}
                        disabled={r.disabled && r.label !== "Final"}
                        onChange={e => !r.disabled && r.set(e.target.checked)} />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Bracket preview */}
            <BracketViz groups={groups} qualPerGroup={qualPerGroup} hasQF={hasQF} hasSF={hasSF} hasFinal={hasFinal} />
          </div>
        )}

        {/* ── Step: Settings ── */}
        {step === "settings" && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-white">Match settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SettingField label="Default venue">
                <input value={venue} onChange={e => setVenue(e.target.value)}
                  placeholder="e.g. City Cricket Ground"
                  className={inp} />
              </SettingField>

              <SettingField label="Match format">
                <div className="flex gap-2 mt-1">
                  {["T10","T20","ODI","Custom"].map(f => (
                    <button key={f} onClick={() => {
                      setMatchFormat(f);
                      if (f === "T10") setTotalOvers(10);
                      else if (f === "T20") setTotalOvers(20);
                      else if (f === "ODI") setTotalOvers(50);
                    }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${matchFormat === f ? "bg-primary text-white" : "bg-panel2 text-muted hover:text-white"}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </SettingField>

              <SettingField label="Overs per innings">
                <div className="flex items-center gap-3 mt-1">
                  <button onClick={() => setTotalOvers(o => Math.max(1, o - 1))} className={stepBtn}><Minus className="w-3.5 h-3.5" /></button>
                  <span className="text-xl font-black text-white w-10 text-center">{totalOvers}</span>
                  <button onClick={() => setTotalOvers(o => o + 1)} className={stepBtn}><Plus className="w-3.5 h-3.5" /></button>
                </div>
              </SettingField>

              <SettingField label="Matches per day">
                <div className="flex items-center gap-3 mt-1">
                  <button onClick={() => setMatchesPerDay(o => Math.max(1, o - 1))} className={stepBtn}><Minus className="w-3.5 h-3.5" /></button>
                  <span className="text-xl font-black text-white w-10 text-center">{matchesPerDay}</span>
                  <button onClick={() => setMatchesPerDay(o => o + 1)} className={stepBtn}><Plus className="w-3.5 h-3.5" /></button>
                </div>
              </SettingField>

              <SettingField label="First match date">
                <input type="date" value={firstDate} onChange={e => setFirstDate(e.target.value)}
                  className={inp} />
              </SettingField>

              <SettingField label="First match time">
                <input type="time" value={firstTime} onChange={e => setFirstTime(e.target.value)}
                  className={inp} />
              </SettingField>

              <SettingField label="Match duration (mins)">
                <input type="number" value={durationMins} onChange={e => setDurationMins(+e.target.value)}
                  min={60} max={600} className={inp} />
              </SettingField>

              <SettingField label="Gap between matches (mins)">
                <input type="number" value={gapMins} onChange={e => setGapMins(+e.target.value)}
                  min={0} max={180} className={inp} />
              </SettingField>
            </div>
          </div>
        )}

        {/* ── Step: Preview ── */}
        {step === "preview" && !created && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Schedule preview</h2>
                <p className="text-xs text-muted mt-0.5">
                  {groupStageCount} group-stage matches · {playoffCount} playoff slots (TBD)
                </p>
              </div>
              <button onClick={() => setStep("settings")} className="text-xs text-muted hover:text-white flex items-center gap-1.5 transition">
                <RefreshCw className="w-3.5 h-3.5" /> Edit settings
              </button>
            </div>

            {/* Group by round */}
            {(() => {
              const rounds = [...new Set(preview.map(m => m.round))];
              return rounds.map(round => (
                <div key={round}>
                  <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-2">{round}</p>
                  <div className="space-y-1.5">
                    {preview.filter(m => m.round === round).map(m => (
                      <div key={m.matchNumber}
                        className={`bg-panel border rounded-xl px-4 py-3 flex items-center gap-4 ${m.isTBD ? "border-bdr opacity-60" : "border-bdr"}`}>
                        <span className="text-[10px] text-muted w-6 shrink-0">M{m.matchNumber}</span>
                        <div className="flex-1 flex items-center gap-2 text-sm">
                          {m.isTBD ? (
                            <span className="text-muted italic">{m.note}</span>
                          ) : (
                            <>
                              <span className="font-semibold text-white truncate">{m.teamA?.name}</span>
                              <span className="text-muted text-xs shrink-0">vs</span>
                              <span className="font-semibold text-white truncate">{m.teamB?.name}</span>
                            </>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {m.isTBD
                            ? <span className="text-[10px] text-muted bg-panel2 px-2 py-0.5 rounded-full">TBD</span>
                            : m.scheduledAt
                              ? <span className="text-[10px] text-muted">
                                  {new Date(m.scheduledAt).toLocaleString("en-IN",{dateStyle:"short",timeStyle:"short"})}
                                </span>
                              : null
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}

            {playoffCount > 0 && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-400">
                <strong>Note:</strong> Playoff matches (TBD) will not be created now — they'll be created automatically once group stage results are in.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep("settings")} className="flex items-center gap-2 px-4 py-2.5 bg-panel2 border border-bdr text-sm text-muted hover:text-white rounded-xl transition">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={handleCreate} disabled={creating || groupStageCount === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition">
                {creating
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating… {createProgress}%</>
                  : <><Zap className="w-4 h-4" /> Create {groupStageCount} matches</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {created && (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Schedule created!</h2>
            <p className="text-sm text-muted">{groupStageCount} matches have been added to the tournament.</p>
            <div className="flex gap-3 justify-center mt-4">
              <button onClick={() => navigate("/")} className="px-5 py-2.5 bg-panel border border-bdr text-sm text-muted hover:text-white rounded-xl transition">
                Back to matches
              </button>
              <button onClick={() => { setCreated(false); setStep("format"); setPreview([]); }}
                className="px-5 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition">
                Build another
              </button>
            </div>
          </div>
        )}

        {/* Nav footer */}
        {step !== "preview" && !created && (
          <div className="flex justify-between mt-8 pt-4 border-t border-bdr">
            <button onClick={back} disabled={step === "format"}
              className="flex items-center gap-2 px-4 py-2.5 bg-panel2 border border-bdr text-sm text-muted hover:text-white rounded-xl disabled:opacity-40 transition">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={next} disabled={!canNext[step]}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 disabled:opacity-40 transition">
              {isLast ? <><Eye className="w-4 h-4" /> Preview schedule</> : <>Next <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DropZone ─────────────────────────────────────────────────────────────────

function DropZone({ label, teams, groupId, isPool, onDragStart, onDrop }:
  { label: string; teams: Team[]; groupId: string; isPool?: boolean; onDragStart: (t: Team, gid: string) => void; onDrop: (gid: string) => void }) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop(groupId); }}
      className={`rounded-2xl border-2 border-dashed p-3 min-h-[120px] transition-colors
        ${over ? "border-primary bg-primary/5" : isPool ? "border-bdr bg-panel2" : "border-bdr bg-panel"}`}>
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-bold text-muted uppercase tracking-wide">{label}</p>
        <span className="text-[10px] text-muted">{teams.length} teams</span>
      </div>
      <div className="space-y-1.5">
        {teams.map(t => (
          <div key={t._id} draggable
            onDragStart={e => { e.dataTransfer.effectAllowed = "move"; onDragStart(t, groupId); }}
            className="flex items-center gap-2 bg-panel2 border border-bdr rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing hover:border-primary/50 transition">
            <GripVertical className="w-3 h-3 text-muted shrink-0" />
            <span className="text-sm text-white font-medium truncate">{t.name}</span>
          </div>
        ))}
        {teams.length === 0 && (
          <p className="text-xs text-muted/50 text-center py-4">Drop teams here</p>
        )}
      </div>
    </div>
  );
}

// ─── BracketViz ───────────────────────────────────────────────────────────────

function BracketViz({ groups, qualPerGroup, hasQF, hasSF, hasFinal }:
  { groups: Group[]; qualPerGroup: number; hasQF: boolean; hasSF: boolean; hasFinal: boolean }) {
  const stages: string[] = [];
  groups.forEach(g => {
    for (let i = 0; i < qualPerGroup; i++) stages.push(i === 0 ? `W ${g.label}` : `RU ${g.label}`);
  });
  const rounds: string[][] = [stages];
  if (hasQF && stages.length >= 8) {
    const qf: string[] = [];
    for (let i = 0; i < stages.length / 2; i++) qf.push("QF winner");
    rounds.push(qf);
  }
  if (hasSF) rounds.push(rounds[rounds.length - 1].slice(0, rounds[rounds.length - 1].length / 2).map(() => "SF winner"));
  if (hasFinal) rounds.push(["🏆 Champion"]);

  return (
    <div className="bg-panel border border-bdr rounded-2xl p-4 overflow-x-auto">
      <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-3">Bracket preview</p>
      <div className="flex gap-4 min-w-max">
        {rounds.map((round, ri) => (
          <div key={ri} className="flex flex-col justify-center gap-2 min-w-[110px]">
            <p className="text-[10px] text-muted uppercase tracking-wide text-center mb-1">
              {ri === 0 ? "Qualifiers" : ri === rounds.length - 1 ? "Final" : hasSF && ri === rounds.length - 2 ? "Semi-finals" : "Quarter-finals"}
            </p>
            {round.map((slot, si) => (
              <div key={si} className={`text-center text-[11px] px-2 py-1.5 rounded-lg border ${ri === rounds.length - 1 ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400 font-bold" : "border-bdr bg-panel2 text-muted"}`}>
                {slot}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SettingField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted font-medium">{label}</label>
      {children}
    </div>
  );
}

const inp = "w-full mt-1 bg-panel2 border border-bdr rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary";
const stepBtn = "w-9 h-9 rounded-lg bg-panel2 border border-bdr text-muted hover:text-white flex items-center justify-center transition";
