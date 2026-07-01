import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Plus, Trophy, Calendar, MapPin, ChevronDown, ChevronUp,
  Loader2, CheckCircle2, Clock, XCircle, Trash2, Save, X,
  BookTemplate, Pencil,
} from "lucide-react";
import { WorkspaceTournament } from "./TournamentWorkspace";
import apiConfig from "@/config/apiConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchStatus = "upcoming" | "live" | "completed" | "cancelled" | "no_result";
type MatchFormat = "T20" | "ODI" | "T10" | "custom";

interface TeamRef { id: string; name: string; logo?: string }

interface Innings {
  id: string;
  inningsNumber: number;
  battingTeamId: string;
  battingTeam?: TeamRef;
  runs: number;
  wickets: number;
  oversBowled: number;
  extras: number;
  isCompleted: boolean;
}

interface Match {
  id: string;
  matchNumber?: number;
  round?: string;
  venue?: string;
  scheduledAt?: string;
  format: MatchFormat;
  totalOvers: number;
  teamAId: string;
  teamA: TeamRef;
  teamBId: string;
  teamB: TeamRef;
  status: MatchStatus;
  tossWonById?: string;
  tossDecision?: string;
  winnerId?: string;
  resultNote?: string;
  innings: Innings[];
}

interface PointsRow {
  teamId: string; teamName: string;
  played: number; won: number; lost: number; tied: number; noResult: number;
  points: number; nrr: number;
}

// ─── Match templates (stored in localStorage per tournament) ──────────────────

interface MatchTemplate {
  id: string;
  name: string;
  round: string;
  venue: string;
  format: MatchFormat;
  totalOvers: number;
}

const templateKey = (tid: string) => `cricbid_match_templates_${tid}`;

const loadTemplates = (tid: string): MatchTemplate[] => {
  try { return JSON.parse(localStorage.getItem(templateKey(tid)) || "[]"); }
  catch { return []; }
};

const saveTemplates = (tid: string, templates: MatchTemplate[]) =>
  localStorage.setItem(templateKey(tid), JSON.stringify(templates));

// ─── API helper ───────────────────────────────────────────────────────────────

