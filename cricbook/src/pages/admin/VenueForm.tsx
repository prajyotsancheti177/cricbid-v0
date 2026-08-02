import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { post } from "../../lib/api";
import { authUser } from "../../lib/booking";

/** Create (no :venueId) or edit (with :venueId) a venue. */
export default function VenueForm() {
  const { venueId } = useParams<{ venueId?: string }>();
  const navigate = useNavigate();
  const user = authUser();
  const editing = !!venueId;

  const [form, setForm] = useState({
    name: "", area: "", city: "", address: "", description: "", phone: "",
    amenities: "", photos: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    post("booking/venue/detail", { venueId }).then(r => {
      if (r.success) setForm({
        name: r.data.name || "", area: r.data.area || "", city: r.data.city || "",
        address: r.data.address || "", description: r.data.description || "", phone: r.data.phone || "",
        amenities: (r.data.amenities || []).join(", "),
        photos: (r.data.photos || []).join(", "),
      });
    });
  }, [venueId]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) { setError("Venue name is required"); return; }
    setBusy(true); setError("");
    const payload = {
      ownerId: user?._id,
      ...(editing ? { venueId } : {}),
      name: form.name.trim(), area: form.area.trim(), city: form.city.trim(),
      address: form.address.trim(), description: form.description.trim(), phone: form.phone.trim(),
      amenities: form.amenities.split(",").map(s => s.trim()).filter(Boolean),
      photos: form.photos.split(",").map(s => s.trim()).filter(Boolean),
    };
    const r = await post(editing ? "booking/admin/venue/update" : "booking/admin/venue/create", payload).catch(() => null);
    setBusy(false);
    if (r?.success) navigate(editing ? `/admin/venue/${venueId}` : `/admin/venue/${r.data.id}`);
    else setError(r?.message || "Save failed");
  };

  return (
    <div className="space-y-4 max-w-lg">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-xl font-bold text-white">{editing ? "Edit venue" : "New venue"}</h1>

      <div className="space-y-3">
        <Field label="Venue name *"><input className="input" value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Area / locality"><input className="input" value={form.area} onChange={set("area")} /></Field>
          <Field label="City"><input className="input" value={form.city} onChange={set("city")} /></Field>
        </div>
        <Field label="Address"><input className="input" value={form.address} onChange={set("address")} /></Field>
        <Field label="Phone"><input className="input" value={form.phone} onChange={set("phone")} inputMode="tel" /></Field>
        <Field label="Description"><textarea className="input" rows={2} value={form.description} onChange={set("description")} /></Field>
        <Field label="Amenities (comma-separated)"><input className="input" placeholder="Parking, Washroom, Floodlights" value={form.amenities} onChange={set("amenities")} /></Field>
        <Field label="Photo URLs (comma-separated)"><input className="input" value={form.photos} onChange={set("photos")} /></Field>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button onClick={save} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {editing ? "Save changes" : "Create venue"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-muted font-medium">{label}</span><div className="mt-1">{children}</div></label>;
}
