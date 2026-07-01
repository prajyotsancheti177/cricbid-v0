import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from "react-router-dom";
import { Navbar } from "./components/layout/Navbar";
import Home from "./pages/Home";
import Auction from "./pages/Auction";
import LiveAuctionLobby from "./pages/LiveAuctionLobby";
import Teams from "./pages/Teams";
import TeamDetail from "./pages/TeamDetail";
import Players from "./pages/Players";
import PlayerRegistration from "./pages/PlayerRegistration";
import PublicPlayerRegistration from "./pages/PublicPlayerRegistration";
import PublicTeamRegistration from "./pages/PublicTeamRegistration";
import AddPlayer from "./pages/AddPlayer";
import Tournaments from "./pages/Tournaments";
import TournamentDetail from "./pages/TournamentDetail";
import TournamentManagement from "./pages/TournamentManagement";
import TournamentWorkspace from "./pages/workspace/TournamentWorkspace";
import TournamentOverview from "./pages/workspace/TournamentOverview";
import TournamentRegistrationSection from "./pages/workspace/TournamentRegistrationSection";
import TournamentAuctionSection from "./pages/workspace/TournamentAuctionSection";
import TournamentSettingsSection from "./pages/workspace/TournamentSettingsSection";
import TournamentWhatsAppSection from "./pages/workspace/TournamentWhatsAppSection";
import TournamentScheduleSection from "./pages/workspace/TournamentScheduleSection";
import TournamentDataSection from "./pages/workspace/TournamentDataSection";
import TournamentBackupsSection from "./pages/workspace/TournamentBackupsSection";
import UserManagement from "./pages/UserManagement";
import BulkUpload from "./pages/BulkUpload";
import Analytics from "./pages/Analytics";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import CameraHudOverlay from "./pages/overlays/CameraHudOverlay";
import FullscreenOverlay from "./pages/overlays/FullscreenOverlay";
import SplitScreenOverlay from "./pages/overlays/SplitScreenOverlay";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import DeleteAccount from "./pages/DeleteAccount";

const queryClient = new QueryClient();

// Redirect component for malformed WhatsApp URLs
const TournamentRedirect = () => {
  const { tournamentId } = useParams();
  return <Navigate to={`/tournament/${tournamentId}`} replace />;
};

// Protected Route Component - for admin features
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Layout with Navbar
const AppLayout = () => (
  <>
    <Navbar />
    <Outlet />
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground">
          <Routes>
            {/* Standalone pages — no navbar */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/delete-account" element={<DeleteAccount />} />
            {/* Landing Page - Standalone (No Navbar) */}
            <Route path="/" element={<Home />} />
            <Route path="/register/:tournamentId" element={<PublicPlayerRegistration />} />
            
            {/* Public Team Registration Page - Standalone */}
            <Route path="/team-register/:tournamentId" element={<PublicTeamRegistration />} />

            {/* Overlay Routes — No Navbar, standalone for OBS Browser Source */}
            <Route path="/overlay/:tournamentId/camera-hud" element={<CameraHudOverlay />} />
            <Route path="/overlay/:tournamentId/fullscreen" element={<FullscreenOverlay />} />
            <Route path="/overlay/:tournamentId/split-screen" element={<SplitScreenOverlay />} />

            {/* App Routes - With Navbar */}
            <Route element={<AppLayout />}>
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/tournament/:tournamentId" element={<TournamentDetail />} />
              <Route path="/players" element={<Players />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/team/:teamId" element={<TeamDetail />} />
              <Route path="/register" element={<PlayerRegistration />} />
              <Route path="/register/public/:tournamentId" element={<PublicPlayerRegistration />} />
              <Route path="/add-player" element={<AddPlayer />} />

              {/* Login Route */}
              <Route path="/login" element={<Login />} />

              {/* Protected Routes - Login required */}
              <Route
                path="/tournaments/manage"
                element={
                  <ProtectedRoute>
                    <TournamentManagement />
                  </ProtectedRoute>
                }
              />
              {/* Tournament Workspace - per-tournament management hub */}
              <Route
                path="/tournament/:tournamentId/manage"
                element={
                  <ProtectedRoute>
                    <TournamentWorkspace />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<TournamentOverview />} />
                <Route path="players" element={<Players />} />
                <Route path="teams" element={<Teams />} />
                <Route path="add-player" element={<AddPlayer />} />
                <Route path="bulk-upload" element={<BulkUpload />} />
                <Route path="registration" element={<TournamentRegistrationSection />} />
                <Route path="whatsapp" element={<TournamentWhatsAppSection />} />
                <Route path="schedule" element={<TournamentScheduleSection />} />
                <Route path="auction" element={<TournamentAuctionSection />} />
                <Route path="data" element={<TournamentDataSection />} />
                <Route path="backups" element={<TournamentBackupsSection />} />
                <Route path="settings" element={<TournamentSettingsSection />} />
              </Route>

              {/* Public Auction Routes */}
              <Route path="/auction" element={<LiveAuctionLobby />} />
              <Route path="/auction/room/:tournamentId" element={<Auction />} />
              <Route
                path="/users"
                element={
                  <ProtectedRoute>
                    <UserManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bulk-upload"
                element={
                  <ProtectedRoute>
                    <BulkUpload />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />

              {/* Redirect for malformed WhatsApp URLs */}
              <Route path="/tournament/:placeholder/:tournamentId" element={<TournamentRedirect />} />

              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
