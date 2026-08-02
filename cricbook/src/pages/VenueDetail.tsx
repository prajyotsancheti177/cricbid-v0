import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Check, ChevronRight, ImageOff } from "lucide-react";
import { post } from "../lib/api";
import { SPORT_LABEL, rupees } from "../lib/booking";

interface Court {
  _id: string; name: string; sport: string; pricePerSlot: number;
  slotMinutes: number; openMinute: number; closeMinute: number;
}
interface VenueFull {
  _id: string; name: string; description?: string; address?: string;
  city?: string; area?: string; photos: string[]; amenities: string[];
  phone?: string; courts: Court[];
}

export default function VenueDetail() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const [venue, setVenue] = useState<VenueFull | null>(null);

  useEffect(() => {
    post("booking/venue/detail", { venueId }).then(r => { if (r.success) setVenue(r.data); });
  }, [venueId]);

  if (!venue) return <p className="text-muted text-sm text-center py-16">Loading venue…</p>;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="card overflow-hidden">
        <div className="h-44 bg-panel2 flex items-center justify-center overflow-hidden">
          {venue.photos?.[0]
            ? <img src={venue.photos[0]} alt={venue.name} className="w-full h-full object-cover" />
            : <ImageOff className="w-10 h-10 text-muted/40" />}
        </div>
        <div className="p-4">
          <h1 className="text-lg font-bold text-white">{venue.name}</h1>
          {(venue.area || venue.city) && (
            <p className="flex items-center gap-1 text-sm text-muted mt-1">
              <MapPin className="w-3.5 h-3.5" />{[venue.address, venue.area, venue.city].filter(Boolean).join(", ")}
            </p>
          )}
          {venue.phone && (
            <p className="flex items-center gap-1 text-sm text-muted mt-1"><Phone className="w-3.5 h-3.5" />{venue.phone}</p>
          )}
          {venue.description && <p className="text-sm text-muted mt-2">{venue.description}</p>}
          {venue.amenities?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {venue.amenities.map(a => (
                <span key={a} className="flex items-center gap-1 text-[11px] text-muted bg-panel2 border border-bdr rounded-full px-2 py-1">
                  <Check className="w-3 h-3 text-primary" />{a}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="section-label mb-2">Courts</p>
        <div className="space-y-2">
          {venue.courts.map(c => (
            <Link key={c._id} to={`/venue/${venue._id}/book/${c._id}`}
              className="card p-4 flex items-center gap-3 hover:border-primary/40 transition">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{c.name}</p>
                <p className="text-xs text-muted mt-0.5">{SPORT_LABEL[c.sport] || c.sport} · {rupees(c.pricePerSlot)}/slot · {c.slotMinutes}min</p>
              </div>
              <span className="text-xs font-semibold text-primary flex items-center gap-1 shrink-0">Book <ChevronRight className="w-4 h-4" /></span>
            </Link>
          ))}
          {venue.courts.length === 0 && <p className="text-muted text-sm text-center py-8">No courts listed yet.</p>}
        </div>
      </div>
    </div>
  );
}
