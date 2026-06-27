import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Users, Wallet } from "lucide-react";
import { PlayerCard } from "@/components/auction/PlayerCard";
import apiConfig from "@/config/apiConfig";
import { getDriveThumbnail } from "@/lib/imageUtils";

const TeamDetail = () => {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTeamDetails = async () => {
      try {
        const response = await fetch(`${apiConfig.baseUrl}/api/team/detail`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            teamId: teamId,
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to fetch team details");
        }
        const data = await response.json();
        if (data.data.length > 0) {
          setTeam(data.data[0]);
        } else {
          setTeam(null);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamDetails();
  }, [teamId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <p className="text-base sm:text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <p className="text-base sm:text-xl text-destructive">Error: {error}</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl sm:text-4xl font-bold text-foreground mb-4">Team Not Found</h1>
          <Link to="/teams">
            <Button variant="outline" size="sm">Back to Teams</Button>
          </Link>
        </div>
      </div>
    );
  }

  const budgetUsedPercentage = team.totalSpent && team.tournament.totalBudget
    ? (team.totalSpent / team.tournament.totalBudget) * 100
    : 0;

  const remainingSlots = team.tournament.maxPlayersPerTeam && team.players.length
    ? team.tournament.maxPlayersPerTeam - team.players.length
    : 0;

  return (
    <div className="min-h-screen bg-gradient-dark">
      <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-6 md:py-8">
        {/* Back Button - Compact */}
        <Link to="/teams">
          <Button variant="outline" className="mb-3 sm:mb-6 h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4" size="sm">
            <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Back
          </Button>
        </Link>

        {/* Team Header - Compact */}
        <div className="mb-4 sm:mb-8 md:mb-12 animate-fade-in">
          <div className="flex items-center gap-3 sm:gap-6 mb-4 sm:mb-8">
            <img
              src={getDriveThumbnail(team.logo)}
              alt={`${team.name} logo`}
              className="h-12 w-12 sm:h-20 sm:w-20 md:h-32 md:w-32 rounded-full shadow-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-3xl md:text-5xl font-black text-foreground mb-0.5 sm:mb-2 truncate">{team.name}</h1>
              <p className="text-xs sm:text-lg md:text-xl text-muted-foreground">Squad Details</p>
            </div>
          </div>

          {/* Stats Cards - Horizontal on mobile */}
          <div className="grid grid-cols-2 md:grid-cols-2 gap-2 sm:gap-4 md:gap-6">
            {/* Budget Card */}
            <Card className="p-2 sm:p-4 md:p-6 bg-card/80 backdrop-blur-sm border sm:border-2 border-border shadow-elevated">
              <div className="flex items-center gap-1.5 sm:gap-3 mb-2 sm:mb-4">
                <div className="p-1.5 sm:p-3 rounded-lg sm:rounded-xl bg-primary/10">
                  <Wallet className="h-3 w-3 sm:h-5 sm:w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <h3 className="text-xs sm:text-base md:text-lg font-bold text-foreground">Budget</h3>
              </div>

              <div className="space-y-1 sm:space-y-3">
                <div className="flex justify-between text-[10px] sm:text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold text-foreground text-[10px] sm:text-sm">
                    {team.tournament.totalBudget}
                  </span>
                </div>
                <Progress value={budgetUsedPercentage} className="h-1 sm:h-2" />
                <div className="flex justify-between text-[10px] sm:text-sm">
                  <span className="text-muted-foreground">Spent</span>
                  <span className="font-bold text-secondary text-[10px] sm:text-sm">
                    {team.totalSpent}
                  </span>
                </div>
                <div className="pt-1 sm:pt-2 border-t border-border">
                  <div className="flex justify-between">
                    <span className="text-[10px] sm:text-sm text-muted-foreground">Left</span>
                    <span className="font-bold text-accent text-[10px] sm:text-sm">
                      {team.remainingBudget}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Squad Card */}
            <Card className="p-2 sm:p-4 md:p-6 bg-card/80 backdrop-blur-sm border sm:border-2 border-border shadow-elevated">
              <div className="flex items-center gap-1.5 sm:gap-3 mb-2 sm:mb-4">
                <div className="p-1.5 sm:p-3 rounded-lg sm:rounded-xl bg-secondary/10">
                  <Users className="h-3 w-3 sm:h-5 sm:w-5 md:h-6 md:w-6 text-secondary" />
                </div>
                <h3 className="text-xs sm:text-base md:text-lg font-bold text-foreground">Squad</h3>
              </div>

              <div className="space-y-1 sm:space-y-3">
                <div className="flex justify-between text-[10px] sm:text-sm">
                  <span className="text-muted-foreground">Max</span>
                  <span className="font-bold text-foreground text-[10px] sm:text-sm">{team.tournament.maxPlayersPerTeam}</span>
                </div>
                <Progress
                  value={(team.players.length / team.tournament.maxPlayersPerTeam) * 100}
                  className="h-1 sm:h-2"
                />
                <div className="flex justify-between text-[10px] sm:text-sm">
                  <span className="text-muted-foreground">Current</span>
                  <span className="font-bold text-secondary text-[10px] sm:text-sm">{team.players.length}</span>
                </div>
                <div className="pt-1 sm:pt-2 border-t border-border">
                  <div className="flex justify-between">
                    <span className="text-[10px] sm:text-sm text-muted-foreground">Slots</span>
                    <span className="font-bold text-accent text-[10px] sm:text-sm">{remainingSlots}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Players Section */}
        <div>
          <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-foreground mb-3 sm:mb-6">
            Squad ({team.players.length})
          </h2>

          {team.players.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4 md:gap-6">
              {team.players.map((player, index) => (
                <div
                  key={player._id}
                  className="animate-scale-in"
                  style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
                >
                  <PlayerCard player={player} />
                </div>
              ))}
            </div>
          ) : (
            <Card className="p-6 sm:p-12 text-center bg-card/80 backdrop-blur-sm">
              <p className="text-sm sm:text-xl text-muted-foreground">No players in squad yet</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamDetail;

