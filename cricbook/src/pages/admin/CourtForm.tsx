import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { post } from "../../lib/api";
import { authUser, SPORTS, SPORT_LABEL, minutesToHHMM, hhmmToMinutes } from "../../lib/booking";

/** Create (courtId absent) or edit a court under a venue. */
export default function CourtForm() {
  const { venueId, courtId } = useParams<{ venueId: string; courtId?: string }>();
  const navigate = useNavigate();
  const user = authUser();
  const editing = courtId && courtId !== "new";

  const [form, setForm] = useState({
    name: "", sport: "cricket", pricePerSlot: "500", slotMinutes: "60",
    open: "06:00", close: "23:00", isActive: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    post("booking/venue/detail", { venueId }).then(r => {
      if (!r.success) return;
      const c = r.data.courts.find((x: { _id: string }) => x._id === courtId);
      if (c) setForm({
        name: c.name, sport: c.sport, pricePerSlot: String(c.pricePerSlot),
        slotMinutes: String(c.slotMinutes), open: minutesToHHMM(c.openMinute),
        close: minutesToHHMM(c.closeMinute), isActive: c.isActive ?? true,
      });
    });
  }, [venueId, courtId]);

  const save = async () => {
    if (!form.name.trim()) { setError("Court name is required"); return; }
    const price = Number(form.pricePerSlot);
    if (!price || price <= 0) { setError("Enter a valid price"); return; }
    const openMinute = hhmmToMinutes(form.open), closeMinute = hhmmToMinutes(form.close);
    if (closeMinute <= openMinute) { setError("Closing time must be after opening"); return; }

    setBusy(true); setError("");
    const payload = {
      ownerId: user?._id,
      ...(editing ? { courtId } : { venueId }),
      name: form.name.trim(), sport: form.sport,
      pricePerSlot: price, slotMinutes: Number(form.slotMinutes),
      openMinute, closeMinute, isActive: form.isActive,
    };
    const r = await post(editing ? "booking/admin/court/update" : "booking/admin/court/create", payload).catch(() => null);
    setBusy(false);
    if (r?.success) navigate(`/admin/venue/${venueId}`);
    else setError(r?.message || "Save failed");
  };

  return (
    <div className="space-y-4 max-w-lg">
      <button onClick={() => navigate(`/admin/venue/${venueId}`)} className="flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-xl font-bold text-white">{editing ? "Edit court" : "Add court"}</h1>

      <div className="space-y-3">
        <label className="block"><span className="text-xs text-muted font-medium">Court name *</span>
          <input className="input mt-1" placeholder="Turf A" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
        <label className="block"><span className="text-xs text-muted font-medium">Sport</span>
          <select className="input mt-1" value={form.sport} onChange={e => setForm(f => ({ ...f, sport: e.target.value }))}>
            {SPORTS.map(s => <option key={s} value={s}>{SPORT_LABEL[s]}</option>)}
          </select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs text-muted font-medium">Price per slot (₹)</span>
            <input className="input mt-1" type="number" value={form.pricePerSlot} onChange={e => setForm(f => ({ ...f, pricePerSlot: e.target.value }))} /></label>
          <label className="block"><span className="text-xs text-muted font-medium">Slot length (min)</span>
            <select className="input mt-1" value={form.slotMinutes} onChange={e => setForm(f => ({ ...f, slotMinutes: e.target.value }))}>
              {[30, 60, 90, 120].map(m => <option key={m} value={m}>{m} min</option>)}
            </select></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs text-muted font-medium">Opens</span>
            <input className="input mt-1" type="time" value={form.open} onChange={e => setForm(f => ({ ...f, open: e.target.value }))} /></label>
          <label className="block"><span className="text-xs text-muted font-medium">Closes</span>
            <input className="input mt-1" type="time" value={form.close} onChange={e => setForm(f => ({ ...f, close: e.target.value }))} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="accent-primary w-4 h-4" />
          Visible &amp; bookable
        </label>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button onClick={save} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {editing ? "Save changes" : "Add court"}
        </button>
      </div>
    </div>
  );
}
