import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import {
  MessageSquare, Send, RefreshCw, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Loader2, AlertCircle, Info,
  Inbox, ArrowUpRight, Search, Filter, Webhook, Circle,
} from "lucide-react";
import { WorkspaceTournament } from "./TournamentWorkspace";
import apiConfig from "@/config/apiConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateConfig { enabled: boolean; thresholdPercent?: number; }

interface WhatsAppConfig {
  playerSold: TemplateConfig; playerUnsold: TemplateConfig;
  teamPurchase: TemplateConfig; postAuctionPlayer: TemplateConfig;
  postAuctionOwner: TemplateConfig; auctionReminder: TemplateConfig;
  categoryStarting: TemplateConfig; budgetWarning: TemplateConfig & { thresholdPercent: number };
}

interface LogEntry {
  id: string; messageType: string; templateName: string;
  recipientMobile: string; playerName?: string; teamName?: string;
  status: "success" | "failed"; errorMessage?: string; timestamp: string;
  amtSold?: number;
}

interface IncomingMessage {
  id: string; from: string; senderName?: string; messageId: string;
  messageType: string; body?: string; isRead: boolean; receivedAt: string;
}

interface Template {
  key: keyof WhatsAppConfig; label: string; trigger: string; recipient: string;
  description: string; preview: string; metaTemplateName: string;
  metaParams: string[]; hasButton?: boolean; buttonUrl?: string;
  isNew?: boolean; extraField?: { label: string; key: "thresholdPercent"; min: number; max: number };
}

