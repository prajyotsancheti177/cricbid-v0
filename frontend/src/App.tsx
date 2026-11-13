import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams, useLocation } from "react-router-dom";
import RouteMeta from "@/components/seo/RouteMeta";
import NormalizePath from "@/components/NormalizePath";
import { AnimatePresence, motion } from "framer-motion";
import { Navbar } from "./components/layout/Navbar";
import AnalyticsTracker from "./components/AnalyticsTracker";

/**
 * Eager: the pages scripts/prerender.mjs writes real markup for.
 *
 * main.tsx mounts with createRoot, not hydrateRoot, so React discards the
 * container's contents on its first commit. A lazy route commits `null` first
 * and only paints once its chunk has arrived, which would wipe the
 * pre-rendered markup and leave these pages blank for a network round trip —
 * the opposite of what pre-rendering them was for. They stay in the entry
 * chunk so the takeover is instant.
 */
import DemoPage from "./pages/demo/DemoPage";
import GuidesPage from "./pages/guides/GuidesPage";
import GuideClipPage from "./pages/guides/GuideClipPage";
import Home from "./pages/Home";

/**
 * Everything else is split out and fetched when its route is first opened.
 *
 * The entry bundle used to carry all 47 screens — the auction room, the OBS
 * overlays, the whole management workspace, and Leaflet, recharts, jspdf and
 * html2canvas behind them — so a visitor to the landing page downloaded the
 * admin analytics map before it could paint.
 *
 * None of these routes is pre-rendered, so there is no server markup for a
 * Suspense fallback to destroy.
 */
