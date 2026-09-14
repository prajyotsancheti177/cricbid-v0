import type { ReactNode } from "react";
import { Download, FileSpreadsheet, UploadCloud, Upload, UserCheck, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuideDefinition, SceneProps } from "../kit/types";
import { after, between, ease, lerp, progress, typed } from "../kit/timeline";
import { FakeButton, FakeInput, FakeSelect, Spotlight, WorkspaceFrame } from "../kit/primitives";

/*
 * Part A: look-alike of pages/AddPlayer.tsx (workspace → Add player).
 * Part B: look-alike of pages/BulkUpload.tsx (workspace → Bulk upload).
 * Everything is absolutely positioned inside <main> (stage x = 230 + local x, y = local y).
 */

const T = {
    name: 3000, nameType: 3300,
    age: 5000, ageType: 5300,
    gender: 6500, genderPick: 7300,
    mobile: 8500, mobileType: 8800,
    scroll: 10500, scrollEnd: 11500,
    cat: 12000, catPick: 12800,
    skill: 13800, skillType: 14100,
    add: 17500, added: 18400,
    bulkNav: 22000,
    download: 24500,
    csv: 26000, csvEnd: 31000,
    choose: 32500, chosen: 33300,
    upload: 35000, uploaded: 36300,
    end: 41000,
};

const SCROLL = 300;
const LEFT_X = 64, RIGHT_X = 508, FIELD_W = 420;
/** Stage coords for a field centre (local top of the label block). */
const at = (col: "L" | "R", top: number, scroll = 0) => ({ x: 230 + (col === "L" ? LEFT_X : RIGHT_X) + FIELD_W / 2, y: top + 48 - scroll });

const F = { tournament: 200, name: 330, gender: 410, email: 490, category: 620, photo: 700, serial: 780, alert: 876, buttons: 932 };

const Section = ({ top, children }: { top: number; children: string }) => (
    <h3 className="absolute border-b border-border pb-2 text-lg font-semibold" style={{ top, left: LEFT_X, width: 864 }}>{children}</h3>
);
const Block = ({ col, top, full, children }: { col: "L" | "R"; top: number; full?: boolean; children: ReactNode }) => (
    <div className="absolute" style={{ top, left: col === "L" ? LEFT_X : RIGHT_X, width: full ? 864 : FIELD_W }}>{children}</div>
);

