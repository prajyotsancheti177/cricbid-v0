import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MatchList       from "./pages/MatchList";
import ScorerPanel     from "./pages/ScorerPanel";
import Scorecard       from "./pages/Scorecard";
import Login           from "./pages/Login";
import ScheduleBuilder from "./pages/ScheduleBuilder";
import "./index.css";

const isAuth = () => localStorage.getItem("scoring_auth") === "true";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return isAuth() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                   element={<MatchList />} />
        <Route path="/scorecard/:matchId" element={<Scorecard />} />
        <Route path="/login"              element={<Login />} />
        <Route path="/schedule-builder"   element={<ProtectedRoute><ScheduleBuilder /></ProtectedRoute>} />
        <Route path="/score/:matchId"     element={<ProtectedRoute><ScorerPanel /></ProtectedRoute>} />
        <Route path="*"                   element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
