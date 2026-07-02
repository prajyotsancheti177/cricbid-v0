import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { post } from "../lib/api";
import { toDateStr, rupees } from "../lib/booking";
import DayStrip from "../components/booking/DayStrip";
import SlotGrid from "../components/booking/SlotGrid";
import type { Slot } from "../components/booking/SlotGrid";
import BookingConfirmSheet from "../components/booking/BookingConfirmSheet";

export default function BookSlot() {
  const { venueId, courtId } = useParams<{ venueId: string; courtId: string }>();
  const navigate = useNavigate();

  const [venueName, setVenueName] = useState("");
  const [courtName, setCourtName] = useState("");
  const [date, setDate] = useState(toDateStr(new Date()));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    post("booking/venue/detail", { venueId }).then(r => {
      if (r.success) {
        setVenueName(r.data.name);
        setCourtName(r.data.courts.find((c: { _id: string }) => c._id === courtId)?.name || "Court");
      }
    });
  }, [venueId, courtId]);

  const fetchAvailability = () => {
    setSlots(null); setSelected(new Set());
    post("booking/availability", { courtId, date }).then(r => { if (r.success) setSlots(r.data.slots); });
  };

  useEffect(fetchAvailability, [courtId, date]);

  const toggle = (slot: Slot) => {
    if (!slots) return;
    const next = new Set(selected);
    if (next.has(slot.startTime)) next.delete(slot.startTime);
    else next.add(slot.startTime);
    // enforce contiguous (consecutive indices in the slot list)
    const indices = [...next]
      .map(st => slots.findIndex(s => s.startTime === st))
      .sort((a, b) => a - b);
    const contiguous = indices.every((v, i) => i === 0 || v === indices[i - 1] + 1);
    setSelected(contiguous ? next : new Set([slot.startTime]));
  };

  const selectedSlots = useMemo(
    () => (slots || []).filter(s => selected.has(s.startTime)).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [slots, selected]
  );
  const total = selectedSlots.reduce((s, x) => s + x.price, 0);

  return (
    <div className="space-y-4 pb-24">
      <button onClick={() => navigate(`/venue/${venueId}`)} className="flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div>
        <h1 className="text-lg font-bold text-white">{courtName}</h1>
        <p className="text-sm text-muted">{venueName}</p>
      </div>

      <DayStrip value={date} onChange={setDate} />

      {slots === null ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {[...Array(9)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-panel2 animate-pulse" />)}
        </div>
      ) : slots.length === 0 ? (
        <p className="text-muted text-sm text-center py-12">No slots configured for this court.</p>
      ) : (
        <>
          <p className="section-label">Tap to select slots · contiguous only</p>
          <SlotGrid slots={slots} selected={selected} onToggle={toggle} />
        </>
      )}

      {/* Sticky action bar */}
      {selectedSlots.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-panel border-t border-bdr z-30">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted">{selectedSlots.length} slot{selectedSlots.length > 1 ? "s" : ""} selected</p>
              <p className="text-lg font-bold text-white">{rupees(total)}</p>
            </div>
            <button onClick={() => setShowConfirm(true)} className="btn-primary px-6">Book</button>
          </div>
        </div>
      )}

      {showConfirm && (
        <BookingConfirmSheet
          courtId={courtId!} courtName={courtName} venueName={venueName}
          slots={selectedSlots}
          onClose={() => setShowConfirm(false)}
          onBooked={() => navigate("/my-bookings")}
          onConflict={fetchAvailability}
        />
      )}
    </div>
  );
}
