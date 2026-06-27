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
import AddPlayer from "./pages/AddPlayer";
import Tournaments from "./pages/Tournaments";
import TournamentDetail from "./pages/TournamentDetail";
import TournamentManagement from "./pages/TournamentManagement";
import UserManagement from "./pages/UserManagement";
import BulkUpload from "./pages/BulkUpload";
import Analytics from "./pages/Analytics";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

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
            {/* Landing Page - Standalone (No Navbar) */}
            <Route path="/" element={<Home />} />

            {/* App Routes - With Navbar */}
            <Route element={<AppLayout />}>
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/tournament/:tournamentId" element={<TournamentDetail />} />
              <Route path="/players" element={<Players />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/team/:teamId" element={<TeamDetail />} />
              <Route path="/register" element={<PlayerRegistration />} />
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
