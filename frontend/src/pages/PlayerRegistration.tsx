import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, Users, Trophy } from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { getSelectedTournamentId } from "@/lib/tournamentUtils";

interface PlayerRegistrationData {
  name: string;
  age: string;
  gender: string;
  mobile: string;
  email: string;
  address: string;
  skill: string;
  playerCategory: string;
  photo?: string;
}

const PlayerRegistration = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState<PlayerRegistrationData>({
    name: "",
    age: "",
    gender: "",
    mobile: "",
    email: "",
    address: "",
    skill: "",
    playerCategory: "",
    photo: ""
  });

  const playerCategories = ["Regular", "Icon", "Youth"];
  const genderOptions = ["Male", "Female", "Other"];

  const handleInputChange = (field: keyof PlayerRegistrationData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError("");
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError("Player name is required");
      return false;
    }
    if (!formData.age || parseInt(formData.age) < 10 || parseInt(formData.age) > 50) {
      setError("Please enter a valid age between 10 and 50");
      return false;
    }
    if (!formData.gender) {
      setError("Please select gender");
      return false;
    }
    if (!formData.mobile || formData.mobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return false;
    }
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      setError("Please enter a valid email address");
      return false;
    }
    if (!formData.skill.trim()) {
      setError("Please enter a skill");
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

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Get tournament ID from localStorage or context
      const tournamentId = getSelectedTournamentId();

      // Get user ID for authentication
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?._id;

      if (!userId) {
        setError("You must be logged in to register a player");
        setLoading(false);
        return;
      }

      const payload = {
        name: formData.name.trim(),
        age: parseInt(formData.age),
        gender: formData.gender,
        mobile: parseInt(formData.mobile),
        email: formData.email.trim(),
        address: formData.address.trim(),
        skill: formData.skill.trim(),
        playerCategory: formData.playerCategory,
        touranmentId: tournamentId,
        photo: formData.photo || "",
        sold: false,
        auctionStatus: false,
        userId
      };

      const response = await fetch(`${apiConfig.baseUrl}/api/player/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const result = await response.json();
      setSuccess("Registration successful! Your player profile has been created.");

      // Reset form
      setFormData({
        name: "",
        age: "",
        gender: "",
        mobile: "",
        email: "",
        address: "",
        skill: "",
        playerCategory: "",
        photo: ""
      });

      // Redirect to players page after successful registration
      setTimeout(() => {
        navigate('/players');
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-4xl font-bold text-foreground mb-2">Player Registration</h1>
          <p className="text-lg text-muted-foreground">
            Join the auction and showcase your cricket skills!
          </p>
        </div>

        {/* Registration Form */}
        <Card className="shadow-xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Users className="h-6 w-6" />
              Player Details
            </CardTitle>
            <CardDescription>
              Fill in your information to register for the tournament
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age">Age *</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="Enter your age"
                      value={formData.age}
                      onChange={(e) => handleInputChange('age', e.target.value)}
                      min="10"
                      max="50"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {genderOptions.map((gender) => (
                        <SelectItem key={gender} value={gender}>
                          {gender}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  Contact Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mobile">Mobile Number *</Label>
                    <Input
                      id="mobile"
                      type="tel"
                      placeholder="Enter 10-digit mobile number"
                      value={formData.mobile}
                      onChange={(e) => handleInputChange('mobile', e.target.value)}
                      maxLength={10}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    placeholder="Enter your address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* Cricket Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  Cricket Details
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="skill">Skill *</Label>
                  <Input
                    id="skill"
                    type="text"
                    placeholder="e.g., Batsman, Bowler, All-Rounder, Wicket-Keeper"
                    value={formData.skill}
                    onChange={(e) => handleInputChange('skill', e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the player's primary skill (free text, not restricted)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="playerCategory">Player Category *</Label>
                  <Select value={formData.playerCategory} onValueChange={(value) => handleInputChange('playerCategory', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {playerCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Base price will be set according to the category defined in the tournament
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo">Photo URL (Optional)</Label>
                  <Input
                    id="photo"
                    type="url"
                    placeholder="Enter photo URL or Google Drive link"
                    value={formData.photo}
                    onChange={(e) => handleInputChange('photo', e.target.value)}
                  />
                </div>
              </div>

              {/* Error and Success Messages */}
              {error && (
                <Alert className="border-destructive">
                  <AlertDescription className="text-destructive">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-500 bg-green-50">
                  <AlertDescription className="text-green-700">
                    {success}
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Registering..." : "Register Player"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlayerRegistration;