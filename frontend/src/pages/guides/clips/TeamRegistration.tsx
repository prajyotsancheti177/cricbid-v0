import { Copy, ExternalLink, Settings2, Trophy, Users, CheckCircle2 } from "lucide-react";
import type { GuideDefinition, SceneProps } from "../kit/types";
import { after, between, typed } from "../kit/timeline";
import { FakeButton, FakeInput, FakeToast, Spotlight, WorkspaceFrame } from "../kit/primitives";
import { TeamCard } from "@/components/team/TeamCard";
import { TEAMS } from "@/pages/demo/demoData";
import type { Team } from "@/types/auction";

/*
 * Real product facts this clip follows:
 * - Workspace > Registration lists "Team registration link" (/team-register/:id)
 *   when features.publicTeamRegistration is on (it defaults to on).
 * - PublicTeamRegistration asks for Team Name, Owner Name, Owner Mobile Number
 *   and a Team Logo file — all required — then "Register Team".
 * - The team is created immediately (no approval) and every team's purse is the
 *   tournament's total budget; there is no per-team budget field.
 */

const TOURNAMENT = "Jain Unity Cup";
const NEW_TEAM = TEAMS[1]; // Lumen
const BUDGET = 50000;

// Timeline (ms)
const T_COPY = 4500;
const T_PUBLIC = 8000;
const T_NAME = 9000;
const T_OWNER = 12000;
const T_MOBILE = 15500;
const T_LOGO = 19500;
const T_SUBMIT = 24500;
const T_TEAMS = 29000;
const DURATION = 36000;

const MOBILE = "9876543210";

// Stage coordinates of clicked controls
const COPY_BTN = { x: 1170, y: 480 };
const NAME_IN = { x: 500, y: 342 };
const OWNER_IN = { x: 476, y: 432 };
const MOBILE_IN = { x: 804, y: 432 };
const LOGO_IN = { x: 380, y: 522 };
const SUBMIT_BTN = { x: 640, y: 608 };

const RegistrationScreen = ({ t }: SceneProps) => {
    const link = "cricbid.online/team-register/6650c1f2a9e4b7d3c8f01a2b";
    const LinkRow = ({ label, url, top, spot }: { label: string; url: string; top: number; spot?: boolean }) => (
        <div className="absolute flex items-center justify-between gap-3 rounded-lg border border-border px-3"
            style={{ left: 64, width: 922, top, height: 60 }}>
            <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="truncate text-xs text-muted-foreground">https://{url}</p>
            </div>
            <div className="flex shrink-0 gap-1">
                <span className="relative flex h-8 w-9 items-center justify-center rounded-md hover:bg-muted">
                    <Copy className="h-4 w-4" />
                    <Spotlight show={!!spot} />
                </span>
                <span className="flex h-8 w-9 items-center justify-center rounded-md">
                    <ExternalLink className="h-4 w-4" />
                </span>
            </div>
        </div>
    );
    return (
        <WorkspaceFrame active="Registration" tournament={TOURNAMENT}>
            <div className="absolute inset-0">
                <div className="absolute" style={{ left: 40, top: 32 }}>
                    <h1 className="text-2xl font-bold">Registration</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Public sign-up form and shareable links</p>
                </div>
                <div className="absolute rounded-xl border border-border bg-card" style={{ left: 40, width: 970, top: 110, height: 150 }}>
                    <p className="absolute text-lg font-semibold" style={{ left: 24, top: 20 }}>Public form</p>
                    <p className="absolute text-sm text-muted-foreground" style={{ left: 24, top: 50 }}>Choose which fields appear on the public registration form.</p>
                    <div className="absolute" style={{ left: 24, top: 88 }}>
                        <FakeButton><Settings2 className="h-4 w-4" /> Customize registration form</FakeButton>
                    </div>
                </div>
                <div className="absolute rounded-xl border border-border bg-card" style={{ left: 40, width: 970, top: 290, height: 250 }} />
                <p className="absolute text-lg font-semibold" style={{ left: 64, top: 310 }}>Shareable links</p>
                <p className="absolute text-sm text-muted-foreground" style={{ left: 64, top: 340 }}>Send these to players and team owners to self-register.</p>
                <LinkRow label="Player registration link" url="cricbid.online/register/public/6650c1f2a9e4b7d3c8f01a2b" top={380} />
                <LinkRow label="Team registration link" url={link} top={450} spot={between(t, 3000, T_COPY + 100)} />
            </div>
            <FakeToast show={between(t, T_COPY + 100, T_PUBLIC - 200)} title="Copied!" description="Team registration link copied to clipboard" />
        </WorkspaceFrame>
    );
};

