import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings2, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RegistrationConfigDialog } from "@/components/auction/RegistrationConfigDialog";
import { useWorkspace } from "./TournamentWorkspace";

const TournamentRegistrationSection = () => {
  const { tournament } = useWorkspace();
  const { toast } = useToast();
  const [configOpen, setConfigOpen] = useState(false);

  const playerLink = `${window.location.origin}/register/public/${tournament._id}`;
  const teamLink = `${window.location.origin}/team-register/${tournament._id}`;

  const copy = (link: string, label: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const LinkRow = ({ label, link }: { label: string; link: string }) => (
    <div className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{link}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => copy(link, label)} aria-label={`Copy ${label}`}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => window.open(link, "_blank")} aria-label={`Open ${label}`}>
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Registration</h1>
        <p className="text-muted-foreground text-sm mt-1">Public sign-up form and shareable links</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Public form</CardTitle>
          <CardDescription>Choose which fields appear on the public registration form.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setConfigOpen(true)} className="gap-2">
            <Settings2 className="h-4 w-4" /> Customize registration form
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Shareable links</CardTitle>
          <CardDescription>Send these to players and team owners to self-register.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <LinkRow label="Player registration link" link={playerLink} />
          <LinkRow label="Team registration link" link={teamLink} />
        </CardContent>
      </Card>

      <RegistrationConfigDialog
        isOpen={configOpen}
        onClose={() => setConfigOpen(false)}
        tournamentId={tournament._id}
        tournamentName={tournament.name || ""}
      />
    </div>
  );
};

export default TournamentRegistrationSection;
