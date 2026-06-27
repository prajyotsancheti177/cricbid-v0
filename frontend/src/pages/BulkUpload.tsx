import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Upload, FileSpreadsheet, Users, UserCheck } from "lucide-react";
import { getSelectedTournamentId } from "@/lib/tournamentUtils";
import apiConfig from "@/config/apiConfig";

const BulkUpload = () => {
  const [teamsFile, setTeamsFile] = useState<File | null>(null);
  const [playersFile, setPlayersFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const [isUploading, setIsUploading] = useState(false);

  // Generate sample CSV for teams
  const downloadTeamsSample = () => {
    const csvContent = `Team Name,Team Logo URL,Owner Name,Owner Contact Number
Mumbai Mavericks,https://drive.google.com/file/d/1234567890/view,Rajesh Kumar,9876543210
Delhi Dragons,https://drive.google.com/file/d/0987654321/view,Amit Sharma,9876543211
Bangalore Bulls,https://drive.google.com/file/d/1122334455/view,Priya Patel,9876543212`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "teams_sample.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate sample CSV for players
  const downloadPlayersSample = () => {
    const csvContent = `Serial Number,Player Name,Age,Photo URL,Category,Skill,Phone Number,Team (Sold To),Sold,Amount Sold
1,Virat Kohli,35,https://drive.google.com/file/d/1234567890/view,Icon,Batsman,9876543210,Mumbai Mavericks,Yes,5000
2,MS Dhoni,42,https://drive.google.com/file/d/0987654321/view,Icon,All-Rounder,9876543211,Delhi Dragons,Yes,4500
3,Rohit Sharma,36,https://drive.google.com/file/d/1122334455/view,Icon,Batsman,9876543212,,No,0
1,Jasprit Bumrah,30,https://drive.google.com/file/d/2233445566/view,Regular,Bowler,9876543213,,,
2,KL Rahul,31,https://drive.google.com/file/d/3344556677/view,Regular,Batsman,9876543214,,,
1,Shubman Gill,24,https://drive.google.com/file/d/4455667788/view,Youth,Batsman,9876543215,,,`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "players_sample.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse a single CSV line handling quoted fields (commas inside quotes)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote inside quoted field
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Parse CSV file — handles quoted fields with commas inside them
  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split("\n").filter(line => line.trim());
    const headers = parseCSVLine(lines[0]);
    const data: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return data;
  };

  // Upload teams CSV
  const handleTeamsUpload = async () => {
    if (!teamsFile) {
      setUploadStatus({ type: "error", message: "Please select a teams CSV file" });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: null, message: "" });

    try {
      const text = await teamsFile.text();
      const teamsData = parseCSV(text);
      const tournamentId = getSelectedTournamentId();

      // Get user ID for authentication
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?._id;

      if (!userId) {
        setUploadStatus({ type: "error", message: "You must be logged in to upload teams" });
        setIsUploading(false);
        return;
      }

      // Transform data to match API format
      const teams = teamsData.map((team) => ({
        name: team["Team Name"],
        logo: team["Team Logo URL"],
        owner: {
          name: team["Owner Name"],
          mobile: team["Owner Contact Number"]
        },
        touranmentId: tournamentId,
      }));

      const response = await fetch(`${apiConfig.baseUrl}/api/team/bulk-create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ teams, touranmentId: tournamentId, userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Extract error message from response
        const errorMessage = result.message || result.error || "Failed to upload teams";
        throw new Error(errorMessage);
      }

      setUploadStatus({
        type: "success",
        message: `Successfully uploaded ${teams.length} teams!`,
      });
      setTeamsFile(null);
    } catch (error) {
      console.error("Error uploading teams:", error);
      setUploadStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to upload teams",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Upload players CSV — creates new players and updates existing ones
  const handlePlayersUpload = async () => {
    if (!playersFile) {
      setUploadStatus({ type: "error", message: "Please select a players CSV file" });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: null, message: "" });

    try {
      const text = await playersFile.text();
      const playersData = parseCSV(text);
      const tournamentId = getSelectedTournamentId();

      // Get user ID for authentication
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?._id;

      if (!userId) {
        setUploadStatus({ type: "error", message: "You must be logged in to upload players" });
        setIsUploading(false);
        return;
      }

      // Transform data to match API format — includes all fields
      const players = playersData.map((player) => {
        const soldStr = (player["Sold"] || '').toLowerCase().trim();
        const soldBool = soldStr === 'yes' || soldStr === 'true';
        const amtSoldNum = parseInt(player["Amount Sold"]) || 0;

        return {
          name: player["Player Name"],
          age: parseInt(player["Age"]) || 0,
          photo: player["Photo URL"],
          playerCategory: player["Category"],
          skill: player["Skill"] || '',
          mobile: parseInt(player["Phone Number"]) || 0,
          auctionSerialNumber: player["Serial Number"] ? parseInt(player["Serial Number"]) : undefined,
          teamName: player["Team (Sold To)"] || '',
          sold: soldBool,
          amtSold: amtSoldNum,
          touranmentId: tournamentId,
        };
      });

      const response = await fetch(`${apiConfig.baseUrl}/api/player/bulk-create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({ players, touranmentId: tournamentId, userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Extract error message from response
        const errorMessage = result.message || result.error || "Failed to upload players";
        throw new Error(errorMessage);
      }

      const data = result.data;
      const message = data?.message || `Successfully processed ${players.length} players!`;

      setUploadStatus({
        type: "success",
        message,
      });
      setPlayersFile(null);
    } catch (error) {
      console.error("Error uploading players:", error);
      setUploadStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to upload players",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bulk Upload</h1>
        <p className="text-muted-foreground">
          Download sample CSV files, fill in your data, and upload to quickly add teams and players
        </p>
      </div>

      {uploadStatus.type && (
        <Alert
          className={`mb-6 ${uploadStatus.type === "success"
            ? "border-green-500 bg-green-50 text-green-900"
            : "border-red-500 bg-red-50 text-red-900"
            }`}
        >
          <AlertDescription>{uploadStatus.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Teams Upload Section */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Teams</h2>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Step 1: Download Sample</h3>
              <Button
                onClick={downloadTeamsSample}
                variant="outline"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Teams Sample CSV
              </Button>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Step 2: Upload Filled CSV</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="teams-file">Select Teams CSV File</Label>
                  <Input
                    id="teams-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setTeamsFile(e.target.files?.[0] || null)}
                    className="mt-1"
                  />
                </div>
                {teamsFile && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    {teamsFile.name}
                  </div>
                )}
                <Button
                  onClick={handleTeamsUpload}
                  disabled={!teamsFile || isUploading}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? "Uploading..." : "Upload Teams"}
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-2">CSV Format:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Team Name</li>
                <li>• Team Logo URL (Google Drive link)</li>
                <li>• Owner Name</li>
                <li>• Owner Contact Number</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Players Upload Section */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <UserCheck className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Players</h2>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Step 1: Download Sample</h3>
              <Button
                onClick={downloadPlayersSample}
                variant="outline"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Players Sample CSV
              </Button>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Step 2: Upload Filled CSV</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="players-file">Select Players CSV File</Label>
                  <Input
                    id="players-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setPlayersFile(e.target.files?.[0] || null)}
                    className="mt-1"
                  />
                </div>
                {playersFile && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    {playersFile.name}
                  </div>
                )}
                <Button
                  onClick={handlePlayersUpload}
                  disabled={!playersFile || isUploading}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? "Uploading..." : "Upload Players"}
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-2">CSV Format:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Serial Number (optional)</li>
                <li>• Player Name</li>
                <li>• Age</li>
                <li>• Photo URL (Google Drive link)</li>
                <li>• Category</li>
                <li>• Skill (e.g., Batsman, Bowler, All-Rounder)</li>
                <li>• Phone Number</li>
                <li>• Team (Sold To) — optional, must match an existing team name</li>
                <li>• Sold — optional, Yes/No</li>
                <li>• Amount Sold — optional</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          Important Notes:
        </h3>
        <ul className="text-sm space-y-2 text-blue-900">
          <li>• Make sure your CSV file follows the exact format shown in the sample files</li>
          <li>• Column names must match exactly (case-sensitive)</li>
          <li>• For Google Drive URLs, use the direct file link</li>
          <li>• All numeric fields (Age, Phone Number) should contain only numbers</li>
          <li>• Player categories should match your tournament configuration</li>
          <li>• Upload teams before players for best results</li>
          <li>• <strong>New players</strong> will be created, <strong>existing players</strong> (matched by name) will be updated</li>
          <li>• Team (Sold To), Sold, and Amount Sold columns are optional — leave blank for new unsold players</li>
        </ul>
      </Card>
    </div>
  );
};

export default BulkUpload;
