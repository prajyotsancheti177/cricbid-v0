import type { ReactNode } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Image as ImageIcon, Loader2, Plus, QrCode, Settings2, Trash2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuideDefinition, SceneProps } from "../kit/types";
import { after, between, ease, progress, typed } from "../kit/timeline";
import { FakeSwitch, FakeToast, Spotlight, WorkspaceFrame } from "../kit/primitives";

/**
 * Organiser builds the public player registration form.
 *
 * Look-alike of RegistrationConfigDialog (components/auction/RegistrationConfigDialog.tsx)
 * opened from the workspace Registration section. Labels, headings, column
 * names and select options are copied from the real JSX. Everything is laid
 * out on fixed stage pixels so the cursor keys below land on real controls.
 */

// ── Timeline (ms) ─────────────────────────────────────────────
const T = {
    openClick: 2000,
    dialog: 2200,
    scrollFields: [4800, 5800] as const,
    photoReq: 7200,
    emailOpen: 9000,
    emailPick: 10200,
    scrollCustom: [11000, 12000] as const,
    addField: 12800,
    labelClick: 13800,
    labelType: 14000,
    typeOpen: 15600,
    typePick: 16600,
    optClick1: 17600,
    optType1: 17800,
    optAdd1: 18900,
    optClick2: 19500,
    optType2: 19700,
    optAdd2: 21000,
    cfRequired: 22000,
    scrollPay: [23000, 24000] as const,
    payOn: 24800,
    qrClick: 26000,
    qrShown: 26500,
    textClick: 27400,
    textType: 27600,
    scrollProof: [30400, 31400] as const,
    proofOn: 32200,
    save: 34200,
    close: 34700,
    copy: 36000,
    end: 40500,
};

const PAY_TEXT = "Registration fee ₹500. Scan the QR to pay, then upload the screenshot below.";
const LINK = "https://cricbid.online/register/public/cm8x2k1vq0001jain";

// Dialog geometry (stage px).
const DLG = { left: 250, top: 24, width: 1004, height: 700 };
const BODY_TOP = 110; // stage y where scrollable body starts
const BODY_H = 550;
const CX = 274; // content left

const scrollAt = (t: number) => {
    const segs: [readonly [number, number], number, number][] = [
        [T.scrollFields, 0, 250],
        [T.scrollCustom, 250, 820],
        [T.scrollPay, 820, 1160],
        [T.scrollProof, 1160, 1500],
    ];
    let s = 0;
    for (const [[a, b], from, to] of segs) {
        if (t >= a) s = from + (to - from) * ease(progress(t, a, b));
    }
    return s;
};

const spot = (t: number, at: number) => between(t, at - 900, at + 150);

// ── Small look-alike controls sized like the dialog's h-8 inputs ──
const MiniInput = ({ value, placeholder, focused, className }: { value: string; placeholder?: string; focused?: boolean; className?: string }) => (
    <div className={cn("flex h-8 items-center rounded-md border bg-background px-3 text-sm", focused ? "border-primary ring-2 ring-primary/30" : "border-input", className)}>
        <span className={cn("truncate", value ? "text-foreground" : "text-muted-foreground")}>{value || placeholder}</span>
        {focused && <span className="ml-0.5 h-4 w-[2px] animate-pulse bg-primary" />}
    </div>
);

const MiniSelect = ({ value, open, options, highlighted, disabled, className }: {
    value: string; open?: boolean; options?: string[]; highlighted?: string; disabled?: boolean; className?: string;
}) => (
    <div className={cn("relative", className)}>
        <div className={cn("flex h-8 items-center justify-between rounded-md border bg-background px-3 text-sm", open ? "border-primary ring-2 ring-primary/30" : "border-input", disabled && "opacity-50")}>
            <span className="truncate capitalize">{value}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
        </div>
        {open && options && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover p-1 shadow-xl">
                {options.map((o) => (
                    <div key={o} className={cn("flex h-[30px] items-center justify-between rounded px-2 text-sm capitalize", o === highlighted ? "bg-primary/15 text-foreground" : "text-muted-foreground")}>
                        {o}
                        {o === value && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                ))}
            </div>
        )}
    </div>
);

