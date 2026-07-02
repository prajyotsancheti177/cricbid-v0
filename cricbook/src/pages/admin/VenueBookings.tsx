import { useEffect, useState } from "react";
import { post } from "../../lib/api";
import { authUser, formatSlot, rupees, toDateStr } from "../../lib/booking";
import DayStrip from "../../components/booking/DayStrip";

interface Row {
  _id: string; court: string; sport: string;
  customerName?: string; customerPhone?: string;
  startTime: string; endTime: string; price: number; status: string;
}

/** Embedded in VenueManage "Bookings" tab. */
export default function VenueBookings({ venueId }: { venueId: string }) {
  const user = authUser();
  const [date, setDate] = useState(toDateStr(new Date()));
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    setRows(null);
    post("booking/admin/bookings", { ownerId: user?._id, venueId, date }).then(r => setRows(r.success ? r.data : []));
  }, [venueId, date]);

  const total = (rows || []).reduce((s, r) => s + r.price, 0);

  return (
    <div className="space-y-4 pt-1">
      <DayStrip value={date} onChange={setDate} />
      {rows === null ? (
        <p className="text-muted text-sm text-center py-8">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm text-center py-8">No bookings for this day.</p>
      ) : (
        <>
          <div className="flex justify-between text-sm">
            <span className="text-muted">{rows.length} booking{rows.length !== 1 ? "s" : ""}</span>
            <span className="text-white font-semibold">{rupees(total)}</span>
          </div>
          <div className="card overflow-hidden divide-y divide-bdr/60">
            {rows.map(r => (
              <div key={r._id} className="p-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{r.customerName || "—"} <span className="text-muted font-normal">· {r.customerPhone || "no phone"}</span></p>
                  <p className="text-xs text-muted mt-0.5">{r.court} · {formatSlot(r.startTime, r.endTime)}</p>
                </div>
                <span className="text-sm text-white font-semibold shrink-0">{rupees(r.price)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
