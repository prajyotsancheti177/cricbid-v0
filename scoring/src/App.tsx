import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import AppShell         from "./components/layout/AppShell";
import TournamentPicker from "./pages/TournamentPicker";
import Home             from "./pages/Home";
import PointsTable      from "./pages/PointsTable";
import Stats            from "./pages/Stats";
import MatchCenter      from "./pages/match/MatchCenter";
import ScorerPanel      from "./pages/ScorerPanel";
import Login            from "./pages/Login";
import ScheduleBuilder  from "./pages/ScheduleBuilder";
import "./index.css";

const isAuth = () => localStorage.getItem("scoring_auth") === "true";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return isAuth() ? <>{children}</> : <Navigate to="/login" replace />;
}

/** Preserve old /scorecard/:matchId links */
function LegacyScorecardRedirect() {
  const { matchId } = useParams<{ matchId: string }>();
  return <Navigate to={`/match/${matchId}/scorecard`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TournamentPicker />} />

        {/* Tournament workspace: Matches | Points | Stats */}
        <Route path="/t/:tid" element={<AppShell />}>
          <Route index element={<TournamentTabRedirect />} />
          <Route path="matches" element={<Home />} />
          <Route path="points"  element={<PointsTable />} />
          <Route path="stats"   element={<Stats />} />
        </Route>

        {/* Match center */}
        <Route path="/match/:matchId"      element={<MatchRedirect />} />
        <Route path="/match/:matchId/:tab" element={<MatchCenter />} />
        <Route path="/scorecard/:matchId"  element={<LegacyScorecardRedirect />} />

        {/* Scorer tools (unchanged) */}
        <Route path="/login"            element={<Login />} />
        <Route path="/schedule-builder" element={<ProtectedRoute><ScheduleBuilder /></ProtectedRoute>} />
        <Route path="/score/:matchId"   element={<ProtectedRoute><ScorerPanel /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function TournamentTabRedirect() {
  const { tid } = useParams<{ tid: string }>();
  return <Navigate to={`/t/${tid}/matches`} replace />;
}

function MatchRedirect() {
  const { matchId } = useParams<{ matchId: string }>();
  return <Navigate to={`/match/${matchId}/live`} replace />;
}
