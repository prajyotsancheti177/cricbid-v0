import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Loader2, Plus, Trash2, QrCode, UploadCloud, X, Image as ImageIcon } from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { compressImage } from "@/lib/imageCompressor";
import { isValidUpiId, isPhoneUpiId, type PaymentMode } from "@/lib/upi";
import { buildPaymentProofField, hasPaymentProofField, isPaymentProofField } from "@/lib/paymentProof";



interface PaymentPanelConfig {
  enabled: boolean;
  qrImage?: string; // base64 data URL
  text?: string;
  // Absent mode means 'qr' — panels saved before UPI existed keep working.
  mode?: PaymentMode;
  upiId?: string;
  payeeName?: string;
  amount?: number | string;
}

interface fieldConfig {
  required: boolean;
  enabled: boolean;
  showToPublic: boolean;
  defaultValue: any;
  label: string;
  options?: string[];
}

interface CustomFieldConfig {
  id: string;
  label: string;
  type: string;
  required: boolean;
  showToPublic: boolean;
  defaultValue: any;
  options: string[];
}

interface RegistrationConfig {
  isActive: boolean;
  fields: {
    age: fieldConfig;
    gender: fieldConfig;
    photo: fieldConfig;
    skill: fieldConfig;
    mobile: fieldConfig;
    email: fieldConfig;
    address: fieldConfig;
    playerCategory: fieldConfig;
  };
  customFields?: CustomFieldConfig[];
  googleSheetUrl?: string;
  googleSheetId?: string;
  showProfileLogin?: boolean;      // show the "CricBid profile login" panel on the public form (default true)
  paymentPanel?: PaymentPanelConfig;
  paymentProofOptOut?: boolean;   // host turned the payment-screenshot upload off
  posterImage?: string;            // tournament logo/poster shown at the top of the public form (S3 URL)
}

const defaultFields = {
  age: { required: true, enabled: true, showToPublic: true, defaultValue: '', label: "Age" },
  gender: { required: true, enabled: true, showToPublic: true, defaultValue: '', label: "Gender" },
  photo: { required: false, enabled: true, showToPublic: true, defaultValue: '', label: "Photo" },
  skill: { required: true, enabled: true, showToPublic: true, defaultValue: '', label: "Skill", options: ["Batsman", "Bowler", "All-rounder"] },
  mobile: { required: true, enabled: true, showToPublic: true, defaultValue: '', label: "Mobile Number" },
  email: { required: true, enabled: true, showToPublic: true, defaultValue: '', label: "Email Address" },
  address: { required: false, enabled: true, showToPublic: true, defaultValue: '', label: "Address" },
  playerCategory: { required: true, enabled: true, showToPublic: true, defaultValue: '', label: "Player Category" },
};

interface RegistrationConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentName: string;
}

