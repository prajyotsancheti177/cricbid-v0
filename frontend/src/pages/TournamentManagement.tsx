import { useState, useEffect } from "react";
import { Pencil, Trash2, Trophy, Users, DollarSign, Download, UserMinus, UsersRound, RotateCcw, Plus } from "lucide-react";
import { BidSlabEditor, BidSlab } from "@/components/auction/BidSlabEditor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  bidIncrementSlabs?: Array<{
    minBid: number;
    maxBid: number | null;
    increment: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

interface TournamentHost {
  _id: string;
  name: string;
  email: string;
}

interface TournamentFormData {
  name: string;
  tournamentHostId?: string;
  noOfTeams: number | string;
  maxPlayersPerTeam: number | string;
  minPlayersPerTeam: number | string;
  totalBudget: number | string;
  playerCategories: string;
  categoryBasePrices: { [key: string]: string };
  bidIncrementSlabs: Array<{
    minBid: number;
    maxBid: number | null;
    increment: number;
  }>;
}

export default function TournamentManagement() {
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentHosts, setTournamentHosts] = useState<TournamentHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteAllTeamsDialogOpen, setDeleteAllTeamsDialogOpen] = useState(false);
  const [deleteAllPlayersDialogOpen, setDeleteAllPlayersDialogOpen] = useState(false);
  const [resetUnsoldDialogOpen, setResetUnsoldDialogOpen] = useState(false);
  const [actionTournamentId, setActionTournamentId] = useState<string | null>(null);
  const [isResettingUnsold, setIsResettingUnsold] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isTournamentHost = user.role === "tournament_host";
  const canSelectHost = user.role === "boss" || user.role === "super_user";

  const [formData, setFormData] = useState<TournamentFormData>({
    name: "",
    tournamentHostId: "",
    noOfTeams: "",
    maxPlayersPerTeam: "",
    minPlayersPerTeam: "",
    totalBudget: "",
    playerCategories: "",
    categoryBasePrices: {},
    bidIncrementSlabs: [
      { minBid: 0, maxBid: 499, increment: 50 },
      { minBid: 500, maxBid: null, increment: 100 }
    ],
  });

  useEffect(() => {
    fetchTournaments();
    if (canSelectHost) {
      fetchTournamentHosts();
    }
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

  const fetchTournamentHosts = async () => {
    try {
      const response = await fetch(`${apiConfig.baseUrl}/api/tournament/hosts`, {
        headers: {
          "x-user-id": user._id
        }
      });
      const data = await response.json();
      if (response.ok) {
        setTournamentHosts(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch tournament hosts:", error);
    }
  };

  const handleInputChange = (field: keyof TournamentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      tournamentHostId: "",
      noOfTeams: "",
      maxPlayersPerTeam: "",
      minPlayersPerTeam: "",
      totalBudget: "",
      playerCategories: "",
      categoryBasePrices: {},
      bidIncrementSlabs: [
        { minBid: 0, maxBid: 499, increment: 50 },
        { minBid: 500, maxBid: null, increment: 100 }
      ],
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleOpenDialog = (tournament?: Tournament) => {
    if (tournament) {
      setIsEditing(true);
      setEditingId(tournament._id);
      const basePrices: { [key: string]: string } = {};
      if (tournament.categoryBasePrices) {
        Object.entries(tournament.categoryBasePrices).forEach(([key, value]) => {
          basePrices[key] = value.toString();
        });
      }
      setFormData({
        name: tournament.name || "",
        tournamentHostId: typeof tournament.tournamentHostId === 'object'
          ? tournament.tournamentHostId?._id || ""
          : (tournament.tournamentHostId as unknown as string) || "",
        noOfTeams: tournament.noOfTeams || "",
        maxPlayersPerTeam: tournament.maxPlayersPerTeam || "",
        minPlayersPerTeam: tournament.minPlayersPerTeam || "",
        totalBudget: tournament.totalBudget || "",
        playerCategories: tournament.playerCategories?.join(", ") || "",
        categoryBasePrices: basePrices,
        bidIncrementSlabs: tournament.bidIncrementSlabs || [
          { minBid: 0, maxBid: 499, increment: 50 },
          { minBid: 500, maxBid: null, increment: 100 }
        ],
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.name || !formData.noOfTeams || !formData.maxPlayersPerTeam ||
      !formData.minPlayersPerTeam || !formData.totalBudget) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (canSelectHost && !formData.tournamentHostId) {
      toast({
        title: "Validation Error",
        description: "Please select a tournament host",
        variant: "destructive",
      });
      return;
    }

    try {
      const categories = formData.playerCategories
        .split(",")
        .map((cat) => cat.trim())
        .filter((cat) => cat);

      // Validate base prices for all categories
      const categoryBasePrices: { [key: string]: number } = {};
      for (const category of categories) {
        const basePrice = formData.categoryBasePrices[category];
        if (!basePrice || Number(basePrice) <= 0) {
          toast({
            title: "Validation Error",
            description: `Please enter a valid base price for category: ${category}`,
            variant: "destructive",
          });
          return;
        }
        categoryBasePrices[category] = Number(basePrice);
      }

      const payload = {
        name: formData.name,
        noOfTeams: Number(formData.noOfTeams),
        maxPlayersPerTeam: Number(formData.maxPlayersPerTeam),
        minPlayersPerTeam: Number(formData.minPlayersPerTeam),
        totalBudget: Number(formData.totalBudget),
        playerCategories: categories,
        categoryBasePrices: categoryBasePrices,
        bidIncrementSlabs: formData.bidIncrementSlabs,
        userId: user._id,
        userRole: user.role,
        ...(canSelectHost && { tournamentHostId: formData.tournamentHostId }),
      };

      let url = `${apiConfig.baseUrl}/api/tournament/register`;
      if (isEditing && editingId) {
        url = `${apiConfig.baseUrl}/api/tournament/update`;
        Object.assign(payload, { tournamentId: editingId });
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Success",
          description: isEditing
            ? "Tournament updated successfully"
            : "Tournament created successfully",
        });
        handleCloseDialog();
        fetchTournaments();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to save tournament",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while saving the tournament",
        variant: "destructive",
      });
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

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadData = async (tournamentId: string, tournamentName: string) => {
    try {
      console.log("Exporting data for tournament:", tournamentId);
      const response = await fetch(`${apiConfig.baseUrl}/api/tournament/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user._id
        },
        body: JSON.stringify({
          tournamentId,
          userId: user._id,
        }),
      });

      const result = await response.json();
      console.log("Export response:", result);

      if (!response.ok) {
        toast({
          title: "Error",
          description: result.message || "Failed to export data",
          variant: "destructive",
        });
        return;
      }

      const data = result.data;

      if (!data) {
        toast({
          title: "Error",
          description: "No data returned from server",
          variant: "destructive",
        });
        return;
      }

      const safeName = tournamentName.replace(/[^a-zA-Z0-9]/g, '_');

      // Create Teams CSV - matches import format: Team Name,Team Logo URL,Owner Name,Owner Contact Number
      const teamsHeaders = "Team Name,Team Logo URL,Owner Name,Owner Contact Number";
      const teamsRows = (data.teams || []).map((t: { name: string; logo: string; ownerName: string; ownerMobile: string }) =>
        `"${t.name || ''}","${t.logo || ''}","${t.ownerName || ''}","${t.ownerMobile || ''}"`
      ).join("\n");
      const teamsCSV = `${teamsHeaders}\n${teamsRows}`;

      // Create Players CSV - matches import format: Serial Number,Player Name,Age,Photo URL,Category,Skill,Phone Number
      // Plus additional columns for auction status
      const playersHeaders = "Serial Number,Player Name,Age,Photo URL,Category,Skill,Phone Number,Team (Sold To),Sold,Amount Sold";
      const playersRows = (data.players || []).map((p: { auctionSerialNumber: number | string; name: string; age: string; photo: string; playerCategory: string; skill: string; mobile: string; teamName: string; sold: string; amtSold: number }) =>
        `"${p.auctionSerialNumber || ''}","${p.name || ''}","${p.age || ''}","${p.photo || ''}","${p.playerCategory || ''}","${p.skill || ''}","${p.mobile || ''}","${p.teamName || ''}","${p.sold || ''}","${p.amtSold || 0}"`
      ).join("\n");
      const playersCSV = `${playersHeaders}\n${playersRows}`;

      // Download teams first
      downloadCSV(teamsCSV, `${safeName}_teams.csv`);

      // Download players after a short delay
      setTimeout(() => {
        downloadCSV(playersCSV, `${safeName}_players.csv`);
        toast({
          title: "Success",
          description: `Exported ${data.teams?.length || 0} teams and ${data.players?.length || 0} players`,
        });
      }, 300);

    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Error",
        description: "An error occurred while exporting data",
        variant: "destructive",
      });
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
            <Button onClick={() => handleOpenDialog()} size="lg">
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
                      <div className="flex justify-center gap-1 flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(tournament)}
                          title="Edit Tournament"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadData(tournament._id, tournament.name || 'tournament')}
                          title="Download Data"
                        >
                          <Download className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActionTournamentId(tournament._id);
                            setDeleteAllTeamsDialogOpen(true);
                          }}
                          title="Delete All Teams"
                        >
                          <UsersRound className="h-4 w-4 text-orange-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActionTournamentId(tournament._id);
                            setDeleteAllPlayersDialogOpen(true);
                          }}
                          title="Delete All Players"
                        >
                          <UserMinus className="h-4 w-4 text-orange-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActionTournamentId(tournament._id);
                            setResetUnsoldDialogOpen(true);
                          }}
                          title="Reset Unsold Players to Pending"
                        >
                          <RotateCcw className="h-4 w-4 text-amber-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(tournament._id)}
                          title="Delete Tournament"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Tournament Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Tournament" : "Create New Tournament"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the tournament details below"
                : "Fill in the details to create a new tournament"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Tournament Name *</Label>
              <Input
                id="name"
                placeholder="e.g., IPL 2025"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
              />
            </div>

            {canSelectHost && (
              <div className="grid gap-2">
                <Label htmlFor="host">Tournament Host *</Label>
                <Select
                  value={formData.tournamentHostId}
                  onValueChange={(value) =>
                    handleInputChange("tournamentHostId", value)
                  }
                  disabled={isEditing && isTournamentHost}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tournament host" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournamentHosts.map((host) => (
                      <SelectItem key={host._id} value={host._id}>
                        {host.name} ({host.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="teams">Number of Teams *</Label>
                <Input
                  id="teams"
                  type="number"
                  placeholder="e.g., 8"
                  value={formData.noOfTeams}
                  onChange={(e) => handleInputChange("noOfTeams", e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="budget">Total Budget *</Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="e.g., 100000"
                  value={formData.totalBudget}
                  onChange={(e) => handleInputChange("totalBudget", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="minPlayers">Min Players per Team *</Label>
                <Input
                  id="minPlayers"
                  type="number"
                  placeholder="e.g., 11"
                  value={formData.minPlayersPerTeam}
                  onChange={(e) =>
                    handleInputChange("minPlayersPerTeam", e.target.value)
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="maxPlayers">Max Players per Team *</Label>
                <Input
                  id="maxPlayers"
                  type="number"
                  placeholder="e.g., 15"
                  value={formData.maxPlayersPerTeam}
                  onChange={(e) =>
                    handleInputChange("maxPlayersPerTeam", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="categories">
                Player Categories (comma-separated) *
              </Label>
              <Input
                id="categories"
                placeholder="e.g., Batsman, Bowler, All-rounder, Wicket-keeper"
                value={formData.playerCategories}
                onChange={(e) => {
                  const categories = e.target.value;
                  handleInputChange("playerCategories", categories);

                  // Auto-create base price fields for each category
                  const categoryList = categories
                    .split(",")
                    .map((cat) => cat.trim())
                    .filter((cat) => cat);

                  const newBasePrices: { [key: string]: string } = {};
                  categoryList.forEach((cat) => {
                    // Keep existing value if category already had a base price
                    newBasePrices[cat] = formData.categoryBasePrices[cat] || "";
                  });
                  setFormData((prev) => ({
                    ...prev,
                    playerCategories: categories,
                    categoryBasePrices: newBasePrices,
                  }));
                }}
              />
              <p className="text-xs text-gray-500">
                Separate multiple categories with commas
              </p>
            </div>

            {/* Base Prices for Categories */}
            {formData.playerCategories.split(",").map((cat) => cat.trim()).filter((cat) => cat).length > 0 && (
              <div className="grid gap-3 p-4 border rounded-lg bg-gray-50">
                <Label className="font-semibold text-base dark:text-gray-100 text-gray-900">Base Prices for Categories *</Label>
                <div className="grid gap-4">
                  {formData.playerCategories
                    .split(",")
                    .map((cat) => cat.trim())
                    .filter((cat) => cat)
                    .map((category, idx) => (
                      <div key={idx} className="grid gap-2">
                        <Label htmlFor={`basePrice-${idx}`} className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {category}
                        </Label>
                        <Input
                          id={`basePrice-${idx}`}
                          type="number"
                          placeholder="e.g., 500"
                          value={formData.categoryBasePrices[category] || ""}
                          onChange={(e) => {
                            setFormData((prev) => ({
                              ...prev,
                              categoryBasePrices: {
                                ...prev.categoryBasePrices,
                                [category]: e.target.value,
                              },
                            }));
                          }}
                        />
                      </div>
                    ))}
                </div>
                <p className="text-xs text-gray-500">
                  Enter the base auction price (in points) for each category
                </p>
              </div>
            )}

            {/* Bid Increment Slabs */}
            <div className="grid gap-3 p-4 border rounded-lg bg-gray-50">
              <Label className="font-semibold text-base dark:text-gray-100 text-gray-900">Bid Increment Settings *</Label>
              <BidSlabEditor
                slabs={formData.bidIncrementSlabs}
                onChange={(slabs) => setFormData(prev => ({ ...prev, bidIncrementSlabs: slabs }))}
              />
              <p className="text-xs text-gray-500">
                Configure bid increments for different price ranges during auction
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {isEditing ? "Update Tournament" : "Create Tournament"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
