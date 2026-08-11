import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { EventsPage } from "./pages/EventsPage";
import { EventDetailPage } from "./pages/EventDetailPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/eventos" element={<EventsPage />} />
              <Route path="/eventos/:eventId" element={<EventDetailPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/eventos" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