/** Deterministic QR-looking pattern (not a scannable code). */
export const QrArt = ({ size }: { size: number }) => {
    const n = 25;
    const cells: ReactNode[] = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const finder = (x: number, y: number) => x < 7 && y < 7 || x >= n - 7 && y < 7 || x < 7 && y >= n - 7;
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const v = rnd();
            if (finder(x, y)) continue;
            if (v > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
        }
    }
    const eye = (x: number, y: number) => (
        <g key={`e${x}${y}`}>
            <rect x={x} y={y} width={7} height={7} />
            <rect x={x + 1} y={y + 1} width={5} height={5} fill="white" />
            <rect x={x + 2} y={y + 2} width={3} height={3} />
        </g>
    );
    return (
        <svg width={size} height={size} viewBox={`-1 -1 ${n + 2} ${n + 2}`} shapeRendering="crispEdges" className="bg-white">
            <g fill="#111">{cells}{eye(0, 0)}{eye(n - 7, 0)}{eye(0, n - 7)}</g>
        </svg>
    );
};

const STANDARD: { key: string; name: string; label: string; required: boolean }[] = [
    { key: "age", name: "Age", label: "Age", required: true },
    { key: "gender", name: "Gender", label: "Gender", required: true },
    { key: "photo", name: "Photo", label: "Photo", required: false },
    { key: "skill", name: "Skill", label: "Skill", required: true },
    { key: "mobile", name: "Mobile", label: "Mobile Number", required: true },
    { key: "email", name: "Email", label: "Email Address", required: true },
    { key: "address", name: "Address", label: "Address", required: false },
    { key: "playerCategory", name: "Player Category", label: "Player Category", required: true },
];
const FIELD_ROW0 = 334;
const FIELD_STEP = 66;

const Abs = ({ top, left = 0, width, height, children, className }: { top: number; left?: number; width?: number; height?: number; children: ReactNode; className?: string }) => (
    <div className={cn("absolute", className)} style={{ top, left, width, height }}>{children}</div>
);

