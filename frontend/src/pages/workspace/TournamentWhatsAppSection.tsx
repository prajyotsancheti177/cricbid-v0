import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  MessageSquare, Send, RefreshCw, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Loader2, AlertCircle, Info,
} from "lucide-react";
import { WorkspaceTournament } from "./TournamentWorkspace";
import apiConfig from "@/config/apiConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateConfig {
  enabled: boolean;
  thresholdPercent?: number;
}

interface WhatsAppConfig {
  playerSold:        TemplateConfig;
  playerUnsold:      TemplateConfig;
  teamPurchase:      TemplateConfig;
  postAuctionPlayer: TemplateConfig;
  postAuctionOwner:  TemplateConfig;
  auctionReminder:   TemplateConfig;
  categoryStarting:  TemplateConfig;
  budgetWarning:     TemplateConfig & { thresholdPercent: number };
}

interface LogEntry {
  id: string;
  messageType: string;
  templateName: string;
  recipientMobile: string;
  playerName?: string;
  teamName?: string;
  status: "success" | "failed";
  errorMessage?: string;
  timestamp: string;
}

interface Template {
  key: keyof WhatsAppConfig;
  label: string;
  trigger: string;
  recipient: string;
  description: string;
  preview: string;
  metaTemplateName: string;
  metaParams: string[];
  hasButton?: boolean;
  buttonUrl?: string;
  isNew?: boolean;
  extraField?: { label: string; key: "thresholdPercent"; min: number; max: number };
}

