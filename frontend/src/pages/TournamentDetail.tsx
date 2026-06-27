import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Calendar, DollarSign, ArrowLeft, UserCircle, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import apiConfig from "@/config/apiConfig";
import { setSelectedTournamentId } from "@/lib/tournamentUtils";
import { trackEvent, trackPageView } from "@/lib/eventTracker";

interface Tournament {
  _id: string;
  name: string;
  tournamentHostId?: {
    _id: string;
    name: string;
    email: string;
  };
  noOfTeams?: number;
  maxPlayersPerTeam?: number;
  minPlayersPerTeam?: number;
  totalBudget?: number;
  playerCategories?: string[];
  createdAt?: string;
  updatedAt?: string;
}

const TournamentDetail = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tournamentId) {
      navigate("/tournaments");
      return;
    }

    setSelectedTournamentId(tournamentId);

    const fetchTournament = async () => {
      try {
        const userStr = localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : null;

        const response = await fetch(`${apiConfig.baseUrl}/api/tournament/detail`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tournamentId,
            userId: user?._id || "",
            userRole: user?.role || "guest",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch tournament details");
        }

        const data = await response.json();
        setTournament(data.data || null);
      } catch (err) {
        console.error("Error fetching tournament:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch tournament");
      } finally {
        setLoading(false);
      }
    };

    fetchTournament();
    trackPageView(`/tournament/${tournamentId}`, tournamentId);
  }, [tournamentId, navigate]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "0";
    if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)}Cr`;
    if (amount >= 100000) return `${(amount / 100000).toFixed(2)}L`;
    return new Intl.NumberFormat("en-IN").format(amount);
  };

  const handleViewPlayers = () => {
    trackEvent("players_view", { tournamentId }, tournamentId);
    navigate("/players");
  };

  const handleViewTeams = () => {
    trackEvent("teams_view", { tournamentId }, tournamentId);
    navigate("/teams");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-base sm:text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-base sm:text-xl text-destructive mb-4">{error || "Tournament not found"}</p>
          <Button onClick={() => navigate("/tournaments")} size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-2 sm:p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Back Button - Compact */}
        <Button
          variant="ghost"
          onClick={() => navigate("/tournaments")}
          className="mb-2 sm:mb-4 h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4"
          size="sm"
        >
          <ArrowLeft className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          Back
        </Button>

        {/* Tournament Header - Compact */}
        <Card className="mb-3 sm:mb-6 border border-primary/20 sm:border-2">
          <CardContent className="p-3 sm:p-6">
            {/* Title Row */}
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
              <Trophy className="h-5 w-5 sm:h-8 md:h-10 text-primary flex-shrink-0" />
              <h1 className="text-lg sm:text-2xl md:text-4xl font-bold truncate">
                {tournament.name || "Unnamed Tournament"}
              </h1>
            </div>

            {/* Meta info - Single line */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{formatDate(tournament.createdAt)}</span>
              </div>
              {tournament.tournamentHostId && (
                <div className="flex items-center gap-1">
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>{tournament.tournamentHostId.name}</span>
                </div>
              )}
            </div>

            {/* Stats Row - Horizontal on all screens */}
            <div className="flex items-stretch gap-2 sm:gap-4 mb-3 sm:mb-4">
              {/* Teams */}
              <div className="flex-1 p-2 sm:p-4 bg-muted rounded-lg text-center">
                <Users className="h-4 w-4 sm:h-6 md:h-8 text-primary mx-auto mb-0.5 sm:mb-1" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">Teams</p>
                <p className="text-lg sm:text-2xl md:text-3xl font-bold">{tournament.noOfTeams || 0}</p>
              </div>

              {/* Players per Team */}
              <div className="flex-1 p-2 sm:p-4 bg-muted rounded-lg text-center">
                <UserCircle className="h-4 w-4 sm:h-6 md:h-8 text-primary mx-auto mb-0.5 sm:mb-1" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">Players</p>
                <p className="text-lg sm:text-2xl md:text-3xl font-bold">
                  {tournament.minPlayersPerTeam || 0}-{tournament.maxPlayersPerTeam || 0}
                </p>
              </div>

              {/* Budget */}
              <div className="flex-1 p-2 sm:p-4 bg-muted rounded-lg text-center">
                <DollarSign className="h-4 w-4 sm:h-6 md:h-8 text-primary mx-auto mb-0.5 sm:mb-1" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">Budget</p>
                <p className="text-lg sm:text-2xl md:text-3xl font-bold">₹{formatCurrency(tournament.totalBudget)}</p>
              </div>
            </div>

            {/* Player Categories - Scrollable */}
            {tournament.playerCategories && tournament.playerCategories.length > 0 && (
              <div className="overflow-x-auto no-scrollbar">
                <div className="flex gap-1.5 sm:gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap self-center">Categories:</span>
                  {tournament.playerCategories.map((category, index) => (
                    <Badge key={index} variant="secondary" className="text-xs sm:text-sm py-0.5 sm:py-1 px-2 sm:px-3 whitespace-nowrap">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons - Modern gradient style */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          {/* View Players */}
          <button
            onClick={handleViewPlayers}
            className="relative overflow-hidden h-auto py-4 sm:py-8 flex flex-col items-center gap-1.5 sm:gap-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-purple-800 hover:from-violet-400 hover:via-purple-500 hover:to-purple-700 shadow-[0_0_25px_hsl(263,70%,50%,0.5)] hover:shadow-[0_0_35px_hsl(263,70%,50%,0.7)] transition-all duration-300 hover:scale-[1.02] text-white border border-violet-400/40"
          >
            {/* Glass reflection overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent rounded-t-xl sm:rounded-t-2xl pointer-events-none" />
            <UserCircle className="h-6 w-6 sm:h-10 sm:w-10 drop-shadow-lg relative z-10" />
            <span className="text-xs sm:text-lg font-bold tracking-wide relative z-10">View Players</span>
          </button>

          {/* View Teams */}
          <button
            onClick={handleViewTeams}
            className="relative overflow-hidden h-auto py-4 sm:py-8 flex flex-col items-center gap-1.5 sm:gap-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-800 hover:from-fuchsia-400 hover:via-purple-500 hover:to-indigo-700 shadow-[0_0_25px_hsl(280,70%,50%,0.5)] hover:shadow-[0_0_35px_hsl(280,70%,50%,0.7)] transition-all duration-300 hover:scale-[1.02] text-white border border-fuchsia-400/40"
          >
            {/* Glass reflection overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent rounded-t-xl sm:rounded-t-2xl pointer-events-none" />
            <Users className="h-6 w-6 sm:h-10 sm:w-10 drop-shadow-lg relative z-10" />
            <span className="text-xs sm:text-lg font-bold tracking-wide relative z-10">View Teams</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TournamentDetail;
