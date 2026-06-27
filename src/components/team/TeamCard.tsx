import { Team } from "@/types/auction";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { getDriveThumbnail } from "@/lib/imageUtils";
import placeholderImg from "@/assets/player-placeholder.jpg";

interface TeamCardProps {
  team: Team;
}

export const TeamCard = ({ team }: TeamCardProps) => {
  const totalBudget = team.remainingBudget + team.totalSpent;
  const budgetUsedPercentage = (team.totalSpent / totalBudget) * 100;
  const playersBoughtPercentage = (team.players.length / team.maxPlayersPerTeam) * 100;
  const logoSrc = getDriveThumbnail(team.logo as unknown as string);
  const slotsRemaining = team.maxPlayersPerTeam - team.players.length;

  return (
    <Link to={`/team/${team._id}`}>
      <Card className="group relative overflow-hidden border border-border hover:border-primary transition-all duration-300 hover:shadow-glow cursor-pointer bg-card">
        {/* Team Header with Logo */}
        <div className="flex items-center gap-4 p-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
          <img
            src={logoSrc}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = placeholderImg; }}
            alt={`${team.name} logo`}
            className="h-14 w-14 rounded-full shadow-md ring-2 ring-primary/20 transition-transform group-hover:scale-105 object-cover"
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate">
              {team.name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {team.owner?.name || "No owner"}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-4 space-y-4">
          {/* Budget Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <span className="text-sm font-medium">Budget</span>
              </div>
              <span className="text-sm font-bold text-foreground">
                {team.remainingBudget.toLocaleString()} <span className="text-muted-foreground font-normal">/ {totalBudget.toLocaleString()}</span>
              </span>
            </div>
            <Progress value={budgetUsedPercentage} className="h-2" />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Spent: <span className="text-secondary font-medium">{team.totalSpent.toLocaleString()}</span></span>
              <span className="text-accent font-medium">{team.remainingBudget.toLocaleString()} remaining</span>
            </div>
          </div>

          {/* Squad Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Squad</span>
              </div>
              <span className="text-sm font-bold text-foreground">
                {team.players.length} <span className="text-muted-foreground font-normal">/ {team.maxPlayersPerTeam}</span>
              </span>
            </div>
            <Progress value={playersBoughtPercentage} className="h-2" />
            <div className="flex justify-end text-xs">
              <span className="text-accent font-medium">{slotsRemaining} slots available</span>
            </div>
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none" />
      </Card>
    </Link>
  );
};
