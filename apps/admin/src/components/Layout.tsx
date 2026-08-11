import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();

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
        }}
      >
        <Link
          to="/eventos"
          style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text)", textDecoration: "none", fontWeight: 700 }}
        >
          <img src="/logo-mark.png" alt="" width={28} height={28} style={{ display: "block" }} />
          PK Digital — Credenciamento
        </Link>
        <div className="row">
          {user ? <span className="muted">{user.name}</span> : null}
          <button className="btn btn-secondary btn-sm" onClick={logout}>
            Sair
          </button>
        </div>
      </header>
      <main style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