const AddPlayerPage = ({ t }: SceneProps) => {
    const scroll = lerp(0, SCROLL, ease(progress(t, T.scroll, T.scrollEnd)));
    const focus = (start: number, end: number) => between(t, start, end);
    return (
        <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-x-0 top-0" style={{ transform: `translateY(${-scroll}px)` }}>
                <div className="absolute left-0 right-0 top-4 text-center">
                    <div className="mb-1 inline-flex rounded-full bg-primary/20 p-2"><UserPlus className="h-5 w-5 text-primary" /></div>
                    <h1 className="text-3xl font-bold">Add Player</h1>
                    <p className="text-muted-foreground">Add a new player to a tournament</p>
                </div>
                <div className="absolute rounded-xl border border-border/50 bg-card/80 shadow-xl" style={{ left: 40, width: 912, top: 124, height: 880 }} />
                <div className="absolute" style={{ left: LEFT_X, top: 140 }}>
                    <p className="flex items-center gap-2 text-2xl font-semibold"><UserPlus className="h-6 w-6" /> Player Details</p>
                </div>

                <Block col="L" top={F.tournament} full>
                    <FakeSelect label="Select Tournament *" value="Jain Unity Cup" />
                </Block>

                <Section top={290}>Basic Information</Section>
                <Block col="L" top={F.name}>
                    <FakeInput label="Player Name *" placeholder="Enter player name" value={typed("Yash Choudhary", t, T.nameType)} focused={focus(T.name, T.age)} />
                    <Spotlight show={between(t, T.name - 700, T.name)} />
                </Block>
                <Block col="R" top={F.name}>
                    <FakeInput label="Age" placeholder="Enter age" value={typed("23", t, T.ageType, 8)} focused={focus(T.age, T.gender)} />
                </Block>
                <Block col="L" top={F.gender}>
                    <FakeSelect label="Gender" placeholder="Select gender" value={after(t, T.genderPick) ? "Male" : undefined}
                        open={between(t, T.gender, T.genderPick)} options={["Male", "Female", "Other"]}
                        highlighted={after(t, T.genderPick - 500) ? "Male" : undefined} />
                </Block>
                <Block col="R" top={F.gender}>
                    <FakeInput label="Mobile Number *" placeholder="10-digit mobile number" value={typed("9000000123", t, T.mobileType, 20)} focused={focus(T.mobile, T.scroll)} />
                </Block>
                <Block col="L" top={F.email} full>
                    <FakeInput label="Email" placeholder="Enter email (optional)" value="" />
                </Block>

                <Section top={580}>Cricket Details</Section>
                <Block col="L" top={F.category}>
                    <FakeSelect label="Category *" placeholder="Select category" value={after(t, T.catPick) ? "Gold" : undefined}
                        open={between(t, T.cat, T.catPick)} options={["Platinum", "Gold", "Silver", "Bronze"]}
                        highlighted={after(t, T.catPick - 500) ? "Gold" : undefined} />
                    <p className="mt-1 text-xs text-muted-foreground">Categories are loaded from the selected tournament</p>
                    <Spotlight show={between(t, T.cat - 700, T.cat)} />
                </Block>
                <Block col="R" top={F.category}>
                    <FakeInput label="Skill" placeholder="e.g., Batsman, Bowler, All-Rounder" value={typed("Bowler", t, T.skillType)} focused={focus(T.skill, T.add - 1000)} />
                </Block>
                <Block col="L" top={F.photo} full>
                    <FakeInput label="Photo URL" placeholder="Photo URL or Google Drive link (optional)" value="" />
                </Block>
                <Block col="L" top={F.serial} full>
                    <FakeInput label="Serial Number (Optional)" placeholder="Auto-generated if left blank" value="" />
                    <p className="mt-1 text-xs text-muted-foreground">To explicitly assign an auction order</p>
                    <Spotlight show={between(t, 15200, 16600)} />
                </Block>
                {after(t, T.added) && (
                    <div className="absolute rounded-lg border border-green-500 bg-green-50 px-4 py-3 text-sm text-green-700" style={{ top: F.alert, left: LEFT_X, width: 864 }}>
                        Player added successfully!
                    </div>
                )}
                <Block col="L" top={F.buttons}>
                    <FakeButton variant="outline" className="w-full">Cancel</FakeButton>
                </Block>
                <Block col="R" top={F.buttons}>
                    <div className="relative">
                        <FakeButton className="w-full" pressed={between(t, T.add, T.add + 250)}>{between(t, T.add, T.added) ? "Adding..." : "Add Player"}</FakeButton>
                        <Spotlight show={between(t, T.add - 1000, T.add)} />
                    </div>
                </Block>
            </div>
        </div>
    );
};

// ---- Bulk upload: players card at local left 506, width 450
const CARD_L = 506, CARD_W = 450;
const bulkX = 230 + CARD_L + CARD_W / 2;
const Y = { download: 234, input: 362, upload: 446 };

const CSV_ROWS = [
    ["", "Rahul Bhosale", "25", "", "Gold", "Batsman", "9000000201"],
    ["", "Ishaan Rathore", "22", "", "Silver", "Bowler", "9000000202"],
    ["", "Manav Trivedi", "28", "", "Platinum", "All-Rounder", "9000000203"],
];
const CSV_HEAD = ["Serial Number", "Player Name", "Age", "Photo URL", "Category", "Skill", "Phone Number"];

