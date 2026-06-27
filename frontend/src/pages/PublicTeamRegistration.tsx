import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, Trophy, Loader2 } from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { compressImage } from "@/lib/imageCompressor";

const PublicTeamRegistration = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [tournamentName, setTournamentName] = useState("");

  const [formData, setFormData] = useState<any>({
    name: "",
    ownerName: "",
    ownerMobile: "",
    logo: null,
  });

  useEffect(() => {
    if (tournamentId) {
      fetchConfig();
    }
  }, [tournamentId]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      // Re-use the existing registration-config route to just get the tournament name and verify it exists
      const response = await fetch(`${apiConfig.baseUrl}/api/tournament/${tournamentId}/registration-config`);
      const data = await response.json();
      
      if (response.ok && data.data) {
        setTournamentName(data.data.name);
      } else {
        setError(data.message || "Failed to load tournament details.");
      }
    } catch (err) {
      setError("Failed to fetch tournament configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleFileChange = async (field: string, file: File | undefined) => {
    if (!file) {
      setFormData((prev: any) => ({ ...prev, [field]: null }));
      return;
    }
    setError("");

    // Auto-compress images before storing
    if (file.type.startsWith("image/")) {
      try {
        const compressed = await compressImage(file);
        setFormData((prev: any) => ({ ...prev, [field]: compressed }));
      } catch {
        // If compression fails, use the original file
        setFormData((prev: any) => ({ ...prev, [field]: file }));
      }
    } else {
      setFormData((prev: any) => ({ ...prev, [field]: file }));
    }
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError("Team Name is required");
      return false;
    }

    if (!formData.ownerName.trim()) {
      setError("Owner Name is required");
      return false;
    }

    if (!formData.ownerMobile || formData.ownerMobile.length < 10) {
      setError("Please enter a valid Mobile Number (at least 10 digits)");
      return false;
    }

    if (!formData.logo) {
      setError("Please select a Team Logo");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setError("");

    try {
      const formPayload = new FormData();
      formPayload.append('touranmentId', tournamentId || "");
      formPayload.append('name', formData.name.trim());
      formPayload.append('ownerName', formData.ownerName.trim());
      formPayload.append('ownerMobile', formData.ownerMobile.trim());
      
      if (formData.logo instanceof File) {
         formPayload.append('logo', formData.logo);
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/team/register-public`, {
        method: 'POST',
        // Omit Content-Type to let the browser set boundary correctly for FormData
        body: formPayload,
      });

      if (!response.ok) {
        let errorMessage = 'Registration failed. Please try again.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Could not parse JSON error body
        }

        // Map common server errors to user-friendly messages
        const lowerMsg = errorMessage.toLowerCase();
        if (response.status === 413 || lowerMsg.includes('too large') || lowerMsg.includes('payload')) {
          throw new Error('The uploaded file is too large. Please use a smaller image (max 10 MB).');
        } else if (lowerMsg.includes('duplicate') || lowerMsg.includes('already exists')) {
          throw new Error('A team with this name is already registered for this tournament.');
        } else if (lowerMsg.includes('tournament') && lowerMsg.includes('not found')) {
          throw new Error('This tournament could not be found. The registration link may be invalid.');
        } else {
          throw new Error(errorMessage);
        }
      }

      setSuccess("Registration successful! Your team has been submitted.");
      setFormData({ name: "", ownerName: "", ownerMobile: "", logo: null });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network')) {
        setError('Unable to connect to the server. Please check your internet connection and try again.');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  if (error && !tournamentName) {
     return (
        <div className="flex h-screen items-center justify-center p-4">
           <Alert variant="destructive" className="max-w-md">
             <AlertTitle>Error</AlertTitle>
             <AlertDescription>{error}</AlertDescription>
           </Alert>
        </div>
     );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/10 p-4 py-12">
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <Trophy className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Team Registration</h1>
          <p className="text-xl font-medium text-primary/80">{tournamentName}</p>
          <p className="text-md text-muted-foreground mt-2">
             Complete the form below to register your team.
          </p>
        </div>

        <Card className="shadow-xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Users className="h-6 w-6" />
              Team Details
            </CardTitle>
            <CardDescription>
              All fields are required
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
               <Alert className="border-green-500 bg-green-50 mb-6">
                 <AlertDescription className="text-green-700 text-lg py-4 text-center">
                   {success}
                 </AlertDescription>
               </Alert>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-2">
                <Label htmlFor="name">Team Name *</Label>
                <Input id="name" placeholder="Enter your team's name" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} required />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ownerName">Owner Name *</Label>
                  <Input id="ownerName" placeholder="Enter owner's name" value={formData.ownerName} onChange={(e) => handleInputChange('ownerName', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ownerMobile">Owner Mobile Number *</Label>
                  <Input id="ownerMobile" type="tel" placeholder="Enter mobile number" value={formData.ownerMobile} onChange={(e) => handleInputChange('ownerMobile', e.target.value)} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">Team Logo *</Label>
                <Input id="logo" type="file" accept="image/*" onChange={(e) => handleFileChange('logo', e.target.files?.[0])} required />
              </div>

              {error && (
                <Alert className="border-destructive">
                  <AlertDescription className="text-destructive">{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={submitting} className="w-full mt-6 py-6 text-lg font-semibold tracking-wide">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                Register Team
              </Button>
            </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicTeamRegistration;
