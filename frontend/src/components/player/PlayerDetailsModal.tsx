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
  Trash2,
  UploadCloud,
  ImageOff,
  Loader2
} from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { getDriveThumbnail } from "@/lib/imageUtils";
import { shouldMaskPlayer, maskMobile, useMaskingEligible } from "@/lib/privacyUtils";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/imageCompressor";

interface Team {
  _id: string;
  name: string;
}

type PlayerStatus = "pending" | "sold" | "unsold";

const statusOf = (p: Partial<Player>): PlayerStatus =>
  p.sold ? "sold" : p.auctionStatus ? "unsold" : "pending";

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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const maskingEligible = useMaskingEligible(player?.touranmentId);

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

  // While editing, show the photo as it will be saved (including a removal).
  const activePhoto = isEditing ? (editData.photo ?? "") : (player.photo || "");
  const logoSrc = getDriveThumbnail(activePhoto as string);
  const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=6366f1,8b5cf6,ec4899&backgroundType=gradientLinear&fontSize=40&fontWeight=600`;
  const masked = shouldMaskPlayer(player, maskingEligible);

  const handleEdit = () => {
    setEditData({
      name: player.name,
      photo: player.photo || "",
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

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return;
    setUploadingPhoto(true);
    setError("");
    try {
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const compressed = await compressImage(file, 800, 800, 0.8);
      const formData = new FormData();
      formData.append("image", compressed, file.name);

      const response = await fetch(`${apiConfig.baseUrl}/api/tournament/upload-image`, {
        method: "POST",
        headers: { "x-user-id": user?._id || "" },
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data.data?.imageUrl) {
        handleInputChange("photo", data.data.imageUrl);
      } else {
        setError(data.error || data.message || "Failed to upload photo");
      }
    } catch {
      setError("Could not upload that photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Empty string, not null: buildPlayerData drops null/undefined keys, so a
  // removed photo would otherwise leave the old one in place.
  const handleRemovePhoto = () => handleInputChange("photo", "");

  // sold / auctionStatus are two booleans in the DB but only three states are
  // valid; edit them as one value so "unsold" can't be left with a sold tag.
  const handleStatusChange = (status: PlayerStatus) => {
    setEditData(prev => ({
      ...prev,
      sold: status === "sold",
      auctionStatus: status !== "pending",
      ...(status === "sold" ? {} : { amtSold: 0, teamId: "none" }),
    }));
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

      const isSold = statusOf(editData) === "sold";
      const payload = {
        playerId: player._id,
        userId,
        name: editData.name?.trim(),
        photo: editData.photo ?? "",
        playerCategory: editData.playerCategory,
        sold: isSold,
        auctionStatus: !!editData.auctionStatus,
        // clearing these matters: an unsold/not-auctioned player must not keep
        // its old team or price
        amtSold: isSold && editData.amtSold ? parseInt(editData.amtSold.toString()) : null,
        teamId: isSold && editData.teamId && editData.teamId !== "none" ? editData.teamId : null
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
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-2 border-border rounded-2xl max-h-[90vh] flex flex-col">
          <DialogTitle className="sr-only">{player.name} Details</DialogTitle>
          {/* Scrollable wrapper for everything */}
          <div className="overflow-y-auto flex-1">
          {/* Hero Image Section with blurred background */}
          <div className="relative h-48 sm:h-64 overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center blur-xl scale-110 opacity-60"
              style={{ backgroundImage: `url(${logoSrc})` }}
            />
            <img
              src={logoSrc || fallbackAvatar}
              alt={player.name}
              className={cn("relative h-full w-full object-contain z-10", masked && "blur-xl scale-110")}
              onError={(e) => { e.currentTarget.src = fallbackAvatar; }}
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
            {player.auctionSerialNumber != null && (
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
                <span className="text-sm">{masked ? maskMobile(player.mobile) : player.mobile}</span>
              </div>
            )}

            {/* Edit Mode: Photo */}
            {isEditing && (
              <div className="space-y-2 border-t pt-4">
                <Label>Photo</Label>
                <div className="flex items-start gap-3">
                  <img
                    src={logoSrc || fallbackAvatar}
                    alt={player.name}
                    className="w-20 h-20 rounded-lg border object-cover bg-muted shrink-0"
                    onError={(e) => { e.currentTarget.src = fallbackAvatar; }}
                  />
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingPhoto}
                        onChange={(e) => {
                          handlePhotoUpload(e.target.files?.[0]);
                          e.target.value = "";  // let the same file be picked again
                        }}
                      />
                      <span className={cn(
                        "inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border cursor-pointer hover:bg-muted",
                        uploadingPhoto && "opacity-60 pointer-events-none"
                      )}>
                        {uploadingPhoto
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                          : <><UploadCloud className="h-4 w-4" /> {editData.photo ? "Change photo" : "Upload photo"}</>}
                      </span>
                    </label>
                    {editData.photo ? (
                      <Button
                        type="button" variant="ghost" size="sm"
                        disabled={uploadingPhoto}
                        className="text-destructive hover:text-destructive justify-start px-2"
                        onClick={handleRemovePhoto}
                      >
                        <ImageOff className="h-4 w-4 mr-1" /> Remove photo
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground max-w-[12rem]">
                        No photo — a name avatar is shown instead.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Edit Mode: Auction Status */}
            {isEditing && (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <Label>Auction Status</Label>
                  <Select
                    value={statusOf(editData)}
                    onValueChange={(v) => handleStatusChange(v as PlayerStatus)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Not Auctioned</SelectItem>
                      <SelectItem value="sold">Mark as Sold</SelectItem>
                      <SelectItem value="unsold">Mark as Unsold</SelectItem>
                    </SelectContent>
                  </Select>
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