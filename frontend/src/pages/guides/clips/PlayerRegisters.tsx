import type { ReactNode } from "react";
import { Check, CheckCircle2, ChevronDown, Loader2, LogIn, QrCode, Trophy, User, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuideDefinition, SceneProps } from "../kit/types";
import { after, between, ease, progress, typed } from "../kit/timeline";
import { Spotlight } from "../kit/primitives";
import { QrArt } from "./RegistrationForm";

/**
 * A player opens the public link on a phone and registers.
 *
 * Look-alike of pages/PublicPlayerRegistration.tsx at phone width, with the
 * form the organiser built in the "registration-form" clip: Email disabled,
 * Photo required, a "Batting style" dropdown, a QR payment panel and a
 * compulsory "Payment Screenshot" upload. Wording is copied from the real JSX.
 */

const T = {
    scrollFields: [3600, 4400] as const,
    name: 5000, nameType: 5200,
    age: 6600, ageType: 6800,
    genderOpen: 7800, genderPick: 8800,
    mobile: 9800, mobileType: 10000,
    scrollSkill: [11000, 12000] as const,
    skillOpen: 12600, skillPick: 13600,
    catOpen: 14400, catPick: 15400,
    photo: 16800, photoPick: 18200,
    scrollBat: [19200, 20200] as const,
    batOpen: 21000, batPick: 22000,
    scrollPay: [22800, 23800] as const,
    upiIn: 25200, upiPay: 26800, upiDone: 27700, upiOut: 29600,
    proof: 30400, proofPick: 31800,
    submit: 33600, success: 35000,
    end: 39000,
};

// Phone geometry (stage px)
const SCREEN = { left: 457, top: 32, width: 366, height: 676 };
const VIEW_TOP = 76; // below the in-phone browser bar

const scrollAt = (t: number) => {
    if (t >= T.success) return 0;
    const segs: [readonly [number, number], number, number][] = [
        [T.scrollFields, 0, 120],
        [T.scrollSkill, 120, 480],
        [T.scrollBat, 480, 860],
        [T.scrollPay, 860, 1100],
    ];
    let s = 0;
    for (const [[a, b], from, to] of segs) if (t >= a) s = from + (to - from) * ease(progress(t, a, b));
    return s;
};
const sy = (top: number, s: number) => VIEW_TOP + top - s;
const spot = (t: number, at: number) => between(t, at - 900, at + 150);

const Field = ({ top, label, children }: { top: number; label: string; children: ReactNode }) => (
    <div className="absolute" style={{ top, left: 28, width: 310 }}>
        <span className="block h-5 text-sm font-medium">{label}</span>
        <div className="relative mt-1.5">{children}</div>
    </div>
);

const PInput = ({ value, placeholder, focused, height = 40 }: { value: string; placeholder: string; focused?: boolean; height?: number }) => (
    <div className={cn("flex items-start rounded-md border bg-background px-3 text-sm", focused ? "border-primary ring-2 ring-primary/30" : "border-input")}
        style={{ height, paddingTop: height > 40 ? 8 : 10 }}>
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || placeholder}</span>
        {focused && <span className="ml-0.5 h-4 w-[2px] animate-pulse bg-primary" />}
    </div>
);

const PSelect = ({ value, placeholder, open, options, highlighted }: { value: string; placeholder: string; open: boolean; options: string[]; highlighted?: string }) => (
    <>
        <div className={cn("flex h-10 items-center justify-between rounded-md border bg-background px-3 text-sm", open ? "border-primary ring-2 ring-primary/30" : "border-input")}>
            <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || placeholder}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
        </div>
        {open && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover p-1 shadow-xl">
                {options.map((o) => (
                    <div key={o} className={cn("flex h-9 items-center justify-between rounded px-3 text-sm", o === highlighted ? "bg-primary/15" : "text-muted-foreground")}>
                        {o}{o === value && <Check className="h-4 w-4 text-primary" />}
                    </div>
                ))}
            </div>
        )}
    </>
);

