import { dayLabel, nextDays, toDateStr } from "../../lib/booking";

/** Horizontal 14-day selector. Value/onChange use "YYYY-MM-DD" (IST). */
export default function DayStrip({ value, onChange, days = 14 }: {
  value: string; onChange: (date: string) => void; days?: number;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3">
      {nextDays(days).map((d) => {
        const ds = toDateStr(d);
        const { dow, day } = dayLabel(d);
        const active = ds === value;
        return (
          <button key={ds} onClick={() => onChange(ds)}
            className={`shrink-0 w-16 rounded-xl border px-2 py-2.5 text-center transition ${
              active ? "bg-primary border-primary text-white" : "bg-panel border-bdr text-muted hover:text-white"
            }`}>
            <span className="block text-[10px] font-semibold uppercase">{dow}</span>
            <span className="block text-xs font-bold mt-0.5">{day}</span>
          </button>
        );
      })}
    </div>
  );
}
