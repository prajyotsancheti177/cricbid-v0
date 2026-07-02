import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Building2, ChevronRight } from "lucide-react";
import { post } from "../../lib/api";
import { authUser } from "../../lib/booking";

interface OwnerVenue { _id: string; name: string; city?: string; area?: string; courtCount: number; isActive: boolean; }

export default function AdminDashboard() {
  const user = authUser();
  const [venues, setVenues] = useState<OwnerVenue[] | null>(null);

  useEffect(() => {
    post("booking/admin/venue/list", { ownerId: user?._id }).then(r => setVenues(r.success ? r.data : []));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Your Venues</h1>
        <Link to="/admin/venue/new" className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> New venue
        </Link>
      </div>

      {venues === null ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}</div>
      ) : venues.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Building2 className="w-12 h-12 mx-auto text-muted/40" />
          <p className="text-white font-medium">No venues yet</p>
          <Link to="/admin/venue/new" className="btn-primary inline-block">Add your first venue</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {venues.map(v => (
            <Link key={v._id} to={`/admin/venue/${v._id}`} className="card p-4 flex items-center gap-3 hover:border-primary/40 transition">
              <Building2 className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{v.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  {[v.area, v.city].filter(Boolean).join(", ") || "No location"} · {v.courtCount} court{v.courtCount !== 1 ? "s" : ""}
                  {!v.isActive && <span className="text-red-400"> · hidden</span>}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
