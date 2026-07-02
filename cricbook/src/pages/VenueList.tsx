import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { post } from "../lib/api";
import { SPORTS, SPORT_LABEL } from "../lib/booking";
import VenueCard from "../components/booking/VenueCard";
import type { VenueSummary } from "../components/booking/VenueCard";

export default function VenueList() {
  const [venues, setVenues] = useState<VenueSummary[] | null>(null);
  const [q, setQ] = useState("");
  const [sport, setSport] = useState<string>("");

  const fetchVenues = () => {
    setVenues(null);
    post("booking/venue/list", { q: q || undefined, sport: sport || undefined })
      .then(r => setVenues(r.success ? r.data : []));
  };

  useEffect(() => { fetchVenues(); }, [sport]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Book a court or turf</h1>
        <p className="text-sm text-muted mt-0.5">Find nearby venues and reserve your slot.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          className="input pl-9" placeholder="Search venue or area…"
          value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchVenues()}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3">
        <button onClick={() => setSport("")}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${sport === "" ? "bg-primary border-primary text-white" : "bg-panel border-bdr text-muted hover:text-white"}`}>
          All sports
        </button>
        {SPORTS.filter(s => s !== "other").map(s => (
          <button key={s} onClick={() => setSport(s)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${sport === s ? "bg-primary border-primary text-white" : "bg-panel border-bdr text-muted hover:text-white"}`}>
            {SPORT_LABEL[s]}
          </button>
        ))}
      </div>

      {venues === null ? (
        <div className="grid gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-48 animate-pulse" />)}
        </div>
      ) : venues.length === 0 ? (
        <p className="text-muted text-sm text-center py-16">No venues found. Try a different search or sport.</p>
      ) : (
        <div className="grid gap-3">
          {venues.map(v => <VenueCard key={v._id} venue={v} />)}
        </div>
      )}
    </div>
  );
}
