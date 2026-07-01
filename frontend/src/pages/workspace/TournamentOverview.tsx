import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Plus, Share2, Users, Shield, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import apiConfig from "@/config/apiConfig";
import { useWorkspace } from "./TournamentWorkspace";

const Stat = ({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </CardContent>
  </Card>
);

const TournamentOverview = () => {
  const { tournament } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<{ teams: number; players: number; sold: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pRes] = await Promise.all([
          fetch(`${apiConfig.baseUrl}/api/player/all`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ touranmentId: tournament._id }),
          }),
        ]);
        const pData = await pRes.json();
        const players: { sold?: boolean }[] = Array.isArray(pData.data) ? pData.data : [];
        setStats({
          teams: tournament.noOfTeams || 0,
          players: players.length,
          sold: players.filter((p) => p.sold).length,
        });
      } catch {
        setStats({ teams: tournament.noOfTeams || 0, players: 0, sold: 0 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tournament._id, tournament.noOfTeams]);

  const copyLink = (path: string, label: string) => {
    navigator.clipboard.writeText(`${window.location.origin}${path}`);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tournament.name || "Untitled tournament"}</h1>
        <p className="text-muted-foreground text-sm mt-1">Tournament overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-7 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Stat label="Budget" value={`₹${(tournament.totalBudget || 0).toLocaleString()}`} icon={DollarSign} />
            <Stat label="Teams" value={String(stats?.teams ?? 0)} icon={Shield} />
            <Stat label="Players" value={String(stats?.players ?? 0)} icon={Users} />
            <Stat label="Sold" value={`${stats?.sold ?? 0} / ${stats?.players ?? 0}`} icon={Users} />
          </>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Quick actions</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate(`/auction/room/${tournament._id}`)} className="gap-2">
            <Play className="h-4 w-4" /> Start auction
          </Button>
          <Button variant="outline" onClick={() => navigate("../add-player")} className="gap-2">
            <Plus className="h-4 w-4" /> Add player
          </Button>
          <Button variant="outline" onClick={() => copyLink(`/register/public/${tournament._id}`, "Player registration link")} className="gap-2">
            <Share2 className="h-4 w-4" /> Player link
          </Button>
          <Button variant="outline" onClick={() => copyLink(`/team-register/${tournament._id}`, "Team registration link")} className="gap-2">
            <Share2 className="h-4 w-4" /> Team link
          </Button>
        </div>
      </div>

    </div>
  );
};

export default TournamentOverview;
