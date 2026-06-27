import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";

import { TeamCard } from "@/components/team/TeamCard";
import apiConfig from "@/config/apiConfig";
import { getSelectedTournamentId } from "@/lib/tournamentUtils";
import { trackPageView } from "@/lib/eventTracker";

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const tournamentId = getSelectedTournamentId();
        const response = await fetch(`${apiConfig.baseUrl}/api/team/all`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            touranmentId: tournamentId,
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to fetch teams");
        }
        const data = await response.json();
        if (!Array.isArray(data.data[0]?.teams)) {
          console.warn("API response does not contain a valid teams array. Setting teams to an empty array.");
          setTeams([]);
        } else {
          setTeams(data.data[0].teams);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
    const tournamentId = getSelectedTournamentId();
    trackPageView("/teams", tournamentId || undefined);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-base sm:text-xl text-muted-foreground">Loading teams...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-base sm:text-xl text-destructive">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-8 md:py-12">
        {/* Header - Compact */}
        <div className="text-center mb-3 sm:mb-8 md:mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4 px-3 sm:px-6 py-1.5 sm:py-3 rounded-full bg-card border border-primary sm:border-2 shadow-glow">
            <Trophy className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
            <span className="text-sm sm:text-xl font-bold text-foreground">Tournament Teams</span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black bg-gradient-primary bg-clip-text text-transparent mb-1 sm:mb-4">
            All Teams
          </h1>
          <p className="text-sm sm:text-xl text-muted-foreground">
            {teams.length} teams competing
          </p>
        </div>

        {/* Teams Grid - 2 columns on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 md:gap-6 max-w-6xl mx-auto">
          {teams.map((team, index) => (
            <div
              key={team.name}
              className="animate-scale-in"
              style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
            >
              <TeamCard team={team} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Teams;