// ─── Template catalogue ───────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  { key: "playerSold", label: "Player Sold", trigger: "Auto — when auctioneer marks SOLD", recipient: "Player (via their registered mobile)", description: "Sent to the player immediately when they are sold in the auction.", preview: "🎉 Congratulations *{{1}}*! You've been sold to *{{2}}* for *{{3}} pts* in the *{{4}}* auction. Tap below to see the full standings.", metaTemplateName: "sold_message", metaParams: ["Player Name", "Team Name", "Amount (pts)", "Tournament Name"], hasButton: true, buttonUrl: "https://cricbid.online/tournament/{{tournamentId}}" },
  { key: "playerUnsold", label: "Player Unsold", trigger: "Auto — when auctioneer marks UNSOLD", recipient: "Player (via their registered mobile)", description: "Notifies the player they went unsold.", preview: "Hi *{{1}}*, unfortunately you went unsold in the *{{2}}* auction this round. You may be placed in the next round. Stay tuned!", metaTemplateName: "unsold_message", metaParams: ["Player Name", "Tournament Name"], isNew: true },
  { key: "teamPurchase", label: "Team Purchase Update", trigger: "Auto — after every SOLD event, to the buying team's owner", recipient: "Team Owner (via owner mobile)", description: "Sent to the team owner every time they buy a player.", preview: "Hi *{{1}}* 👋\nYou just bought *{{2}}* for *{{3}}*!\n\n📊 *Your Squad:*\nPlayers: *{{4}}*\nBudget used: *{{5}}*\nRemaining: *{{6}}*\n\nCurrent team: {{7}}", metaTemplateName: "team_purchase_summary", metaParams: ["Owner Name", "Player Bought", "Amount", "No. of Players", "Budget Used", "Budget Remaining", "Squad List"], hasButton: true, buttonUrl: "https://cricbid.online/team/{{teamId}}", isNew: true },
  { key: "postAuctionPlayer", label: "Post-Auction Player Summary", trigger: "Manual — tap 'Send Now' after auction ends", recipient: "Every registered player", description: "After the auction, sends each player their result.", preview: "Hi *{{1}}* 🏏\nThe *{{2}}* auction has ended!\n\nYour result: *{{3}}*\n\nAll the best for the upcoming matches.", metaTemplateName: "post_auction_player_summary", metaParams: ["Player Name", "Tournament Name", "Team Name (or UNSOLD)"], hasButton: true, buttonUrl: "https://cricbid.online/tournament/{{tournamentId}}", isNew: true },
  { key: "postAuctionOwner", label: "Post-Auction Owner Summary", trigger: "Manual — tap 'Send Now' after auction ends", recipient: "Every team owner", description: "After the auction, sends each owner their complete squad list.", preview: "Hi *{{1}}* 🏆\nThe *{{2}}* auction for *{{3}}* is complete!\n\nYour final squad ({{4}} players):\n{{6}}\n\nTotal spent: *{{5}}*", metaTemplateName: "post_auction_owner_summary", metaParams: ["Owner Name", "Team Name", "Tournament Name", "Player Count", "Budget Used", "Squad List"], hasButton: true, buttonUrl: "https://cricbid.online/tournament/{{tournamentId}}", isNew: true },
  { key: "auctionReminder", label: "Auction Day Reminder", trigger: "Manual — send whenever you like", recipient: "All players + all team owners", description: "A broadcast reminder to everyone participating.", preview: "Hey *{{1}}* 👋\nReminder: The *{{2}}* cricket auction is happening soon!\n\n{{3}}\n\nSee you there! 🏏", metaTemplateName: "auction_announcement", metaParams: ["Recipient Name", "Tournament Name", "Custom Message"], hasButton: true, buttonUrl: "https://cricbid.online/tournament/{{tournamentId}}", isNew: true },
  { key: "categoryStarting", label: "Your Category Is Next", trigger: "Auto — when auctioneer starts a new category", recipient: "All unsold players in that category", description: "Alerts players that their category auction is starting now.", preview: "🚨 Heads up *{{1}}*!\nThe *{{2}}* category auction is starting right now in the *{{3}}* tournament. Get ready!", metaTemplateName: "category_auction_starting", metaParams: ["Player Name", "Category Name", "Tournament Name"], isNew: true },
  { key: "budgetWarning", label: "Budget Warning", trigger: "Auto — after purchase when team hits threshold% of budget", recipient: "Team Owner", description: "Warns a team owner when they're running low on budget.", preview: "⚠️ *{{1}}*, your team *{{2}}* has used *{{3}}%* of your budget!\n\nRemaining budget: *{{4}}*\n\nChoose your remaining picks wisely.", metaTemplateName: "budget_warning", metaParams: ["Owner Name", "Team Name", "% Used", "Remaining Budget"], isNew: true, extraField: { label: "Trigger threshold (%)", key: "thresholdPercent", min: 50, max: 95 } },
];

const DEFAULT_CONFIG: WhatsAppConfig = {
  playerSold: { enabled: true }, playerUnsold: { enabled: true }, teamPurchase: { enabled: true },
  postAuctionPlayer: { enabled: false }, postAuctionOwner: { enabled: false },
  auctionReminder: { enabled: false }, categoryStarting: { enabled: false },
  budgetWarning: { enabled: false, thresholdPercent: 80 },
};

