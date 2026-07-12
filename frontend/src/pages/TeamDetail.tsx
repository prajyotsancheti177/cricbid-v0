import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Users, Wallet, Pencil, Save, X, Trash2, Loader2 } from "lucide-react";
import { PlayerCard } from "@/components/auction/PlayerCard";
import apiConfig from "@/config/apiConfig";
import { getDriveThumbnail } from "@/lib/imageUtils";
import { compressImage } from "@/lib/imageCompressor";
import { useToast } from "@/hooks/use-toast";

const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
};

const TeamDetail = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: "", ownerName: "", ownerEmail: "", ownerMobile: "" });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setIsAuthenticated(localStorage.getItem("isAuthenticated") === "true");
  }, []);

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

  useEffect(() => {
    fetchTeamDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const handleEdit = () => {
    setEditData({
      name: team.name || "",
      ownerName: team.owner?.name || "",
      ownerEmail: team.owner?.email || "",
      ownerMobile: team.owner?.mobile || "",
    });
    setLogoFile(null);
    setLogoPreview(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleLogoChange = async (file) => {
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setLogoFile(compressed);
      setLogoPreview(URL.createObjectURL(compressed));
    } catch {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    const user = getUser();
    setSaving(true);
    try {
      const formPayload = new FormData();
      formPayload.append("teamId", team._id);
      if (user?._id) formPayload.append("userId", user._id);
      formPayload.append("name", editData.name.trim());
      formPayload.append("ownerName", editData.ownerName.trim());
      formPayload.append("ownerEmail", editData.ownerEmail.trim());
      formPayload.append("ownerMobile", editData.ownerMobile.trim());
      if (logoFile) formPayload.append("logo", logoFile);

      const res = await fetch(`${apiConfig.baseUrl}/api/team/update`, {
        method: "POST",
        body: formPayload,
        // Omit Content-Type so the browser sets the multipart boundary.
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || "Failed to update team");

      toast({ title: "Team updated" });
      setIsEditing(false);
      setLogoFile(null);
      setLogoPreview(null);
      fetchTeamDetails();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to update team", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const user = getUser();
    setDeleting(true);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/team/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team._id, userId: user?._id }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || "Failed to delete team");

      toast({ title: "Team deleted" });
      navigate("/teams");
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to delete team", variant: "destructive" });
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

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
        <div className="flex items-center justify-between mb-3 sm:mb-6">
          <Link to="/teams">
            <Button variant="outline" className="h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4" size="sm">
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Back
            </Button>
          </Link>

          {isAuthenticated && !isEditing && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 sm:h-10 text-xs sm:text-sm gap-1.5" onClick={handleEdit}>
                <Pencil className="h-3 w-3 sm:h-4 sm:w-4" /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 sm:h-10 text-xs sm:text-sm gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" /> Delete
              </Button>
            </div>
          )}
        </div>

        {/* Team Header - Compact */}
        <div className="mb-4 sm:mb-8 md:mb-12 animate-fade-in">
          {isEditing ? (
            <Card className="p-4 sm:p-6 mb-4 sm:mb-8 bg-card/80 backdrop-blur-sm border sm:border-2 border-border">
              <div className="flex items-center gap-4 mb-4">
                <img
                  src={logoPreview || getDriveThumbnail(team.logo)}
                  alt={`${team.name} logo`}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-full shadow-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <Label htmlFor="team-logo" className="text-xs">Team logo</Label>
                  <Input
                    id="team-logo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLogoChange(e.target.files?.[0])}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="team-name">Team name</Label>
                  <Input
                    id="team-name"
                    value={editData.name}
                    onChange={(e) => setEditData((p) => ({ ...p, name: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="owner-name">Owner name</Label>
                  <Input
                    id="owner-name"
                    value={editData.ownerName}
                    onChange={(e) => setEditData((p) => ({ ...p, ownerName: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="owner-email">Owner email</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    value={editData.ownerEmail}
                    onChange={(e) => setEditData((p) => ({ ...p, ownerEmail: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="owner-mobile">Owner mobile</Label>
                  <Input
                    id="owner-mobile"
                    value={editData.ownerMobile}
                    onChange={(e) => setEditData((p) => ({ ...p, ownerMobile: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
                <Button variant="outline" onClick={handleCancelEdit} disabled={saving} className="gap-2">
                  <X className="h-4 w-4" /> Cancel
                </Button>
              </div>
            </Card>
          ) : (
            <div className="flex items-center gap-3 sm:gap-6 mb-4 sm:mb-8">
              <img
                src={getDriveThumbnail(team.logo)}
                alt={`${team.name} logo`}
                className="h-12 w-12 sm:h-20 sm:w-20 md:h-32 md:w-32 rounded-full shadow-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-3xl md:text-5xl font-black text-foreground mb-0.5 sm:mb-2 truncate">{team.name}</h1>
                <p className="text-xs sm:text-lg md:text-xl text-muted-foreground">Squad Details</p>
                {team.owner?.name && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Owner: {team.owner.name}</p>
                )}
              </div>
            </div>
          )}

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
                    {team.tournament.totalBudget} Pts
                  </span>
                </div>
                <Progress value={budgetUsedPercentage} className="h-1 sm:h-2" />
                <div className="flex justify-between text-[10px] sm:text-sm">
                  <span className="text-muted-foreground">Spent</span>
                  <span className="font-bold text-secondary text-[10px] sm:text-sm">
                    {team.totalSpent} Pts
                  </span>
                </div>
                <div className="pt-1 sm:pt-2 border-t border-border">
                  <div className="flex justify-between">
                    <span className="text-[10px] sm:text-sm text-muted-foreground">Left</span>
                    <span className="font-bold text-accent text-[10px] sm:text-sm">
                      {team.remainingBudget} Pts
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

      <AlertDialog open={showDeleteDialog} onOpenChange={(o) => !deleting && setShowDeleteDialog(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this team?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{team.name}</strong>. Players on this team will be
              unassigned, not deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamDetail;
