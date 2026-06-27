import { useState, useEffect } from "react";
import { Player } from "@/types/auction";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Phone,
  Edit3,
  Save,
  X,
  Trash2
} from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { getDriveThumbnail } from "@/lib/imageUtils";

interface Team {
  _id: string;
  name: string;
}

interface PlayerDetailsModalProps {
  player: Player | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (updatedPlayer: Player) => void;
  onDelete?: (playerId: string) => void;
}

export const PlayerDetailsModal = ({ player, isOpen, onClose, onUpdate, onDelete }: PlayerDetailsModalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [playerCategories, setPlayerCategories] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [editData, setEditData] = useState<Partial<Player>>({});

  // Check authentication status
  useEffect(() => {
    const authStatus = localStorage.getItem("isAuthenticated") === "true";
    setIsAuthenticated(authStatus);
  }, []);

  // Fetch teams when modal opens
  useEffect(() => {
    const fetchTeams = async () => {
      if (!player?.touranmentId) return;
      try {
        const response = await fetch(`${apiConfig.baseUrl}/api/team/all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ touranmentId: player.touranmentId }),
        });
        if (response.ok) {
          const data = await response.json();
          setTeams(data.data[0].teams || []);
        }
      } catch (err) {
        console.error("Error fetching teams:", err);
      }
    };
    if (isOpen && player) fetchTeams();
  }, [isOpen, player]);

  // Fetch player categories
  useEffect(() => {
    const fetchPlayerCategories = async () => {
      if (!player?.touranmentId) return;
      try {
        const response = await fetch(`${apiConfig.baseUrl}/api/player/categories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ touranmentId: player.touranmentId }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setPlayerCategories(data.data);
          }
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };
    if (isOpen && player) fetchPlayerCategories();
  }, [isOpen, player]);

  if (!player) return null;

  const logoSrc = getDriveThumbnail(player.photo as string);

  const handleEdit = () => {
    setEditData({
      name: player.name,
      playerCategory: player.playerCategory || "",
      sold: player.sold,
      auctionStatus: player.auctionStatus,
      amtSold: player.amtSold || 0,
      teamId: (typeof player.teamId === 'object' && player.teamId !== null
        ? (player.teamId as any)._id
        : player.teamId) || "none"
    });
    setIsEditing(true);
    setError("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
    setError("");
  };

  const handleInputChange = (field: keyof Player, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSave = async () => {
    if (!editData.name?.trim()) {
      setError("Player name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?._id;

      if (!userId) {
        setError("You must be logged in");
        setLoading(false);
        return;
      }

      const payload = {
        playerId: player._id,
        userId,
        name: editData.name?.trim(),
        playerCategory: editData.playerCategory,
        sold: editData.sold,
        auctionStatus: editData.auctionStatus,
        amtSold: editData.amtSold ? parseInt(editData.amtSold.toString()) : undefined,
        teamId: editData.teamId && editData.teamId !== "none" ? editData.teamId : null
      };

      const response = await fetch(`${apiConfig.baseUrl}/api/player/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Update failed');
      }

      const result = await response.json();
      setIsEditing(false);
      if (onUpdate && result.data) onUpdate(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!player) return;
    setDeleting(true);
    setError("");

    try {
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?._id;

      if (!userId) {
        setError("You must be logged in");
        setDeleting(false);
        setShowDeleteDialog(false);
        return;
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/player/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player._id, userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Delete failed');
      }

      if (onDelete) onDelete(player._id);
      setTimeout(() => {
        setShowDeleteDialog(false);
        onClose();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  };

  // Status badge styling
  const getStatusBadge = () => {
    if (player.sold) return <Badge className="bg-green-500 text-white">SOLD</Badge>;
    if (player.auctionStatus) return <Badge className="bg-red-500 text-white">UNSOLD</Badge>;
    return <Badge variant="outline" className="text-muted-foreground">PENDING</Badge>;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-2 border-border rounded-2xl">
          <DialogTitle className="sr-only">{player.name} Details</DialogTitle>
          {/* Hero Image Section with blurred background */}
          <div className="relative h-48 sm:h-64 overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center blur-xl scale-110 opacity-60"
              style={{ backgroundImage: `url(${logoSrc})` }}
            />
            <img
              src={logoSrc}
              alt={player.name}
              className="relative h-full w-full object-contain z-10"
              onError={(e) => {
                e.currentTarget.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=6366f1,8b5cf6,ec4899&backgroundType=gradientLinear&fontSize=40&fontWeight=600`;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent z-20" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-30 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Status badge */}
            <div className="absolute top-3 left-3 z-30">
              {getStatusBadge()}
            </div>

            {/* Serial number */}
            {player.auctionSerialNumber && (
              <div className="absolute bottom-3 left-3 z-30">
                <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
                  #{player.auctionSerialNumber}
                </Badge>
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="p-4 sm:p-6 space-y-4">
            {/* Player Name & Category */}
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={editData.name || ""}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={editData.playerCategory || ""}
                    onValueChange={(v) => handleInputChange('playerCategory', v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {playerCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">{player.name}</h2>
                <Badge variant="secondary" className="mt-1">{player.playerCategory}</Badge>
              </div>
            )}

            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Base Price</p>
                <p className="text-lg font-bold text-foreground">{player.basePrice} Pts</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Sold For</p>
                <p className="text-lg font-bold text-green-500">
                  {player.sold && player.amtSold ? `${player.amtSold} Pts` : "—"}
                </p>
              </div>
            </div>

            {/* Team info if sold */}
            {player.sold && player.teamName && !isEditing && (
              <div className="bg-primary/10 rounded-lg p-3 text-center border border-primary/20">
                <p className="text-xs text-muted-foreground">Team</p>
                <p className="text-lg font-semibold text-primary">{player.teamName}</p>
              </div>
            )}

            {/* Contact (if available) */}
            {player.mobile && !isEditing && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span className="text-sm">{player.mobile}</span>
              </div>
            )}

            {/* Edit Mode: Auction Status */}
            {isEditing && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>Mark as Sold</Label>
                  <Switch
                    checked={editData.sold || false}
                    onCheckedChange={(v) => handleInputChange('sold', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Auctioned</Label>
                  <Switch
                    checked={editData.auctionStatus || false}
                    onCheckedChange={(v) => handleInputChange('auctionStatus', v)}
                  />
                </div>
                {editData.sold && (
                  <>
                    <div>
                      <Label>Sold Amount</Label>
                      <Input
                        type="number"
                        value={editData.amtSold || ""}
                        onChange={(e) => handleInputChange('amtSold', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Team</Label>
                      <Select
                        value={editData.teamId as string || "none"}
                        onValueChange={(v) => handleInputChange('teamId', v)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Team</SelectItem>
                          {teams.map((team) => (
                            <SelectItem key={team._id} value={team._id}>{team.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              {isEditing ? (
                <>
                  <Button onClick={handleCancel} variant="outline" className="flex-1">
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={loading} className="flex-1">
                    <Save className="h-4 w-4 mr-1" /> {loading ? "..." : "Save"}
                  </Button>
                </>
              ) : isAuthenticated ? (
                <>
                  <Button
                    onClick={() => setShowDeleteDialog(true)}
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button onClick={handleEdit} className="flex-1">
                    <Edit3 className="h-4 w-4 mr-2" /> Edit
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Player?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{player?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};