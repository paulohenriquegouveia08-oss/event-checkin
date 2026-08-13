import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { EventsPage } from "./pages/EventsPage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { UsersPage } from "./pages/UsersPage";
import { RolesPage } from "./pages/RolesPage";
import { AuditPage } from "./pages/AuditPage";

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
              <Route element={<ProtectedRoute permission="users.view" />}>
                <Route path="/usuarios" element={<UsersPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="roles.view" />}>
                <Route path="/perfis" element={<RolesPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="audit.view" />}>
                <Route path="/auditoria" element={<AuditPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/eventos" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
