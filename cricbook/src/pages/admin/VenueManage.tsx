import { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, SquarePen } from "lucide-react";
import { post } from "../../lib/api";
import { SPORT_LABEL, rupees, minutesToHHMM } from "../../lib/booking";
import TabBar from "../../components/layout/TabBar";
import VenueBookings from "./VenueBookings";

interface Court { id: string; name: string; sport: string; pricePerSlot: number; slotMinutes: number; openMinute: number; closeMinute: number; isActive: boolean; }

export default function VenueManage() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const tab = location.pathname.endsWith("/bookings") ? "bookings" : "courts";

  const [name, setName] = useState("");
  const [courts, setCourts] = useState<Court[] | null>(null);

  useEffect(() => {
    post("booking/venue/detail", { venueId }).then(r => {
      if (r.success) { setName(r.data.name); setCourts(r.data.courts.map((c: Court & { _id: string }) => ({ ...c, id: c._id }))); }
    });
  }, [venueId, location.pathname]);

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/admin")} className="flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft className="w-4 h-4" /> All venues
      </button>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-white truncate">{name}</h1>
        <Link to={`/admin/venue/${venueId}/edit`} className="flex items-center gap-1 text-xs text-muted hover:text-white shrink-0">
          <SquarePen className="w-3.5 h-3.5" /> Edit venue
        </Link>
      </div>

      <TabBar top="top-0" tabs={[
        { label: "Courts", to: `/admin/venue/${venueId}`, end: true },
        { label: "Bookings", to: `/admin/venue/${venueId}/bookings` },
      ]} />

      {tab === "bookings" ? (
        <VenueBookings venueId={venueId!} />
      ) : (
        <div className="space-y-3 pt-1">
          <Link to={`/admin/venue/${venueId}/court/new`} className="btn-primary inline-flex items-center gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Add court
          </Link>
          {courts === null ? (
            <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}</div>
          ) : courts.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">No courts yet. Add one to start taking bookings.</p>
          ) : (
            <div className="space-y-2">
              {courts.map(c => (
                <div key={c.id} className="card p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{c.name} {!c.isActive && <span className="text-red-400 text-xs">(hidden)</span>}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {SPORT_LABEL[c.sport] || c.sport} · {rupees(c.pricePerSlot)}/{c.slotMinutes}min · {minutesToHHMM(c.openMinute)}–{minutesToHHMM(c.closeMinute)}
                    </p>
                  </div>
                  <Link to={`/admin/venue/${venueId}/court/${c.id}`} className="text-muted hover:text-white shrink-0"><Pencil className="w-4 h-4" /></Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
