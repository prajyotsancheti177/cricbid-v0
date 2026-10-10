import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import apiConfig from "@/config/apiConfig";
import { jsonAuthHeaders, authHeaders } from "@/lib/auth";
import { Timer, Upload, X, Loader2 } from "lucide-react";

/**
 * Stream countdown — set the start time and the logo from here, not the URL.
 *
 * The countdown overlay can still be driven by query parameters, but nobody
 * wants to retype an ISO timestamp into OBS five minutes before going live.
 * What is saved here is what the overlay shows, and it picks changes up on its
 * own — the browser source does not need reloading.
 *
 * Stored on the tournament's `features` blob (no migration): `auctionCountdown`
 * holds the start time and the note, `brandLogo` the image.
 */

interface Props {
  tournamentId: string;
  /** The tournament's current features blob — saved back merged, never replaced. */
  features: Record<string, unknown>;
  onSaved: () => void;
}

/** A Date → the "YYYY-MM-DDTHH:mm" an <input type="datetime-local"> wants, in local time. */
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const CountdownSettingsCard = ({ tournamentId, features, onSaved }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const saved = (features?.auctionCountdown || {}) as { startsAt?: string; note?: string };
  const savedLogo = (features?.brandLogo as string) || "";

  const [startsAt, setStartsAt] = useState(() =>
    saved.startsAt ? toLocalInput(new Date(saved.startsAt)) : ""
  );
  const [note, setNote] = useState(saved.note || "");
  const [logo, setLogo] = useState(savedLogo);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  /** What the overlay is counting to right now, so this card agrees with the screen. */
  const preview = useMemo(() => {
    if (!startsAt) return null;
    const ms = new Date(startsAt).getTime() - now;
    if (!Number.isFinite(ms)) return null;
    if (ms <= 0) return "Starting now";
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }, [startsAt, now]);

  /** "Start in N minutes" — the way this actually gets used before a stream. */
  const setMinutesFromNow = (mins: number) =>
    setStartsAt(toLocalInput(new Date(Date.now() + mins * 60_000)));

  const save = async (next?: { startsAt?: string | null; note?: string; logo?: string }) => {
    setBusy(true);
    try {
      const iso = next?.startsAt === null
        ? null
        : (next?.startsAt ?? (startsAt ? new Date(startsAt).toISOString() : null));

      const res = await fetch(`${apiConfig.baseUrl}/api/tournament/update`, {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({
          tournamentId,
          // Merged, not replaced — this blob also holds the category limits and
          // the per-tournament flags.
          features: {
            ...features,
            auctionCountdown: { startsAt: iso, note: next?.note ?? note },
            brandLogo: next?.logo ?? logo,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Could not save");
      toast({ title: "Saved", description: iso ? "The overlay will pick this up within a few seconds." : "Countdown cleared." });
      onSaved();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch(`${apiConfig.baseUrl}/api/tournament/upload-image`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const body = await res.json();
      if (!res.ok || !body?.data?.imageUrl) throw new Error(body.message || "Upload failed");
      setLogo(body.data.imageUrl);
      await save({ logo: body.data.imageUrl });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Timer className="h-5 w-5 text-primary" /> Stream countdown
        </CardTitle>
        <CardDescription>
          Sets what the Countdown overlay shows. Change it here and the overlay follows
          within a few seconds — no need to reload the browser source in OBS.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 p-4 pt-0 md:p-6 md:pt-0">
        <div className="flex flex-wrap gap-2">
          {[5, 10, 15, 30, 60].map((m) => (
            <Button key={m} type="button" variant="outline" size="sm" onClick={() => setMinutesFromNow(m)}>
              Start in {m}m
            </Button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cd-at">Start time</Label>
            <Input
              id="cd-at"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cd-note">Line under the clock (optional)</Label>
            <Input
              id="cd-note"
              placeholder="e.g. Doors open 7pm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {preview && (
          <p className="text-sm text-muted-foreground">
            Overlay will show <span className="font-semibold tabular-nums text-foreground">{preview}</span>
            {startsAt && ` · ${new Date(startsAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
          </p>
        )}

        <div className="space-y-2">
          <Label>Logo on the overlay</Label>
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt="" className="h-12 w-12 rounded-lg border border-border object-contain bg-muted" />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                None
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()} className="gap-1.5">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {logo ? "Replace" : "Upload"}
            </Button>
            {logo && (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setLogo(""); save({ logo: "" }); }} className="gap-1.5">
                <X className="h-4 w-4" /> Remove
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => save()} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save countdown
          </Button>
          <Button
            variant="outline"
            disabled={busy || !startsAt}
            onClick={() => { setStartsAt(""); save({ startsAt: null }); }}
          >
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CountdownSettingsCard;
