import { useEffect, useState } from "react";
import { post } from "./api";

export interface SiteSettings {
  maskFemalePlayers: boolean;
}

const DEFAULT_SETTINGS: SiteSettings = { maskFemalePlayers: false };

export function useSiteSettings(): SiteSettings {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    post("site-settings/get", {}).then((r) => {
      if (!cancelled && r?.data) setSettings({ ...DEFAULT_SETTINGS, ...r.data });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return settings;
}
