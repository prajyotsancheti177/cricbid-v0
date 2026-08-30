import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserPlus, Trophy, Loader2, CheckCircle2, LogIn, LogOut, QrCode, Smartphone, Copy } from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { compressImage } from "@/lib/imageCompressor";
import { buildUpiUri, resolvePaymentMode } from "@/lib/upi";
import { buildPaymentProofField, asksForPaymentProof } from "@/lib/paymentProof";
import PlayerProfileModal, { getStoredPlayerToken, clearPlayerToken, fetchProfileWithToken } from "@/components/PlayerProfileModal";

const PublicPlayerRegistration = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      fetchProfileWithToken(token).then((profile) => {
        if (profile) setActiveProfile(profile);
        else clearPlayerToken();
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
    // asksForPaymentProof also covers a host's own file field, so a tournament
    // that already collects a screenshot is not asked for a second one.
    if (!config || config.paymentProofOptOut === true || asksForPaymentProof(configured)) return configured;
    return [...configured, buildPaymentProofField()];
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setError("");

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

      const response = await fetch(`${apiConfig.baseUrl}/api/player/register-public`, {
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
        } else if (lowerMsg.includes('duplicate') || lowerMsg.includes('already exists') || lowerMsg.includes('already registered')) {
          throw new Error('A player with this name or mobile number is already registered.');
        } else if (lowerMsg.includes('tournament') && lowerMsg.includes('not found')) {
          throw new Error('This tournament could not be found. The registration link may be invalid.');
        } else {
          throw new Error(errorMessage);
        }
      }

      setSuccess("Registration successful! Your player profile has been submitted.");
      setFormData({ name: "", age: "", gender: "", mobile: "", email: "", address: "", skill: "", playerCategory: "", photo: null, customFields: {} });
    } catch (err: any) {
      // Map network-level errors to user-friendly messages
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
               <Alert className="border-green-500 bg-green-50 mb-6">
                 <AlertDescription className="text-green-700 text-lg py-4 text-center">
                   {success}
                 </AlertDescription>
               </Alert>
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
                      {playerCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isFieldEnabled('photo') && (
                <div className="space-y-2">
                  <Label htmlFor="photo">{fieldLabel('photo', 'Photo')} {isFieldRequired('photo') && '*'}</Label>
                  <Input id="photo" type="file" accept="image/*" onChange={(e) => handleFileChange('photo', e.target.files?.[0])} required={isFieldRequired('photo')} />
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
                  <AlertDescription className="text-destructive">{error}</AlertDescription>
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