// ─── Template catalogue ───────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  {
    key: "playerSold",
    label: "Player Sold",
    trigger: "Auto — when auctioneer marks SOLD",
    recipient: "Player (via their registered mobile)",
    description: "Sent to the player immediately when they are sold in the auction. Includes the team they were bought by and the final price.",
    preview: "🎉 Congratulations *{{1}}*! You've been sold to *{{2}}* for *{{3}} pts* in the *{{4}}* auction. Tap below to see the full standings.",
    metaTemplateName: "sold_message",
    metaParams: ["Player Name", "Team Name", "Amount (pts)", "Tournament Name"],
    hasButton: true,
    buttonUrl: "https://cricbid.online/tournament/{{tournamentId}}",
  },
  {
    key: "playerUnsold",
    label: "Player Unsold",
    trigger: "Auto — when auctioneer marks UNSOLD",
    recipient: "Player (via their registered mobile)",
    description: "Notifies the player they went unsold. Keeps them informed and ensures they know they may be available in a later round.",
    preview: "Hi *{{1}}*, unfortunately you went unsold in the *{{2}}* auction this round. You may be placed in the next round. Stay tuned!",
    metaTemplateName: "unsold_message",
    metaParams: ["Player Name", "Tournament Name"],
    isNew: true,
  },
  {
    key: "teamPurchase",
    label: "Team Purchase Update",
    trigger: "Auto — after every SOLD event, to the buying team's owner",
    recipient: "Team Owner (via owner mobile)",
    description: "Sent to the team owner every time they buy a player. Shows the new addition, total spend, remaining budget, and current squad.",
    preview: "Hi *{{1}}* 👋\nYou just bought *{{2}}* for *{{3}}*!\n\n📊 *Your Squad:*\nPlayers: *{{4}}*\nBudget used: *{{5}}*\nRemaining: *{{6}}*\n\nCurrent team: {{7}}",
    metaTemplateName: "team_purchase_summary",
    metaParams: ["Owner Name", "Player Bought", "Amount", "No. of Players", "Budget Used", "Budget Remaining", "Squad List"],
    hasButton: true,
    buttonUrl: "https://cricbid.online/team/{{teamId}}",
    isNew: true,
  },
  {
    key: "postAuctionPlayer",
    label: "Post-Auction Player Summary",
    trigger: "Manual — tap 'Send Now' after auction ends",
    recipient: "Every registered player",
    description: "After the auction, sends each player their result — which team bought them or that they were unsold. A nice closure message.",
    preview: "Hi *{{1}}* 🏏\nThe *{{2}}* auction has ended!\n\nYour result: *{{3}}*\n\nAll the best for the upcoming matches. View the full results at the link below.",
    metaTemplateName: "post_auction_player_summary",
    metaParams: ["Player Name", "Tournament Name", "Team Name (or UNSOLD)"],
    hasButton: true,
    buttonUrl: "https://cricbid.online/tournament/{{tournamentId}}",
    isNew: true,
  },
  {
    key: "postAuctionOwner",
    label: "Post-Auction Owner Summary",
    trigger: "Manual — tap 'Send Now' after auction ends",
    recipient: "Every team owner",
    description: "After the auction, sends each owner their complete squad list, total spend, and a motivational message for the tournament.",
    preview: "Hi *{{1}}* 🏆\nThe *{{2}}* auction for *{{3}}* is complete!\n\nYour final squad ({{4}} players):\n{{6}}\n\nTotal spent: *{{5}}*\n\nAll the best for the tournament! 🎉",
    metaTemplateName: "post_auction_owner_summary",
    metaParams: ["Owner Name", "Team Name", "Tournament Name", "Player Count", "Budget Used", "Squad List"],
    hasButton: true,
    buttonUrl: "https://cricbid.online/tournament/{{tournamentId}}",
    isNew: true,
  },
  {
    key: "auctionReminder",
    label: "Auction Day Reminder",
    trigger: "Manual — send whenever you like (typically day before / morning of)",
    recipient: "All players + all team owners",
    description: "A broadcast reminder to everyone participating — players and owners. You can add a custom message when sending.",
    preview: "Hey *{{1}}* 👋\nReminder: The *{{2}}* cricket auction is happening soon!\n\n{{3}}\n\nSee you there! 🏏",
    metaTemplateName: "auction_announcement",
    metaParams: ["Recipient Name", "Tournament Name", "Custom Message"],
    hasButton: true,
    buttonUrl: "https://cricbid.online/tournament/{{tournamentId}}",
    isNew: true,
  },
  {
    key: "categoryStarting",
    label: "Your Category Is Next",
    trigger: "Auto — when auctioneer starts a new category",
    recipient: "All unsold players in that category",
    description: "Alerts players that their category auction is starting now, so they're ready and watching.",
    preview: "🚨 Heads up *{{1}}*!\nThe *{{2}}* category auction is starting right now in the *{{3}}* tournament. Get ready!",
    metaTemplateName: "category_auction_starting",
    metaParams: ["Player Name", "Category Name", "Tournament Name"],
    isNew: true,
  },
  {
    key: "budgetWarning",
    label: "Budget Warning",
    trigger: "Auto — after a purchase when team has used ≥ threshold% of budget",
    recipient: "Team Owner",
    description: "Warns a team owner when they're running low on budget, so they bid carefully on remaining players.",
    preview: "⚠️ *{{1}}*, your team *{{2}}* has used *{{3}}%* of your budget!\n\nRemaining budget: *{{4}}*\n\nChoose your remaining picks wisely.",
    metaTemplateName: "budget_warning",
    metaParams: ["Owner Name", "Team Name", "% Used", "Remaining Budget"],
    isNew: true,
    extraField: { label: "Trigger threshold (%)", key: "thresholdPercent", min: 50, max: 95 },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: WhatsAppConfig = {
  playerSold:        { enabled: true },
  playerUnsold:      { enabled: true },
  teamPurchase:      { enabled: true },
  postAuctionPlayer: { enabled: false },
  postAuctionOwner:  { enabled: false },
  auctionReminder:   { enabled: false },
  categoryStarting:  { enabled: false },
  budgetWarning:     { enabled: false, thresholdPercent: 80 },
};

const api = (path: string, body: object) =>
  fetch(`${apiConfig.baseUrl}/api/whatsapp/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(r => r.json());

// ─── Component ────────────────────────────────────────────────────────────────

export default function TournamentWhatsAppSection() {
  const { tournament } = useOutletContext<{ tournament: WorkspaceTournament }>();
  const tournamentId = tournament._id;

  const [config, setConfig]         = useState<WhatsAppConfig>(DEFAULT_CONFIG);
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState<string | null>(null);
  const [logs, setLogs]             = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState(false);
  const [sending, setSending]       = useState<Record<string, boolean>>({});
  const [sendResult, setSendResult] = useState<Record<string, string>>({});
  const [reminderMsg, setReminderMsg] = useState("");
  const [recipientCount, setRecipientCount] = useState<{ playerCount: number; teamOwnerCount: number } | null>(null);

  // Load config + logs on mount
  useEffect(() => {
    api("config/get", { tournamentId }).then(r => {
      if (r.success && r.data) setConfig({ ...DEFAULT_CONFIG, ...r.data });
    });
    api("preview-recipients", { tournamentId }).then(r => {
      if (r.success) setRecipientCount(r.data);
    });
    fetchLogs();
  }, [tournamentId]);

  const fetchLogs = async () => {
    setLogsLoading(true);
    const r = await api("logs", { tournamentId, limit: 30 });
    if (r.success) setLogs(r.data || []);
    setLogsLoading(false);
  };

  const updateTemplate = (key: keyof WhatsAppConfig, patch: Partial<TemplateConfig>) => {
    setConfig(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const saveConfig = async () => {
    setSaving(true); setSaveMsg(null);
    const r = await api("config/save", { tournamentId, whatsappConfig: config });
    setSaveMsg(r.success ? "✓ Saved" : "✗ Save failed");
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const sendAction = async (actionKey: string, body: object, label: string) => {
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
    fetchLogs();
  };

  const totalEnabled = Object.values(config).filter(v => v.enabled).length;
  const autoCount = TEMPLATES.filter(t => !["postAuctionPlayer","postAuctionOwner","auctionReminder"].includes(t.key) && config[t.key]?.enabled).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-green-400" />
            WhatsApp Notifications
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalEnabled} template{totalEnabled !== 1 ? "s" : ""} enabled — {autoCount} trigger automatically during the auction
          </p>
        </div>
        <button
          onClick={saveConfig}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saveMsg ?? "Save changes"}
        </button>
      </div>

      {/* ── Recipient summary ───────────────────────────────────────────── */}
      {recipientCount && (
        <div className="flex gap-3 p-4 bg-card rounded-xl border border-border text-sm">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <span className="text-muted-foreground">
            This tournament has <span className="text-white font-semibold">{recipientCount.playerCount} players</span> and{" "}
            <span className="text-white font-semibold">{recipientCount.teamOwnerCount} team owners</span> with registered mobile numbers.
          </span>
        </div>
      )}

      {/* ── Template cards ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        {TEMPLATES.map(t => {
          const cfg = config[t.key] as TemplateConfig;
          const isManual = ["postAuctionPlayer", "postAuctionOwner", "auctionReminder"].includes(t.key);
          return (
            <TemplateCard
              key={t.key}
              template={t}
              enabled={cfg?.enabled ?? false}
              threshold={(cfg as any)?.thresholdPercent}
              isManual={isManual}
              reminderMsg={reminderMsg}
              onReminderMsgChange={setReminderMsg}
              isSending={!!sending[t.key]}
              sendResult={sendResult[t.key]}
              onToggle={() => updateTemplate(t.key, { enabled: !cfg?.enabled })}
              onThresholdChange={v => updateTemplate(t.key, { thresholdPercent: v })}
              onSend={() => {
                if (t.key === "auctionReminder") {
                  sendAction(t.key, { tournamentId, customMessage: reminderMsg || undefined }, t.label);
                } else {
                  const targets = t.key === "postAuctionPlayer" ? ["players"] : ["owners"];
                  sendAction(t.key, { tournamentId, targets }, t.label);
                }
              }}
            />
          );
        })}
      </div>

      {/* ── Post-auction bulk send ──────────────────────────────────────── */}
      <div className="p-5 bg-card rounded-xl border border-border space-y-3">
        <h3 className="text-sm font-semibold text-white">Send all post-auction messages at once</h3>
        <p className="text-xs text-muted-foreground">
          Sends both player results and owner squad summaries (if enabled above) in a single click.
        </p>
        <button
          onClick={() => sendAction("postAll", { tournamentId, targets: ["players", "owners"] }, "Post-auction all")}
          disabled={!!sending["postAll"]}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition"
        >
          {sending["postAll"] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send post-auction summary to everyone
        </button>
        {sendResult["postAll"] && (
          <p className={`text-sm ${sendResult["postAll"].startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
            {sendResult["postAll"]}
          </p>
        )}
      </div>

      {/* ── Delivery log ────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-white hover:bg-muted/20 transition"
          onClick={() => { setExpandedLog(p => !p); if (!expandedLog) fetchLogs(); }}
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            Recent delivery log
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <button onClick={e => { e.stopPropagation(); fetchLogs(); }} className="hover:text-white">
              <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? "animate-spin" : ""}`} />
            </button>
            {expandedLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>
        {expandedLog && (
          <div className="border-t border-border divide-y divide-border">
            {logsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : logs.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No messages sent yet.</p>
            ) : (
              logs.map(log => <LogRow key={log.id} log={log} />)
            )}
          </div>
        )}
      </div>

      {/* ── Meta template cheatsheet ────────────────────────────────────── */}
      <MetaCheatsheet />
    </div>
  );
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────

