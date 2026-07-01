import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams, useNavigate, useOutletContext } from "react-router-dom";
import {
  LayoutDashboard, Users, Shield, UserPlus, Upload, Link as LinkIcon,
  Gavel, Settings, ChevronLeft, Loader2, Trophy, Database, History, MessageSquare, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { setSelectedTournamentId } from "@/lib/tournamentUtils";
import apiConfig from "@/config/apiConfig";

export interface TournamentFeatures {
  whatsappNotifications?: boolean;
  obsOverlays?: boolean;
  publicPlayerRegistration?: boolean;
  publicTeamRegistration?: boolean;
  googleSheetsSync?: boolean;
  dataExport?: boolean;
}

export interface WorkspaceTournament {
  _id: string;
  name?: string;
  totalBudget?: number;
  noOfTeams?: number;
  minPlayersPerTeam?: number;
  maxPlayersPerTeam?: number;
  playerCategories?: string[];
  features?: TournamentFeatures;
  [key: string]: unknown;
}

/** Returns true if the feature is enabled (missing/null treated as enabled for backward compat). */
export const isFeatureOn = (tournament: WorkspaceTournament, key: keyof TournamentFeatures): boolean =>
  (tournament.features as TournamentFeatures | undefined)?.[key] !== false;

// Sections in the tournament workspace sidebar.
// adminOnly sections are only shown when a user is logged in.
const SECTIONS: { to: string; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { to: "overview", label: "Overview", icon: LayoutDashboard },
  { to: "players", label: "Players", icon: Users },
  { to: "teams", label: "Teams", icon: Shield },
  { to: "add-player", label: "Add player", icon: UserPlus },
  { to: "bulk-upload", label: "Bulk upload", icon: Upload },
  { to: "registration", label: "Registration", icon: LinkIcon },
  { to: "auction", label: "Auction", icon: Gavel },
  { to: "schedule", label: "Schedule & Scores", icon: CalendarDays, adminOnly: true },
  { to: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "data", label: "Data & export", icon: Database },
  { to: "backups", label: "Backups", icon: History },
  { to: "settings", label: "Settings", icon: Settings },
];

const getAuthUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const TournamentWorkspace = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<WorkspaceTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Make this tournament the active one for reused pages (Players/Teams/etc.)
  useEffect(() => {
    if (tournamentId) setSelectedTournamentId(tournamentId);
  }, [tournamentId]);

  useEffect(() => {
    const fetchTournament = async () => {
      setLoading(true);
      try {
        const user = getAuthUser();
        const res = await fetch(`${apiConfig.baseUrl}/api/tournament/detail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tournamentId, userId: user?._id, userRole: user?.role }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || "Failed to load tournament");
        setTournament(data.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load tournament");
      } finally {
        setLoading(false);
      }
    };
    if (tournamentId) fetchTournament();
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading tournament…
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-lg font-medium">Tournament not found</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
        <button onClick={() => navigate("/tournaments/manage")} className="mt-4 text-primary hover:underline">
          Back to tournaments
        </button>
      </div>
    );
  }

  const authUser = getAuthUser();
  const isLoggedIn = Boolean(authUser);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb / header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button onClick={() => navigate("/tournaments/manage")} className="inline-flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Tournaments
        </button>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[60vw]">{tournament.name || "Untitled tournament"}</span>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Sidebar (desktop) / horizontal tabs (mobile) */}
        <aside className="md:w-56 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {SECTIONS.filter(s => !s.adminOnly || isLoggedIn).map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-gradient-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Section content */}
        <main className="flex-1 min-w-0">
          <Outlet context={{ tournament, reload: () => navigate(0) }} />
        </main>
      </div>
    </div>
  );
};

// Helper for section components to read the workspace tournament
export const useWorkspace = () =>
  useOutletContext<{ tournament: WorkspaceTournament; reload: () => void }>();

export default TournamentWorkspace;