const Dialog = ({ t }: { t: number }) => {
    const S = scrollAt(t);
    const photoRequired = after(t, T.photoReq + 100);
    const emailOpen = between(t, T.emailOpen + 100, T.emailPick + 100);
    const emailDisabled = after(t, T.emailPick + 100);

    const hasField = after(t, T.addField + 100);
    const labelFocused = between(t, T.labelClick, T.typeOpen);
    const label = after(t, T.labelClick + 100) ? typed("Batting style", t, T.labelType) : "New Custom Field";
    const typeOpen = between(t, T.typeOpen + 100, T.typePick + 100);
    const isDropdown = after(t, T.typePick + 100);
    const options = [
        ...(after(t, T.optAdd1 + 100) ? ["Right hand"] : []),
        ...(after(t, T.optAdd2 + 100) ? ["Left hand"] : []),
    ];
    const optDraft = between(t, T.optClick1, T.optAdd1 + 100) ? typed("Right hand", t, T.optType1)
        : between(t, T.optClick2, T.optAdd2 + 100) ? typed("Left hand", t, T.optType2) : "";
    const optFocused = between(t, T.optClick1, T.optAdd1 + 100) || between(t, T.optClick2, T.optAdd2 + 100);
    const cfRequired = after(t, T.cfRequired + 100);

    const payOn = after(t, T.payOn + 100);
    const qrUploading = between(t, T.qrClick + 100, T.qrShown);
    const qrShown = after(t, T.qrShown);
    const textFocused = between(t, T.textClick, T.scrollProof[0]);
    const payText = after(t, T.textClick) ? typed(PAY_TEXT, t, T.textType, 32) : "";
    const proofOn = after(t, T.proofOn + 100);

    // stage-y → body-content y helper is BODY_TOP + top - S.
    return (
        <div className="absolute inset-0 z-40 bg-black/70">
            <div className="absolute rounded-xl border border-border bg-card shadow-2xl"
                style={{ left: DLG.left, top: DLG.top, width: DLG.width, height: DLG.height }}>
                <div className="px-6 pt-5">
                    <h3 className="text-lg font-semibold">Customize Registration Form - Jain Unity Cup</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Configure what fields are shown and required for publicly registered players.</p>
                </div>
            </div>

            {/* Scrollable body */}
            <div className="absolute overflow-hidden" style={{ left: DLG.left, top: BODY_TOP, width: DLG.width, height: BODY_H }}>
                <div className="absolute left-0 top-0 w-full" style={{ transform: `translateY(${-S}px)` }}>
                    <div className="relative" style={{ marginLeft: CX - DLG.left, width: 956, height: 1900 }}>
                        {/* Enable Public Registration */}
                        <Abs top={0} width={956} height={76} className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
                            <div>
                                <h4 className="text-lg font-medium">Enable Public Registration</h4>
                                <p className="text-sm text-muted-foreground">Allow players to self-register via link</p>
                            </div>
                            <span className="relative"><FakeSwitch on /><Spotlight show={between(t, 2800, 4600)} /></span>
                        </Abs>
                        <Abs top={92} width={956} height={96} className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                            <span className="text-sm font-medium">Public Link</span>
                            <div className="flex gap-2">
                                <MiniInput value={LINK} className="h-9 flex-1 font-mono text-xs" />
                                <span className="flex h-9 w-9 items-center justify-center rounded-md border"><Copy className="h-4 w-4" /></span>
                                <span className="flex h-9 w-9 items-center justify-center rounded-md border"><ExternalLink className="h-4 w-4" /></span>
                            </div>
                        </Abs>

                        {/* Standard fields */}
                        <Abs top={210} width={956}><h4 className="border-b pb-2 font-semibold">Standard Field Configuration</h4></Abs>
                        <div className="absolute left-3 grid text-sm font-medium opacity-70" style={{ top: 252, gridTemplateColumns: "300px 16px 200px 16px 300px 16px 84px" }}>
                            <span>Field Base</span><span /><span>Label Override</span><span /><span>Visibility</span><span /><span className="text-center">Required</span>
                        </div>
                        <Abs top={280} width={956} height={44} className="rounded bg-muted/20">
                            <div className="absolute left-3 top-1.5 grid items-center" style={{ gridTemplateColumns: "300px 16px 200px 16px 300px 16px 84px" }}>
                                <span className="font-medium">Name <span className="text-xs text-muted-foreground">(always)</span></span><span />
                                <MiniInput value="Full Name" className="opacity-50" /><span />
                                <MiniSelect value="Public" disabled /><span />
                                <span className="flex justify-center opacity-50"><FakeSwitch on /></span>
                            </div>
                        </Abs>
                        {STANDARD.map((f, i) => {
                            const isPhoto = f.key === "photo";
                            const isEmail = f.key === "email";
                            const req = isPhoto ? photoRequired : isEmail ? f.required && !emailDisabled : f.required;
                            const vis = isEmail && emailDisabled ? "Disabled" : "Public & Editable";
                            return (
                                <Abs key={f.key} top={FIELD_ROW0 + i * FIELD_STEP} width={956} height={56}
                                    className={cn("rounded-lg border bg-card shadow-sm", isEmail && emailOpen && "z-20")}>
                                    <div className="absolute left-3 top-3 grid items-center" style={{ gridTemplateColumns: "300px 16px 200px 16px 300px 16px 84px" }}>
                                        <span className="font-medium">{f.name}</span><span />
                                        <MiniInput value={f.label} /><span />
                                        <div className="relative">
                                            <MiniSelect value={vis} open={isEmail && emailOpen}
                                                options={["Public & Editable", "Hidden w/ Default", "Disabled"]}
                                                highlighted={t > T.emailPick - 500 ? "Disabled" : "Public & Editable"} />
                                            {isEmail && <Spotlight show={spot(t, T.emailOpen)} />}
                                        </div>
                                        <span />
                                        <span className="relative flex justify-center">
                                            <span className={cn(isEmail && emailDisabled && "opacity-40")}><FakeSwitch on={req} /></span>
                                            {isPhoto && <Spotlight show={spot(t, T.photoReq)} className="-inset-x-3" />}
                                        </span>
                                    </div>
                                </Abs>
                            );
                        })}

                        {/* Custom fields */}
                        <Abs top={880} width={956} height={36} className="flex items-center justify-between">
                            <h4 className="font-semibold">Custom Fields</h4>
                            <span className="relative inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium">
                                <Plus className="mr-1 h-4 w-4" /> Add Field
                                <Spotlight show={spot(t, T.addField)} />
                            </span>
                        </Abs>
                        {!hasField ? (
                            <Abs top={930} width={956} height={56} className="flex items-center justify-center rounded border border-dashed bg-muted/20 text-sm text-muted-foreground">
                                No custom fields added yet.
                            </Abs>
                        ) : (
                            <>
                                <div className="absolute left-3 grid text-sm font-medium opacity-70" style={{ top: 932, gridTemplateColumns: "270px 16px 180px 16px 270px 16px 78px 16px 70px" }}>
                                    <span>Field Label</span><span /><span>Type</span><span /><span>Visibility</span><span /><span className="text-center">Required</span><span /><span className="text-center">Action</span>
                                </div>
                                <Abs top={960} width={956} height={isDropdown ? 164 : 56} className="z-20 rounded-lg border bg-card shadow-sm">
                                    <div className="absolute left-3 top-3 grid items-center" style={{ gridTemplateColumns: "270px 16px 180px 16px 270px 16px 78px 16px 70px" }}>
                                        <div className="relative">
                                            <MiniInput value={label} focused={labelFocused} className={cn("font-medium", labelFocused && label === "" && "text-muted-foreground")} />
                                            <Spotlight show={spot(t, T.labelClick)} />
                                        </div>
                                        <span />
                                        <div className="relative">
                                            <MiniSelect value={isDropdown ? "dropdown" : "text"} open={typeOpen}
                                                options={["text", "number", "textarea", "dropdown", "checkbox", "file"]}
                                                highlighted={t > T.typePick - 500 ? "dropdown" : "text"} />
                                            <Spotlight show={spot(t, T.typeOpen)} />
                                        </div>
                                        <span />
                                        <MiniSelect value="Public" />
                                        <span />
                                        <span className="relative flex justify-center"><FakeSwitch on={cfRequired} /><Spotlight show={spot(t, T.cfRequired)} className="-inset-x-2" /></span>
                                        <span />
                                        <span className="flex justify-center text-destructive"><Trash2 className="h-4 w-4" /></span>
                                    </div>
                                    {isDropdown && (
                                        <div className="absolute left-3 right-3 border-l-2 border-primary/20 pl-4" style={{ top: 56 }}>
                                            <span className="block text-xs text-muted-foreground">Dropdown Options</span>
                                            <div className="mt-1.5 flex h-7 flex-wrap gap-1.5">
                                                {options.map((o) => (
                                                    <span key={o} className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                                        {o} <span className="ml-0.5">×</span>
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="mt-2 flex gap-2">
                                                <div className="relative" style={{ width: 800 }}>
                                                    <MiniInput value={optDraft} placeholder="Type an option..." focused={optFocused} className="bg-muted/30" />
                                                    <Spotlight show={spot(t, T.optClick1) || spot(t, T.optClick2)} />
                                                </div>
                                                <span className="relative inline-flex h-8 w-20 items-center justify-center rounded-md border border-input bg-background text-xs font-medium">
                                                    <Plus className="mr-1 h-3 w-3" /> Add
                                                    <Spotlight show={spot(t, T.optAdd1) || spot(t, T.optAdd2)} />
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </Abs>
                            </>
                        )}

                        {/* Payment */}
                        <Abs top={1150} width={956}><h4 className="flex items-center gap-2 border-b pb-2 font-semibold"><QrCode className="h-4 w-4" /> Payment (optional)</h4></Abs>
                        <Abs top={1190} width={956} height={payOn ? 480 : 80} className="rounded-lg border bg-muted/50" >
                            <div className="flex h-20 items-center justify-between px-4">
                                <div className="pr-4">
                                    <h4 className="font-medium">Show a payment panel on the form</h4>
                                    <p className="text-sm text-muted-foreground">Display a QR code and/or a UPI link so players can pay the registration fee while filling the form.</p>
                                </div>
                                <span className="relative"><FakeSwitch on={payOn} /><Spotlight show={spot(t, T.payOn)} /></span>
                            </div>
                        </Abs>
                        {payOn && (
                            <>
                                <Abs top={1290} left={16} width={924}>
                                    <span className="text-sm font-medium">Payment method</span>
                                    <MiniSelect value="QR code only" className="mt-2 [&>div]:h-10" />
                                </Abs>
                                <Abs top={1374} left={16} width={924}>
                                    <span className="text-sm font-medium">QR code image</span>
                                </Abs>
                                <Abs top={1398} left={16} width={924} height={qrShown ? 130 : 100}>
                                    {qrShown ? (
                                        <div className="flex items-start gap-3">
                                            <div className="rounded-lg border bg-white p-1"><QrArt size={120} /></div>
                                            <div className="flex flex-col gap-2">
                                                <span className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"><UploadCloud className="h-4 w-4" /> Replace</span>
                                                <span className="inline-flex items-center px-2 text-sm text-destructive"><X className="mr-1 h-4 w-4" /> Remove</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground">
                                            {qrUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
                                            <span className="text-sm">Upload a QR screenshot (PhonePe / GPay / UPI)</span>
                                            <Spotlight show={spot(t, T.qrClick)} />
                                        </div>
                                    )}
                                </Abs>
                                <Abs top={1548} left={16} width={924}>
                                    <span className="text-sm font-medium">Payment instructions (optional)</span>
                                </Abs>
                                <Abs top={1572} left={16} width={924} height={80}
                                    className={cn("rounded-md border bg-background px-3 py-2 text-sm", textFocused ? "border-primary ring-2 ring-primary/30" : "border-input")}>
                                    {payText ? <span>{payText}</span> : <span className="text-muted-foreground">e.g. Registration fee ₹500. Scan the QR to pay, then submit the form. Mention your name in the payment note.</span>}
                                    {textFocused && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle" />}
                                    <Spotlight show={spot(t, T.textClick)} />
                                </Abs>
                            </>
                        )}

                        {/* Payment proof */}
                        <Abs top={1690} width={956}><h4 className="flex items-center gap-2 border-b pb-2 font-semibold"><ImageIcon className="h-4 w-4" /> Payment proof</h4></Abs>
                        <Abs top={1730} width={956} height={proofOn ? 170 : 84} className="rounded-lg border bg-muted/50 px-4">
                            <div className="flex h-[84px] items-center justify-between">
                                <div className="pr-4">
                                    <h4 className="font-medium">Ask players for a payment screenshot</h4>
                                    <p className="text-sm text-muted-foreground">Adds a "Payment Screenshot" upload to the registration form. The uploaded image comes through as a column in the Google Sheet export.</p>
                                </div>
                                <span className="relative"><FakeSwitch on={proofOn} /><Spotlight show={spot(t, T.proofOn)} /></span>
                            </div>
                            {proofOn && (
                                <div className="flex items-center justify-between border-t pt-3">
                                    <div className="pr-4">
                                        <h4 className="font-medium">Make the screenshot compulsory</h4>
                                        <p className="text-sm text-muted-foreground">On: players cannot submit the form without uploading proof of payment.</p>
                                    </div>
                                    <FakeSwitch on />
                                </div>
                            )}
                        </Abs>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute flex justify-end gap-2 border-t border-border pt-3" style={{ left: DLG.left + 24, top: 662, width: DLG.width - 48 }}>
                <span className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium">Cancel</span>
                <span className={cn("relative inline-flex h-9 w-[130px] items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground", between(t, T.save, T.save + 250) && "scale-95")}>
                    Save Configuration
                    <Spotlight show={spot(t, T.save)} />
                </span>
            </div>
        </div>
    );
};

const Section = ({ t }: { t: number }) => {
    const copied = after(t, T.copy + 100);
    return (
        <div className="absolute inset-0">
            <div className="absolute" style={{ left: 262, top: 32 }}>
                <h1 className="text-2xl font-bold">Registration</h1>
                <p className="mt-1 text-sm text-muted-foreground">Public sign-up form and shareable links</p>
            </div>
            <div className="absolute rounded-lg border border-border bg-card p-6" style={{ left: 262, top: 104, width: 986, height: 140 }}>
                <p className="text-lg font-semibold">Public form</p>
                <p className="text-sm text-muted-foreground">Choose which fields appear on the public registration form.</p>
                <span className={cn("absolute inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground", between(t, T.openClick, T.openClick + 250) && "scale-95")}
                    style={{ left: 24, top: 80, width: 234 }}>
                    <Settings2 className="h-4 w-4" /> Customize registration form
                    <Spotlight show={spot(t, T.openClick)} />
                </span>
            </div>
            <div className="absolute rounded-lg border border-border bg-card p-6" style={{ left: 262, top: 260, width: 986, height: 228 }}>
                <p className="text-lg font-semibold">Shareable links</p>
                <p className="text-sm text-muted-foreground">Send these to players and team owners to self-register.</p>
                {[
                    { label: "Player registration link", link: LINK, top: 84 },
                    { label: "Team registration link", link: "https://cricbid.online/team-register/cm8x2k1vq0001jain", top: 148 },
                ].map((r, i) => (
                    <div key={r.label} className={cn("absolute flex items-center justify-between rounded-lg border px-3", i === 0 && copied ? "border-primary bg-primary/5" : "border-border")}
                        style={{ left: 24, top: r.top, width: 938, height: 56 }}>
                        <div className="min-w-0">
                            <p className="text-sm font-medium">{r.label}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.link}</p>
                        </div>
                        <div className="flex gap-1">
                            <span className="relative flex h-9 w-9 items-center justify-center rounded-md">
                                {i === 0 && copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                                {i === 0 && <Spotlight show={spot(t, T.copy)} />}
                            </span>
                            <span className="flex h-9 w-9 items-center justify-center rounded-md"><ExternalLink className="h-4 w-4" /></span>
                        </div>
                    </div>
                ))}
            </div>
            {copied && (
                <div className="absolute rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-sm" style={{ left: 262, top: 510, width: 986 }}>
                    <p className="font-semibold">Share it in your WhatsApp group</p>
                    <p className="mt-1 text-muted-foreground">Players open the link on their phone, fill the form, pay using your QR and upload the screenshot. Each sign-up lands in Players.</p>
                </div>
            )}
        </div>
    );
};

const Scene = ({ t }: SceneProps) => {
    const dialogOpen = between(t, T.dialog, T.close);
    return (
        <div className="relative h-full w-full">
            <WorkspaceFrame active="Registration"><span /></WorkspaceFrame>
            <Section t={t} />
            {dialogOpen && <Dialog t={t} />}
            <FakeToast show={between(t, T.save + 100, T.copy)} title="Success" description="Registration configuration saved." />
            <FakeToast show={after(t, T.copy + 100)} title="Copied!" description="Player registration link copied to clipboard" />
        </div>
    );
};

// ── Stage coordinates of the controls (derived from the layout above) ──
const y = (contentTop: number, S: number) => BODY_TOP + contentTop - S;

const guide: GuideDefinition = {
    slug: "registration-form",
    title: "Build the player registration form",
    summary: "Choose which fields players fill in, add your own dropdown question, require a photo, add your payment QR and fee, then copy the public link to share.",
    group: "Registration",
    audience: "Organiser",
    url: "cricbid.online/tournament/jain-unity-cup/manage/registration",
    duration: T.end,
    steps: [
        { at: 0, title: "Open Registration and click Customize registration form", detail: "It lives in the tournament workspace sidebar." },
        { at: 2600, title: "Keep Enable Public Registration switched on", detail: "Players can only use the link while this is on." },
        { at: 5800, title: "Choose which built-in fields to ask for", detail: "Make Photo required and set fields you don't need to Disabled." },
        { at: 11000, title: "Add a dropdown question", detail: "Add Field, name it, pick the dropdown type and add each option." },
        { at: 23000, title: "Turn on the payment panel and upload your QR", detail: "Write the fee in the instructions so players know what to pay." },
        { at: 30400, title: "Ask players for a payment screenshot", detail: "Make it compulsory so nobody registers without proof." },
        { at: 33400, title: "Save, then copy the player registration link", detail: "Paste the link wherever your players are." },
    ],
    cursor: [
        { at: 0, x: 760, y: 520 },
        { at: T.openClick, x: 403, y: 204, click: true },
        { at: 3600, x: 1190, y: 148 },
        { at: T.photoReq, x: 1176, y: y(FIELD_ROW0 + 2 * FIELD_STEP + 28, 250), click: true },
        { at: T.emailOpen, x: 968, y: y(FIELD_ROW0 + 5 * FIELD_STEP + 28, 250), click: true },
        { at: T.emailPick, x: 968, y: y(FIELD_ROW0 + 5 * FIELD_STEP + 28, 250) + 104, click: true },
        { at: T.addField, x: 1180, y: y(898, 820), click: true },
        { at: T.labelClick, x: 421, y: y(988, 820), click: true },
        { at: T.typeOpen, x: 662, y: y(988, 820), click: true },
        { at: T.typePick, x: 662, y: y(988, 820) + 128, click: true },
        { at: T.optClick1, x: 700, y: y(1092, 820), click: true },
        { at: T.optAdd1, x: 1160, y: y(1092, 820), click: true },
        { at: T.optClick2, x: 700, y: y(1092, 820), click: true },
        { at: T.optAdd2, x: 1160, y: y(1092, 820), click: true },
        { at: T.cfRequired, x: 1093, y: y(988, 820), click: true },
        { at: T.payOn, x: 1190, y: y(1230, 1160), click: true },
        { at: T.qrClick, x: 600, y: y(1448, 1160), click: true },
        { at: T.textClick, x: 600, y: y(1612, 1160), click: true },
        { at: T.proofOn, x: 1190, y: y(1772, 1500), click: true },
        { at: T.save, x: 1165, y: 692, click: true },
        { at: T.copy, x: 1154, y: 372, click: true },
        { at: T.end, x: 1154, y: 372 },
    ],
    Scene,
};

export default guide;