function TemplateCard({
  template, enabled, threshold, isManual, reminderMsg, onReminderMsgChange,
  isSending, sendResult, onToggle, onThresholdChange, onSend,
}: {
  template: Template;
  enabled: boolean;
  threshold?: number;
  isManual: boolean;
  reminderMsg: string;
  onReminderMsgChange: (v: string) => void;
  isSending: boolean;
  sendResult?: string;
  onToggle: () => void;
  onThresholdChange: (v: number) => void;
  onSend: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border transition-all ${enabled ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      {/* Header row */}
      <div className="flex items-start gap-4 p-4">
        {/* Toggle */}
        <button
          onClick={onToggle}
          className={`mt-0.5 w-10 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${enabled ? "translate-x-4" : "translate-x-0"}`} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-white">{template.label}</span>
            {template.isNew && (
              <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded font-semibold">NEW</span>
            )}
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

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          <p className="text-sm text-muted-foreground">{template.description}</p>
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-white">Recipient: </span>{template.recipient}
          </div>

          {/* Message preview */}
          <div className="bg-[#1a2a1a] rounded-lg p-3 border border-green-900/40">
            <p className="text-[10px] text-green-500/70 mb-1.5 font-semibold uppercase tracking-wide">WhatsApp preview</p>
            <pre className="text-xs text-green-100 whitespace-pre-wrap font-sans leading-relaxed">
              {template.preview}
            </pre>
          </div>

          {/* Threshold slider for budget warning */}
          {template.extraField && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {template.extraField.label}: <span className="text-white font-semibold">{threshold ?? 80}%</span>
              </label>
              <input
                type="range"
                min={template.extraField.min}
                max={template.extraField.max}
                value={threshold ?? 80}
                onChange={e => onThresholdChange(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{template.extraField.min}%</span>
                <span>{template.extraField.max}%</span>
              </div>
            </div>
          )}

          {/* Custom message for reminder */}
          {template.key === "auctionReminder" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{"Custom message (optional — replaces {{3}})"}</label>
              <textarea
                rows={2}
                placeholder="e.g. Auction starts at 6 PM sharp. All team owners must be present."
                value={reminderMsg}
                onChange={e => onReminderMsgChange(e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground resize-none"
              />
            </div>
          )}

          {/* Manual send button */}
          {isManual && (
            <div className="flex items-center gap-3">
              <button
                onClick={onSend}
                disabled={isSending || !enabled}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition"
              >
                {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send now
              </button>
              {sendResult && (
                <span className={`text-xs ${sendResult.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
                  {sendResult}
                </span>
              )}
              {!enabled && <span className="text-xs text-muted-foreground">(enable the toggle to send)</span>}
            </div>
          )}

          {/* Meta template name reference */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground border-t border-border pt-3 mt-1">
            <span>Meta template: <code className="text-white bg-muted/40 px-1.5 py-0.5 rounded">{template.metaTemplateName}</code></span>
            <span>·</span>
            <span>{template.metaParams.length} variable{template.metaParams.length !== 1 ? "s" : ""}: {template.metaParams.map((p, i) => `{{${i+1}}} ${p}`).join(", ")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Log row ──────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: LogEntry }) {
  const typeLabel: Record<string, string> = {
    player_sold: "Sold",
    player_unsold: "Unsold",
    team_purchase_summary: "Team purchase",
    post_auction_player: "Post-auction player",
    post_auction_owner: "Post-auction owner",
    auction_announcement: "Reminder",
    category_starting: "Category alert",
    budget_warning: "Budget warning",
    test: "Test",
  };
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 text-xs hover:bg-muted/10 transition">
      {log.status === "success"
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
        : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
      <span className="text-muted-foreground w-24 shrink-0">{typeLabel[log.messageType] ?? log.messageType}</span>
      <span className="text-white flex-1 truncate">
        {log.playerName || log.teamName || log.recipientMobile}
      </span>
      <span className="text-muted-foreground shrink-0">
        {new Date(log.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
      </span>
      {log.status === "failed" && log.errorMessage && (
        <span className="text-red-400 truncate max-w-[160px]" title={log.errorMessage}>
          {log.errorMessage}
        </span>
      )}
    </div>
  );
}

// ─── Meta cheatsheet ──────────────────────────────────────────────────────────

function MetaCheatsheet() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-white hover:bg-muted/20 transition"
      >
        <span className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-400" />
          Meta Business API — templates to create / approve
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border p-5 space-y-5 text-sm">
          <p className="text-muted-foreground text-xs">
            Each template below must be created and approved in your{" "}
            <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noreferrer" className="text-primary underline">
              Meta Business Manager
            </a>{" "}
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
                {t.hasButton && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    + <span className="text-white">CTA Button</span> → Visit Website → URL: <code className="text-xs">{t.buttonUrl}</code>
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground pt-1 border-t border-border mt-1">
                  Variables ({t.metaParams.length}): {t.metaParams.map((p, i) => `{{${i+1}}} = ${p}`).join(" · ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