export function RegistrationConfigDialog({ isOpen, onClose, tournamentId, tournamentName }: RegistrationConfigDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<RegistrationConfig>({ isActive: false, fields: defaultFields, customFields: [], showProfileLogin: true, paymentPanel: { enabled: false, qrImage: '', text: '' } });

  const customFieldTypes = ["text", "number", "textarea", "dropdown", "checkbox", "file"];

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const publicLink = `${window.location.origin}/register/public/${tournamentId}`;

  useEffect(() => {
    if (isOpen && tournamentId) {
      fetchConfig();
    }
  }, [isOpen, tournamentId]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiConfig.baseUrl}/api/tournament/${tournamentId}/registration-config`);
      const data = await response.json();
      if (response.ok && data.data && data.data.registrationFormConfig) {
        const serverFields = data.data.registrationFormConfig.fields || {};
        const mergedFields: any = {};
        for (const key of Object.keys(defaultFields)) {
          mergedFields[key] = { ...defaultFields[key as keyof typeof defaultFields], ...(serverFields[key] || {}) };
        }
        const loadedCustomFields = data.data.registrationFormConfig.customFields || [];
        const optedOut = data.data.registrationFormConfig.paymentProofOptOut === true;
        // On by default: tournaments configured before this existed get the
        // payment-screenshot upload unless their host explicitly removed it.
        const withProof = (!optedOut && !hasPaymentProofField(loadedCustomFields))
          ? [...loadedCustomFields, buildPaymentProofField()]
          : loadedCustomFields;
        setConfig({
          isActive: data.data.registrationFormConfig.isActive || false,
          fields: mergedFields,
          customFields: withProof,
          paymentProofOptOut: optedOut,
          googleSheetUrl: data.data.registrationFormConfig.googleSheetUrl || '',
          googleSheetId: data.data.registrationFormConfig.googleSheetId || '',
          showProfileLogin: data.data.registrationFormConfig.showProfileLogin !== false,
          paymentPanel: data.data.registrationFormConfig.paymentPanel || { enabled: false, qrImage: '', text: '' },
          posterImage: data.data.registrationFormConfig.posterImage || '',
        });
      } else {
        setConfig({ isActive: false, fields: defaultFields, customFields: [buildPaymentProofField()], showProfileLogin: true, paymentPanel: { enabled: false, qrImage: '', text: '' } });
      }
    } catch (error) {
       console.error(error);
       toast({ title: "Error", description: "Failed to load config", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${apiConfig.baseUrl}/api/tournament/update-registration-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user._id },
        body: JSON.stringify({
          tournamentId,
          configData: config,
          userId: user._id,
          userRole: user.role
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast({ title: "Success", description: "Registration configuration saved." });
        onClose();
      } else {
        toast({ title: "Error", description: data.error || data.message || "Failed to save configuration", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof RegistrationConfig["fields"], property: keyof fieldConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [key]: {
          ...prev.fields[key],
          [property]: value
        }
      }
    }));
  };

  const addCustomField = () => {
    const newField: CustomFieldConfig = {
      id: "cf_" + Math.random().toString(36).substr(2, 9),
      label: "New Custom Field",
      type: "text",
      required: false,
      showToPublic: true,
      defaultValue: '',
      options: []
    };
    setConfig(prev => ({
      ...prev,
      customFields: [...(prev.customFields || []), newField]
    }));
  };

  const updateCustomField = (index: number, key: keyof CustomFieldConfig, value: any) => {
    setConfig(prev => {
      const updatedArr = [...(prev.customFields || [])];
      updatedArr[index] = { ...updatedArr[index], [key]: value };
      return { ...prev, customFields: updatedArr };
    });
  };

  const removeCustomField = (index: number) => {
    setConfig(prev => {
      const updatedArr = [...(prev.customFields || [])];
      updatedArr.splice(index, 1);
      return { ...prev, customFields: updatedArr };
    });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(publicLink);
    toast({ title: "Copied!", description: "Link copied to clipboard" });
  };

  const paymentMode = config.paymentPanel?.mode || 'qr';
  const showUpiFields = paymentMode === 'upi' || paymentMode === 'both';
  const showQrField = paymentMode === 'qr' || paymentMode === 'both';
  const upiIdEntered = !!(config.paymentPanel?.upiId || '').trim();
  const upiIdValid = isValidUpiId(config.paymentPanel?.upiId);
  const upiIdIsPhone = isPhoneUpiId(config.paymentPanel?.upiId);

  // Keeps each field's real index so update/remove by index stay correct.
  const editableCustomFields = (config.customFields || [])
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => !isPaymentProofField(field));

  const askPaymentProof = hasPaymentProofField(config.customFields);

  const setAskPaymentProof = (on: boolean) => {
    setConfig(prev => {
      const others = (prev.customFields || []).filter(f => !isPaymentProofField(f));
      return {
        ...prev,
        paymentProofOptOut: !on,
        customFields: on ? [...others, buildPaymentProofField()] : others,
      };
    });
  };

  const updatePaymentPanel = (patch: Partial<PaymentPanelConfig>) => {
    setConfig(prev => ({
      ...prev,
      paymentPanel: { ...(prev.paymentPanel || { enabled: false }), ...patch },
    }));
  };

  const handleQrUpload = async (file?: File) => {
    if (!file) return;
    try {
      const compressed = await compressImage(file, 800, 800, 0.8);
      const formData = new FormData();
      formData.append('image', compressed, file.name);
      const response = await fetch(`${apiConfig.baseUrl}/api/tournament/upload-image`, {
        method: 'POST',
        headers: { 'x-user-id': user._id },
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data.data?.imageUrl) {
        updatePaymentPanel({ qrImage: data.data.imageUrl });
      } else {
        toast({ title: "Error", description: data.message || "Failed to upload QR image", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not upload that image", variant: "destructive" });
    }
  };

  const handlePosterUpload = async (file?: File) => {
    if (!file) return;
    try {
      const compressed = await compressImage(file, 1400, 1400, 0.8);
      const formData = new FormData();
      formData.append('image', compressed, file.name);
      const response = await fetch(`${apiConfig.baseUrl}/api/tournament/upload-image`, {
        method: 'POST',
        headers: { 'x-user-id': user._id },
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data.data?.imageUrl) {
        setConfig(prev => ({ ...prev, posterImage: data.data.imageUrl }));
      } else {
        toast({ title: "Error", description: data.message || "Failed to upload image", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not upload that image", variant: "destructive" });
    }
  };

  // Radix Select/Popover render their dropdown in a portal OUTSIDE the dialog's
  // DOM subtree. On touch devices especially, tapping a dropdown option registers
  // as an "interact outside" and dismisses the whole dialog. Ignore any outside
  // interaction that actually originated from a popper (dropdown) so changing a
  // field's visibility/type no longer closes the dialog.
  const isInsidePopper = (e: any): boolean => {
    const t = (e?.detail?.originalEvent?.target ?? e?.target) as HTMLElement | undefined;
    return !!t?.closest?.('[data-radix-popper-content-wrapper]');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => { if (isInsidePopper(e)) e.preventDefault(); }}
        onInteractOutside={(e) => { if (isInsidePopper(e)) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Customize Registration Form - {tournamentName}</DialogTitle>
          <DialogDescription>
            Configure what fields are shown and required for publicly registered players.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <div>
                <h4 className="font-medium text-lg">Enable Public Registration</h4>
                <p className="text-sm text-muted-foreground">Allow players to self-register via link</p>
              </div>
              <Switch 
                checked={config.isActive} 
                onCheckedChange={(c) => setConfig(prev => ({ ...prev, isActive: c }))} 
              />
            </div>

            {config.isActive && (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
                <div className="space-y-3">
                  <Label>Public Link</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={publicLink} className="bg-background" />
                    <Button variant="outline" size="icon" onClick={copyLink} title="Copy Link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" asChild title="Open Link">
                      <a href={publicLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-primary/10">
                  <div className="flex justify-between items-center">
                      <Label className="text-green-700 font-semibold flex items-center gap-2">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-8h8v2H8v-2zm0 4h8v2H8v-2z"/></svg>
                        Live Data Sync Sheet
                      </Label>
                  </div>
                  <p className="text-sm text-green-700/80 mb-2">
                    Create an empty Google Sheet, share it with <code className="bg-green-100 px-1 py-0.5 rounded">449137598564-compute@developer.gserviceaccount.com</code> (as Editor), and paste the URL here:
                  </p>
                  <Input 
                    placeholder="https://docs.google.com/spreadsheets/d/..." 
                    value={config.googleSheetUrl || ''} 
                    onChange={(e) => {
                      const url = e.target.value;
                      let id = '';
                      const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
                      const match = url.match(regex);
                      if (match) id = match[1];
                      setConfig(prev => ({ ...prev, googleSheetUrl: url, googleSheetId: id }));
                    }}
                    className="bg-green-50 border-green-200 text-green-800" 
                  />
                  {config.googleSheetUrl && (
                    <Button variant="outline" size="sm" className="mt-2 border-green-200 text-green-700 hover:bg-green-100" asChild>
                      <a href={config.googleSheetUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" /> Open Google Sheet
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Tournament logo / poster */}
            <div>
              <h4 className="font-semibold text-md border-b pb-2 mb-4 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Tournament Logo / Poster (optional)
              </h4>
              <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                <p className="text-sm text-muted-foreground">
                  Shown at the top of the public registration page. Use your tournament logo or a promotional poster.
                </p>
                {config.posterImage ? (
                  <div className="space-y-2">
                    <img
                      src={config.posterImage}
                      alt="Tournament poster"
                      className="max-h-48 w-auto rounded-lg border bg-white object-contain"
                    />
                    <div className="flex gap-2">
                      <label className="inline-flex">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePosterUpload(e.target.files?.[0])} />
                        <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border cursor-pointer hover:bg-muted">
                          <UploadCloud className="h-4 w-4" /> Replace
                        </span>
                      </label>
                      <Button
                        type="button" variant="ghost" size="sm"
                        className="text-destructive hover:text-destructive px-2"
                        onClick={() => setConfig(prev => ({ ...prev, posterImage: '' }))}
                      >
                        <X className="h-4 w-4 mr-1" /> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border border-dashed cursor-pointer hover:bg-muted/40 text-muted-foreground">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePosterUpload(e.target.files?.[0])} />
                    <UploadCloud className="h-6 w-6" />
                    <span className="text-sm">Upload a logo or poster image</span>
                  </label>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-md border-b pb-2 mb-4">Standard Field Configuration</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-[1.5fr_1fr_1.5fr_0.5fr] gap-4 mb-2 opacity-70">
                  <span className="text-sm font-medium">Field Base</span>
                  <span className="text-sm font-medium">Label Override</span>
                  <span className="text-sm font-medium">Visibility</span>
                  <span className="text-sm font-medium text-center">Required</span>
                </div>
                
                {/* Name is always required and enabled */}
                <div className="grid grid-cols-[1.5fr_1fr_1.5fr_0.5fr] gap-4 items-center pl-2 py-2 bg-muted/20 rounded">
                  <span className="font-medium">Name <span className="text-xs text-muted-foreground">(always)</span></span>
                  <Input value="Full Name" disabled className="h-8" />
                  <Select disabled value="public"><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public</SelectItem></SelectContent></Select>
                  <div className="flex justify-center"><Switch checked disabled /></div>
                </div>

                {/* Other fields */}
                {(Object.keys(config.fields) as Array<keyof RegistrationConfig["fields"]>).map((key) => {
                  const field = config.fields[key];
                  const visibilityMode = (!field.enabled) ? 'disabled' : (field.showToPublic ? 'public' : 'hidden');

                  const setVisibility = (mode: string) => {
                     if (mode === 'disabled') {
                        updateField(key, 'enabled', false);
                        updateField(key, 'showToPublic', false);
                        updateField(key, 'required', false);
                     } else if (mode === 'hidden') {
                        updateField(key, 'enabled', true);
                        updateField(key, 'showToPublic', false);
                        updateField(key, 'required', false);
                     } else {
                        updateField(key, 'enabled', true);
                        updateField(key, 'showToPublic', true);
                     }
                  };

                  return (
                    <div key={key} className="p-3 border rounded-lg bg-card shadow-sm space-y-3">
                      <div className="grid grid-cols-[1.5fr_1fr_1.5fr_0.5fr] gap-4 items-center">
                        <span className="capitalize font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <Input 
                          value={field.label} 
                          onChange={(e) => updateField(key, 'label', e.target.value)} 
                          className="h-8"
                        />
                        <Select value={visibilityMode} onValueChange={setVisibility}>
                          <SelectTrigger className="h-8 bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Public & Editable</SelectItem>
                            <SelectItem value="hidden">Hidden w/ Default</SelectItem>
                            <SelectItem value="disabled">Disabled</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex justify-center">
                          <Switch 
                            checked={field.required} 
                            disabled={visibilityMode !== 'public'}
                            onCheckedChange={(c) => updateField(key, 'required', c)} 
                          />
                        </div>
                      </div>
                      
                      {visibilityMode === 'hidden' && (
                         <div className="pl-4 mt-2">
                           <Label className="text-xs text-emerald-600 mb-1 flex items-center gap-2">
                             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3 h-3"><path strokeWidth="3" d="M20 6L9 17l-5-5"/></svg>
                             Auto-Injection value
                           </Label>
                           <Input 
                             value={field.defaultValue || ''} 
                             onChange={(e) => updateField(key, 'defaultValue', e.target.value)} 
                             className="h-8 max-w-sm border-emerald-200 focus-visible:ring-emerald-500 bg-emerald-50/50" 
                             placeholder={`Enter a forced default...`} 
                           />
                         </div>
                      )}

                      {/* Skill dropdown options editor */}
                      {key === 'skill' && field.enabled && visibilityMode === 'public' && (
                         <div className="pl-4 mt-2 border-l-2 border-primary/20 space-y-2">
                           <Label className="text-xs text-muted-foreground block">Skill Dropdown Options</Label>
                           {field.options && field.options.length > 0 && (
                             <div className="flex flex-wrap gap-1.5">
                               {field.options.map((opt, optIdx) => (
                                 <span
                                   key={optIdx}
                                   className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                                 >
                                   {opt}
                                   <button
                                     type="button"
                                     onClick={() => {
                                       const updated = [...(field.options || [])];
                                       updated.splice(optIdx, 1);
                                       updateField(key, 'options', updated);
                                     }}
                                     className="ml-0.5 hover:text-destructive transition-colors"
                                   >
                                     ×
                                   </button>
                                 </span>
                               ))}
                             </div>
                           )}
                           <div className="flex gap-2">
                             <Input
                               id="new-skill-opt"
                               placeholder="Type a skill option..."
                               className="h-8 bg-muted/30 flex-1 max-w-sm"
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter') {
                                   e.preventDefault();
                                   const input = e.currentTarget;
                                   const val = input.value.trim();
                                   if (val && !(field.options || []).includes(val)) {
                                     updateField(key, 'options', [...(field.options || []), val]);
                                     input.value = '';
                                   }
                                 }
                               }}
                             />
                             <Button
                               type="button"
                               variant="outline"
                               size="sm"
                               className="h-8 px-3 text-xs"
                               onClick={() => {
                                 const input = document.getElementById('new-skill-opt') as HTMLInputElement;
                                 if (!input) return;
                                 const val = input.value.trim();
                                 if (val && !(field.options || []).includes(val)) {
                                   updateField(key, 'options', [...(field.options || []), val]);
                                   input.value = '';
                                 }
                               }}
                             >
                               <Plus className="h-3 w-3 mr-1" /> Add
                             </Button>
                           </div>
                         </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h4 className="font-semibold text-md">Custom Fields</h4>
                <Button onClick={addCustomField} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Field
                </Button>
              </div>
              
              <div className="space-y-4">
                {editableCustomFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded border border-dashed">
                    No custom fields added yet.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-[1.5fr_1fr_1.5fr_0.5fr_0.5fr] gap-4 mb-2 opacity-70">
                      <span className="text-sm font-medium">Field Label</span>
                      <span className="text-sm font-medium">Type</span>
                      <span className="text-sm font-medium">Visibility</span>
                      <span className="text-sm font-medium text-center">Required</span>
                      <span className="text-sm font-medium text-center">Action</span>
                    </div>

                    {editableCustomFields.map(({ field, index }) => {
                      const visibilityMode = field.showToPublic !== false ? 'public' : 'hidden';
                      
                      const setVisibility = (mode: string) => {
                         if (mode === 'hidden') {
                            updateCustomField(index, 'showToPublic', false);
                            updateCustomField(index, 'required', false);
                         } else {
                            updateCustomField(index, 'showToPublic', true);
                         }
                      };

                      return (
                      <div key={field.id} className="p-3 border rounded-lg bg-card shadow-sm space-y-3">
                        <div className="grid grid-cols-[1.5fr_1fr_1.5fr_0.5fr_0.5fr] gap-4 items-center">
                          <Input 
                            value={field.label} 
                            onChange={(e) => updateCustomField(index, 'label', e.target.value)} 
                            className="h-8 font-medium"
                            placeholder="Label (e.g. T-Shirt Size)"
                          />
                          
                          <Select 
                            value={field.type} 
                            disabled={visibilityMode === 'hidden'}
                            onValueChange={(val) => updateCustomField(index, 'type', val)}
                          >
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {customFieldTypes.map(t => (
                                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select value={visibilityMode} onValueChange={setVisibility}>
                            <SelectTrigger className="h-8 bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="public">Public</SelectItem>
                              <SelectItem value="hidden">Hidden w/ Default</SelectItem>
                            </SelectContent>
                          </Select>

                          <div className="flex justify-center">
                            <Switch 
                              checked={field.required} 
                              disabled={visibilityMode === 'hidden'}
                              onCheckedChange={(c) => updateCustomField(index, 'required', c)} 
                            />
                          </div>

                          <div className="flex justify-center">
                            <Button variant="ghost" size="icon" onClick={() => removeCustomField(index)} className="h-8 w-8 text-destructive hover:text-destructive/90">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {visibilityMode === 'hidden' && (
                           <div className="pl-4 mt-2">
                             <Label className="text-xs text-emerald-600 mb-1 flex items-center gap-2">
                               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3 h-3"><path strokeWidth="3" d="M20 6L9 17l-5-5"/></svg>
                               Auto-Injection value
                             </Label>
                             <Input 
                               value={field.defaultValue || ''} 
                               onChange={(e) => updateCustomField(index, 'defaultValue', e.target.value)} 
                               className="h-8 max-w-sm border-emerald-200 focus-visible:ring-emerald-500 bg-emerald-50/50" 
                               placeholder={`Enter a forced default...`} 
                             />
                           </div>
                        )}

                        {field.type === 'dropdown' && visibilityMode === 'public' && (
                          <div className="pl-4 border-l-2 border-primary/20 pt-1 space-y-2">
                            <Label className="text-xs text-muted-foreground block">Dropdown Options</Label>
                            {/* Existing options as removable pills */}
                            {field.options && field.options.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {field.options.map((opt, optIdx) => (
                                  <span
                                    key={optIdx}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                                  >
                                    {opt}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...field.options];
                                        updated.splice(optIdx, 1);
                                        updateCustomField(index, 'options', updated);
                                      }}
                                      className="ml-0.5 hover:text-destructive transition-colors"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* Add new option */}
                            <div className="flex gap-2">
                              <Input
                                id={`new-opt-${field.id}`}
                                placeholder="Type an option..."
                                className="h-8 bg-muted/30 flex-1"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const input = e.currentTarget;
                                    const val = input.value.trim();
                                    if (val && !(field.options || []).includes(val)) {
                                      updateCustomField(index, 'options', [...(field.options || []), val]);
                                      input.value = '';
                                    }
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs"
                                onClick={() => {
                                  const input = document.getElementById(`new-opt-${field.id}`) as HTMLInputElement;
                                  if (!input) return;
                                  const val = input.value.trim();
                                  if (val && !(field.options || []).includes(val)) {
                                    updateCustomField(index, 'options', [...(field.options || []), val]);
                                    input.value = '';
                                  }
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )})}
                  </>
                )}
              </div>
            </div>

            {/* Sign-in / Profile access */}
            <div>
              <h4 className="font-semibold text-md border-b pb-2 mb-4">Player Sign-in</h4>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="pr-4">
                  <h4 className="font-medium">Show CricBid profile login</h4>
                  <p className="text-sm text-muted-foreground">
                    When on, players can log in / create a CricBid profile to auto-fill their details.
                    Turn off to make the form fully anonymous — no sign-in shown.
                  </p>
                </div>
                <Switch
                  checked={config.showProfileLogin !== false}
                  onCheckedChange={(c) => setConfig(prev => ({ ...prev, showProfileLogin: c }))}
                />
              </div>
            </div>

            {/* Payment QR panel */}
            <div>
              <h4 className="font-semibold text-md border-b pb-2 mb-4 flex items-center gap-2">
                <QrCode className="h-4 w-4" /> Payment (optional)
              </h4>
              <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <h4 className="font-medium">Show a payment panel on the form</h4>
                    <p className="text-sm text-muted-foreground">
                      Display a QR code and/or a UPI link so players can pay the registration fee while filling the form.
                    </p>
                  </div>
                  <Switch
                    checked={!!config.paymentPanel?.enabled}
                    onCheckedChange={(c) => updatePaymentPanel({ enabled: c })}
                  />
                </div>

                {config.paymentPanel?.enabled && (
                  <div className="space-y-4 pt-2 border-t">
                    <div className="space-y-2">
                      <Label>Payment method</Label>
                      <Select
                        value={config.paymentPanel?.mode || 'qr'}
                        onValueChange={(v) => updatePaymentPanel({ mode: v as PaymentMode })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="qr">QR code only</SelectItem>
                          <SelectItem value="upi">UPI link only</SelectItem>
                          <SelectItem value="both">QR code and UPI link</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {showUpiFields && (
                      <div className="space-y-4 p-3 rounded-lg border bg-background/60">
                        <div className="space-y-2">
                          <Label>UPI ID</Label>
                          <Input
                            placeholder="yourname@okhdfcbank or 10-digit mobile number"
                            value={config.paymentPanel?.upiId || ''}
                            onChange={(e) => updatePaymentPanel({ upiId: e.target.value })}
                          />
                          {upiIdEntered && !upiIdValid && (
                            <p className="text-sm text-destructive">
                              Enter a valid UPI ID (name@bank) or a 10-digit mobile number.
                            </p>
                          )}
                          {upiIdValid && upiIdIsPhone && (
                            <p className="text-sm text-amber-600 dark:text-amber-500">
                              Mobile-number UPI IDs only work if the recipient's bank has enabled
                              NPCI mobile mapping. A full UPI ID (name@bank) is more reliable —
                              keeping the QR as a fallback is recommended.
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Payee name (optional)</Label>
                          <Input
                            placeholder="e.g. Rebirth Cricket Club"
                            maxLength={80}
                            value={config.paymentPanel?.payeeName || ''}
                            onChange={(e) => updatePaymentPanel({ payeeName: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Shown in the player's UPI app. Always confirm it matches your account name.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Amount (optional)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={100000}
                            placeholder="Leave blank to let players enter the amount"
                            value={config.paymentPanel?.amount ?? ''}
                            onChange={(e) => updatePaymentPanel({ amount: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Pre-fills the amount, but players can still edit it in their UPI app before paying —
                            the link does not confirm that money arrived.
                          </p>
                        </div>
                      </div>
                    )}

                    {showQrField && (
                    <div className="space-y-2">
                      <Label>QR code image</Label>
                      {config.paymentPanel?.qrImage ? (
                        <div className="flex items-start gap-3">
                          <img
                            src={config.paymentPanel.qrImage}
                            alt="Payment QR"
                            className="w-32 h-32 object-contain rounded-lg border bg-white p-1"
                          />
                          <div className="flex flex-col gap-2">
                            <label className="inline-flex">
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleQrUpload(e.target.files?.[0])} />
                              <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border cursor-pointer hover:bg-muted">
                                <UploadCloud className="h-4 w-4" /> Replace
                              </span>
                            </label>
                            <Button
                              type="button" variant="ghost" size="sm"
                              className="text-destructive hover:text-destructive justify-start px-2"
                              onClick={() => updatePaymentPanel({ qrImage: '' })}
                            >
                              <X className="h-4 w-4 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border border-dashed cursor-pointer hover:bg-muted/40 text-muted-foreground">
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleQrUpload(e.target.files?.[0])} />
                          <UploadCloud className="h-6 w-6" />
                          <span className="text-sm">Upload a QR screenshot (PhonePe / GPay / UPI)</span>
                        </label>
                      )}
                    </div>
                    )}

                    <div className="space-y-2">
                      <Label>Payment instructions (optional)</Label>
                      <Textarea
                        placeholder="e.g. Registration fee ₹500. Scan the QR to pay, then submit the form. Mention your name in the payment note."
                        value={config.paymentPanel?.text || ''}
                        onChange={(e) => updatePaymentPanel({ text: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment screenshot upload */}
            <div>
              <h4 className="font-semibold text-md border-b pb-2 mb-4 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Payment proof
              </h4>
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <h4 className="font-medium">Ask players for a payment screenshot</h4>
                    <p className="text-sm text-muted-foreground">
                      Adds a "Payment Screenshot" upload to the registration form. It is optional to
                      submit, so it never blocks a registration, and the uploaded image comes through
                      as a column in the Google Sheet export.
                    </p>
                  </div>
                  <Switch
                    checked={askPaymentProof}
                    onCheckedChange={setAskPaymentProof}
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