const GuideVideosPage = lazy(() => import("./pages/guides/GuideVideosPage"));
const Auction = lazy(() => import("./pages/Auction"));
const LiveAuctionLobby = lazy(() => import("./pages/LiveAuctionLobby"));
const Teams = lazy(() => import("./pages/Teams"));
const TeamDetail = lazy(() => import("./pages/TeamDetail"));
const Players = lazy(() => import("./pages/Players"));
const PlayerRegistration = lazy(() => import("./pages/PlayerRegistration"));
const PublicPlayerRegistration = lazy(() => import("./pages/PublicPlayerRegistration"));
const PublicTeamRegistration = lazy(() => import("./pages/PublicTeamRegistration"));
const AddPlayer = lazy(() => import("./pages/AddPlayer"));
const Tournaments = lazy(() => import("./pages/Tournaments"));
const TournamentDetail = lazy(() => import("./pages/TournamentDetail"));
const TournamentManagement = lazy(() => import("./pages/TournamentManagement"));
const TournamentWorkspace = lazy(() => import("./pages/workspace/TournamentWorkspace"));
const TournamentOverview = lazy(() => import("./pages/workspace/TournamentOverview"));
const TournamentRegistrationSection = lazy(() => import("./pages/workspace/TournamentRegistrationSection"));
const TournamentAuctionSection = lazy(() => import("./pages/workspace/TournamentAuctionSection"));
const TournamentSettingsSection = lazy(() => import("./pages/workspace/TournamentSettingsSection"));
const TournamentWhatsAppSection = lazy(() => import("./pages/workspace/TournamentWhatsAppSection"));
const TournamentCricHeroesSection = lazy(() => import("./pages/workspace/TournamentCricHeroesSection"));
const TournamentScheduleSection = lazy(() => import("./pages/workspace/TournamentScheduleSection"));
const TournamentDataSection = lazy(() => import("./pages/workspace/TournamentDataSection"));
const TournamentPlayerSheetSection = lazy(() => import("./pages/workspace/TournamentPlayerSheetSection"));
const TournamentBackupsSection = lazy(() => import("./pages/workspace/TournamentBackupsSection"));
const TournamentTopUpSection = lazy(() => import("./pages/workspace/TournamentTopUpSection"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const BulkUpload = lazy(() => import("./pages/BulkUpload"));
const Analytics = lazy(() => import("./pages/analytics/AnalyticsPage"));
const AssistantRequests = lazy(() => import("./pages/AssistantRequests"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CameraHudOverlay = lazy(() => import("./pages/overlays/CameraHudOverlay"));
const FullscreenOverlay = lazy(() => import("./pages/overlays/FullscreenOverlay"));
const SplitScreenOverlay = lazy(() => import("./pages/overlays/SplitScreenOverlay"));
const CountdownOverlay = lazy(() => import("./pages/overlays/CountdownOverlay"));
const BroadcastOverlay = lazy(() => import("./pages/overlays/BroadcastOverlay"));
const OwnerPlanner = lazy(() => import("./pages/OwnerPlanner"));
const PlannerLinks = lazy(() => import("./pages/PlannerLinks"));
const PlayerCard = lazy(() => import("./pages/PlayerCard"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/Terms"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const SiteSettingsPage = lazy(() => import("./pages/SiteSettings"));

import { SiteSettingsProvider } from "@/lib/siteSettings";
import { clearSession, getSessionToken, installSessionExpiryHandler, useCurrentUser } from "@/lib/auth";

const queryClient = new QueryClient();

// Redirect component for malformed WhatsApp URLs
const TournamentRedirect = () => {
  const { tournamentId } = useParams();
  return <Navigate to={`/tournament/${tournamentId}`} replace />;
};

// Protected Route Component - for admin features
// Installed before anything renders, so the very first failed request signs out.
installSessionExpiryHandler();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";

  // A session from before tokens existed looks signed in but cannot prove it:
  // the flag is set, there is no token, and every API call comes back 401. That
  // reads as "the app is broken" rather than "please sign in again", so treat
  // it as signed out and clear it.
  if (isAuthenticated && !getSessionToken()) {
    clearSession();
    return <Navigate to="/login" replace />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

/**
 * For screens that manage a tournament.
 *
 * Being signed in is not enough now that anyone can sign in with Google and
 * land as a `player`. A player reaching the management workspace saw a real UI
 * they had no business seeing.
 *
 * The server enforces this too — this only keeps the wrong screen off theirs.
 */
const MANAGING_ROLES = ["boss", "super_user", "tournament_host"];
const ADMIN_ROLES = ["boss", "super_user"];

/**
 * A route only certain roles may open.
 *
 * Being signed in is not a permission. Everyone who signs in with Google is a
 * `player`, so every admin screen needs to say which roles it is for — a player
 * reaching tournament management, bulk upload or site analytics saw a real UI
 * that was never theirs.
 *
 * The server enforces the same rules; this only keeps the wrong screen off
 * their device.
 */
const RoleRoute = ({ allow, children }: { allow: string[]; children: React.ReactNode }) => {
  const { user, ready } = useCurrentUser();

  // Wait for the server's answer before turning anyone away. The stored role is
  // a snapshot from sign-in, so somebody promoted since then would otherwise be
  // bounced off a screen they now have every right to open.
  if (!ready) return null;

  if (!allow.includes(String(user?.role || ""))) {
    return <Navigate to="/tournaments" replace />;
  }
  return <>{children}</>;
};

const ManageRoute = ({ children }: { children: React.ReactNode }) => (
  <RoleRoute allow={MANAGING_ROLES}>{children}</RoleRoute>
);

// Page transition wrapper — fades + slides each route in
const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.25, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);

// Layout with Navbar
const AppLayout = () => {
  const location = useLocation();
  return (
    <>
      <Navbar />
      <AnimatePresence mode="wait">
        <PageTransition key={location.pathname}>
          <Outlet />
        </PageTransition>
      </AnimatePresence>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SiteSettingsProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RouteMeta />
        <NormalizePath />
        <AnalyticsTracker />
        <div className="min-h-screen bg-background text-foreground">
          {/* fallback={null} rather than a spinner: an OBS overlay is a
              transparent browser source over a live camera feed, and a
              centred spinner would be composited into the broadcast. */}
          <Suspense fallback={null}>
          <Routes>
            {/* Standalone pages — no navbar */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/delete-account" element={<DeleteAccount />} />
            {/* Landing Page - Standalone (No Navbar) */}
            <Route path="/" element={<Home />} />
            {/* Product demo — marketing page, standalone like the landing page */}
            <Route path="/demo" element={<DemoPage />} />
            {/* How-to clip library */}
            <Route path="/guides" element={<GuidesPage />} />
            {/* Unlisted: not linked anywhere, noindex — preview of the exported videos */}
            <Route path="/guide-videos" element={<GuideVideosPage />} />
            <Route path="/guides/:slug" element={<GuideClipPage />} />
            <Route path="/register/:tournamentId" element={<PublicPlayerRegistration />} />
            
            {/* Public Team Registration Page - Standalone */}
            <Route path="/team-register/:tournamentId" element={<PublicTeamRegistration />} />

            {/* Overlay Routes — No Navbar, standalone for OBS Browser Source */}
            <Route path="/overlay/:tournamentId/camera-hud" element={<CameraHudOverlay />} />
            <Route path="/overlay/:tournamentId/fullscreen" element={<FullscreenOverlay />} />
            <Route path="/overlay/:tournamentId/split-screen" element={<SplitScreenOverlay />} />
            {/* Pre-show holding card: "Auction is starting in MM:SS" */}
            <Route path="/overlay/:tournamentId/countdown" element={<CountdownOverlay />} />
            {/* Television-style bottom strip, for a full-bleed camera feed */}
            <Route path="/overlay/:tournamentId/broadcast" element={<BroadcastOverlay />} />

            {/* Shareable player card — public by design, opened from the sold
                WhatsApp message. /c/ is the short form printed on the image;
                the /tournament/... form is what the approved WhatsApp button
                produces, since its base URL is fixed on the Meta dashboard. */}
            <Route path="/c/:code" element={<PlayerCard />} />
            <Route path="/card/:code" element={<PlayerCard />} />
            <Route path="/tournament/:tournamentId/card/:code" element={<PlayerCard />} />

            {/* Owner auction planner — standalone, token in the URL, no navbar.
                Read-only on the auction; it can never emit an auction event. */}
            <Route path="/plan/:token" element={<OwnerPlanner />} />

            {/* App Routes - With Navbar */}
            <Route element={<AppLayout />}>
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/tournament/:tournamentId" element={<TournamentDetail />} />
              <Route path="/players" element={<Players />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/team/:teamId" element={<TeamDetail />} />
              {/* Host-side planner links; not linked from the workspace yet. */}
              <Route path="/tournament/:tournamentId/planner-links" element={<PlannerLinks />} />
              <Route path="/register" element={<PlayerRegistration />} />
              <Route path="/register/public/:tournamentId" element={<PublicPlayerRegistration />} />
              <Route
                path="/add-player"
                element={
                  <ProtectedRoute>
                    <ManageRoute>
                      <AddPlayer />
                    </ManageRoute>
                  </ProtectedRoute>
                }
              />

              {/* Login Route */}
              <Route path="/login" element={<Login />} />

              {/* Protected Routes - Login required */}
              <Route
                path="/tournaments/manage"
                element={
                  <ProtectedRoute>
                    <ManageRoute>
                      <TournamentManagement />
                    </ManageRoute>
                  </ProtectedRoute>
                }
              />
              {/* Tournament Workspace - per-tournament management hub */}
              <Route
                path="/tournament/:tournamentId/manage"
                element={
                  <ProtectedRoute>
                    <ManageRoute>
                      <TournamentWorkspace />
                    </ManageRoute>
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<TournamentOverview />} />
                <Route path="players" element={<Players />} />
                <Route path="sheet" element={<TournamentPlayerSheetSection />} />
                <Route path="teams" element={<Teams />} />
                <Route path="add-player" element={<AddPlayer />} />
                <Route path="bulk-upload" element={<BulkUpload />} />
                <Route path="registration" element={<TournamentRegistrationSection />} />
                <Route path="cricheroes" element={<TournamentCricHeroesSection />} />
                <Route path="whatsapp" element={<TournamentWhatsAppSection />} />
                <Route path="schedule" element={<TournamentScheduleSection />} />
                <Route path="auction" element={<TournamentAuctionSection />} />
                <Route path="top-up" element={<TournamentTopUpSection />} />
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
                    <RoleRoute allow={ADMIN_ROLES}>
                      <UserManagement />
                    </RoleRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bulk-upload"
                element={
                  <ProtectedRoute>
                    <ManageRoute>
                      <BulkUpload />
                    </ManageRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <RoleRoute allow={ADMIN_ROLES}>
                      <Analytics />
                    </RoleRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assistant"
                element={
                  <ProtectedRoute>
                    <RoleRoute allow={ADMIN_ROLES}>
                      <AssistantRequests />
                    </RoleRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/site-settings"
                element={
                  <ProtectedRoute>
                    <RoleRoute allow={ADMIN_ROLES}>
                      <SiteSettingsPage />
                    </RoleRoute>
                  </ProtectedRoute>
                }
              />

              {/* Redirect for malformed WhatsApp URLs */}
              <Route path="/tournament/:placeholder/:tournamentId" element={<TournamentRedirect />} />

              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          </Suspense>
        </div>
      </BrowserRouter>
    </TooltipProvider>
    </SiteSettingsProvider>
  </QueryClientProvider>
);

export default App;
