import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/form/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserPlus, Trophy, Loader2, CheckCircle2, LogIn, LogOut, QrCode, Smartphone, Copy } from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { compressImage } from "@/lib/imageCompressor";
import { PhotoCropDialog } from "@/components/form/PhotoCropDialog";
import { buildUpiUri, resolvePaymentMode } from "@/lib/upi";
import { buildPaymentProofField, asksForPaymentProof, isPaymentProofRequired, isPaymentProofField } from "@/lib/paymentProof";
import PlayerProfileModal, { getStoredPlayerToken, clearPlayerToken, fetchAccountWithToken } from "@/components/PlayerProfileModal";

const PublicPlayerRegistration = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Shown next to a refusal so the player can quote it; the row is in registration_error.
  const [errorId, setErrorId] = useState("");
  const [registeredAs, setRegisteredAs] = useState<{ name: string; serial?: number | null } | null>(null);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [profilePrefilled, setProfilePrefilled] = useState(false);

  const [config, setConfig] = useState<any>(null);
  const [tournamentName, setTournamentName] = useState("");
  const [playerCategories, setPlayerCategories] = useState<string[]>([]);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const [formData, setFormData] = useState<any>({
    name: "",
    age: "",
    gender: "",
    mobile: "",
    email: "",
    address: "",
    skill: "",
    playerCategory: "",
    photo: null,
    customFields: {}
  });

  const genderOptions = ["Male", "Female", "Other"];

  useEffect(() => {
    if (tournamentId) {
      fetchConfig();
    }
    // Restore session if player was already logged in
    const token = getStoredPlayerToken();
    if (token) {
      fetchAccountWithToken(token).then((acc) => {
        if (!acc) { clearPlayerToken(); return; }
        // An account can own several players, so only auto-select when there is
        // no ambiguity. With two children the parent has to say which one.
        if (acc.profiles.length === 1) setActiveProfile(acc.profiles[0]);
      });
    }
  }, [tournamentId]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiConfig.baseUrl}/api/tournament/${tournamentId}/registration-config`);
      const data = await response.json();
      
      if (response.ok && data.data) {
        setTournamentName(data.data.name);
        setPlayerCategories(data.data.playerCategories || []);
        if (data.data.registrationFormConfig?.isActive) {
           setConfig(data.data.registrationFormConfig);
        } else {
           setConfig({ isActive: false });
        }
      } else {
        setError(data.message || "Failed to load registration details.");
      }
    } catch (err) {
      setError("Failed to fetch tournament registration configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileLoaded = (profile: any) => {
    setActiveProfile(profile);
  };

  const handlePrefillFromProfile = () => {
    if (!activeProfile) return;
    setFormData((prev: any) => ({
      ...prev,
      name: activeProfile.name || prev.name,
      age: activeProfile.age ? String(activeProfile.age) : prev.age,
      gender: activeProfile.gender || prev.gender,
      mobile: activeProfile.mobile || prev.mobile,
      email: activeProfile.email || prev.email,
      address: activeProfile.address || prev.address,
      skill: activeProfile.skill || prev.skill,
    }));
    setProfilePrefilled(true);
  };

  const handleLogout = () => {
    clearPlayerToken();
    setActiveProfile(null);
    setProfilePrefilled(false);
  };

  // Photo picked but not yet confirmed in the crop dialog, and the untouched
  // original so "Adjust" can re-crop from it rather than from a cropped copy.
  const [photoToCrop, setPhotoToCrop] = useState<File | null>(null);
  const [photoOriginal, setPhotoOriginal] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!(formData.photo instanceof File)) { setPhotoPreview(null); return; }
    const url = URL.createObjectURL(formData.photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [formData.photo]);

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

  const handleCustomInputChange = (id: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [id]: value
      }
    }));
    setError("");
  };

  // Renders a single custom field. Reused for both the "Additional Information"
  // group and the payment-proof group (file fields shown under the QR).
  const renderCustomField = (cf: any) => {
    if (cf.showToPublic === false) return null;
    return (
      <div key={cf.id} className={cf.type === 'textarea' ? "col-span-1 md:col-span-2 space-y-2" : "space-y-2"}>
        <Label htmlFor={cf.id}>{cf.label} {cf.required && '*'}</Label>

        {cf.type === 'text' && (
          <Input id={cf.id} value={formData.customFields[cf.id] || ""} onChange={(e) => handleCustomInputChange(cf.id, e.target.value)} required={cf.required} />
        )}

        {cf.type === 'number' && (
          <Input id={cf.id} type="number" value={formData.customFields[cf.id] || ""} onChange={(e) => handleCustomInputChange(cf.id, e.target.value)} required={cf.required} />
        )}

        {cf.type === 'textarea' && (
          <Textarea id={cf.id} value={formData.customFields[cf.id] || ""} onChange={(e) => handleCustomInputChange(cf.id, e.target.value)} required={cf.required} rows={3} />
        )}

        {cf.type === 'dropdown' && (
          <Select value={formData.customFields[cf.id] || ""} onValueChange={(v) => handleCustomInputChange(cf.id, v)} required={cf.required}>
            <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
            <SelectContent>
              {cf.options?.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {cf.type === 'checkbox' && (
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox id={cf.id} checked={!!formData.customFields[cf.id]} onCheckedChange={(checked) => handleCustomInputChange(cf.id, checked)} />
            <label htmlFor={cf.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Yes</label>
          </div>
        )}

        {cf.type === 'file' && (
          <Input id={cf.id} type="file" accept="image/*" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.type.startsWith("image/")) {
              try {
                const compressed = await compressImage(f);
                handleCustomInputChange(cf.id, compressed);
              } catch {
                handleCustomInputChange(cf.id, f);
              }
            } else {
              handleCustomInputChange(cf.id, f);
            }
          }} required={cf.required} />
        )}
      </div>
    );
  };

  // The payment-screenshot upload is on unless the host opted out. Seeded here
  // too, so tournaments configured before it existed show it without the host
  // having to open and re-save the registration form first.
  const customFields: any[] = (() => {
    const configured = config?.customFields || [];
    if (!config || config.paymentProofOptOut === true) return configured;

    // The built-in field's `required` follows the host's toggle rather than
    // whatever was persisted, so the compulsory-by-default setting applies to
    // tournaments configured before the toggle existed. A host's own upload
    // field is left exactly as they set it.
    const required = isPaymentProofRequired(config);
    const normalised = configured.map((f: any) =>
      isPaymentProofField(f) ? { ...f, required } : f);

    // asksForPaymentProof also covers a host's own file field, so a tournament
    // that already collects a screenshot is not asked for a second one.
    return asksForPaymentProof(normalised)
      ? normalised
      : [...normalised, buildPaymentProofField(required)];
  })();

  const paymentPanel = config?.paymentPanel;
  const paymentMode = resolvePaymentMode(paymentPanel);
  const showQr = !!(paymentPanel?.qrImage) && (paymentMode === 'qr' || paymentMode === 'both');
  const upiUri = (paymentMode === 'upi' || paymentMode === 'both') && paymentPanel
    ? buildUpiUri(paymentPanel)
    : null;
  // The deep link is inert on desktop, so the UPI id is always shown as text too.
  const showPaymentPanel = !!paymentPanel?.enabled && (showQr || !!upiUri || !!paymentPanel?.text);

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(paymentPanel?.upiId || '');
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } catch {
      /* clipboard unavailable — the id is visible as text regardless */
    }
  };

  const isFieldRequired = (field: string) => {
     if (field === 'name') return true;
     return config?.fields?.[field]?.required;
  };

  const isFieldEnabled = (field: string) => {
     if (field === 'name') return true;
     return config?.fields?.[field]?.enabled && config?.fields?.[field]?.showToPublic !== false;
  };

  const fieldLabel = (field: string, defaultLabel: string) => {
     if (field === 'name') return 'Full Name';
     return config?.fields?.[field]?.label || defaultLabel;
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return false;
    }

    if (isFieldEnabled('age') && isFieldRequired('age')) {
       if (!formData.age || parseInt(formData.age) < 10 || parseInt(formData.age) > 60) {
          setError(`Please enter a valid ${fieldLabel('age', 'Age')} between 10 and 60`);
          return false;
       }
    }

    if (isFieldEnabled('gender') && isFieldRequired('gender') && !formData.gender) {
       setError(`Please select ${fieldLabel('gender', 'Gender')}`);
       return false;
    }

    if (isFieldEnabled('mobile') && isFieldRequired('mobile')) {
       if (!formData.mobile || formData.mobile.length < 10) {
          setError(`Please enter a valid ${fieldLabel('mobile', 'Mobile Number')}`);
          return false;
       }
    }

    if (isFieldEnabled('email') && isFieldRequired('email')) {
       if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
          setError(`Please enter a valid ${fieldLabel('email', 'Email')}`);
          return false;
       }
    }

    if (isFieldEnabled('skill') && isFieldRequired('skill') && !formData.skill.trim()) {
       setError(`Please enter ${fieldLabel('skill', 'Skill')}`);
       return false;
    }

    if (isFieldEnabled('playerCategory') && isFieldRequired('playerCategory') && !formData.playerCategory) {
       setError(`Please select ${fieldLabel('playerCategory', 'Player Category')}`);
       return false;
    }

    if (isFieldEnabled('photo') && isFieldRequired('photo') && !formData.photo) {
       setError(`Please select a ${fieldLabel('photo', 'Photo')}`);
       return false;
    }

    if (customFields.length) {
      for (const cf of customFields) {
        if (cf.showToPublic === false) continue;
        if (cf.required) {
          const val = formData.customFields[cf.id];
          if (val === undefined || val === null || val === "") {
             setError(`Please provide ${cf.label}`);
             return false;
          }
        }
      }
    }

    return true;
  };

  /** Show a failure the API didn't record itself, and record it so it has an id. */
  const failWith = async (code: string, message: string, details: Record<string, unknown> = {}, httpStatus?: number) => {
    setError(message);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/player/registration-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId, code, message, httpStatus,
          name: formData.name?.trim(), mobile: formData.mobile, details,
        }),
      });
      const data = await res.json();
      if (data?.errorId) setErrorId(data.errorId);
    } catch {
      // Recording failed too (likely offline); the message alone still helps.
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setError("");
    setErrorId("");

    try {
      const formPayload = new FormData();
      formPayload.append('touranmentId', tournamentId || "");
      formPayload.append('name', formData.name.trim());
      
      if (formData.age) formPayload.append('age', formData.age);
      if (formData.gender) formPayload.append('gender', formData.gender);
      if (formData.mobile) formPayload.append('mobile', formData.mobile);
      if (formData.email) formPayload.append('email', formData.email.trim());
      if (formData.address) formPayload.append('address', formData.address.trim());
      if (formData.skill) formPayload.append('skill', formData.skill.trim());
      if (formData.playerCategory) formPayload.append('playerCategory', formData.playerCategory);
      
      // Handle the Photo File
      if (formData.photo instanceof File) {
         formPayload.append('photo', formData.photo);
      }

      // Handle Custom fields
      const primitiveCustomFields: any = {};
      
      if (customFields.length) {
         for (const cf of customFields) {
            const val = formData.customFields[cf.id];
            if (val !== undefined && val !== null) {
               if (cf.type === 'file') {
                  if (val instanceof File) {
                     formPayload.append(cf.id, val); // Appended with cf_ ID for Multer
                  }
               } else {
                  primitiveCustomFields[cf.id] = val;
               }
            }
         }
      }

      formPayload.append('customFields', JSON.stringify(primitiveCustomFields));

      // Tell the API which saved player this is, so it can keep their details
      // current for next time. Signed out, it deliberately saves nothing.
      const playerToken = getStoredPlayerToken();
      if (playerToken && activeProfile?.id) {
        formPayload.append('playerProfileId', activeProfile.id);
      }

      // nginx refuses anything over 10 MB before the API sees it, which the
      // player would only experience as an unexplained failure. Catch it here.
      let totalBytes = 0;
      formPayload.forEach((v) => { if (v instanceof File) totalBytes += v.size; });
      if (totalBytes > 9.5 * 1024 * 1024) {
        await failWith('FILE_TOO_LARGE', 'The photo and screenshot together are too large. Please choose smaller images (under 10 MB in total).', { totalBytes });
        return;
      }

      let response: Response;
      try {
        response = await fetch(`${apiConfig.baseUrl}/api/player/register-public`, {
          method: 'POST',
          // Omit Content-Type to let the browser set boundary correctly for FormData
          headers: playerToken ? { 'x-player-token': playerToken } : undefined,
          body: formPayload,
        });
      } catch (netErr: any) {
        await failWith('NETWORK', 'Could not reach the server. Please check your internet connection and try again.', { error: String(netErr?.message || netErr) });
        return;
      }

      if (!response.ok) {
        let data: any = null;
        try { data = await response.json(); } catch { /* nginx error pages are HTML */ }

        if (data?.errorId) {
          // The API recorded it and wrote the message for the player.
          setError(data.message || 'Registration could not be completed.');
          setErrorId(data.errorId);
        } else if (response.status === 413) {
          await failWith('FILE_TOO_LARGE', 'The photo or screenshot is too large. Please choose a smaller image (under 10 MB) and try again.', { totalBytes }, 413);
        } else {
          await failWith('UNKNOWN', data?.message || 'Registration could not be completed. Please try again.', { body: data }, response.status);
        }
        return;
      }

      const saved = await response.json().catch(() => null);
      setRegisteredAs({ name: formData.name.trim(), serial: saved?.data?.auctionSerialNumber ?? null });
      setSuccess("Registration successful! Your player profile has been submitted.");
      setFormData({ name: "", age: "", gender: "", mobile: "", email: "", address: "", skill: "", playerCategory: "", photo: null, customFields: {} });
      // The form is replaced by the confirmation; bring it into view so nobody
      // scrolls back down to a blank form and registers twice.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      await failWith('UNKNOWN', err?.message || 'Something went wrong. Please try again.', { error: String(err?.message || err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  if (error && !config) {
     return (
        <div className="flex h-screen items-center justify-center p-4">
           <Alert variant="destructive" className="max-w-md">
             <AlertTitle>Error</AlertTitle>
             <AlertDescription>{error}</AlertDescription>
           </Alert>
        </div>
     );
  }

  if (config && !config.isActive) {
     return (
        <div className="flex h-screen items-center justify-center p-4">
           <Alert className="max-w-md">
             <AlertTitle>Registration Closed</AlertTitle>
             <AlertDescription>Registration for {tournamentName} is currently closed or not public.</AlertDescription>
           </Alert>
        </div>
     );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/10 p-4 py-12">
      <div className="container mx-auto max-w-2xl">
        {config?.posterImage && (
          <div className="mb-6">
            <img
              src={config.posterImage}
              alt={`${tournamentName} poster`}
              className="w-full max-h-72 object-contain rounded-xl border border-border/50 shadow-lg bg-card/40"
            />
          </div>
        )}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <Trophy className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Player Registration</h1>
          <p className="text-xl font-medium text-primary/80">{tournamentName}</p>
          <p className="text-md text-muted-foreground mt-2">
             Complete the form to submit your profile.
          </p>
        </div>

        <Card className="shadow-xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <UserPlus className="h-6 w-6" />
              Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {success ? (
               <div className="mb-6 rounded-xl border-2 border-green-500 bg-green-500/10 p-6 text-center">
                 <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-green-500" />
                 <p className="text-2xl font-bold text-foreground">You're registered!</p>
                 {registeredAs?.name && (
                   <p className="mt-2 text-lg text-foreground">
                     {registeredAs.name}
                     {registeredAs.serial != null && <span className="text-muted-foreground"> · Registration #{registeredAs.serial}</span>}
                   </p>
                 )}
                 <p className="mt-3 text-muted-foreground">{success}</p>
                 <p className="mt-4 rounded-md bg-background/60 p-3 text-sm font-medium text-foreground">
                   Please don't submit the form again — your registration is already saved.
                   Take a screenshot of this screen for your records.
                 </p>
               </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* CricBid Profile Section */}
              {config?.showProfileLogin !== false && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
                {!activeProfile ? (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      Have a CricBid profile? Login to auto-fill your details.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowProfileModal(true)}
                      >
                        <LogIn className="w-4 h-4 mr-1" />
                        Login / Create Profile
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        Logged in as <span className="font-semibold">{activeProfile.name || activeProfile.mobile}</span>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
                        <LogOut className="w-3 h-3 mr-1" />
                        Logout
                      </Button>
                    </div>
                    {!profilePrefilled ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handlePrefillFromProfile}
                        className="w-full sm:w-auto"
                      >
                        Fill form from my profile
                      </Button>
                    ) : (
                      <p className="text-sm text-green-700">
                        Details filled from your profile. Review and edit anything before submitting.
                      </p>
                    )}
                  </>
                )}
              </div>
              )}

              <PlayerProfileModal
                open={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                onProfileLoaded={handleProfileLoaded}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" placeholder="Enter your full name" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} required />
                </div>

                {isFieldEnabled('age') && (
                  <div className="space-y-2">
                    <Label htmlFor="age">{fieldLabel('age', 'Age')} {isFieldRequired('age') && '*'}</Label>
                    <Input id="age" type="number" placeholder="Enter your age" value={formData.age} onChange={(e) => handleInputChange('age', e.target.value)} required={isFieldRequired('age')} />
                  </div>
                )}
              </div>

              {isFieldEnabled('gender') && (
                <div className="space-y-2">
                  <Label htmlFor="gender">{fieldLabel('gender', 'Gender')} {isFieldRequired('gender') && '*'}</Label>
                  <Select value={formData.gender} onValueChange={(v) => handleInputChange('gender', v)} required={isFieldRequired('gender')}>
                    <SelectTrigger><SelectValue placeholder={`Select ${fieldLabel('gender', 'Gender')}`} /></SelectTrigger>
                    <SelectContent>
                      {genderOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isFieldEnabled('mobile') && (
                  <div className="space-y-2">
                    <Label htmlFor="mobile">{fieldLabel('mobile', 'Mobile Number')} {isFieldRequired('mobile') && '*'}</Label>
                    <Input id="mobile" type="tel" placeholder="Enter mobile number" value={formData.mobile} onChange={(e) => handleInputChange('mobile', e.target.value)} required={isFieldRequired('mobile')} />
                  </div>
                )}
                {isFieldEnabled('email') && (
                  <div className="space-y-2">
                    <Label htmlFor="email">{fieldLabel('email', 'Email Address')} {isFieldRequired('email') && '*'}</Label>
                    <Input id="email" type="email" placeholder="Enter email address" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} required={isFieldRequired('email')} />
                  </div>
                )}
              </div>

              {isFieldEnabled('address') && (
                <div className="space-y-2">
                  <Label htmlFor="address">{fieldLabel('address', 'Address')} {isFieldRequired('address') && '*'}</Label>
                  <Textarea id="address" placeholder={`Enter ${fieldLabel('address', 'Address')}`} value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} required={isFieldRequired('address')} rows={3} />
                </div>
              )}

              {isFieldEnabled('skill') && (
                <div className="space-y-2">
                  <Label htmlFor="skill">{fieldLabel('skill', 'Skill')} {isFieldRequired('skill') && '*'}</Label>
                  <Select value={formData.skill} onValueChange={(v) => handleInputChange('skill', v)} required={isFieldRequired('skill')}>
                    <SelectTrigger><SelectValue placeholder={`Select ${fieldLabel('skill', 'Skill')}`} /></SelectTrigger>
                    <SelectContent>
                      {(config?.fields?.skill?.options || ["Batsman", "Bowler", "All-rounder"]).map((opt: string) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isFieldEnabled('playerCategory') && (
                <div className="space-y-2">
                  <Label htmlFor="playerCategory">{fieldLabel('playerCategory', 'Player Category')} {isFieldRequired('playerCategory') && '*'}</Label>
                  <Select value={formData.playerCategory} onValueChange={(v) => handleInputChange('playerCategory', v)} required={isFieldRequired('playerCategory')}>
                    <SelectTrigger><SelectValue placeholder={`Select ${fieldLabel('playerCategory', 'Category')}`} /></SelectTrigger>
                    <SelectContent>
                      {(() => {
                        // Only the categories the organiser ticked, and only ones the
                        // tournament still has; nothing ticked means all of them.
                        const allowed: string[] = config?.fields?.playerCategory?.options || [];
                        const shown = allowed.length ? playerCategories.filter(c => allowed.includes(c)) : playerCategories;
                        return (shown.length ? shown : playerCategories).map((cat: string) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>);
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isFieldEnabled('photo') && (
                <div className="space-y-2">
                  <Label htmlFor="photo">{fieldLabel('photo', 'Photo')} {isFieldRequired('photo') && '*'}</Label>
                  {photoPreview ? (
                    <div className="flex items-center gap-3 rounded-md border p-2">
                      <img src={photoPreview} alt="Selected photo" className="h-20 w-16 rounded object-cover" />
                      <div className="flex flex-1 flex-wrap gap-2">
                        {photoOriginal && (
                          <Button type="button" variant="outline" size="sm" onClick={() => setPhotoToCrop(photoOriginal)}>
                            Adjust
                          </Button>
                        )}
                        <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('photo')?.click()}>
                          Change photo
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {/* The picker opens the crop dialog; the value is reset so the
                      same file can be picked again after cancelling. */}
                  <Input
                    id="photo"
                    type="file"
                    accept="image/*"
                    className={photoPreview ? "hidden" : undefined}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      if (f.type.startsWith("image/")) setPhotoToCrop(f);
                      else handleFileChange('photo', f);
                    }}
                    required={isFieldRequired('photo') && !formData.photo}
                  />
                  <PhotoCropDialog
                    file={photoToCrop}
                    onCancel={() => setPhotoToCrop(null)}
                    onDone={(f) => {
                      if (photoToCrop) setPhotoOriginal(photoToCrop);
                      setPhotoToCrop(null);
                      handleFileChange('photo', f);
                    }}
                  />
                </div>
              )}

              {/* Additional Information — non-file custom fields, shown above the payment section */}
              {(config?.customFields || []).some((cf: any) => cf.type !== 'file' && cf.showToPublic !== false) && (
                <div className="pt-4 mt-6 border-t">
                  <h3 className="font-medium text-lg mb-4 text-foreground/80">Additional Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customFields.filter((cf) => cf.type !== 'file').map(renderCustomField)}
                  </div>
                </div>
              )}

              {/* Payment QR panel (optional, admin-configured) */}
              {showPaymentPanel && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-primary font-semibold">
                    <QrCode className="w-5 h-5" />
                    Registration Payment
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    {showQr && (
                      <img
                        src={config.paymentPanel.qrImage}
                        alt="Payment QR code"
                        className="w-44 h-44 object-contain rounded-lg border bg-white p-2 shrink-0 mx-auto sm:mx-0"
                      />
                    )}
                    {config.paymentPanel.text && (
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                        {config.paymentPanel.text}
                      </p>
                    )}
                  </div>

                  {upiUri && (
                    <div className="space-y-2 pt-3 border-t border-primary/20">
                      <a
                        href={upiUri}
                        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
                      >
                        <Smartphone className="w-4 h-4" />
                        Pay with any UPI app
                      </a>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">UPI ID:</span>
                        <code className="px-2 py-1 rounded bg-background border font-mono text-foreground break-all">
                          {paymentPanel.upiId}
                        </code>
                        <Button
                          type="button" variant="ghost" size="sm"
                          className="h-7 px-2"
                          onClick={copyUpiId}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          {copiedUpi ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        The button opens your UPI app on a phone. On a computer, copy the UPI ID above
                        and pay from your phone.
                      </p>
                    </div>
                  )}

                  {/* Payment-proof upload(s) — file custom fields, grouped under the QR */}
                  {customFields.some((cf: any) => cf.type === 'file' && cf.showToPublic !== false) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-primary/20">
                      {customFields.filter((cf) => cf.type === 'file').map(renderCustomField)}
                    </div>
                  )}
                </div>
              )}

              {/* Payment-proof upload(s) when there's no QR panel configured */}
              {!showPaymentPanel &&
                customFields.some((cf: any) => cf.type === 'file' && cf.showToPublic !== false) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customFields.filter((cf) => cf.type === 'file').map(renderCustomField)}
                </div>
              )}

              {error && (
                <Alert className="border-destructive">
                  <AlertTitle className="text-destructive">Registration not completed</AlertTitle>
                  <AlertDescription className="text-destructive">
                    {error}
                    {errorId && (
                      <span className="mt-2 block text-sm text-foreground/80">
                        Error ID: <span className="select-all font-mono font-semibold">{errorId}</span>
                        {" "}— share this with the organiser if you need help.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={submitting} className="w-full mt-6 py-6 text-lg font-semibold tracking-wide">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                Register Now
              </Button>
            </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicPlayerRegistration;
