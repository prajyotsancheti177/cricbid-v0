import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, Trophy } from "lucide-react";
import apiConfig from "@/config/apiConfig";

interface Tournament {
  _id: string;
  name: string;
  playerCategories: string[];
  createdAt: string;
}

interface AddPlayerFormData {
  name: string;
  age: string;
  gender: string;
  mobile: string;
  email: string;
  skill: string;
  playerCategory: string;
  photo: string;
  auctionSerialNumber: string;
}

const AddPlayer = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState<AddPlayerFormData>({
    name: "",
    age: "",
    gender: "",
    mobile: "",
    email: "",
    skill: "",
    playerCategory: "",
    photo: "",
    auctionSerialNumber: "",
  });

  const genderOptions = ["Male", "Female", "Other"];

  // Fetch tournaments on mount
  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const response = await fetch(`${apiConfig.baseUrl}/api/tournament/all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) throw new Error("Failed to fetch tournaments");

        const data = await response.json();
        const tournamentList: Tournament[] = data.data || [];
        setTournaments(tournamentList);

        // Auto-select latest tournament (first in list, sorted by createdAt desc)
        if (tournamentList.length > 0) {
          setSelectedTournamentId(tournamentList[0]._id);
        }
      } catch (err) {
        setError("Failed to load tournaments");
      } finally {
        setLoadingTournaments(false);
      }
    };
    fetchTournaments();
  }, []);

  // Get categories from selected tournament
  const selectedTournament = tournaments.find(t => t._id === selectedTournamentId);
  const playerCategories = selectedTournament?.playerCategories || [];

  const handleInputChange = (field: keyof AddPlayerFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleTournamentChange = (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
    // Reset category when tournament changes since categories may differ
    setFormData(prev => ({ ...prev, playerCategory: "" }));
    setError("");
  };

  const validateForm = (): boolean => {
    if (!selectedTournamentId) {
      setError("Please select a tournament");
      return false;
    }
    if (!formData.name.trim()) {
      setError("Player name is required");
      return false;
    }
    if (!formData.mobile || formData.mobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return false;
    }
    if (!formData.playerCategory) {
      setError("Please select a player category");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError("");

    try {
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?._id;

      if (!userId) {
        setError("You must be logged in to add a player");
        setLoading(false);
        return;
      }

      const payload = {
        name: formData.name.trim(),
        age: formData.age ? parseInt(formData.age) : undefined,
        gender: formData.gender || undefined,
        mobile: parseInt(formData.mobile),
        email: formData.email.trim() || undefined,
        skill: formData.skill.trim() || undefined,
        playerCategory: formData.playerCategory,
        touranmentId: selectedTournamentId,
        photo: formData.photo || "",
        auctionSerialNumber: formData.auctionSerialNumber ? parseInt(formData.auctionSerialNumber) : undefined,
        sold: false,
        auctionStatus: false,
        userId,
      };

      const response = await fetch(`${apiConfig.baseUrl}/api/player/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add player");
      }

      setSuccess("Player added successfully!");

      // Reset form but keep tournament selected
      setFormData({
        name: "",
        age: "",
        gender: "",
        mobile: "",
        email: "",
        skill: "",
        playerCategory: "",
        photo: "",
        auctionSerialNumber: "",
      });

      // Clear success after a delay
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add player");
    } finally {
      setLoading(false);
    }
  };

  if (loadingTournaments) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Loading tournaments...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/10 p-4">
      <div className="container mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/20 rounded-full">
              <UserPlus className="h-8 w-8 text-primary" />
            </div>
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Add Player</h1>
          <p className="text-lg text-muted-foreground">
            Add a new player to a tournament
          </p>
        </div>

        <Card className="shadow-xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <UserPlus className="h-6 w-6" />
              Player Details
            </CardTitle>
            <CardDescription>
              Select a tournament and fill in the player information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tournament Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  Tournament
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="tournament">Select Tournament *</Label>
                  <Select value={selectedTournamentId} onValueChange={handleTournamentChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tournament" />
                    </SelectTrigger>
                    <SelectContent>
                      {tournaments.map((t) => (
                        <SelectItem key={t._id} value={t._id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Player Name *</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter player name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="Enter age"
                      value={formData.age}
                      onChange={(e) => handleInputChange("age", e.target.value)}
                      min="10"
                      max="80"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={formData.gender} onValueChange={(v) => handleInputChange("gender", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {genderOptions.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mobile">Mobile Number *</Label>
                    <Input
                      id="mobile"
                      type="tel"
                      placeholder="10-digit mobile number"
                      value={formData.mobile}
                      onChange={(e) => handleInputChange("mobile", e.target.value)}
                      maxLength={10}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email (optional)"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                  />
                </div>
              </div>

              {/* Cricket Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  Cricket Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="playerCategory">Category *</Label>
                    <Select
                      value={formData.playerCategory}
                      onValueChange={(v) => handleInputChange("playerCategory", v)}
                      disabled={playerCategories.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={playerCategories.length === 0 ? "Select a tournament first" : "Select category"} />
                      </SelectTrigger>
                      <SelectContent>
                        {playerCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Categories are loaded from the selected tournament
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="skill">Skill</Label>
                    <Input
                      id="skill"
                      type="text"
                      placeholder="e.g., Batsman, Bowler, All-Rounder"
                      value={formData.skill}
                      onChange={(e) => handleInputChange("skill", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo">Photo URL</Label>
                  <Input
                    id="photo"
                    type="url"
                    placeholder="Photo URL or Google Drive link (optional)"
                    value={formData.photo}
                    onChange={(e) => handleInputChange("photo", e.target.value)}
                  />
                </div>

                <div className="space-y-2 flex flex-col justify-end">
                  <Label htmlFor="auctionSerialNumber">Serial Number (Optional)</Label>
                  <Input
                    id="auctionSerialNumber"
                    type="number"
                    placeholder="Auto-generated if left blank"
                    value={formData.auctionSerialNumber}
                    onChange={(e) => handleInputChange("auctionSerialNumber", e.target.value)}
                    min="1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    To explicitly assign an auction order
                  </p>
                </div>
              </div>

              {/* Messages */}
              {error && (
                <Alert className="border-destructive">
                  <AlertDescription className="text-destructive">{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="border-green-500 bg-green-50">
                  <AlertDescription className="text-green-700">{success}</AlertDescription>
                </Alert>
              )}

              {/* Submit */}
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Adding..." : "Add Player"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddPlayer;
