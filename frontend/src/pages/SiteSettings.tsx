import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import apiConfig from "@/config/apiConfig";
import { useSiteSettings } from "@/lib/siteSettings";

const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
};

const SiteSettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings, loading, refresh } = useSiteSettings();
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/login");
      return;
    }
    const user = JSON.parse(userStr);
    if (user.role !== "boss" && user.role !== "super_user") {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate("/tournaments");
      return;
    }
    setAuthorized(true);
  }, [navigate, toast]);

  const toggleMaskFemalePlayers = async (value: boolean) => {
    const user = getUser();
    setSaving(true);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/site-settings/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?._id, maskFemalePlayers: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || "Save failed");
      await refresh();
      toast({ title: "Saved", description: `Female player masking is now ${value ? "on" : "off"} site-wide.` });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!authorized) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" />
          Site Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          These settings apply across every tournament on the site.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>Control visibility of sensitive player information.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <Label htmlFor="mask-female-players" className="text-base">
                Mask female players' photos &amp; contact numbers
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Blurs the photo and masks the mobile number of any player whose gender is
                "Female" everywhere on the site — player cards, the live auction room,
                overlays, and the scoring app. Only applies to tournaments conducted a
                week ago or earlier; current and upcoming tournaments are unaffected.
              </p>
            </div>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            ) : (
              <Switch
                id="mask-female-players"
                checked={settings.maskFemalePlayers}
                disabled={saving}
                onCheckedChange={toggleMaskFemalePlayers}
                className="shrink-0"
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SiteSettingsPage;
