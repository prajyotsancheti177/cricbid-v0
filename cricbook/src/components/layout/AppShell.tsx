import { Link, Outlet, useNavigate } from "react-router-dom";
import { CalendarCheck, CalendarClock, LayoutGrid, LogOut } from "lucide-react";
import { authUser, isAuthed } from "../../lib/booking";

/** Public app shell: sticky top bar + centered outlet. */
export default function AppShell() {
  const navigate = useNavigate();
  const authed = isAuthed();
  const user = authUser();

  const logout = () => {
    localStorage.removeItem("cricbook_auth");
    localStorage.removeItem("cricbook_user");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-bdr bg-panel sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <CalendarCheck className="w-5 h-5 text-primary" />
            <span className="font-bold text-white text-lg">CricBook</span>
          </Link>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Link to="/my-bookings" className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition px-2 py-1.5">
              <CalendarClock className="w-4 h-4" />
              <span className="hidden sm:inline">My Bookings</span>
            </Link>
            {authed
              ? <>
                  <Link to="/admin" className="flex items-center gap-1.5 text-[11px] bg-primary/15 border border-primary/30 text-primary px-2.5 py-1.5 rounded-lg font-semibold hover:bg-primary/25 transition">
                    <LayoutGrid className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Admin</span>
                  </Link>
                  <button onClick={logout} title={user?.name || "Logout"} className="text-muted hover:text-white transition"><LogOut className="w-4 h-4" /></button>
                </>
              : <Link to="/login" className="text-[11px] bg-primary text-white px-2.5 py-1.5 rounded-lg font-semibold hover:bg-primary/90 transition">
                  List your venue
                </Link>}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4 pb-12">
        <Outlet />
      </main>
    </div>
  );
}
