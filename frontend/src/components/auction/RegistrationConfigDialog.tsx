import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import apiConfig from "@/config/apiConfig";

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
  const [config, setConfig] = useState<RegistrationConfig>({ isActive: false, fields: defaultFields, customFields: [] });

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
        setConfig({
          isActive: data.data.registrationFormConfig.isActive || false,
          fields: mergedFields,
          customFields: data.data.registrationFormConfig.customFields || [],
          googleSheetUrl: data.data.registrationFormConfig.googleSheetUrl || '',
          googleSheetId: data.data.registrationFormConfig.googleSheetId || '',
        });
      } else {
        setConfig({ isActive: false, fields: defaultFields, customFields: [] });
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
        toast({ title: "Error", description: data.message || "Failed to save configuration", variant: "destructive" });
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                {(config.customFields?.length || 0) === 0 ? (
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

                    {config.customFields?.map((field, index) => {
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
