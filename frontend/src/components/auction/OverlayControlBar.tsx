import { useState } from "react";
import { Copy, Check, Monitor, Tv, SplitSquareHorizontal, HelpCircle } from "lucide-react";

interface OverlayControlBarProps {
  tournamentId: string;
}

const OVERLAY_LAYOUTS = [
  {
    id: "camera-hud",
    label: "Camera HUD",
    description: "Lower third overlay — transparent BG for camera feed",
    icon: Monitor,
  },
  {
    id: "fullscreen",
    label: "Fullscreen",
    description: "Full 1920×1080 opaque page — no camera needed",
    icon: Tv,
  },
  {
    id: "split-screen",
    label: "Split Screen",
    description: "Left: camera (transparent) | Right: data panel",
    icon: SplitSquareHorizontal,
  },
];

/**
 * OverlayControlBar — shown to the auctioneer in the Auction page.
 * Displays overlay URLs for each layout that the host can copy and paste
 * into OBS Browser Source.
 */
export const OverlayControlBar = ({ tournamentId }: OverlayControlBarProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const baseUrl = window.location.origin;

  const copyUrl = (layoutId: string) => {
    const url = `${baseUrl}/overlay/${tournamentId}/${layoutId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(layoutId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="w-full">
      {/* Layout Cards */}
      <div className="flex flex-wrap gap-2">
        {OVERLAY_LAYOUTS.map((layout) => {
          const Icon = layout.icon;
          const isCopied = copiedId === layout.id;

          return (
            <button
              key={layout.id}
              onClick={() => copyUrl(layout.id)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs
                ${isCopied
                  ? "border-green-500/50 bg-green-500/10 text-green-400"
                  : "border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground"
                }
              `}
              title={`Copy overlay URL: ${layout.description}`}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-medium whitespace-nowrap">{layout.label}</span>
              {isCopied ? (
                <Check className="h-3 w-3 text-green-400" />
              ) : (
                <Copy className="h-3 w-3 opacity-50" />
              )}
            </button>
          );
        })}

        {/* Help button */}
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-all text-xs"
          title="OBS Setup Help"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span className="font-medium">OBS Guide</span>
        </button>
      </div>

      {/* Inline Help Panel */}
      {showHelp && (
        <div className="mt-3 p-4 rounded-xl bg-card/80 border border-border text-sm space-y-3 animate-fade-in">
          <h4 className="font-bold text-foreground flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            Quick OBS Setup
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>
              Open <strong className="text-foreground">OBS Studio</strong> (v28+)
            </li>
            <li>
              Create a new <strong className="text-foreground">Scene</strong> (e.g., "Auction HUD")
            </li>
            <li>
              Add a <strong className="text-foreground">Browser Source</strong>:
              <ul className="ml-6 mt-1 space-y-1 list-disc">
                <li>Click a layout button above to copy its URL</li>
                <li>Paste the URL into the Browser Source URL field</li>
                <li>Set width to <strong className="text-foreground">1920</strong> and height to <strong className="text-foreground">1080</strong></li>
              </ul>
            </li>
            <li>
              For <strong className="text-foreground">Camera HUD</strong> and <strong className="text-foreground">Split Screen</strong>, add your webcam/camera source <em>below</em> the Browser Source
            </li>
            <li>
              Start streaming to YouTube via <strong className="text-foreground">Settings → Stream</strong>
            </li>
          </ol>
          <p className="text-xs text-muted-foreground/60 pt-1 border-t border-border">
            💡 Tip: The overlay automatically syncs with live auction data — no manual input needed!
          </p>
        </div>
      )}
    </div>
  );
};
