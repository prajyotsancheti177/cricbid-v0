import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileDown, RefreshCw, Upload, Loader2, LockKeyhole, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportTeamsPdf } from "@/lib/exportTeamsPdf";
import { exportAuctionReport } from "@/lib/exportAuctionReport";
import { SyncPreviewDialog } from "@/components/auction/SyncPreviewDialog";
import { useWorkspace, isFeatureOn } from "./TournamentWorkspace";
import apiConfig from "@/config/apiConfig";

const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
};

const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const FeatureDisabled = ({ label, navigate }: { label: string; navigate: ReturnType<typeof useNavigate> }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <LockKeyhole className="h-4 w-4 shrink-0" />
    <span>{label} is disabled for this tournament.</span>
    <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={() => navigate("../settings")}>Enable in Settings</Button>
  </div>
);

const TournamentDataSection = () => {
  const { tournament } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = getUser();

  const [csvBusy, setCsvBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [syncingToSheet, setSyncingToSheet] = useState(false);
  const [syncFromSheetOpen, setSyncFromSheetOpen] = useState(false);

  const handleDownloadCSV = async () => {
    setCsvBusy(true);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/tournament/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user._id },
        body: JSON.stringify({ tournamentId: tournament._id, userId: user._id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed to export data");

      const data = result.data;
      const safe = (tournament.name || "tournament").replace(/[^a-zA-Z0-9]/g, "_");

      const teamsCSV = [
        "Team Name,Team Logo URL,Owner Name,Owner Contact Number",
        ...(data.teams || []).map((t: { name: string; logo: string; ownerName: string; ownerMobile: string }) =>
          `"${t.name || ''}","${t.logo || ''}","${t.ownerName || ''}","${t.ownerMobile || ''}"`
        ),
      ].join("\n");

      const playersCSV = [
        "Serial Number,Player Name,Age,Photo URL,Category,Skill,Phone Number,Team (Sold To),Sold,Amount Sold",
        ...(data.players || []).map((p: { auctionSerialNumber: number | string; name: string; age: string; photo: string; playerCategory: string; skill: string; mobile: string; teamName: string; sold: string; amtSold: number }) =>
          `"${p.auctionSerialNumber || ''}","${p.name || ''}","${p.age || ''}","${p.photo || ''}","${p.playerCategory || ''}","${p.skill || ''}","${p.mobile || ''}","${p.teamName || ''}","${p.sold || ''}","${p.amtSold || 0}"`
        ),
      ].join("\n");

      downloadCSV(teamsCSV, `${safe}_teams.csv`);
      setTimeout(() => {
        downloadCSV(playersCSV, `${safe}_players.csv`);
        toast({ title: "Downloaded", description: `${data.teams?.length || 0} teams and ${data.players?.length || 0} players exported` });
      }, 300);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Export failed", variant: "destructive" });
    } finally {
      setCsvBusy(false);
    }
  };

  const handleExportPdf = async () => {
    setPdfBusy(true);
    try {
      await exportTeamsPdf(tournament.name || "Tournament", tournament._id);
      toast({ title: "Downloaded", description: "PDF exported successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to export PDF", variant: "destructive" });
    } finally {
      setPdfBusy(false);
    }
  };

  const handleExportAuctionReport = async () => {
    setReportBusy(true);
    try {
      await exportAuctionReport(tournament.name || "Tournament", tournament._id);
      toast({ title: "Downloaded", description: "Auction report PDF exported successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to export auction report", variant: "destructive" });
    } finally {
      setReportBusy(false);
    }
  };

  const handleSyncToSheet = async () => {
    setSyncingToSheet(true);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/player/sync-to-sheet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user._id,
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({ touranmentId: tournament._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Sync failed");
      toast({ title: "Sync complete", description: "Database exported to Google Sheet" });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Sync failed", variant: "destructive" });
    } finally {
      setSyncingToSheet(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data &amp; Export</h1>
        <p className="text-muted-foreground text-sm mt-1">Download data and sync with Google Sheets</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CSV export</CardTitle>
          <CardDescription>Download teams and players as CSV files. Columns match the bulk-upload import format.</CardDescription>
        </CardHeader>
        <CardContent>
          {isFeatureOn(tournament, "dataExport") ? (
            <Button onClick={handleDownloadCSV} disabled={csvBusy} className="gap-2">
              {csvBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download CSV
            </Button>
          ) : <FeatureDisabled label="Data export" navigate={navigate} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">PDF export</CardTitle>
          <CardDescription>Export all teams with their player rosters as a printable PDF.</CardDescription>
        </CardHeader>
        <CardContent>
          {isFeatureOn(tournament, "dataExport") ? (
            <Button onClick={handleExportPdf} disabled={pdfBusy} variant="outline" className="gap-2">
              {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Export teams PDF
            </Button>
          ) : <FeatureDisabled label="Data export" navigate={navigate} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Auction report PDF</CardTitle>
          <CardDescription>
            Generate a full auction results report — cover page with summary stats, per-team player lists with amounts paid, and an unsold players page. Ready to share with team owners.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isFeatureOn(tournament, "dataExport") ? (
            <Button onClick={handleExportAuctionReport} disabled={reportBusy} className="gap-2">
              {reportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              Export auction report
            </Button>
          ) : <FeatureDisabled label="Data export" navigate={navigate} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Google Sheets sync</CardTitle>
          <CardDescription>Keep your Google Sheet in sync with the database.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {isFeatureOn(tournament, "googleSheetsSync") ? (
            <>
              <Button onClick={handleSyncToSheet} disabled={syncingToSheet} variant="outline" className="gap-2">
                {syncingToSheet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Sync database → sheet
              </Button>
              <Button onClick={() => setSyncFromSheetOpen(true)} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Sync sheet → database
              </Button>
            </>
          ) : <FeatureDisabled label="Google Sheets sync" navigate={navigate} />}
        </CardContent>
      </Card>

      <SyncPreviewDialog
        isOpen={syncFromSheetOpen}
        onClose={() => setSyncFromSheetOpen(false)}
        tournamentId={tournament._id}
      />
    </div>
  );
};

export default TournamentDataSection;
