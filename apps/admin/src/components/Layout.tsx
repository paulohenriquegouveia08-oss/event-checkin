import { Link, useLocation } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV_LINKS = [
  { to: "/eventos", label: "Eventos", permission: "events.view" },
  { to: "/modelos-certificado", label: "Modelos de certificado", permission: "certificates.view" },
  { to: "/apk", label: "App do terminal", permission: null },
  { to: "/usuarios", label: "Usuários", permission: "users.view" },
  { to: "/perfis", label: "Perfis", permission: "roles.view" },
  { to: "/auditoria", label: "Auditoria", permission: "audit.view" },
];

export function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();

  return (
    <div>
      <header className="app-header">
        <div className="app-header-main">
          <Link
            to="/eventos"
            style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text)", textDecoration: "none", fontWeight: 700 }}
          >
            LSPK — Credenciamento
          </Link>
          <nav className="app-nav">
            {NAV_LINKS.filter((link) => link.permission === null || hasPermission(link.permission)).map((link) => {
              const active = location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    color: active ? "var(--primary-foreground)" : "var(--text-muted)",
                    background: active ? "var(--primary)" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="row app-header-user">
          {user ? (
            <span className="muted">
              {user.name} · {user.role.name}
            </span>
          ) : null}
          <button className="btn btn-secondary btn-sm" onClick={logout}>
            Sair
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer style={{ textAlign: "center", padding: "16px 24px", borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 12 }}>
        Copol | LSPK Tecnology
      </footer>
    </div>
  );
}
