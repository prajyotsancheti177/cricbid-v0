import { createContext, useContext, useEffect, useState, useCallback, createElement, type ReactNode } from "react";
import apiConfig from "@/config/apiConfig";

export interface SiteSettings {
  maskFemalePlayers: boolean;
}

const DEFAULT_SETTINGS: SiteSettings = {
  maskFemalePlayers: false,
};

interface SiteSettingsContextValue {
  settings: SiteSettings;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loading: true,
  refresh: async () => {},
});

export const fetchSiteSettings = async (): Promise<SiteSettings> => {
  try {
    const res = await fetch(`${apiConfig.baseUrl}/api/site-settings/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return DEFAULT_SETTINGS;
    const data = await res.json();
    return { ...DEFAULT_SETTINGS, ...(data?.data || {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const SiteSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const fresh = await fetchSiteSettings();
    setSettings(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return createElement(SiteSettingsContext.Provider, { value: { settings, loading, refresh } }, children);
};

export const useSiteSettings = () => useContext(SiteSettingsContext);
