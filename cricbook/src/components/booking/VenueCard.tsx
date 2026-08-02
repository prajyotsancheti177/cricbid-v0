import { useNavigate } from "react-router-dom";
import { MapPin, ImageOff } from "lucide-react";
import { SPORT_LABEL, rupees } from "../../lib/booking";

export interface VenueSummary {
  _id: string;
  name: string;
  city?: string;
  area?: string;
  photos: string[];
  amenities: string[];
  sports: string[];
  minPrice: number | null;
}

export default function VenueCard({ venue }: { venue: VenueSummary }) {
  const navigate = useNavigate();
  const photo = venue.photos?.[0];

  return (
    <button onClick={() => navigate(`/venue/${venue._id}`)}
      className="card overflow-hidden text-left w-full hover:border-primary/40 transition">
      <div className="h-32 bg-panel2 flex items-center justify-center overflow-hidden">
        {photo
          ? <img src={photo} alt={venue.name} className="w-full h-full object-cover" />
          : <ImageOff className="w-8 h-8 text-muted/40" />}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-white text-sm truncate">{venue.name}</h3>
          {venue.minPrice != null && (
            <span className="text-xs text-muted shrink-0">from <span className="text-white font-semibold">{rupees(venue.minPrice)}</span></span>
          )}
        </div>
        {(venue.area || venue.city) && (
          <p className="flex items-center gap-1 text-xs text-muted mt-1">
            <MapPin className="w-3 h-3 shrink-0" />{[venue.area, venue.city].filter(Boolean).join(", ")}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {venue.sports.map(s => (
            <span key={s} className="text-[10px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full">
              {SPORT_LABEL[s] || s}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