const BulkUploadPage = ({ t }: SceneProps) => {
    const done = after(t, T.uploaded);
    const shift = done ? 64 : 0;
    const fileChosen = after(t, T.chosen) && !done;
    const card = (left: number, icon: ReactNode, title: string, noun: string, active: boolean) => (
        <div className="absolute rounded-xl border border-border bg-card p-6 transition-[top] duration-300" style={{ left, width: CARD_W, top: 110 + shift, height: 600 }}>
            <div className="flex items-center gap-3">{icon}<h2 className="text-2xl font-bold">{title}</h2></div>
            <div className="absolute inset-x-6" style={{ top: 72 }}>
                <h3 className="mb-2 font-semibold">Step 1: Download Sample</h3>
                <div className="relative">
                    <FakeButton variant="outline" className="w-full" pressed={active && between(t, T.download, T.download + 250)}><Download className="h-4 w-4" /> Download {noun} Sample CSV</FakeButton>
                    {active && <Spotlight show={between(t, T.download - 1000, T.download)} />}
                </div>
                <div className="mt-4 border-t border-border pt-4">
                    <h3 className="mb-2 font-semibold">Step 2: Upload Filled CSV</h3>
                    <p className="text-sm font-medium">Select {noun} CSV File</p>
                    <div className="relative mt-1 flex h-10 items-center gap-3 rounded-md border border-input px-3 text-sm">
                        <span className="font-medium">Choose File</span>
                        <span className="text-muted-foreground">{active && fileChosen ? "jain-unity-cup-players.csv" : "No file chosen"}</span>
                        {active && <Spotlight show={between(t, T.choose - 1000, T.choose)} />}
                    </div>
                    <div className="flex h-6 items-center gap-2 pt-3 text-sm text-muted-foreground">
                        {active && fileChosen && <><FileSpreadsheet className="h-4 w-4" /> jain-unity-cup-players.csv</>}
                    </div>
                    <div className="relative mt-4">
                        <FakeButton className={cn("w-full", !(active && fileChosen) && "opacity-50")} pressed={active && between(t, T.upload, T.upload + 250)}>
                            <Upload className="h-4 w-4" /> {active && between(t, T.upload, T.uploaded) ? "Uploading..." : `Upload ${noun}`}
                        </FakeButton>
                        {active && <Spotlight show={between(t, T.upload - 1000, T.upload)} />}
                    </div>
                </div>
                <div className="mt-4 border-t border-border pt-4">
                    <h4 className="mb-2 text-sm font-semibold">CSV Format:</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                        {(active
                            ? ["Serial Number (optional)", "Player Name", "Age", "Photo URL (Google Drive link)", "Category", "Skill (e.g., Batsman, Bowler, All-Rounder)"]
                            : ["Team Name", "Team Logo URL (Google Drive link)", "Owner Name", "Owner Contact Number"]
                        ).map((l) => <li key={l}>• {l}</li>)}
                    </ul>
                </div>
            </div>
        </div>
    );

    return (
        <div className="absolute inset-0 overflow-hidden">
            <div className="absolute left-8 top-5">
                <h1 className="mb-2 text-3xl font-bold">Bulk Upload</h1>
                <p className="text-muted-foreground">Download sample CSV files, fill in your data, and upload to quickly add teams and players</p>
            </div>
            {done && (
                <div className="absolute left-8 rounded-lg border border-green-500 bg-green-50 px-4 py-3 text-sm text-green-900" style={{ top: 110, width: 924 }}>
                    Successfully processed 24 players!
                </div>
            )}
            {card(32, <Users className="h-6 w-6 text-primary" />, "Teams", "Teams", false)}
            {card(CARD_L, <UserCheck className="h-6 w-6 text-primary" />, "Players", "Players", true)}

            {/* downloaded file chip */}
            {between(t, T.download + 300, T.csv) && (
                <div className="absolute bottom-24 right-8 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-2xl">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> players_sample.csv downloaded
                </div>
            )}

            {/* filling the sheet in a spreadsheet app */}
            {between(t, T.csv, T.csvEnd) && (
                <div className="absolute left-8 top-[150px] z-30 w-[930px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                    <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2 text-sm font-semibold">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> jain-unity-cup-players.csv
                    </div>
                    <div className="grid text-[13px]" style={{ gridTemplateColumns: "110px 170px 60px 110px 110px 130px 1fr" }}>
                        {CSV_HEAD.map((h) => <div key={h} className="border-b border-r border-border bg-muted/40 px-2 py-2 font-semibold">{h}</div>)}
                        {CSV_ROWS.map((row, ri) => row.map((cell, ci) => {
                            const start = T.csv + 600 + ri * 1400 + ci * 180;
                            return <div key={`${ri}-${ci}`} className="h-9 border-b border-r border-border px-2 py-2">{typed(cell, t, start, 40)}</div>;
                        }))}
                        {["…"].concat(Array(6).fill("")).map((c, i) => <div key={i} className="h-9 border-r border-border px-2 py-2 text-muted-foreground">{c}</div>)}
                    </div>
                </div>
            )}
        </div>
    );
};

const Scene = ({ t }: SceneProps) => {
    const bulk = after(t, T.bulkNav);
    return (
        <WorkspaceFrame active={bulk ? "Bulk upload" : "Add player"}>
            {bulk ? <BulkUploadPage t={t} /> : <AddPlayerPage t={t} />}
            {bulk && after(t, T.uploaded) && (
                <div className="absolute bottom-24 right-8 flex items-center gap-2 text-sm text-muted-foreground">
                    <UploadCloud className="h-4 w-4" /> New players created · existing names updated
                </div>
            )}
        </WorkspaceFrame>
    );
};

