import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarX, MapPin, Loader2 } from "lucide-react";
import { post } from "../lib/api";
import { authUser, formatSlot, rupees, SPORT_LABEL } from "../lib/booking";

interface Booking {
  _id: string;
  court: { name: string; sport: string; venue: { name: string; city?: string; area?: string } };
  startTime: string;
  endTime: string;
  price: number;
  status: string;
}

export default function MyBookings() {
  const user = authUser();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchBookings = () => {
    if (!user?._id) { setBookings([]); return; }
    post("booking/booking/mine", { userId: user._id }).then(r => setBookings(r.success ? r.data : []));
  };
  useEffect(fetchBookings, []);

  const cancel = async (id: string) => {
    setCancelling(id);
    await post("booking/booking/cancel", { bookingId: id, userId: user?._id });
    setCancelling(null);
    fetchBookings();
  };

  if (!user?._id) {
    return (
      <div className="text-center py-16 space-y-3">
        <CalendarX className="w-12 h-12 mx-auto text-muted/40" />
        <p className="text-white font-medium">Sign in to see your bookings</p>
        <Link to="/login" className="btn-primary inline-block">Sign in</Link>
      </div>
    );
  }

  if (bookings === null) return <p className="text-muted text-sm text-center py-16">Loading…</p>;

  const now = Date.now();
  const upcoming = bookings.filter(b => new Date(b.startTime).getTime() >= now);
  const past = bookings.filter(b => new Date(b.startTime).getTime() < now);

  const Card = ({ b, canCancel }: { b: Booking; canCancel: boolean }) => (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-white text-sm">{b.court.venue.name}</p>
          <p className="flex items-center gap-1 text-xs text-muted mt-0.5">
            <MapPin className="w-3 h-3" />{b.court.name} · {SPORT_LABEL[b.court.sport] || b.court.sport}
          </p>
        </div>
        <span className="text-sm font-bold text-white shrink-0">{rupees(b.price)}</span>
      </div>
      <p className="text-xs text-primary mt-2">
        {new Date(b.startTime).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
        {" · "}{formatSlot(b.startTime, b.endTime)}
      </p>
      {canCancel && (
        <button onClick={() => cancel(b._id)} disabled={cancelling === b._id}
          className="mt-3 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-semibold">
          {cancelling === b._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarX className="w-3.5 h-3.5" />}
          Cancel booking
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-white">My Bookings</h1>
      {bookings.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <CalendarX className="w-12 h-12 mx-auto text-muted/40" />
          <p className="text-white font-medium">No bookings yet</p>
          <Link to="/" className="btn-primary inline-block">Browse venues</Link>
        </div>
      )}
      {upcoming.length > 0 && (
        <section>
          <p className="section-label mb-2">Upcoming</p>
          <div className="space-y-2">{upcoming.map(b => <Card key={b._id} b={b} canCancel />)}</div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <p className="section-label mb-2">Past</p>
          <div className="space-y-2">{past.map(b => <Card key={b._id} b={b} canCancel={false} />)}</div>
        </section>
      )}
    </div>
  );
}