const api = (path: string, body: object) =>
  fetch(`${apiConfig.baseUrl}/api/whatsapp/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }).then(r => r.json());

const TYPE_META: Record<string, { label: string; color: string }> = {
  player_sold:           { label: "Sold",           color: "bg-emerald-500/20 text-emerald-400" },
  player_unsold:         { label: "Unsold",          color: "bg-amber-500/20 text-amber-400" },
  team_purchase_summary: { label: "Team purchase",   color: "bg-blue-500/20 text-blue-400" },
  post_auction_player:   { label: "Post-auction",    color: "bg-violet-500/20 text-violet-400" },
  post_auction_owner:    { label: "Owner summary",   color: "bg-violet-500/20 text-violet-400" },
  auction_announcement:  { label: "Reminder",        color: "bg-sky-500/20 text-sky-400" },
  category_starting:     { label: "Category alert",  color: "bg-orange-500/20 text-orange-400" },
  budget_warning:        { label: "Budget warning",  color: "bg-red-500/20 text-red-400" },
  test:                  { label: "Test",             color: "bg-muted text-muted-foreground" },
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function TournamentWhatsAppSection() {
  const { tournament } = useOutletContext<{ tournament: WorkspaceTournament }>();
  const tournamentId = tournament._id;

  const [tab, setTab] = useState<"config" | "sent" | "inbox">("config");

  // Config state
  const [config, setConfig]     = useState<WhatsAppConfig>(DEFAULT_CONFIG);
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState<string | null>(null);
  const [sending, setSending]   = useState<Record<string, boolean>>({});
  const [sendResult, setSendResult] = useState<Record<string, string>>({});
  const [reminderMsg, setReminderMsg] = useState("");
  const [recipientCount, setRecipientCount] = useState<{ playerCount: number; teamOwnerCount: number } | null>(null);

  // Sent logs state
  const [logs, setLogs]               = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch]     = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState("all");

  // Inbox state
  const [inbox, setInbox]             = useState<IncomingMessage[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api("config/get", { tournamentId }).then(r => { if (r.success && r.data) setConfig({ ...DEFAULT_CONFIG, ...r.data }); });
    api("preview-recipients", { tournamentId }).then(r => { if (r.success) setRecipientCount(r.data); });
  }, [tournamentId]);

  useEffect(() => {
    if (tab === "sent") fetchLogs();
    if (tab === "inbox") fetchInbox();
  }, [tab]);

  const fetchLogs = async () => {
    setLogsLoading(true);
    const r = await api("logs", { tournamentId, limit: 100 });
    if (r.success) setLogs(r.data || []);
    setLogsLoading(false);
  };

  const fetchInbox = async () => {
    setInboxLoading(true);
    const r = await api("incoming/list", { limit: 50 });
    if (r.success) { setInbox(r.data.messages || []); setUnreadCount(r.data.unreadCount ?? 0); }
    setInboxLoading(false);
  };

  const markRead = async (id: string) => {
    setInbox(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
    setUnreadCount(prev => Math.max(0, prev - 1));
    await api("incoming/mark-read", { ids: [id] });
  };

  const updateTemplate = (key: keyof WhatsAppConfig, patch: Partial<TemplateConfig>) =>
    setConfig(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const saveConfig = async () => {
    setSaving(true); setSaveMsg(null);
    const r = await api("config/save", { tournamentId, whatsappConfig: config });
    setSaveMsg(r.success ? "✓ Saved" : "✗ Save failed");
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const sendAction = async (actionKey: string, body: object) => {
    setSending(p => ({ ...p, [actionKey]: true }));
    setSendResult(p => ({ ...p, [actionKey]: "" }));
    const r = await api(actionKey.startsWith("post") ? "send-post-auction" : "send-reminder", body);
    setSendResult(p => ({
      ...p,
      [actionKey]: r.success
        ? `✓ Sent to ${r.data?.players?.totalSent ?? r.data?.totalSent ?? "?"} recipients`
        : `✗ ${r.message || "Failed"}`,
    }));
    setSending(p => ({ ...p, [actionKey]: false }));
    if (tab === "sent") fetchLogs();
  };

  // ── Filtered logs ─────────────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchType = logTypeFilter === "all" || l.messageType === logTypeFilter;
      const q = logSearch.toLowerCase();
      const matchSearch = !q || (l.recipientMobile?.includes(q) || l.playerName?.toLowerCase().includes(q) || l.teamName?.toLowerCase().includes(q));
      return matchType && matchSearch;
    });
  }, [logs, logTypeFilter, logSearch]);

  const logStats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter(l => l.status === "success").length;
    const failed = total - success;
    const rate = total > 0 ? ((success / total) * 100).toFixed(1) : "0";
    return { total, success, failed, rate };
  }, [logs]);

  const totalEnabled = Object.values(config).filter(v => v.enabled).length;
  const autoCount = TEMPLATES.filter(t => !["postAuctionPlayer", "postAuctionOwner", "auctionReminder"].includes(t.key) && config[t.key]?.enabled).length;

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-green-400" />
            WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalEnabled} template{totalEnabled !== 1 ? "s" : ""} enabled · {autoCount} auto-trigger during auction
          </p>
        </div>
        {tab === "config" && (
          <button onClick={saveConfig} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saveMsg ?? "Save changes"}
          </button>
        )}
        {tab === "sent" && (
          <button onClick={fetchLogs} disabled={logsLoading}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-muted-foreground hover:text-white transition">
            <RefreshCw className={`w-4 h-4 ${logsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
        {tab === "inbox" && (
          <button onClick={fetchInbox} disabled={inboxLoading}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-muted-foreground hover:text-white transition">
            <RefreshCw className={`w-4 h-4 ${inboxLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-card rounded-xl border border-border mb-6">
        {(["config", "sent", "inbox"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-white"
            }`}
          >
            {t === "config" && <AlertCircle className="w-4 h-4" />}
            {t === "sent" && <ArrowUpRight className="w-4 h-4" />}
            {t === "inbox" && <Inbox className="w-4 h-4" />}
            {t === "config" ? "Configuration" : t === "sent" ? "Sent Messages" : "Inbox"}
            {t === "inbox" && unreadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full leading-none">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: CONFIGURATION                                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === "config" && (
        <div className="space-y-4">
          {recipientCount && (
            <div className="flex gap-3 p-4 bg-card rounded-xl border border-border text-sm">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-muted-foreground">
                This tournament has <span className="text-white font-semibold">{recipientCount.playerCount} players</span> and{" "}
                <span className="text-white font-semibold">{recipientCount.teamOwnerCount} team owners</span> with registered mobile numbers.
              </span>
            </div>
          )}

          {TEMPLATES.map(t => {
            const cfg = config[t.key] as TemplateConfig;
            const isManual = ["postAuctionPlayer", "postAuctionOwner", "auctionReminder"].includes(t.key);
            return (
              <TemplateCard key={t.key} template={t} enabled={cfg?.enabled ?? false}
                threshold={(cfg as any)?.thresholdPercent} isManual={isManual}
                reminderMsg={reminderMsg} onReminderMsgChange={setReminderMsg}
                isSending={!!sending[t.key]} sendResult={sendResult[t.key]}
                onToggle={() => updateTemplate(t.key, { enabled: !cfg?.enabled })}
                onThresholdChange={v => updateTemplate(t.key, { thresholdPercent: v })}
                onSend={() => {
                  if (t.key === "auctionReminder") sendAction(t.key, { tournamentId, customMessage: reminderMsg || undefined });
                  else sendAction(t.key, { tournamentId, targets: t.key === "postAuctionPlayer" ? ["players"] : ["owners"] });
                }}
              />
            );
          })}

          {/* Bulk post-auction */}
          <div className="p-5 bg-card rounded-xl border border-border space-y-3">
            <h3 className="text-sm font-semibold text-white">Send all post-auction messages at once</h3>
            <p className="text-xs text-muted-foreground">Sends both player results and owner squad summaries in a single click.</p>
            <button onClick={() => sendAction("postAll", { tournamentId, targets: ["players", "owners"] })}
              disabled={!!sending["postAll"]}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition">
              {sending["postAll"] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send post-auction summary to everyone
            </button>
            {sendResult["postAll"] && (
              <p className={`text-sm ${sendResult["postAll"].startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
                {sendResult["postAll"]}
              </p>
            )}
          </div>

          <MetaCheatsheet />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: SENT MESSAGES                                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === "sent" && (
        <div className="space-y-5">
          {/* Stat cards */}
          {logsLoading && logs.length === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                  <div className="h-3 w-16 bg-muted rounded mb-3" />
                  <div className="h-7 w-12 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total sent" value={logStats.total.toString()} />
              <StatCard label="Delivered" value={logStats.success.toString()} valueColor="text-emerald-400" />
              <StatCard label="Failed" value={logStats.failed.toString()} valueColor={logStats.failed > 0 ? "text-red-400" : undefined} />
              <StatCard label="Success rate" value={`${logStats.rate}%`} valueColor="text-blue-400" />
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={logSearch} onChange={e => setLogSearch(e.target.value)}
                placeholder="Search by name or phone…"
                className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select value={logTypeFilter} onChange={e => setLogTypeFilter(e.target.value)}
                className="pl-9 pr-8 py-2 bg-card border border-border rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer">
                <option value="all">All types</option>
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Log table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {logsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{logs.length === 0 ? "No messages sent yet." : "No results match your filter."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="text-left px-5 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-left px-4 py-3 font-medium">Recipient</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Player / Team</th>
                      <th className="text-right px-5 py-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLogs.map(log => {
                      const meta = TYPE_META[log.messageType] ?? { label: log.messageType, color: "bg-muted text-muted-foreground" };
                      return (
                        <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-5 py-3">
                            {log.status === "success"
                              ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Delivered</span>
                              : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400" title={log.errorMessage}><XCircle className="w-3.5 h-3.5" />Failed</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                          </td>
                          <td className="px-4 py-3 text-white font-mono text-xs">{log.recipientMobile}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[160px] truncate">
                            {log.playerName || log.teamName || "—"}
                          </td>
                          <td className="px-5 py-3 text-right text-muted-foreground whitespace-nowrap text-xs">
                            {new Date(log.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {filteredLogs.length > 0 && (
              <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
                Showing {filteredLogs.length} of {logs.length} message{logs.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: INBOX                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === "inbox" && (
        <div className="space-y-4">
          {/* Webhook setup card */}
          <div className="flex gap-3 p-4 bg-card rounded-xl border border-border">
            <Webhook className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm text-white font-medium">Webhook endpoint</p>
              <p className="text-xs text-muted-foreground">Point your Meta Business webhook here to capture incoming replies:</p>
              <code className="inline-block mt-1 text-xs bg-muted/40 text-emerald-400 px-2 py-1 rounded font-mono break-all">
                POST {apiConfig.baseUrl}/api/whatsapp/incoming/webhook
              </code>
              <p className="text-xs text-muted-foreground">Verify token: <code className="text-white bg-muted/30 px-1 rounded">cricbid_verify</code></p>
            </div>
          </div>

          {/* Message list */}
          {inboxLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-muted rounded" />
                      <div className="h-3 w-3/4 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : inbox.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Inbox className="w-12 h-12 mx-auto text-muted-foreground/30" />
              <p className="text-white font-medium">No incoming messages yet</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Once your Meta webhook is configured and someone replies to your WhatsApp messages, they'll appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {inbox.map(msg => (
                <button key={msg.id} onClick={() => !msg.isRead && markRead(msg.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all hover:border-border-strong ${
                    msg.isRead
                      ? "bg-card border-border"
                      : "bg-green-500/5 border-green-500/30 border-l-2 border-l-green-500"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
                      {(msg.senderName?.[0] || msg.from.slice(-2)).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm text-white truncate">
                            {msg.senderName || msg.from}
                          </span>
                          {msg.senderName && (
                            <span className="text-xs text-muted-foreground font-mono shrink-0">{msg.from}</span>
                          )}
                          {!msg.isRead && (
                            <Circle className="w-2 h-2 fill-green-500 text-green-500 shrink-0" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {new Date(msg.receivedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {msg.body || <span className="italic">[{msg.messageType} message]</span>}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor ?? "text-white"}`}>{value}</p>
    </div>
  );
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────

function TemplateCard({ template, enabled, threshold, isManual, reminderMsg, onReminderMsgChange, isSending, sendResult, onToggle, onThresholdChange, onSend }: {
  template: Template; enabled: boolean; threshold?: number; isManual: boolean;
  reminderMsg: string; onReminderMsgChange: (v: string) => void;
  isSending: boolean; sendResult?: string; onToggle: () => void;
  onThresholdChange: (v: number) => void; onSend: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-xl border transition-all ${enabled ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-start gap-4 p-4">
        <button onClick={onToggle} className={`mt-0.5 w-10 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-primary" : "bg-muted"}`}>
          <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${enabled ? "translate-x-4" : "translate-x-0"}`} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-white">{template.label}</span>
            {template.isNew && <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded font-semibold">NEW</span>}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isManual ? "bg-muted text-muted-foreground" : "bg-green-500/20 text-green-400"}`}>
              {isManual ? "Manual" : "Auto"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{template.trigger}</p>
        </div>
        <button onClick={() => setExpanded(p => !p)} className="text-muted-foreground hover:text-white mt-0.5 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          <p className="text-sm text-muted-foreground">{template.description}</p>
          <div className="text-xs text-muted-foreground"><span className="font-semibold text-white">Recipient: </span>{template.recipient}</div>
          <div className="bg-[#1a2a1a] rounded-lg p-3 border border-green-900/40">
            <p className="text-[10px] text-green-500/70 mb-1.5 font-semibold uppercase tracking-wide">WhatsApp preview</p>
            <pre className="text-xs text-green-100 whitespace-pre-wrap font-sans leading-relaxed">{template.preview}</pre>
          </div>
          {template.extraField && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{template.extraField.label}: <span className="text-white font-semibold">{threshold ?? 80}%</span></label>
              <input type="range" min={template.extraField.min} max={template.extraField.max} value={threshold ?? 80}
                onChange={e => onThresholdChange(Number(e.target.value))} className="w-full accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>{template.extraField.min}%</span><span>{template.extraField.max}%</span></div>
            </div>
          )}
          {template.key === "auctionReminder" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{"Custom message (optional — replaces {{3}})"}</label>
              <textarea rows={2} placeholder="e.g. Auction starts at 6 PM sharp." value={reminderMsg}
                onChange={e => onReminderMsgChange(e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground resize-none" />
            </div>
          )}
          {isManual && (
            <div className="flex items-center gap-3">
              <button onClick={onSend} disabled={isSending || !enabled}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition">
                {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send now
              </button>
              {sendResult && <span className={`text-xs ${sendResult.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>{sendResult}</span>}
              {!enabled && <span className="text-xs text-muted-foreground">(enable the toggle to send)</span>}
            </div>
          )}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground border-t border-border pt-3">
            <span>Meta template: <code className="text-white bg-muted/40 px-1.5 py-0.5 rounded">{template.metaTemplateName}</code></span>
            <span>·</span>
            <span>{template.metaParams.length} variables: {template.metaParams.map((p, i) => `{{${i + 1}}} ${p}`).join(", ")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Meta cheatsheet ──────────────────────────────────────────────────────────

function MetaCheatsheet() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-white hover:bg-muted/20 transition">
        <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-orange-400" />Meta Business API — templates to create / approve</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border p-5 space-y-5 text-sm">
          <p className="text-muted-foreground text-xs">
            Each template must be created and approved in your{" "}
            <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noreferrer" className="text-primary underline">Meta Business Manager</a>{" "}
            before it can be sent. Use the exact template names and variable counts listed.
          </p>
          {TEMPLATES.map(t => (
            <div key={t.key} className="space-y-2">
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted/40 text-white px-2 py-0.5 rounded">{t.metaTemplateName}</code>
                {t.isNew && <span className="text-[10px] text-orange-400 font-semibold">needs approval</span>}
              </div>
              <div className="bg-muted/20 rounded-lg p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Body text to submit:</p>
                <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{t.preview}</pre>
                {t.hasButton && <p className="text-[10px] text-muted-foreground mt-1">+ <span className="text-white">CTA Button</span> → Visit Website → URL: <code className="text-xs">{t.buttonUrl}</code></p>}
                <p className="text-[10px] text-muted-foreground pt-1 border-t border-border mt-1">Variables ({t.metaParams.length}): {t.metaParams.map((p, i) => `{{${i + 1}}} = ${p}`).join(" · ")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