const PublicForm = ({ t }: SceneProps) => {
    const name = typed(NEW_TEAM.name, t, T_NAME + 400, 10);
    const owner = typed(NEW_TEAM.owner, t, T_OWNER + 300, 12);
    const mobile = typed(MOBILE, t, T_MOBILE + 300, 12);
    const logoPicked = after(t, T_LOGO + 900);
    const submitted = after(t, T_SUBMIT + 500);
    const field = (top: number, left: number, width: number, node: React.ReactNode) => (
        <div className="absolute" style={{ top, left, width }}>{node}</div>
    );

    return (
        <div className="relative h-full w-full bg-gradient-to-br from-background to-accent/10 text-foreground">
            <div className="absolute inset-x-0 text-center" style={{ top: 34 }}>
                <Trophy className="mx-auto h-10 w-10 text-primary" />
                <h1 className="mt-3 text-4xl font-bold">Team Registration</h1>
                <p className="mt-1 text-xl font-medium text-primary/80">{TOURNAMENT}</p>
            </div>
            <div className="absolute rounded-xl border border-border/50 bg-card/80 shadow-xl" style={{ left: 290, width: 700, top: 200, height: 470 }} />
            <p className="absolute flex items-center gap-2 text-2xl font-semibold" style={{ left: 322, top: 218 }}>
                <Users className="h-6 w-6" /> Team Details
            </p>
            <p className="absolute text-sm text-muted-foreground" style={{ left: 322, top: 254 }}>All fields are required</p>

            {submitted ? (
                <div className="absolute flex items-center justify-center gap-3 rounded-lg border border-green-500 bg-green-50 text-lg text-green-700"
                    style={{ left: 322, width: 636, top: 300, height: 110 }}>
                    <CheckCircle2 className="h-6 w-6" />
                    Registration successful! Your team has been submitted.
                </div>
            ) : (
                <>
                    {field(296, 322, 636, (
                        <div className="relative">
                            <FakeInput label="Team Name *" value={name} placeholder="Enter your team's name" focused={between(t, T_NAME, T_OWNER)} />
                            <Spotlight show={between(t, 8200, T_NAME + 100)} />
                        </div>
                    ))}
                    {field(386, 322, 308, (
                        <FakeInput label="Owner Name *" value={owner} placeholder="Enter owner's name" focused={between(t, T_OWNER, T_MOBILE)} />
                    ))}
                    {field(386, 650, 308, (
                        <FakeInput label="Owner Mobile Number *" value={mobile} placeholder="Enter mobile number" focused={between(t, T_MOBILE, T_LOGO)} />
                    ))}
                    {field(476, 322, 636, (
                        <div className="relative">
                            <span className="mb-1.5 block text-sm font-medium">Team Logo *</span>
                            <div className="flex h-11 items-center gap-3 rounded-md border border-input bg-background px-2 text-[15px]">
                                <span className="rounded bg-muted px-3 py-1 text-sm font-medium">Choose File</span>
                                {logoPicked ? (
                                    <span className="flex items-center gap-2">
                                        <img src={NEW_TEAM.logo} alt="" className="h-7 w-7 rounded-full object-cover" />
                                        lumen-logo.jpg
                                    </span>
                                ) : <span className="text-muted-foreground">No file chosen</span>}
                            </div>
                            <Spotlight show={between(t, 18700, T_LOGO + 100)} />
                        </div>
                    ))}
                    {field(580, 322, 636, (
                        <div className="relative">
                            <FakeButton pressed={between(t, T_SUBMIT, T_SUBMIT + 400)} className="h-14 w-full text-lg font-semibold tracking-wide">
                                Register Team
                            </FakeButton>
                            <Spotlight show={between(t, 23200, T_SUBMIT + 100)} />
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};

const makeTeam = (i: number, remaining: number, spent: number, players: number): Team => ({
    _id: `demo-team-${i}`,
    name: TEAMS[i].name,
    logo: TEAMS[i].logo,
    owner: { name: TEAMS[i].owner },
    remainingBudget: remaining,
    totalSpent: spent,
    maxPlayersPerTeam: 15,
    players: Array.from({ length: players }, () => ({})) as Team["players"],
});

const TeamsScreen = ({ t }: SceneProps) => {
    const existing = [makeTeam(0, BUDGET, 0, 0), makeTeam(2, BUDGET, 0, 0), makeTeam(3, BUDGET, 0, 0), makeTeam(4, BUDGET, 0, 0)];
    const all = [...existing, makeTeam(1, BUDGET, 0, 0)];
    return (
        <WorkspaceFrame active="Teams" tournament={TOURNAMENT}>
            <div className="absolute inset-0">
                <div className="absolute inset-x-0 text-center" style={{ top: 28 }}>
                    <h1 className="bg-gradient-primary bg-clip-text text-4xl font-black text-transparent">All Teams</h1>
                    <p className="mt-1 text-lg text-muted-foreground">{all.length} teams competing</p>
                </div>
                <div className="absolute grid grid-cols-3 gap-5" style={{ left: 40, width: 970, top: 130 }}>
                    {all.map((team, i) => (
                        <div key={team._id} className="relative pointer-events-none">
                            <TeamCard team={team} />
                            {i === all.length - 1 && <Spotlight show={after(t, T_TEAMS + 600)} />}
                        </div>
                    ))}
                </div>
            </div>
        </WorkspaceFrame>
    );
};

const Scene = ({ t }: SceneProps) => {
    if (t < T_PUBLIC) return <RegistrationScreen t={t} />;
    if (t < T_TEAMS) return <PublicForm t={t} />;
    return <TeamsScreen t={t} />;
};

const guide: GuideDefinition = {
    slug: "team-registration",
    title: "Register teams",
    summary: "Share the team registration link so owners sign up their own team with a name, owner details and logo — it appears under Teams straight away with the full tournament purse.",
    group: "Registration",
    audience: "Organiser",
    url: "cricbid.online/team-register/6650c1f2a9e4b7d3c8f01a2b",
    duration: DURATION,
    steps: [
        { at: 0, title: "Open Registration in your workspace", detail: "Shareable links live here while public team registration is on in Settings." },
        { at: 3000, title: "Copy the team registration link", detail: "Send it to team owners on WhatsApp or anywhere else." },
        { at: T_PUBLIC, title: "Owner fills in the team details", detail: "Team name, owner name and mobile number are all required." },
        { at: 18500, title: "Upload the team logo", detail: "Pick an image — it's compressed automatically before upload." },
        { at: 23000, title: "Click Register Team", detail: "The team is added instantly, with no approval step." },
        { at: T_TEAMS, title: "Find the new team under Teams", detail: "Every team starts with the full purse; use Bulk upload for a teams CSV." },
    ],
    cursor: [
        { at: 0, x: 700, y: 560 },
        { at: 3600, x: COPY_BTN.x, y: COPY_BTN.y },
        { at: T_COPY, x: COPY_BTN.x, y: COPY_BTN.y, click: true },
        { at: 7600, x: 900, y: 600 },
        { at: T_NAME, x: NAME_IN.x, y: NAME_IN.y, click: true },
        { at: 11400, x: OWNER_IN.x - 40, y: OWNER_IN.y - 20 },
        { at: T_OWNER, x: OWNER_IN.x, y: OWNER_IN.y, click: true },
        { at: T_MOBILE, x: MOBILE_IN.x, y: MOBILE_IN.y, click: true },
        { at: 18800, x: LOGO_IN.x, y: LOGO_IN.y - 20 },
        { at: T_LOGO, x: LOGO_IN.x, y: LOGO_IN.y, click: true },
        { at: 23600, x: SUBMIT_BTN.x, y: SUBMIT_BTN.y - 10 },
        { at: T_SUBMIT, x: SUBMIT_BTN.x, y: SUBMIT_BTN.y, click: true },
        { at: 27500, x: 760, y: 520 },
        { at: 31000, x: 520, y: 560 },
    ],
    Scene,
};

export default guide;
