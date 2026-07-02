import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppShell        from "./components/layout/AppShell";
import VenueList       from "./pages/VenueList";
import VenueDetail     from "./pages/VenueDetail";
import BookSlot        from "./pages/BookSlot";
import MyBookings      from "./pages/MyBookings";
import Login           from "./pages/Login";
import AdminDashboard  from "./pages/admin/AdminDashboard";
import VenueForm       from "./pages/admin/VenueForm";
import VenueManage     from "./pages/admin/VenueManage";
import CourtForm       from "./pages/admin/CourtForm";
import "./index.css";

const isAuth = () => localStorage.getItem("cricbook_auth") === "true";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return isAuth() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Public + admin under the shared shell */}
        <Route element={<AppShell />}>
          <Route path="/" element={<VenueList />} />
          <Route path="/venue/:venueId" element={<VenueDetail />} />
          <Route path="/venue/:venueId/book/:courtId" element={<BookSlot />} />
          <Route path="/my-bookings" element={<MyBookings />} />

          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/venue/new" element={<ProtectedRoute><VenueForm /></ProtectedRoute>} />
          <Route path="/admin/venue/:venueId/edit" element={<ProtectedRoute><VenueForm /></ProtectedRoute>} />
          <Route path="/admin/venue/:venueId" element={<ProtectedRoute><VenueManage /></ProtectedRoute>} />
          <Route path="/admin/venue/:venueId/bookings" element={<ProtectedRoute><VenueManage /></ProtectedRoute>} />
          <Route path="/admin/venue/:venueId/court/new" element={<ProtectedRoute><CourtForm /></ProtectedRoute>} />
          <Route path="/admin/venue/:venueId/court/:courtId" element={<ProtectedRoute><CourtForm /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
