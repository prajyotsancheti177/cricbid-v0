// Shared helpers for the booking UI.

export const SPORTS = [
  "cricket", "football", "badminton", "tennis", "pickleball", "basketball", "other",
] as const;
export type Sport = typeof SPORTS[number];

export const SPORT_LABEL: Record<string, string> = {
  cricket: "Cricket", football: "Football", badminton: "Badminton",
  tennis: "Tennis", pickleball: "Pickleball", basketball: "Basketball", other: "Other",
};

/** minutes-from-midnight → "HH:MM" (24h) */
export const minutesToHHMM = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** "HH:MM" → minutes-from-midnight */
export const hhmmToMinutes = (s: string): number => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** a Date/ISO → "h:MM AM/PM" in IST */
export const timeLabel = (iso: string | Date): string =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

/** slot window "6:00 AM – 7:00 AM" */
export const formatSlot = (start: string | Date, end: string | Date): string =>
  `${timeLabel(start)} – ${timeLabel(end)}`;

/** "YYYY-MM-DD" for a Date in IST */
export const toDateStr = (d: Date): string =>
  d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // en-CA → YYYY-MM-DD

/** friendly day label for the date strip */
export const dayLabel = (d: Date): { dow: string; day: string; isToday: boolean } => {
  const today = toDateStr(new Date());
  const target = toDateStr(d);
  const tomorrow = toDateStr(new Date(Date.now() + 86400000));
  return {
    dow: target === today ? "Today" : target === tomorrow ? "Tmrw" : d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }),
    day: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }),
    isToday: target === today,
  };
};

/** next N days starting today */
export const nextDays = (n: number): Date[] =>
  Array.from({ length: n }, (_, i) => new Date(Date.now() + i * 86400000));

export const rupees = (n: number): string => `₹${n.toLocaleString("en-IN")}`;

export interface CurrentUser { _id: string; name?: string; email?: string; }

export const authUser = (): CurrentUser | null => {
  try { return JSON.parse(localStorage.getItem("cricbook_user") || "null"); } catch { return null; }
};
export const isAuthed = (): boolean => localStorage.getItem("cricbook_auth") === "true";
