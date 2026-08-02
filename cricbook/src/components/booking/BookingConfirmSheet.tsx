import { useState } from "react";
import { X, Loader2, MapPin } from "lucide-react";
import { post } from "../../lib/api";
import { authUser, formatSlot, rupees } from "../../lib/booking";
import type { Slot } from "./SlotGrid";

/** Bottom sheet to confirm a booking. Book & pay at venue (no gateway). */
export default function BookingConfirmSheet({ courtId, courtName, venueName, slots, onClose, onBooked, onConflict }: {
  courtId: string;
  courtName: string;
  venueName: string;
  slots: Slot[];              // the selected slots, sorted
  onClose: () => void;
  onBooked: () => void;       // success
  onConflict: () => void;     // 409 — parent should refetch availability
}) {
  const user = authUser();
  const [name, setName]   = useState(user?.name || "");
  const [phone, setPhone] = useState("");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");

  const total = slots.reduce((s, x) => s + x.price, 0);

  const confirm = async () => {
    if (!name.trim() || !phone.trim()) { setError("Name and phone are required"); return; }
    setBusy(true); setError("");
    const r = await post("booking/booking/create", {
      courtId,
      slotStarts: slots.map(s => s.startTime),
      customerName: name.trim(),
      customerPhone: phone.trim(),
      userId: user?._id,
    }).catch(() => null);
    setBusy(false);
    if (r?.success) { onBooked(); return; }
    // 409 conflict: slot taken meanwhile
    if (r?.message?.toLowerCase().includes("just booked")) { onConflict(); onClose(); return; }
    setError(r?.message || "Booking failed. Try again.");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-panel border border-bdr rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Confirm booking</h3>
          <button onClick={onClose} className="text-muted hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="card p-3 mb-4 space-y-2 bg-panel2">
          <p className="flex items-center gap-1.5 text-sm text-white font-semibold"><MapPin className="w-4 h-4 text-primary" />{venueName} · {courtName}</p>
          <div className="space-y-1">
            {slots.map(s => (
              <div key={s.startTime} className="flex justify-between text-xs text-muted">
                <span>{formatSlot(s.startTime, s.endTime)}</span>
                <span>{rupees(s.price)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-bold text-white border-t border-bdr pt-2">
            <span>Total ({slots.length} slot{slots.length > 1 ? "s" : ""})</span>
            <span>{rupees(total)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <input className="input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          <input className="input" placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <p className="text-xs text-muted">💵 Pay at the venue. This just reserves your slot.</p>
          <button onClick={confirm} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? "Booking…" : `Book ${rupees(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
