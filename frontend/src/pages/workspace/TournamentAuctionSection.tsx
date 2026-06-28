import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Copy, ExternalLink, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "./TournamentWorkspace";

const OVERLAYS = [
  { slug: "camera-hud", label: "Camera HUD" },
  { slug: "fullscreen", label: "Fullscreen" },
  { slug: "split-screen", label: "Split screen" },
];

const TournamentAuctionSection = () => {
  const { tournament } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();

  const copy = (link: string, label: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Copied!", description: `${label} overlay link copied` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auction</h1>
        <p className="text-muted-foreground text-sm mt-1">Run the live auction and stream overlays</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live auction room</CardTitle>
          <CardDescription>Open the auctioneer console to start or resume the auction.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate(`/auction/room/${tournament._id}`)} className="gap-2">
            <Play className="h-4 w-4" /> Go to auction room
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Video className="h-5 w-5" /> Stream overlays</CardTitle>
          <CardDescription>Add these as Browser Sources in OBS for live streaming.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {OVERLAYS.map(({ slug, label }) => {
            const link = `${window.location.origin}/overlay/${tournament._id}/${slug}`;
            return (
              <div key={slug} className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{link}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => copy(link, label)} aria-label={`Copy ${label} link`}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => window.open(link, "_blank")} aria-label={`Open ${label}`}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentAuctionSection;
