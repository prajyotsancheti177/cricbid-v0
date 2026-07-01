import { useState, useEffect } from "react";
import { Trophy, Search } from "lucide-react";

import { TeamCard } from "@/components/team/TeamCard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import apiConfig from "@/config/apiConfig";
import { getSelectedTournamentId } from "@/lib/tournamentUtils";
import { trackPageView } from "@/lib/eventTracker";

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

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

  const cardVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: Math.min(i * 0.06, 0.5), duration: 0.45, ease: [0.22, 1, 0.36, 1] }
    })
  };

  const filteredTeams = teams.filter((t: any) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark">
        <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-8 md:py-12">
          {/* Header skeleton */}
          <div className="text-center mb-3 sm:mb-8 md:mb-12">
            <Skeleton className="h-8 w-52 mx-auto mb-3 rounded-full" />
            <Skeleton className="h-10 w-40 mx-auto mb-2" />
            <Skeleton className="h-5 w-36 mx-auto" />
          </div>
          {/* Team card skeletons — matches 1/2/3 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 md:gap-6 max-w-6xl mx-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
                {/* Team logo / banner area */}
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    {/* Team name */}
                    <Skeleton className="h-5 w-3/4" />
                    {/* Owner */}
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                {/* Budget row */}
                <Skeleton className="h-4 w-full" />
                {/* Players count */}
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        </div>
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

        {/* Search filter */}
        <div className="flex justify-center mb-4 sm:mb-6">
          <div className="relative w-full max-w-xs sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-md bg-card border border-border text-foreground text-sm w-full focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Teams Grid - 2 columns on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 md:gap-6 max-w-6xl mx-auto">
          {filteredTeams.map((team, index) => (
            <motion.div
              key={team.name}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "0px 0px -40px 0px" }}
            >
              <TeamCard team={team} />
            </motion.div>
          ))}
        </div>

        {filteredTeams.length === 0 && teams.length > 0 && (
          <div className="text-center py-10 sm:py-20">
            <p className="text-lg sm:text-2xl text-muted-foreground">No teams match your search</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Teams;