// Sidebar items in WorkspaceFrame: nav starts ~y=80, 36px items + 4px gap.
const sidebar = (i: number) => ({ x: 110, y: 80 + i * 40 + 18 });

const nameC = at("L", F.name), ageC = at("R", F.name), genderC = at("L", F.gender), mobileC = at("R", F.gender);
const catC = at("L", F.category, SCROLL), skillC = at("R", F.category, SCROLL), addC = { x: at("R", 0).x, y: F.buttons + 20 - SCROLL };
const genderOpt = { x: genderC.x, y: genderC.y + 22 + 4 + 4 + 19 };
const goldOpt = { x: catC.x, y: catC.y + 22 + 4 + 4 + 19 + 38 };

const guide: GuideDefinition = {
    slug: "add-players",
    title: "Add players by hand or in bulk",
    summary: "Add a single player with the Add player form, or fill the sample CSV and upload a whole list at once from Bulk upload.",
    group: "Setup",
    audience: "Organiser",
    url: "cricbid.online/tournament/jain-unity-cup/manage/add-player",
    duration: T.end,
    steps: [
        { at: 0, title: "Open Add player", detail: "It's in the tournament sidebar, for one player at a time." },
        { at: 2500, title: "Fill in the player's details", detail: "Name and mobile number are required." },
        { at: 10500, title: "Pick the category and skill", detail: "Leave the serial number blank and it's numbered for you." },
        { at: 16500, title: "Click Add Player", detail: "The player joins the tournament straight away." },
        { at: 20500, title: "Got a long list? Open Bulk upload", detail: "Add dozens of players from one spreadsheet." },
        { at: 23500, title: "Download the players sample CSV", detail: "Fill it in without renaming the columns." },
        { at: 31500, title: "Choose the file and click Upload Players", detail: "Players with a name already in the tournament are updated, not duplicated." },
        { at: 36300, title: "Your players are in", detail: "Check them in the Player sheet before the auction." },
    ],
    cursor: [
        { at: 0, x: 700, y: 500 },
        { at: 900, x: sidebar(4).x, y: sidebar(4).y },
        { at: 2400, x: sidebar(4).x, y: sidebar(4).y },
        { at: T.name - 400, x: nameC.x, y: nameC.y },
        { at: T.name, x: nameC.x, y: nameC.y, click: true },
        { at: T.age - 400, x: ageC.x, y: ageC.y },
        { at: T.age, x: ageC.x, y: ageC.y, click: true },
        { at: T.gender - 400, x: genderC.x, y: genderC.y },
        { at: T.gender, x: genderC.x, y: genderC.y, click: true },
        { at: T.genderPick - 400, x: genderOpt.x, y: genderOpt.y },
        { at: T.genderPick, x: genderOpt.x, y: genderOpt.y, click: true },
        { at: T.mobile - 400, x: mobileC.x, y: mobileC.y },
        { at: T.mobile, x: mobileC.x, y: mobileC.y, click: true },
        { at: T.cat - 400, x: catC.x, y: catC.y },
        { at: T.cat, x: catC.x, y: catC.y, click: true },
        { at: T.catPick - 400, x: goldOpt.x, y: goldOpt.y },
        { at: T.catPick, x: goldOpt.x, y: goldOpt.y, click: true },
        { at: T.skill - 400, x: skillC.x, y: skillC.y },
        { at: T.skill, x: skillC.x, y: skillC.y, click: true },
        { at: 16000, x: addC.x, y: addC.y },
        { at: T.add, x: addC.x, y: addC.y, click: true },
        { at: 21000, x: sidebar(5).x, y: sidebar(5).y },
        { at: T.bulkNav, x: sidebar(5).x, y: sidebar(5).y, click: true },
        { at: 23800, x: bulkX, y: Y.download },
        { at: T.download, x: bulkX, y: Y.download, click: true },
        { at: T.csv, x: 700, y: 560 },
        { at: 31800, x: bulkX, y: Y.input },
        { at: T.choose, x: bulkX, y: Y.input, click: true },
        { at: 34200, x: bulkX, y: Y.upload },
        { at: T.upload, x: bulkX, y: Y.upload, click: true },
        { at: T.end, x: 760, y: 600 },
    ],
    Scene,
};

export default guide;