const PFile = ({ name }: { name: string }) => (
    <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm">
        <span className="rounded bg-muted px-2 py-1 text-xs font-medium">Choose File</span>
        <span className={cn("truncate", name ? "text-foreground" : "text-muted-foreground")}>{name || "No file chosen"}</span>
    </div>
);

const pick = (t: number, open: number, chosen: number, value: string, options: string[]) => ({
    value: after(t, chosen + 100) ? value : "",
    open: between(t, open + 100, chosen + 100),
    options,
    highlighted: t > chosen - 500 ? value : undefined,
});

/** The phone's own photo picker sheet. */
const PickerSheet = ({ show, kind, chosen }: { show: boolean; kind: "photo" | "receipt"; chosen: boolean }) => {
    if (!show) return null;
    const thumbs = [0, 1, 2, 3, 4, 5];
    const tints = ["from-sky-300 to-indigo-400", "from-emerald-300 to-teal-500", "from-amber-200 to-orange-400", "from-rose-300 to-pink-500", "from-slate-300 to-slate-500", "from-lime-200 to-green-400"];
    return (
        <div className="absolute inset-0 z-50 bg-black/40">
            <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-card p-4 shadow-2xl" style={{ height: 268 }}>
                <p className="mb-3 text-sm font-semibold">{kind === "photo" ? "Choose a photo" : "Recent screenshots"}</p>
                <div className="grid grid-cols-3 gap-1.5">
                    {thumbs.map((i) => (
                        <div key={i} className={cn("relative h-[104px] overflow-hidden rounded-md bg-gradient-to-br", tints[i], i === 0 && chosen && "ring-4 ring-primary")}>
                            {i === 0 && kind === "photo" && (
                                <div className="flex h-full items-end justify-center bg-gradient-to-b from-sky-200 to-sky-500">
                                    <div className="flex flex-col items-center">
                                        <div className="h-9 w-9 rounded-full bg-amber-200" />
                                        <div className="mt-1 h-10 w-20 rounded-t-full bg-blue-800" />
                                    </div>
                                </div>
                            )}
                            {i === 0 && kind === "receipt" && (
                                <div className="flex h-full flex-col items-center justify-center bg-white text-[9px] text-slate-700">
                                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                                    <span className="mt-1 font-bold">₹500</span>
                                    <span>Paid · UPI</span>
                                </div>
                            )}
                            {i === 0 && chosen && <Check className="absolute right-1 top-1 h-5 w-5 rounded-full bg-primary p-0.5 text-primary-foreground" />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/** A generic UPI app paying the registration fee. */
const UpiApp = ({ t }: { t: number }) => {
    if (!between(t, T.upiIn, T.upiOut)) return null;
    const slide = 1 - ease(progress(t, T.upiIn, T.upiIn + 400)) + ease(progress(t, T.upiOut - 400, T.upiOut));
    const paying = between(t, T.upiPay + 100, T.upiDone);
    const done = after(t, T.upiDone);
    return (
        <div className="absolute inset-0 z-50 flex flex-col bg-slate-900 text-white" style={{ transform: `translateY(${slide * 100}%)` }}>
            <p className="px-5 pt-6 text-xs uppercase tracking-wider text-white/60">Your UPI app · scanned QR</p>
            {done ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3">
                    <CheckCircle2 className="h-20 w-20 text-green-400" />
                    <p className="text-xl font-bold">Payment successful</p>
                    <p className="text-3xl font-bold">₹500</p>
                    <p className="text-sm text-white/70">Paid to Jain Unity Cup</p>
                    <p className="mt-4 text-xs text-white/50">Take a screenshot of this screen</p>
                </div>
            ) : (
                <div className="flex flex-1 flex-col items-center px-6 pt-16">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold">J</div>
                    <p className="mt-3 text-lg font-semibold">Paying Jain Unity Cup</p>
                    <p className="mt-6 text-5xl font-bold">₹500</p>
                    <p className="mt-2 text-sm text-white/60">Note: Aarav Deshmukh registration</p>
                    <div className={cn("relative mt-auto mb-10 flex h-12 w-full items-center justify-center rounded-full bg-green-500 font-semibold", paying && "opacity-80")}>
                        {paying ? <Loader2 className="h-5 w-5 animate-spin" /> : "Pay ₹500"}
                        <Spotlight show={spot(t, T.upiPay)} className="rounded-full" />
                    </div>
                </div>
            )}
        </div>
    );
};

const Page = ({ t }: { t: number }) => {
    const s = scrollAt(t);
    const success = after(t, T.success);
    const submitting = between(t, T.submit + 100, T.success);

    const gender = pick(t, T.genderOpen, T.genderPick, "Male", ["Male", "Female", "Other"]);
    const skill = pick(t, T.skillOpen, T.skillPick, "All-rounder", ["Batsman", "Bowler", "All-rounder"]);
    const cat = pick(t, T.catOpen, T.catPick, "Regular", ["Icon", "Regular"]);
    const bat = pick(t, T.batOpen, T.batPick, "Right hand", ["Right hand", "Left hand"]);

    return (
        <div className="absolute inset-x-0 bottom-0 overflow-hidden bg-gradient-to-br from-background to-accent/10" style={{ top: VIEW_TOP - SCREEN.top }}>
            <div className="relative" style={{ height: 1660, transform: `translateY(${-s}px)` }}>
                <div className="absolute inset-x-0 text-center" style={{ top: 16 }}>
                    <Trophy className="mx-auto h-9 w-9 text-primary" />
                    <h1 className="mt-2 text-[28px] font-bold leading-9">Player Registration</h1>
                    <p className="text-lg font-medium text-primary/80">Jain Unity Cup</p>
                    <p className="text-sm text-muted-foreground">Complete the form to submit your profile.</p>
                </div>

                <div className="absolute rounded-xl border border-border/50 bg-card/80 shadow-xl" style={{ top: 166, left: 12, width: 342, height: success ? 190 : 1474 }}>
                    <p className="flex items-center gap-2 px-4 pt-4 text-xl font-semibold"><UserPlus className="h-5 w-5" /> Information</p>
                </div>

                {success ? (
                    <div className="absolute rounded-lg border border-green-500 bg-green-50 px-4 py-5 text-center text-base text-green-700" style={{ top: 226, left: 28, width: 310 }}>
                        Registration successful! Your player profile has been submitted.
                    </div>
                ) : (
                    <>
                        <div className="absolute rounded-lg border border-border/60 bg-muted/30 p-3" style={{ top: 226, left: 28, width: 310, height: 96 }}>
                            <p className="text-sm font-medium">Have a CricBid profile? Login to auto-fill your details.</p>
                            <span className="relative mt-2 inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium">
                                <LogIn className="mr-1 h-4 w-4" /> Login / Create Profile
                            </span>
                            <Spotlight show={between(t, 1000, 3400)} />
                        </div>

                        <Field top={340} label="Full Name *">
                            <PInput value={typed("Aarav Deshmukh", t, T.nameType)} placeholder="Enter your full name" focused={between(t, T.name, T.age)} />
                            <Spotlight show={spot(t, T.name)} />
                        </Field>
                        <Field top={420} label="Age *">
                            <PInput value={typed("24", t, T.ageType, 8)} placeholder="Enter your age" focused={between(t, T.age, T.genderOpen)} />
                        </Field>
                        <Field top={500} label="Gender *">
                            <PSelect {...gender} placeholder="Select Gender" />
                        </Field>
                        <Field top={580} label="Mobile Number *">
                            <PInput value={typed("98XXXXXX12", t, T.mobileType)} placeholder="Enter mobile number" focused={between(t, T.mobile, T.scrollSkill[0])} />
                            <Spotlight show={spot(t, T.mobile)} />
                        </Field>
                        <Field top={660} label="Address">
                            <PInput value="" placeholder="Enter Address" height={60} />
                        </Field>
                        <Field top={766} label="Skill *">
                            <PSelect {...skill} placeholder="Select Skill" />
                        </Field>
                        <Field top={846} label="Player Category *">
                            <PSelect {...cat} placeholder="Select Category" />
                        </Field>
                        <Field top={926} label="Photo *">
                            <PFile name={after(t, T.photoPick + 200) ? "aarav-deshmukh.jpg" : ""} />
                            <Spotlight show={spot(t, T.photo)} />
                        </Field>

                        <div className="absolute border-t" style={{ top: 1016, left: 28, width: 310 }} />
                        <p className="absolute text-lg font-medium text-foreground/80" style={{ top: 1030, left: 28 }}>Additional Information</p>
                        <Field top={1070} label="Batting style *">
                            <PSelect {...bat} placeholder="Select an option" />
                            <Spotlight show={spot(t, T.batOpen)} />
                        </Field>

                        <div className="absolute rounded-lg border border-primary/30 bg-primary/5" style={{ top: 1160, left: 28, width: 310, height: 378 }}>
                            <p className="flex items-center gap-2 px-4 pt-4 font-semibold text-primary"><QrCode className="h-5 w-5" /> Registration Payment</p>
                        </div>
                        <div className="absolute rounded-lg border bg-white p-2" style={{ top: 1210, left: 95, width: 176, height: 176 }}>
                            <QrArt size={158} />
                            <Spotlight show={between(t, T.scrollPay[1], T.upiIn)} />
                        </div>
                        <p className="absolute text-sm leading-relaxed text-foreground/80" style={{ top: 1394, left: 44, width: 278 }}>
                            Registration fee ₹500. Scan the QR to pay, then upload the screenshot below.
                        </p>
                        <div className="absolute border-t border-primary/20" style={{ top: 1446, left: 44, width: 278 }} />
                        <div className="absolute" style={{ top: 1456, left: 44, width: 278 }}>
                            <span className="block h-5 text-sm font-medium">Payment Screenshot *</span>
                            <div className="relative mt-1.5">
                                <PFile name={after(t, T.proofPick + 200) ? "Screenshot_upi_500.png" : ""} />
                                <Spotlight show={spot(t, T.proof)} />
                            </div>
                        </div>

                        <div className={cn("absolute flex items-center justify-center rounded-md bg-primary text-lg font-semibold tracking-wide text-primary-foreground", submitting && "opacity-80")}
                            style={{ top: 1562, left: 28, width: 310, height: 56 }}>
                            {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                            Register Now
                            <Spotlight show={spot(t, T.submit)} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const Scene = ({ t }: SceneProps) => (
    <div className="relative h-full w-full bg-gradient-to-br from-muted/40 via-background to-muted/40">
        {/* Side notes */}
        <div className="absolute w-[340px] text-right" style={{ left: 60, top: 300 }}>
            <p className="text-sm uppercase tracking-wider text-muted-foreground">Shared link</p>
            <p className="mt-2 font-mono text-sm text-foreground/80">cricbid.online/register/public/…</p>
            <p className="mt-4 text-sm text-muted-foreground">No app to install — it opens in the phone's browser.</p>
        </div>
        <div className="absolute w-[330px]" style={{ left: 890, top: 300 }}>
            <p className="text-sm uppercase tracking-wider text-muted-foreground">After submitting</p>
            <p className="mt-2 text-sm text-muted-foreground">The organiser sees the player, their photo and the payment screenshot in the tournament's player list.</p>
        </div>

        {/* Phone */}
        <div className="absolute rounded-[40px] border-[12px] border-neutral-900 bg-neutral-900 shadow-2xl" style={{ left: 445, top: 20, width: 390, height: 700 }} />
        <div className="absolute overflow-hidden rounded-[28px] bg-background" style={SCREEN}>
            <div className="absolute inset-x-0 top-0 flex h-11 items-center gap-2 border-b border-border bg-muted/60 px-3">
                <span className="text-[11px] font-semibold">9:41</span>
                <div className="flex-1 truncate rounded-full bg-background px-3 py-1 text-center font-mono text-[11px] text-muted-foreground">cricbid.online/register/public/…</div>
                <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <Page t={t} />
            <PickerSheet show={between(t, T.photo + 200, T.photoPick + 200)} kind="photo" chosen={after(t, T.photoPick)} />
            <PickerSheet show={between(t, T.proof + 200, T.proofPick + 200)} kind="receipt" chosen={after(t, T.proofPick)} />
            <UpiApp t={t} />
        </div>
    </div>
);

const X = 640; // field centre x on the phone

const guide: GuideDefinition = {
    slug: "player-registers",
    title: "How a player registers and pays",
    summary: "A player opens the shared link on their phone, fills in their details and photo, pays the fee with the organiser's QR, uploads the payment screenshot and submits.",
    group: "Registration",
    audience: "Player",
    url: "cricbid.online/register/public/cm8x2k1vq0001jain",
    duration: T.end,
    steps: [
        { at: 0, title: "Open the registration link on your phone", detail: "Login / Create Profile is optional — sign in with Google to auto-fill the form next time." },
        { at: 3600, title: "Fill in your name, age and mobile number", detail: "Fields marked * are compulsory." },
        { at: 11000, title: "Choose your skill and category", detail: "The options come from the organiser's setup." },
        { at: 16200, title: "Upload your photo", detail: "Pick a clear face photo — it's shown during the auction." },
        { at: 19200, title: "Answer the organiser's questions", detail: "Here, pick your batting style from the dropdown." },
        { at: 22800, title: "Scan the QR and pay the ₹500 fee", detail: "Use any UPI app, then screenshot the success screen." },
        { at: 29600, title: "Upload the payment screenshot", detail: "The form won't submit without it." },
        { at: 32600, title: "Tap Register Now", detail: "You'll see a confirmation once your profile is submitted." },
    ],
    cursor: [
        { at: 0, x: 980, y: 560 },
        { at: 2400, x: 575, y: sy(296, 0) },
        { at: T.name, x: X, y: sy(386, 120), click: true },
        { at: T.age, x: X, y: sy(466, 120), click: true },
        { at: T.genderOpen, x: X, y: sy(546, 120), click: true },
        { at: T.genderPick, x: X, y: sy(546, 120) + 46, click: true },
        { at: T.mobile, x: X, y: sy(626, 120), click: true },
        { at: T.skillOpen, x: X, y: sy(812, 480), click: true },
        { at: T.skillPick, x: X, y: sy(812, 480) + 118, click: true },
        { at: T.catOpen, x: X, y: sy(892, 480), click: true },
        { at: T.catPick, x: X, y: sy(892, 480) + 82, click: true },
        { at: T.photo, x: X, y: sy(972, 480), click: true },
        { at: T.photoPick, x: 510, y: 540, click: true },
        { at: T.batOpen, x: X, y: sy(1116, 860), click: true },
        { at: T.batPick, x: X, y: sy(1116, 860) + 46, click: true },
        { at: 24000, x: X, y: sy(1298, 1100) },
        { at: T.upiPay, x: X, y: 640, click: true },
        { at: T.proof, x: X, y: sy(1502, 1100), click: true },
        { at: T.proofPick, x: 510, y: 540, click: true },
        { at: T.submit, x: X, y: sy(1590, 1100), click: true },
        { at: T.end, x: X, y: 420 },
    ],
    Scene,
};

export default guide;
