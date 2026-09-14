import { Download, IdCard, Loader2, RotateCcw, Save, ShieldCheck, Trash2, Trophy, Upload, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { GuideDefinition, SceneProps } from "../kit/types";
import { Spotlight, FakeButton, FakeInput, FakeSelect, FakeToast, WorkspaceFrame } from "../kit/primitives";
import { after, between, typed } from "../kit/timeline";
import { FEATURED_PLAYER, TEAMS, TOP_SALES, TOURNAMENT } from "@/pages/demo/demoData";
import { cn } from "@/lib/utils";

/*
 * Real-product facts this clip follows:
 * - Workspace "Data & export" (TournamentDataSection): CSV export ("Download CSV"),
 *   Player cards PDF, Auction report PDF ("Export auction report") and Google Sheets
 *   sync ("Sync database → sheet", push-only). The teams-roster PDF card is commented
 *   out in the source. All gated by features.dataExport / features.googleSheetsSync.
 * - "Backups" (TournamentBackupsSection): "Create backup" → dialog with optional label →
 *   "Save checkpoint"; rows show players / sold counts with Restore and delete;
 *   restore asks "Restore this backup?" → "Yes, restore".
 * - Squads: /team/:teamId (TeamDetail) shows "Squad Details" and "Squad (n)".
 */

const T_NAME = "Jain Unity Cup";

/** Absolute card inside the workspace main area (main's left edge is stage x=230). */
const Card = ({ top, height, title, desc, children }: { top: number; height: number; title: string; desc: string; children?: ReactNode }) => (
    <div className="absolute rounded-lg border border-border bg-card" style={{ left: 32, top, width: 940, height }}>
        <div className="px-6 pt-5">
            <p className="text-lg font-semibold leading-6">{title}</p>
            <p className="mt-1 truncate text-sm text-muted-foreground">{desc}</p>
        </div>
        {children}
    </div>
);

const Btn = ({ top, width, children, pressed, spot, variant = "primary" }: {
    top: number; width: number; children: ReactNode; pressed?: boolean; spot?: boolean; variant?: "primary" | "outline";
}) => (
    <div className="absolute" style={{ left: 24, top, width, height: 40 }}>
        <FakeButton variant={variant} pressed={pressed} className="w-full">{children}</FakeButton>
        <Spotlight show={!!spot} className="rounded-md" />
    </div>
);

const DataPage = ({ t }: SceneProps) => {
    const reportBusy = between(t, 12000, 13600);
    const syncBusy = between(t, 22000, 23600);
    return (
        <WorkspaceFrame active="Data & export" tournament={T_NAME}>
            <h1 className="text-2xl font-bold">Data &amp; Export</h1>
            <p className="mt-1 text-sm text-muted-foreground">Download data and sync with Google Sheets</p>

            <Card top={110} height={130} title="CSV export" desc="Download teams and players as CSV files. Columns match the bulk-upload import format.">
                <Btn top={78} width={170} pressed={between(t, 5400, 5800)} spot={between(t, 3800, 5500)}>
                    <Download className="h-4 w-4" /> Download CSV
                </Btn>
            </Card>
            <Card top={256} height={150} title="Player cards PDF" desc="Export players as photo cards — by team, or as the top N in each category or across the tournament.">
                <div className="absolute left-6 top-[80px] w-[330px]"><FakeSelect value="Team-wise — one section per team" /></div>
                <div className="absolute left-[370px] top-[80px]"><FakeButton variant="outline"><IdCard className="h-4 w-4" /> Export player cards</FakeButton></div>
            </Card>
            <Card top={422} height={140} title="Auction report PDF" desc="Cover page with summary stats, per-team player lists with amounts paid, and an unsold players page.">
                <Btn top={88} width={210} pressed={between(t, 11900, 12300)} spot={between(t, 10300, 12000)}>
                    {reportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />} Export auction report
                </Btn>
            </Card>
            <Card top={578} height={130} title="Google Sheets sync" desc="Push the database out to your Google Sheet. Editing players happens in the player sheet, not in Google Sheets.">
                <Btn top={78} width={210} variant="outline" pressed={between(t, 21900, 22300)} spot={between(t, 20300, 22000)}>
                    {syncBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Sync database → sheet
                </Btn>
            </Card>

            <FakeToast show={between(t, 6000, 9800)} title="Downloaded" description={`${TEAMS.length} teams and ${TOURNAMENT.playersAuctioned} players exported`} />
            <FakeToast show={between(t, 23700, 25000)} title="Sync complete" description="Database exported to Google Sheet" />

            {/* The report that lands in Downloads */}
            {between(t, 13800, 19800) && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
                    <div className="w-[560px] rounded-md bg-white p-8 text-zinc-900 shadow-2xl" style={{ opacity: Math.min(1, (t - 13800) / 400) }}>
                        <p className="text-xs uppercase tracking-widest text-zinc-500">Auction report · PDF</p>
                        <p className="mt-1 text-2xl font-black">{T_NAME}</p>
                        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                            {[["Players sold", TOURNAMENT.playersSold], ["Total spend", `${TOURNAMENT.totalSpend} Pts`], ["Total bids", TOURNAMENT.totalBids]].map(([k, v]) => (
                                <div key={k} className="rounded bg-zinc-100 p-2"><p className="text-lg font-bold">{v}</p><p className="text-[11px] text-zinc-500">{k}</p></div>
                            ))}
                        </div>
                        <p className="mt-5 text-sm font-bold">Top buys</p>
                        {TOP_SALES.slice(0, 5).map((s) => (
                            <div key={s.name} className="flex justify-between border-b border-zinc-200 py-1.5 text-sm">
                                <span>{s.name}</span><span className="text-zinc-500">{s.team}</span><span className="font-semibold">{s.price} Pts</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </WorkspaceFrame>
    );
};

const BACKUPS = [
    { label: "After auction — final squads", date: "14 Sep 2026, 10:42 pm", sold: 66, isNew: true },
    { label: "Before Round 3", date: "14 Sep 2026, 8:15 pm", sold: 41 },
    { label: "Before auction", date: "14 Sep 2026, 6:00 pm", sold: 0 },
];

const BackupsPage = ({ t }: SceneProps) => {
    const created = after(t, 33300);
    const rows = BACKUPS.filter((b) => !b.isNew || created);
    const restoreRow = created ? 1 : 0;
    return (
        <WorkspaceFrame active="Backups" tournament={T_NAME}>
            <h1 className="text-2xl font-bold">Backups</h1>
            <p className="mt-1 text-sm text-muted-foreground">Save checkpoints of the auction state and restore to any point</p>
            <div className="absolute" style={{ left: 868, top: 32, width: 150, height: 40 }}>
                <FakeButton pressed={between(t, 28900, 29300)} className="w-full"><Save className="h-4 w-4" /> Create backup</FakeButton>
                <Spotlight show={between(t, 27400, 29000)} className="rounded-md" />
            </div>

            <Card top={100} height={360} title="Checkpoints" desc="Each backup captures every player's sold status, team, and sold amount at that moment.">
                {rows.map((b, i) => (
                    <div key={b.label} className={cn("absolute flex items-center justify-between rounded-lg border px-4", b.isNew ? "border-primary/60" : "border-border")}
                        style={{ left: 24, right: 24, top: 90 + i * 80, height: 72 }}>
                        <div>
                            <p className="text-sm font-medium">{b.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{b.date}</p>
                            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {TOURNAMENT.playersAuctioned} players</span>
                                <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> {b.sold} sold</span>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <div className="relative">
                                <FakeButton variant="outline" pressed={i === restoreRow && between(t, 36900, 37300)} className="h-8 w-[96px] px-3"><RotateCcw className="h-3.5 w-3.5" /> Restore</FakeButton>
                                {i === restoreRow && <Spotlight show={between(t, 35300, 37000)} className="rounded-md" />}
                            </div>
                            <span className="flex h-8 w-9 items-center justify-center text-destructive"><Trash2 className="h-4 w-4" /></span>
                        </div>
                    </div>
                ))}
            </Card>

            {/* Create backup dialog */}
            {between(t, 29400, 33300) && (
                <div className="absolute inset-0 z-40 bg-black/70" style={{ left: -230, top: 0, width: 1280 }}>
                    <div className="absolute rounded-xl border border-border bg-card p-6" style={{ left: 440, top: 220, width: 520, height: 260 }}>
                        <p className="text-lg font-semibold">Create backup</p>
                        <FakeInput className="mt-4" label="Label (optional)" placeholder="e.g. Before Round 3, After Category A"
                            value={typed("After auction — final squads", t, 30000, 16)} focused />
                        <p className="mt-2 text-xs text-muted-foreground">Captures the current sold/unsold state of all players in this tournament.</p>
                        <div className="absolute flex gap-2" style={{ right: 24, bottom: 24 }}>
                            <FakeButton variant="outline">Cancel</FakeButton>
                            <div className="relative w-[160px]">
                                <FakeButton pressed={between(t, 32900, 33300)} className="w-full"><Save className="h-4 w-4" /> Save checkpoint</FakeButton>
                                <Spotlight show={between(t, 31800, 33000)} className="rounded-md" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Restore confirmation */}
            {between(t, 37400, 40500) && (
                <div className="absolute inset-0 z-40 bg-black/70" style={{ left: -230, top: 0, width: 1280 }}>
                    <div className="absolute rounded-xl border border-border bg-card p-6" style={{ left: 390, top: 230, width: 500, height: 250 }}>
                        <p className="text-lg font-semibold">Restore this backup?</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                            This will revert every player's sold status, team, and sold amount to the state saved in <strong className="text-foreground">Before Round 3</strong>.
                            Players added after this backup will be reset to unsold.
                        </p>
                        <div className="absolute flex gap-2" style={{ right: 24, bottom: 24 }}>
                            <FakeButton variant="outline">Cancel</FakeButton>
                            <div className="relative w-[120px]">
                                <FakeButton pressed={between(t, 39900, 40300)} className="w-full">Yes, restore</FakeButton>
                                <Spotlight show={between(t, 38700, 40000)} className="rounded-md" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <FakeToast show={between(t, 33500, 35000)} title="Backup created" description="After auction — final squads" />
            <FakeToast show={between(t, 40600, 43000)} title="Restored" description='Tournament reverted to "Before Round 3"' />
        </WorkspaceFrame>
    );
};

const SQUAD = [
    { name: FEATURED_PLAYER.name, cat: "Regular", amt: 4600, photo: FEATURED_PLAYER.photo },
    { name: "Rohit Jain", cat: "Icon", amt: 4000 },
    { name: "Aakash Bothra", cat: "Regular", amt: 2150 },
    { name: "Nikhil Kothari", cat: "Regular", amt: 1800 },
    { name: "Sagar Lodha", cat: "Regular", amt: 1500 },
    { name: "Vivek Surana", cat: "Regular", amt: 1500 },
];

const SquadPage = ({ t }: SceneProps) => {
    const team = TEAMS[0];
    return (
        <div className="absolute inset-0 bg-background p-10" style={{ opacity: Math.min(1, (t - 43000) / 400) }}>
            <div className="flex items-center gap-6 rounded-2xl border border-border bg-card p-6">
                <img src={team.logo} alt="" className="h-24 w-24 rounded-full object-cover" />
                <div className="flex-1">
                    <p className="text-5xl font-black">{team.name}</p>
                    <p className="text-xl text-muted-foreground">Squad Details</p>
                </div>
                <div className="text-right text-lg">
                    <p><span className="text-muted-foreground">Spent </span><span className="font-bold">15550 Pts</span></p>
                    <p className="text-sm text-muted-foreground">Owner: {team.owner}</p>
                </div>
            </div>
            <p className="mb-5 mt-8 text-3xl font-bold">Squad ({SQUAD.length})</p>
            <div className="grid grid-cols-3 gap-4">
                {SQUAD.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
                        style={{ opacity: Math.min(1, Math.max(0, (t - 43300 - i * 150) / 300)) }}>
                        {p.photo
                            ? <img src={p.photo} alt="" className="h-14 w-14 rounded-full object-cover" />
                            : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">{p.name[0]}</span>}
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.cat}</p>
                        </div>
                        <p className="font-bold text-primary">{p.amt} Pts</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Scene = ({ t }: SceneProps) => {
    if (t < 26500) return (
        <div className="relative h-full w-full">
            <DataPage t={t} />
            <div className="pointer-events-none absolute" style={{ left: 16, top: 560, width: 198, height: 36 }}>
                <Spotlight show={between(t, 24800, 26500)} className="rounded-md" />
            </div>
        </div>
    );
    if (t < 43000) return <BackupsPage t={t} />;
    return <SquadPage t={t} />;
};

const guide: GuideDefinition = {
    slug: "export-data",
    title: "Export results and restore backups",
    summary: "Download the players CSV, share the auction report PDF, push everything to Google Sheets, and save or restore auction checkpoints from the Backups page.",
    group: "After the auction",
    audience: "Organiser",
    url: "cricbid.online/tournament/jain-unity-cup/manage/data",
    duration: 49000,
    steps: [
        { at: 0, title: "Open Data & export", detail: "Every download for the tournament lives on this page." },
        { at: 3500, title: "Download the CSV", detail: "Teams and players, in the same columns as bulk upload." },
        { at: 10000, title: "Export the auction report", detail: "A PDF with totals and every team's buys, ready for owners." },
        { at: 20000, title: "Sync to Google Sheets", detail: "Pushes the latest database out to your linked sheet." },
        { at: 25000, title: "Create a backup", detail: "Open Backups and save a labelled checkpoint." },
        { at: 35000, title: "Restore if something goes wrong", detail: "Pick a checkpoint and confirm to roll sales back to it." },
        { at: 43000, title: "Check each team's squad", detail: "The team page lists every player bought and the amount paid." },
    ],
    cursor: [
        { at: 0, x: 700, y: 400 },
        { at: 4600, x: 371, y: 208 },
        { at: 5500, x: 371, y: 208, click: true },
        { at: 11000, x: 391, y: 530 },
        { at: 12000, x: 391, y: 530, click: true },
        { at: 21000, x: 391, y: 676 },
        { at: 22000, x: 391, y: 676, click: true },
        { at: 25600, x: 80, y: 578 },
        { at: 26400, x: 80, y: 578, click: true },
        { at: 28200, x: 1173, y: 52 },
        { at: 29000, x: 1173, y: 52, click: true },
        { at: 32200, x: 856, y: 436 },
        { at: 33000, x: 856, y: 436, click: true },
        { at: 36200, x: 1074, y: 306 },
        { at: 37000, x: 1074, y: 306, click: true },
        { at: 39200, x: 806, y: 436 },
        { at: 40000, x: 806, y: 436, click: true },
        { at: 44500, x: 1150, y: 690 },
    ],
    Scene,
};

export default guide;
