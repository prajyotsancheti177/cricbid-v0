import { timeLabel } from "../../lib/booking";

export interface Slot {
  startTime: string;
  endTime: string;
  price: number;
  status: "available" | "booked" | "past";
}

/** Grid of time-slot buttons. Selection is controlled by the parent. */
export default function SlotGrid({ slots, selected, onToggle }: {
  slots: Slot[];
  selected: Set<string>;
  onToggle: (slot: Slot) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {slots.map((s) => {
        const isSel = selected.has(s.startTime);
        const disabled = s.status !== "available";
        let cls = "bg-panel2 border-bdr text-white hover:border-primary";
        if (s.status === "booked") cls = "bg-panel2/40 border-bdr/40 text-muted/50 line-through cursor-not-allowed";
        else if (s.status === "past") cls = "bg-panel2/30 border-bdr/30 text-muted/40 cursor-not-allowed";
        else if (isSel) cls = "bg-primary border-primary text-white";
        return (
          <button key={s.startTime} disabled={disabled} onClick={() => onToggle(s)}
            className={`rounded-xl border px-2 py-2.5 text-center transition ${cls}`}>
            <span className="block text-xs font-bold">{timeLabel(s.startTime)}</span>
            <span className="block text-[10px] opacity-80 mt-0.5">
              {s.status === "booked" ? "Booked" : `₹${s.price}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
