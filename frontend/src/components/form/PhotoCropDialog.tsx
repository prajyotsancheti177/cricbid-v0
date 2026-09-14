import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Crop, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/**
 * Opens after a photo is picked: crop it, or keep it exactly as chosen.
 *
 * Registration photos end up on auction cards and the big screen, where a
 * wide phone shot of a player standing far away reads as a speck. Cropping at
 * the moment of upload is the only point where the player themselves can fix
 * that — nobody goes back and edits a registration photo later.
 */

const ASPECTS = [
  { label: "Portrait", value: 3 / 4 },
  { label: "Square", value: 1 },
  { label: "Landscape", value: 4 / 3 },
];

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Draw the chosen area (after rotation) onto a canvas and return it as a JPEG file. */
const cropToFile = async (src: string, area: Area, rotation: number, name: string): Promise<File> => {
  const img = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const boundW = img.width * cos + img.height * sin;
  const boundH = img.width * sin + img.height * cos;

  // Rotate the whole image onto a canvas big enough to hold it…
  const rotated = document.createElement("canvas");
  rotated.width = boundW;
  rotated.height = boundH;
  const rctx = rotated.getContext("2d")!;
  rctx.translate(boundW / 2, boundH / 2);
  rctx.rotate(rad);
  rctx.drawImage(img, -img.width / 2, -img.height / 2);

  // …then cut the selected area out of that.
  const out = document.createElement("canvas");
  out.width = Math.round(area.width);
  out.height = Math.round(area.height);
  out.getContext("2d")!.drawImage(rotated, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);

  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Could not crop this photo");
  const base = name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}-cropped.jpg`, { type: "image/jpeg" });
};

interface PhotoCropDialogProps {
  /** The picked file; the dialog is open while this is set. */
  file: File | null;
  /** Called with the cropped file, or the original when "Use as is" is chosen. */
  onDone: (file: File) => void;
  onCancel: () => void;
}

export function PhotoCropDialog({ file, onDone, onCancel }: PhotoCropDialogProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState(ASPECTS[0].value);
  const [area, setArea] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) { setSrc(null); return; }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect(ASPECTS[0].value);
    setError("");
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  const applyCrop = async () => {
    if (!file || !src || !area) return;
    setWorking(true);
    setError("");
    try {
      onDone(await cropToFile(src, area, rotation, file.name));
    } catch {
      setError("Couldn't crop this photo. You can still use it as is.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={!!file} onOpenChange={(open) => { if (!open && !working) onCancel(); }}>
      <DialogContent className="max-w-lg p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Adjust your photo</DialogTitle>
          <DialogDescription>
            Drag to position and pinch or use the slider to zoom. Or keep the photo as it is.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-[55vh] max-h-[420px] min-h-[260px] w-full overflow-hidden rounded-md bg-black">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
            />
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {ASPECTS.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => setAspect(a.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  aspect === a.value ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
                )}
              >
                {a.label}
              </button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto gap-1"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCw className="h-4 w-4" /> Rotate
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Slider min={1} max={3} step={0.05} value={[zoom]} onValueChange={([z]) => setZoom(z)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" disabled={working} onClick={() => file && onDone(file)}>
            Use photo as is
          </Button>
          <Button type="button" disabled={working || !area} onClick={applyCrop} className="gap-2">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
            Crop &amp; use
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