const api = (path: string, body: object) =>
  fetch(`${apiConfig.baseUrl}/api/match/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(r => r.json());

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_META: Record<MatchStatus, { label: string; color: string; icon: React.ReactNode }> = {
  upcoming:   { label: "Upcoming",   color: "text-muted-foreground bg-muted/30",   icon: <Clock className="w-3 h-3" /> },
  live:       { label: "Live",       color: "text-green-400 bg-green-500/20",       icon: <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" /> },
  completed:  { label: "Completed",  color: "text-blue-400 bg-blue-500/20",         icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled:  { label: "Cancelled",  color: "text-red-400 bg-red-500/20",           icon: <XCircle className="w-3 h-3" /> },
  no_result:  { label: "No Result",  color: "text-yellow-400 bg-yellow-500/20",     icon: <XCircle className="w-3 h-3" /> },
};

const ROUNDS = ["League", "Group Stage", "Quarter Final", "Semi Final", "Final", "Super Over"];
const FORMATS: MatchFormat[] = ["T20", "T10", "ODI", "custom"];
const FORMAT_OVERS: Record<string, number> = { T20: 20, T10: 10, ODI: 50, custom: 20 };

// ─── Main component ───────────────────────────────────────────────────────────

export default function TournamentScheduleSection() {
  const { tournament } = useOutletContext<{ tournament: WorkspaceTournament }>();
  const tournamentId = tournament._id;

  const [tab, setTab] = useState<"fixtures" | "points">("fixtures");
  const [matches, setMatches] = useState<Match[]>([]);
  const [points, setPoints] = useState<PointsRow[]>([]);
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [templates, setTemplates] = useState<MatchTemplate[]>(() => loadTemplates(tournamentId));
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [scoreMatchId, setScoreMatchId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [mRes, pRes, tRes] = await Promise.all([
        api("list", { tournamentId }).catch(() => ({ success: false })),
        api("points-table", { tournamentId }).catch(() => ({ success: false })),
        fetch(`${apiConfig.baseUrl}/api/team/names`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ touranmentId: tournamentId }),
        }).then(r => r.json()).catch(() => ({ success: false })),
      ]);
      if (mRes.success) setMatches(mRes.data);
      if (pRes.success) setPoints(pRes.data);
      // names endpoint returns { _id, name } — normalise to { id, name }
      if (tRes.success) setTeams((tRes.data || []).map((t: { _id: string; name: string }) => ({ id: t._id, name: t.name })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [tournamentId]);

  const handleTemplatesSave = (updated: MatchTemplate[]) => {
    setTemplates(updated);
    saveTemplates(tournamentId, updated);
  };

  const grouped = useMemo(() => {
    const map: Record<string, Match[]> = {};
    matches.forEach(m => {
      const key = m.round || "Unassigned";
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return map;
  }, [matches]);

  const handleDelete = async (matchId: string) => {
    if (!confirm("Delete this match?")) return;
    await api("delete", { matchId });
    fetchAll();
  };

  const handleStatusChange = async (matchId: string, status: MatchStatus) => {
    await api("update", { matchId, status });
    fetchAll();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-orange-400" />
            Schedule & Scores
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {matches.length} match{matches.length !== 1 ? "es" : ""} · {matches.filter(m => m.status === "completed").length} completed
            {teams.length > 0 && <> · {teams.length} teams</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 px-3 py-2 border border-border text-muted-foreground rounded-lg text-sm hover:text-white hover:border-white/30 transition"
          >
            <BookTemplate className="w-4 h-4" />
            Templates {templates.length > 0 && <span className="bg-primary/30 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-semibold">{templates.length}</span>}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition"
          >
            <Plus className="w-4 h-4" /> Add match
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/20 rounded-lg p-1 w-fit">
        {(["fixtures", "points"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${tab === t ? "bg-card text-white" : "text-muted-foreground hover:text-white"}`}
          >
            {t === "fixtures" ? "Fixtures" : "Points Table"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : tab === "fixtures" ? (
        <FixturesTab
          grouped={grouped}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onScoreClick={setScoreMatchId}
        />
      ) : (
        <PointsTableTab points={points} />
      )}

      {showCreate && (
        <CreateMatchModal
          tournamentId={tournamentId}
          teams={teams}
          templates={templates}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchAll(); }}
        />
      )}

      {showTemplates && (
        <TemplateManagerModal
          templates={templates}
          onSave={handleTemplatesSave}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {scoreMatchId && (
        <ScoreEntryModal
          match={matches.find(m => m.id === scoreMatchId)!}
          onClose={() => setScoreMatchId(null)}
          onSaved={() => { setScoreMatchId(null); fetchAll(); }}
        />
      )}
    </div>
  );
}

// ─── Fixtures tab ─────────────────────────────────────────────────────────────

function FixturesTab({ grouped, onDelete, onStatusChange, onScoreClick }: {
  grouped: Record<string, Match[]>;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, s: MatchStatus) => void;
  onScoreClick: (id: string) => void;
}) {
  const rounds = Object.keys(grouped);
  if (rounds.length === 0) return (
    <div className="text-center py-16 text-muted-foreground text-sm">
      No matches yet. Click "Add match" to create the first fixture.
    </div>
  );
  return (
    <div className="space-y-6">
      {rounds.map(round => (
        <RoundGroup key={round} round={round} matches={grouped[round]}
          onDelete={onDelete} onStatusChange={onStatusChange} onScoreClick={onScoreClick} />
      ))}
    </div>
  );
}

