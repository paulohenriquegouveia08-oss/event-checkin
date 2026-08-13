import { Link, useLocation } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV_LINKS = [
  { to: "/eventos", label: "Eventos", permission: "events.view" },
  { to: "/usuarios", label: "Usuários", permission: "users.view" },
  { to: "/perfis", label: "Perfis", permission: "roles.view" },
  { to: "/auditoria", label: "Auditoria", permission: "audit.view" },
];

export function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();

  return (
    <div>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div className="row" style={{ gap: 24 }}>
          <Link
            to="/eventos"
            style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text)", textDecoration: "none", fontWeight: 700 }}
          >
            <img src="/logo-mark.png" alt="" width={28} height={28} style={{ display: "block" }} />
            PK Digital — Credenciamento
          </Link>
          <nav className="row" style={{ gap: 4 }}>
            {NAV_LINKS.filter((link) => hasPermission(link.permission)).map((link) => {
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
                    textDecoration: "none",
                    color: active ? "#000" : "var(--text-muted)",
                    background: active ? "var(--primary)" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="row">
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
      <main style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
        <Outlet />
      </main>
      <footer style={{ textAlign: "center", padding: "16px 24px", borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 12 }}>
        Copol | LSPK Tecnology
      </footer>
    </div>
  );
}
