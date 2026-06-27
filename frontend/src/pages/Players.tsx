import { useState, useEffect } from "react";
import { PlayerCard } from "@/components/auction/PlayerCard";
import { PlayerDetailsModal } from "@/components/player/PlayerDetailsModal";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { PlayerStatus, Player } from "@/types/auction";
import apiConfig from "@/config/apiConfig";
import { getSelectedTournamentId } from "@/lib/tournamentUtils";
import { trackPageView } from "@/lib/eventTracker";

const Players = () => {
  const [players, setPlayers] = useState([]);
  const [filter, setFilter] = useState<PlayerStatus | "All" | "Remaining">("All");
  const [selectedCategory, setSelectedCategory] = useState<string | "All">("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const tournamentId = getSelectedTournamentId();
        const response = await fetch(`${apiConfig.baseUrl}/api/player/all`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            touranmentId: tournamentId,
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to fetch players");
        }
        const data = await response.json();
        if (!Array.isArray(data.data)) {
          console.warn("API response does not contain a valid players array. Setting players to an empty array.");
          setPlayers([]);
        } else {
          setPlayers(data.data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
    const tournamentId = getSelectedTournamentId();
    trackPageView("/players", tournamentId || undefined);
  }, []);

  const categories = Array.from(
    new Set(players.map((p: any) => (p.playerCategory ? p.playerCategory : null)).filter(Boolean))
  );

  const playersInCategory = selectedCategory === "All"
    ? players
    : players.filter((p: any) => p.playerCategory === selectedCategory);

  const filteredPlayers = filter === "All"
    ? playersInCategory
    : filter === "Sold"
      ? playersInCategory.filter(p => p.sold === true)
      : filter === "Unsold"
        ? playersInCategory.filter(p => p.auctionStatus === true && p.sold === false)
        : filter === "Remaining"
          ? playersInCategory.filter(p => p.auctionStatus === false)
          : playersInCategory;

  const filteredBySearch = filteredPlayers.filter((p: any) => {
    if (!search) return true;
    return p.name.toLowerCase().includes(search.toLowerCase());
  });

  const soldCount = playersInCategory.filter(p => p.sold === true).length;
  const unsoldCount = playersInCategory.filter(p => p.auctionStatus === true && p.sold === false).length;
  const remainingCount = playersInCategory.filter(p => p.auctionStatus === false).length;

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer(player);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedPlayer(null);
  };

  const handlePlayerUpdate = (updatedPlayer: Player) => {
    setPlayers(prev => prev.map(p =>
      p._id === updatedPlayer._id ? updatedPlayer : p
    ));
  };

  const handlePlayerDelete = (playerId: string) => {
    setPlayers(prev => prev.filter(p => p._id !== playerId));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-base sm:text-xl text-muted-foreground">Loading players...</p>
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
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 md:py-12">
        {/* Header - Compact on mobile */}
        <div className="text-center mb-4 sm:mb-8 md:mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4 px-3 sm:px-6 py-1.5 sm:py-3 rounded-full bg-card border border-primary sm:border-2 shadow-glow">
            <Users className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
            <span className="text-sm sm:text-xl font-bold text-foreground">Player Registry</span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black bg-gradient-primary bg-clip-text text-transparent mb-2 sm:mb-4">
            All Players
          </h1>
          <p className="text-sm sm:text-xl text-muted-foreground mb-4 sm:mb-8">
            {players.length} registered players
          </p>

          {/* Stats - Compact horizontal on mobile */}
          <div className="flex justify-center gap-4 sm:gap-8 mb-4 sm:mb-8">
            <div className="text-center">
              <p className="text-xl sm:text-4xl font-black text-accent">{soldCount}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Sold</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-4xl font-black text-destructive">{unsoldCount}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Unsold</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-4xl font-black text-warning">{remainingCount}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Remaining</p>
            </div>
          </div>

          {/* Filters - Compact on mobile */}
          <div className="flex flex-col gap-3 sm:gap-4 w-full">
            {/* Search + Category row */}
            <div className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-3 w-full sm:justify-center">
              <input
                type="text"
                placeholder="Search player..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-md bg-card border border-border text-foreground text-sm sm:text-base w-full sm:w-48 md:w-64"
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-md bg-card border border-border text-foreground text-sm sm:text-base w-full sm:w-auto"
              >
                <option value="All">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Filter buttons - scrollable on mobile */}
            <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto no-scrollbar pb-1 justify-start sm:justify-center">
              <Button
                variant={filter === "All" ? "default" : "outline"}
                onClick={() => setFilter("All")}
                className={`${filter === "All" ? "bg-gradient-primary" : ""} px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-base whitespace-nowrap flex-shrink-0`}
                size="sm"
              >
                All ({playersInCategory.length})
              </Button>
              <Button
                variant={filter === "Sold" ? "default" : "outline"}
                onClick={() => setFilter("Sold")}
                className={`${filter === "Sold" ? "bg-gradient-accent" : ""} px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-base whitespace-nowrap flex-shrink-0`}
                size="sm"
              >
                Sold ({soldCount})
              </Button>
              <Button
                variant={filter === "Unsold" ? "default" : "outline"}
                onClick={() => setFilter("Unsold")}
                className={`${filter === "Unsold" ? "bg-gradient-secondary" : ""} px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-base whitespace-nowrap flex-shrink-0`}
                size="sm"
              >
                Unsold ({unsoldCount})
              </Button>
              <Button
                variant={filter === "Remaining" ? "default" : "outline"}
                onClick={() => setFilter("Remaining")}
                className={`${filter === "Remaining" ? "bg-gradient-warning" : ""} px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-base whitespace-nowrap flex-shrink-0`}
                size="sm"
              >
                Pending ({remainingCount})
              </Button>
            </div>
          </div>
        </div>

        {/* Players Grid: 2 columns on mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4 md:gap-6">
          {filteredBySearch.map((player, index) => (
            <div
              key={player._id}
              className="animate-scale-in"
              style={{ animationDelay: `${Math.min(index * 0.03, 0.5)}s` }}
            >
              <PlayerCard player={player} onClick={handlePlayerClick} categories={categories as string[]} />
            </div>
          ))}
        </div>

        {filteredBySearch.length === 0 && (
          <div className="text-center py-10 sm:py-20">
            <p className="text-lg sm:text-2xl text-muted-foreground">No players found</p>
          </div>
        )}
      </div>

      <PlayerDetailsModal
        player={selectedPlayer}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onUpdate={handlePlayerUpdate}
        onDelete={handlePlayerDelete}
      />
    </div>
  );
};

export default Players;