function RoundGroup({ round, matches, onDelete, onStatusChange, onScoreClick }: {
  round: string; matches: Match[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, s: MatchStatus) => void;
  onScoreClick: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setCollapsed(p => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/10 transition"
      >
        <span className="font-semibold text-sm text-white">{round}</span>
        <span className="flex items-center gap-2 text-muted-foreground text-xs">
          {matches.length} match{matches.length !== 1 ? "es" : ""}
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>
      {!collapsed && (
        <div className="divide-y divide-border border-t border-border">
          {matches.map(m => (
            <MatchRow key={m.id} match={m}
              onDelete={onDelete} onStatusChange={onStatusChange} onScoreClick={onScoreClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchRow({ match: m, onDelete, onStatusChange, onScoreClick }: {
  match: Match;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, s: MatchStatus) => void;
  onScoreClick: (id: string) => void;
}) {
  const sm = STATUS_META[m.status];
  const inn1 = m.innings.find(i => i.battingTeamId === m.teamAId);
  const inn2 = m.innings.find(i => i.battingTeamId === m.teamBId);
  const hasScores = inn1 || inn2;

  return (
    <div className="px-5 py-4 hover:bg-muted/5 transition">
      <div className="flex items-center gap-3 flex-wrap">
        {m.matchNumber && (
          <span className="text-[10px] text-muted-foreground font-semibold w-8 shrink-0">M{m.matchNumber}</span>
        )}
        <div className="flex-1 min-w-0">
          {hasScores ? (
            <div className="space-y-1.5">
              <ScoreLine team={m.teamA} innings={inn1} isWinner={m.winnerId === m.teamAId} />
              <ScoreLine team={m.teamB} innings={inn2} isWinner={m.winnerId === m.teamBId} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white truncate">{m.teamA.name}</span>
              <span className="text-muted-foreground text-xs">vs</span>
              <span className="font-semibold text-sm text-white truncate">{m.teamB.name}</span>
            </div>
          )}
          {m.resultNote && <p className="text-xs text-orange-400 mt-1">{m.resultNote}</p>}
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            {m.scheduledAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(m.scheduledAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
              </span>
            )}
            {m.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.venue}</span>}
            <span className="text-muted-foreground/60">{m.format} · {m.totalOvers} ov</span>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${sm.color}`}>
          {sm.icon}{sm.label}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {m.status !== "completed" && m.status !== "cancelled" && (
            <button
              onClick={() => onScoreClick(m.id)}
              className="text-[11px] px-2.5 py-1 bg-primary/20 text-primary rounded-md hover:bg-primary/30 font-semibold transition"
            >
              Score
            </button>
          )}
          <select
            value={m.status}
            onChange={e => onStatusChange(m.id, e.target.value as MatchStatus)}
            className="text-[11px] bg-muted/30 border border-border text-muted-foreground rounded-md px-1.5 py-1 cursor-pointer"
          >
            {(["upcoming","live","completed","cancelled","no_result"] as MatchStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
          <button onClick={() => onDelete(m.id)} className="p-1.5 text-muted-foreground hover:text-red-400 transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreLine({ team, innings, isWinner }: { team: TeamRef; innings?: Innings; isWinner: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-sm font-semibold truncate ${isWinner ? "text-white" : "text-muted-foreground"}`}>
        {team.name}
      </span>
      {innings ? (
        <span className={`text-sm font-bold shrink-0 ${isWinner ? "text-white" : "text-muted-foreground"}`}>
          {innings.runs}/{innings.wickets}
          <span className="text-xs font-normal ml-1">({innings.oversBowled} ov)</span>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground/50">Yet to bat</span>
      )}
    </div>
  );
}

// ─── Template manager modal ───────────────────────────────────────────────────

function TemplateManagerModal({ templates, onSave, onClose }: {
  templates: MatchTemplate[];
  onSave: (t: MatchTemplate[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<MatchTemplate[]>(templates);
  const [editing, setEditing] = useState<MatchTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);

  const blank = (): MatchTemplate => ({
    id: Math.random().toString(36).slice(2),
    name: "", round: "League", venue: "", format: "T20", totalOvers: 20,
  });

  const handleSaveTemplate = (t: MatchTemplate) => {
    const updated = list.find(x => x.id === t.id)
      ? list.map(x => x.id === t.id ? t : x)
      : [...list, t];
    setList(updated);
    onSave(updated);
    setEditing(null);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    const updated = list.filter(x => x.id !== id);
    setList(updated);
    onSave(updated);
  };

  return (
    <Modal title="Match Templates" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Templates pre-fill format, overs, venue, and round when creating a match. Only the teams and date need to be set each time.
        </p>

        {list.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground/60 py-4 text-center">No templates yet.</p>
        )}

        {list.map(t => (
          <div key={t.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
            <div>
              <p className="text-sm font-semibold text-white">{t.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.round} · {t.format} {t.totalOvers} ov{t.venue ? ` · ${t.venue}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(t); setShowForm(true); }}
                className="p-1.5 text-muted-foreground hover:text-white transition">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(t.id)}
                className="p-1.5 text-muted-foreground hover:text-red-400 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {showForm ? (
          <TemplateForm
            initial={editing || blank()}
            onSave={handleSaveTemplate}
            onCancel={() => { setEditing(null); setShowForm(false); }}
          />
        ) : (
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-white hover:border-white/30 transition"
          >
            <Plus className="w-4 h-4" /> New template
          </button>
        )}

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-card border border-border text-white rounded-lg hover:bg-muted/20 transition">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TemplateForm({ initial, onSave, onCancel }: {
  initial: MatchTemplate;
  onSave: (t: MatchTemplate) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof MatchTemplate, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.name.trim().length > 0;

  return (
    <div className="p-3 bg-muted/10 rounded-lg border border-border space-y-3">
      <Field label="Template name *">
        <input value={form.name} onChange={e => set("name", e.target.value)}
          placeholder="e.g. League stage T20" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Round">
          <select value={form.round} onChange={e => set("round", e.target.value)} className={selectCls}>
            {ROUNDS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Format">
          <select value={form.format} onChange={e => {
            const f = e.target.value as MatchFormat;
            set("format", f);
            set("totalOvers", FORMAT_OVERS[f] ?? 20);
          }} className={selectCls}>
            {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Overs">
          <input type="number" value={form.totalOvers} onChange={e => set("totalOvers", Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Venue">
          <input value={form.venue} onChange={e => set("venue", e.target.value)}
            placeholder="Optional" className={inputCls} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-white transition">Cancel</button>
        <button onClick={() => onSave(form)} disabled={!valid}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-primary/90 transition">
          <Save className="w-3.5 h-3.5" /> Save template
        </button>
      </div>
    </div>
  );
}

// ─── Create match modal ───────────────────────────────────────────────────────

function CreateMatchModal({ tournamentId, teams, templates, onClose, onCreated }: {
  tournamentId: string; teams: TeamRef[]; templates: MatchTemplate[];
  onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState({
    teamAId: "", teamBId: "", round: "League", matchNumber: "",
    venue: "", scheduledAt: "", format: "T20" as MatchFormat, totalOvers: 20,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const applyTemplate = (templateId: string) => {
    const t = templates.find(x => x.id === templateId);
    if (!t) return;
    setForm(p => ({ ...p, round: t.round, venue: t.venue, format: t.format, totalOvers: t.totalOvers }));
  };

  const handleSubmit = async () => {
    if (!form.teamAId || !form.teamBId) { setError("Select both teams"); return; }
    if (form.teamAId === form.teamBId) { setError("Teams must be different"); return; }
    setSaving(true);
    const r = await api("create", {
      tournamentId,
      teamAId: form.teamAId, teamBId: form.teamBId,
      round: form.round || undefined,
      matchNumber: form.matchNumber ? Number(form.matchNumber) : undefined,
      venue: form.venue || undefined,
      scheduledAt: form.scheduledAt || undefined,
      format: form.format, totalOvers: form.totalOvers,
    });
    setSaving(false);
    if (r.success) onCreated();
    else setError(r.message || "Failed to create match");
  };

  return (
    <Modal title="Add match" onClose={onClose}>
      <div className="space-y-4">

        {/* Template picker */}
        {templates.length > 0 && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-xs font-semibold text-primary mb-2">Use a template</p>
            <div className="flex flex-wrap gap-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t.id)}
                  className="px-3 py-1.5 text-xs bg-card border border-border rounded-lg text-muted-foreground hover:text-white hover:border-primary/50 transition"
                >
                  {t.name}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Clicking a template fills in round, venue, format & overs. You still pick the teams and date.</p>
          </div>
        )}

        {/* Teams — pulled from tournament registration */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Team A *">
            <select value={form.teamAId} onChange={e => set("teamAId", e.target.value)} className={selectCls}>
              <option value="">Select team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Team B *">
            <select value={form.teamBId} onChange={e => set("teamBId", e.target.value)} className={selectCls}>
              <option value="">Select team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Round">
            <select value={form.round} onChange={e => set("round", e.target.value)} className={selectCls}>
              {ROUNDS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Match #">
            <input type="number" value={form.matchNumber} onChange={e => set("matchNumber", e.target.value)}
              placeholder="e.g. 1" className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Format">
            <select value={form.format} onChange={e => {
              const f = e.target.value as MatchFormat;
              set("format", f);
              set("totalOvers", FORMAT_OVERS[f] ?? 20);
            }} className={selectCls}>
              {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Overs">
            <input type="number" value={form.totalOvers} onChange={e => set("totalOvers", Number(e.target.value))} className={inputCls} />
          </Field>
        </div>

        <Field label="Date & Time">
          <input type="datetime-local" value={form.scheduledAt} onChange={e => set("scheduledAt", e.target.value)} className={inputCls} />
        </Field>

        <Field label="Venue">
          <input type="text" value={form.venue} onChange={e => set("venue", e.target.value)}
            placeholder="e.g. City Cricket Ground" className={inputCls} />
        </Field>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-white transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Create match
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Score entry modal ────────────────────────────────────────────────────────

function ScoreEntryModal({ match: m, onClose, onSaved }: {
  match: Match; onClose: () => void; onSaved: () => void;
}) {
  // Quick result mode — just pick winner + margin
  const [winner, setWinner] = useState<string>(m.winnerId || "");
  const [winType, setWinType] = useState<"wickets" | "runs">("wickets");
  const [margin, setMargin] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  // Advanced: full innings data
  const existingInn1 = m.innings.find(i => i.inningsNumber === 1);
  const existingInn2 = m.innings.find(i => i.inningsNumber === 2);
  const [inn1, setInn1] = useState({
    battingTeamId: existingInn1?.battingTeamId || m.teamAId,
    runs: existingInn1?.runs ?? 0, wickets: existingInn1?.wickets ?? 0,
    oversBowled: existingInn1?.oversBowled ?? 0, extras: existingInn1?.extras ?? 0,
    isCompleted: existingInn1?.isCompleted ?? false,
  });
  const [inn2, setInn2] = useState({
    battingTeamId: existingInn2?.battingTeamId || m.teamBId,
    runs: existingInn2?.runs ?? 0, wickets: existingInn2?.wickets ?? 0,
    oversBowled: existingInn2?.oversBowled ?? 0, extras: existingInn2?.extras ?? 0,
    isCompleted: existingInn2?.isCompleted ?? false,
  });
  const [toss, setToss] = useState({ tossWonById: m.tossWonById || "", tossDecision: m.tossDecision || "bat" });

  const teams = [
    { id: m.teamAId, name: m.teamA.name },
    { id: m.teamBId, name: m.teamB.name },
  ];

  const handleQuickSave = async () => {
    setSaving(true);
    const winnerName = teams.find(t => t.id === winner)?.name || "";
    let resultNote = "";
    if (winner) {
      resultNote = margin
        ? `${winnerName} won by ${margin} ${winType}`
        : `${winnerName} won`;
    } else {
      resultNote = "Match tied";
    }
    await api("update", {
      matchId: m.id,
      winnerId: winner || undefined,
      resultNote,
      status: "completed",
    });
    setSaving(false);
    onSaved();
  };

  const handleAdvancedSave = async () => {
    setSaving(true);
    await Promise.all([
      api("update", { matchId: m.id, tossWonById: toss.tossWonById || undefined, tossDecision: toss.tossDecision }),
      api("innings/save", { matchId: m.id, inningsNumber: 1, ...inn1 }),
      api("innings/save", { matchId: m.id, inningsNumber: 2, ...inn2 }),
    ]);
    await api("complete", { matchId: m.id });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal title={`${m.teamA.name} vs ${m.teamB.name}`} onClose={onClose}>
      <div className="space-y-5">
        {/* Mode toggle */}
        <div className="flex gap-1 bg-muted/20 rounded-lg p-1 w-fit">
          <button
            onClick={() => setAdvanced(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${!advanced ? "bg-card text-white" : "text-muted-foreground hover:text-white"}`}
          >
            Quick result
          </button>
          <button
            onClick={() => setAdvanced(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${advanced ? "bg-card text-white" : "text-muted-foreground hover:text-white"}`}
          >
            Full scorecard
          </button>
        </div>

        {!advanced ? (
          /* ── Quick result ── */
          <div className="space-y-4">
            <Field label="Who won?">
              <select value={winner} onChange={e => setWinner(e.target.value)} className={selectCls}>
                <option value="">— Match tied / No result —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            {winner && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Win by">
                  <select value={winType} onChange={e => setWinType(e.target.value as "wickets" | "runs")} className={selectCls}>
                    <option value="wickets">Wickets</option>
                    <option value="runs">Runs</option>
                  </select>
                </Field>
                <Field label="Margin">
                  <input type="number" min={0} value={margin} onChange={e => setMargin(Number(e.target.value))}
                    placeholder="e.g. 5" className={inputCls} />
                </Field>
              </div>
            )}
            {/* Preview */}
            {(winner || margin > 0) && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400 font-medium">
                {winner
                  ? `${teams.find(t => t.id === winner)?.name} won by ${margin} ${winType}`
                  : "Match tied"}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-white transition">Cancel</button>
              <button onClick={handleQuickSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Save & complete
              </button>
            </div>
          </div>
        ) : (
          /* ── Full scorecard ── */
          <div className="space-y-4">
            <div className="p-3 bg-muted/20 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Toss</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Won by">
                  <select value={toss.tossWonById} onChange={e => setToss(p => ({ ...p, tossWonById: e.target.value }))} className={selectCls}>
                    <option value="">—</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </Field>
                <Field label="Decision">
                  <select value={toss.tossDecision} onChange={e => setToss(p => ({ ...p, tossDecision: e.target.value }))} className={selectCls}>
                    <option value="bat">Bat</option>
                    <option value="field">Field</option>
                  </select>
                </Field>
              </div>
            </div>
            <InningsForm label="1st Innings" teams={teams} value={inn1} onChange={setInn1} />
            <InningsForm label="2nd Innings" teams={teams} value={inn2} onChange={setInn2} />
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-white transition">Cancel</button>
              <button onClick={handleAdvancedSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Save & complete
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function InningsForm({ label, teams, value, onChange }: {
  label: string;
  teams: { id: string; name: string }[];
  value: { battingTeamId: string; runs: number; wickets: number; oversBowled: number; extras: number; isCompleted: boolean };
  onChange: (v: typeof value) => void;
}) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="p-3 bg-muted/20 rounded-lg space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <Field label="Batting team">
        <select value={value.battingTeamId} onChange={e => set("battingTeamId", e.target.value)} className={selectCls}>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-4 gap-2">
        <Field label="Runs"><input type="number" value={value.runs} min={0} onChange={e => set("runs", Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Wickets"><input type="number" value={value.wickets} min={0} max={10} onChange={e => set("wickets", Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Overs"><input type="number" value={value.oversBowled} min={0} step={0.1} onChange={e => set("oversBowled", Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Extras"><input type="number" value={value.extras} min={0} onChange={e => set("extras", Number(e.target.value))} className={inputCls} /></Field>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <input type="checkbox" checked={value.isCompleted} onChange={e => set("isCompleted", e.target.checked)} className="accent-primary" />
        Innings completed
      </label>
    </div>
  );
}

// ─── Points table tab ─────────────────────────────────────────────────────────

function PointsTableTab({ points }: { points: PointsRow[] }) {
  if (points.length === 0) return (
    <div className="text-center py-16 text-muted-foreground text-sm">
      Points table will populate once matches are completed.
    </div>
  );
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
            <th className="text-left px-4 py-3">#</th>
            <th className="text-left px-4 py-3">Team</th>
            <th className="text-center px-3 py-3">P</th>
            <th className="text-center px-3 py-3">W</th>
            <th className="text-center px-3 py-3">L</th>
            <th className="text-center px-3 py-3">T</th>
            <th className="text-center px-3 py-3">NR</th>
            <th className="text-center px-3 py-3 text-white font-bold">Pts</th>
            <th className="text-center px-3 py-3">NRR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {points.map((row, i) => (
            <tr key={row.teamId} className={`hover:bg-muted/10 transition ${i < 4 ? "border-l-2 border-l-primary" : ""}`}>
              <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3 font-semibold text-white">{row.teamName}</td>
              <td className="text-center px-3 py-3 text-muted-foreground">{row.played}</td>
              <td className="text-center px-3 py-3 text-green-400 font-semibold">{row.won}</td>
              <td className="text-center px-3 py-3 text-red-400">{row.lost}</td>
              <td className="text-center px-3 py-3 text-muted-foreground">{row.tied}</td>
              <td className="text-center px-3 py-3 text-muted-foreground">{row.noResult}</td>
              <td className="text-center px-3 py-3 text-white font-bold text-base">{row.points}</td>
              <td className={`text-center px-3 py-3 text-xs font-semibold ${row.nrr >= 0 ? "text-green-400" : "text-red-400"}`}>
                {row.nrr >= 0 ? "+" : ""}{row.nrr.toFixed(3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-muted-foreground px-4 py-2 border-t border-border">
        Top 4 highlighted · Sorted by points, then NRR
      </p>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary";
const selectCls = "w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary";
