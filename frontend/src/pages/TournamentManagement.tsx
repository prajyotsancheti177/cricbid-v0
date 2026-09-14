import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Users, Wallet, Plus } from "lucide-react";
import TournamentFormDialog from "@/components/tournament/TournamentFormDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import apiConfig from "@/config/apiConfig";
import { jsonAuthHeaders } from "@/lib/auth";

interface Tournament {
  _id: string;
  name?: string;
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
  categoryBasePrices?: { [key: string]: number };
  bidIncrementSlabs?: Array<{ minBid: number; maxBid: number | null; increment: number }>;
  createdAt?: string;
  updatedAt?: string;
}

export default function TournamentManagement() {
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isTournamentHost = user.role === "tournament_host"; // used in table column visibility

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiConfig.baseUrl}/api/tournament/managed`, {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({
          userId: user._id,
          userRole: user.role,
        }),
      });

      const data = await response.json();
      console.log("Fetched tournaments data:", data); // Debug log
      if (response.ok) {
        setTournaments(data.data || []);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to fetch tournaments",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching tournaments:", error); // Debug log
      toast({
        title: "Error",
        description: "Failed to fetch tournaments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading tournaments...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 md:py-8 px-3 md:px-4">
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="min-w-0">
              <CardTitle className="text-xl md:text-3xl font-bold flex items-center gap-2">
                <Trophy className="h-6 w-6 md:h-8 md:w-8 shrink-0" />
                Tournament Management
              </CardTitle>
              <CardDescription className="mt-2">
                {isTournamentHost
                  ? "Manage your tournaments"
                  : "Manage all tournaments in the system"}
              </CardDescription>
            </div>
            <Button onClick={() => { setEditingTournament(null); setFormDialogOpen(true); }} size="lg" className="w-full sm:w-auto">
              <Plus className="h-5 w-5 mr-2" />
              Create Tournament
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
          {tournaments.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-lg text-gray-500">No tournaments found</p>
              <p className="text-sm text-gray-400 mt-2">
                Click "Create Tournament" to add your first tournament
              </p>
            </div>
          ) : (
            <>
            {/* Phones: one card per tournament instead of a 7-column table */}
            <div className="flex flex-col gap-3 md:hidden">
              {tournaments.map((tournament) => (
                <div key={tournament._id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold leading-snug break-words">
                        {tournament.name || "Unnamed Tournament"}
                      </div>
                      {!isTournamentHost && tournament.tournamentHostId?.name && (
                        <div className="text-xs text-muted-foreground truncate">
                          Host: {tournament.tournamentHostId.name}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={() => navigate(`/tournament/${tournament._id}/manage/overview`)}
                    >
                      Manage
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {tournament.noOfTeams || 0} teams
                    </span>
                    <span>{tournament.minPlayersPerTeam || 0}-{tournament.maxPlayersPerTeam || 0} players/team</span>
                    <span className="flex items-center gap-1">
                      <Wallet className="h-3 w-3" />
                      {tournament.totalBudget?.toLocaleString() || "0"} Pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tournament Name</TableHead>
                  {!isTournamentHost && <TableHead>Host</TableHead>}
                  <TableHead className="text-center">Teams</TableHead>
                  <TableHead className="text-center">Players/Team</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tournaments.map((tournament) => (
                  <TableRow key={tournament._id}>
                    <TableCell className="font-medium">
                      {tournament.name || "Unnamed Tournament"}
                    </TableCell>
                    {!isTournamentHost && (
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {tournament.tournamentHostId?.name || "N/A"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {tournament.tournamentHostId?.email || ""}
                          </div>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        <Users className="h-3 w-3 mr-1" />
                        {tournament.noOfTeams || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {tournament.minPlayersPerTeam || 0} - {tournament.maxPlayersPerTeam || 0}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <Wallet className="inline h-4 w-4" />
                      {tournament.totalBudget?.toLocaleString() || "0"} Pts
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {tournament.playerCategories?.slice(0, 3).map((cat, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {cat}
                          </Badge>
                        ))}
                        {(tournament.playerCategories?.length || 0) > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{(tournament.playerCategories?.length || 0) - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center items-center gap-1">
                        <Button
                          size="sm"
                          onClick={() => navigate(`/tournament/${tournament._id}/manage/overview`)}
                          className="gap-1"
                        >
                          Manage
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <TournamentFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        tournament={editingTournament}
        onSuccess={fetchTournaments}
      />

    </div>
  );
}
