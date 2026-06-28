import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Trophy, Users, DollarSign, UserMinus, UsersRound, RotateCcw, Plus, Link, Loader2, MoreHorizontal, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RegistrationConfigDialog } from "@/components/auction/RegistrationConfigDialog";
import { SyncPreviewDialog } from "@/components/auction/SyncPreviewDialog";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import apiConfig from "@/config/apiConfig";

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteAllTeamsDialogOpen, setDeleteAllTeamsDialogOpen] = useState(false);
  const [deleteAllPlayersDialogOpen, setDeleteAllPlayersDialogOpen] = useState(false);
  const [resetUnsoldDialogOpen, setResetUnsoldDialogOpen] = useState(false);
  const [actionTournamentId, setActionTournamentId] = useState<string | null>(null);
  const [actionTournamentName, setActionTournamentName] = useState("");
  const [isResettingUnsold, setIsResettingUnsold] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isTournamentHost = user.role === "tournament_host"; // used in table column visibility

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiConfig.baseUrl}/api/tournament/all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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


  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      const response = await fetch(`${apiConfig.baseUrl}/api/tournament/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: deletingId,
          userId: user._id,
          userRole: user.role,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Success",
          description: "Tournament deleted successfully",
        });
        setDeleteDialogOpen(false);
        setDeletingId(null);
        fetchTournaments();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to delete tournament",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while deleting the tournament",
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (tournamentId: string) => {
    setDeletingId(tournamentId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteAllTeams = async () => {
    if (!actionTournamentId) return;

    try {
      const response = await fetch(`${apiConfig.baseUrl}/api/team/delete-all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user._id
        },
        body: JSON.stringify({
          touranmentId: actionTournamentId,
          userId: user._id,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Success",
          description: data.message || "All teams deleted successfully",
        });
        setDeleteAllTeamsDialogOpen(false);
        setActionTournamentId(null);
        fetchTournaments();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to delete teams",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while deleting teams",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllPlayers = async () => {
    if (!actionTournamentId) return;

    try {
      const response = await fetch(`${apiConfig.baseUrl}/api/player/delete-all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user._id
        },
        body: JSON.stringify({
          touranmentId: actionTournamentId,
          userId: user._id,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Success",
          description: data.message || "All players deleted successfully",
        });
        setDeleteAllPlayersDialogOpen(false);
        setActionTournamentId(null);
        fetchTournaments();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to delete players",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while deleting players",
        variant: "destructive",
      });
    }
  };

  const handleResetUnsold = async () => {
    if (!actionTournamentId) return;

    try {
      setIsResettingUnsold(true);

      const response = await fetch(`${apiConfig.baseUrl}/api/player/reset-unsold`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user._id,
          "x-user-role": user.role
        },
        body: JSON.stringify({
          touranmentId: actionTournamentId,
          userId: user._id,
          userRole: user.role,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: data.message || `${data.data?.count || 0} unsold player(s) reset to pending.`,
        });
        setResetUnsoldDialogOpen(false);
        setActionTournamentId(null);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to reset unsold players",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while resetting unsold players",
        variant: "destructive",
      });
    } finally {
      setIsResettingUnsold(false);
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
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-3xl font-bold flex items-center gap-2">
                <Trophy className="h-8 w-8" />
                Tournament Management
              </CardTitle>
              <CardDescription className="mt-2">
                {isTournamentHost
                  ? "Manage your tournaments"
                  : "Manage all tournaments in the system"}
              </CardDescription>
            </div>
            <Button onClick={() => { setEditingTournament(null); setFormDialogOpen(true); }} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Create Tournament
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tournaments.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-lg text-gray-500">No tournaments found</p>
              <p className="text-sm text-gray-400 mt-2">
                Click "Create Tournament" to add your first tournament
              </p>
            </div>
          ) : (
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
                      <DollarSign className="inline h-4 w-4" />
                      {tournament.totalBudget?.toLocaleString() || "0"}
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label="More actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Setup</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => { setEditingTournament(tournament); setFormDialogOpen(true); }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit tournament details
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Registration</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setActionTournamentId(tournament._id);
                                setActionTournamentName(tournament.name || "");
                                setConfigDialogOpen(true);
                              }}
                            >
                              <Link className="h-4 w-4 mr-2 text-purple-500" />
                              Customize registration form
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/team-register/${tournament._id}`);
                                toast({ title: "Copied!", description: "Team Registration link copied to clipboard" });
                              }}
                            >
                              <Users className="h-4 w-4 mr-2 text-indigo-500" />
                              Copy team registration link
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-red-500">Danger zone</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setActionTournamentId(tournament._id);
                                setResetUnsoldDialogOpen(true);
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-2 text-amber-500" />
                              Reset unsold players
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setActionTournamentId(tournament._id);
                                setDeleteAllTeamsDialogOpen(true);
                              }}
                            >
                              <UsersRound className="h-4 w-4 mr-2 text-orange-500" />
                              Delete all teams
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setActionTournamentId(tournament._id);
                                setDeleteAllPlayersDialogOpen(true);
                              }}
                            >
                              <UserMinus className="h-4 w-4 mr-2 text-orange-500" />
                              Delete all players
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(tournament._id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete tournament
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TournamentFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        tournament={editingTournament}
        onSuccess={fetchTournaments}
      />

      {configDialogOpen && actionTournamentId && (
        <RegistrationConfigDialog
          isOpen={configDialogOpen}
          onClose={() => setConfigDialogOpen(false)}
          tournamentId={actionTournamentId}
          tournamentName={actionTournamentName}
        />
      )}
      {syncDialogOpen && actionTournamentId && (
        <SyncPreviewDialog
          isOpen={syncDialogOpen}
          onClose={() => { setSyncDialogOpen(false); fetchTournaments(); }}
          tournamentId={actionTournamentId}
        />
      )}
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              tournament and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Teams Confirmation Dialog */}
      <AlertDialog open={deleteAllTeamsDialogOpen} onOpenChange={setDeleteAllTeamsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Teams?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete ALL teams
              in this tournament. Players will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActionTournamentId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllTeams}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Delete All Teams
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Players Confirmation Dialog */}
      <AlertDialog open={deleteAllPlayersDialogOpen} onOpenChange={setDeleteAllPlayersDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Players?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete ALL players
              in this tournament.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActionTournamentId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllPlayers}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Delete All Players
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Unsold Players Confirmation Dialog */}
      <AlertDialog open={resetUnsoldDialogOpen} onOpenChange={setResetUnsoldDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Unsold Players?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move all unsold players back to "Pending" status so they can be
              auctioned again. This is useful for conducting another round of auction
              for players who went unsold.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActionTournamentId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetUnsold}
              disabled={isResettingUnsold}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isResettingUnsold ? "Resetting..." : "Reset Unsold Players"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
