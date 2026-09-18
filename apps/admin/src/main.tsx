import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Migração e preservação de autenticação via HTTP -> HTTPS
if (typeof window !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  const authMigrationToken = params.get("__auth_token");
  const authMigrationUser = params.get("__auth_user");

  if (authMigrationToken && authMigrationUser) {
    try {
      localStorage.setItem("admin_token", authMigrationToken);
      localStorage.setItem("admin_user", decodeURIComponent(authMigrationUser));
    } catch {
      // Ignora erro de storage se houver
    }
    params.delete("__auth_token");
    params.delete("__auth_user");
    const cleanSearch = params.toString() ? `?${params.toString()}` : "";
    window.history.replaceState({}, "", window.location.pathname + cleanSearch + window.location.hash);
  }

  // Redirecionamento automático de IP HTTP para domínio HTTPS seguro com certificado SSL válido
  if (
    window.location.protocol === "http:" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    const token = localStorage.getItem("admin_token");
    const user = localStorage.getItem("admin_user");
    const targetUrl = new URL(
      "https://137-131-233-254.sslip.io" + window.location.pathname + window.location.search + window.location.hash
    );
    if (token && user) {
      targetUrl.searchParams.set("__auth_token", token);
      targetUrl.searchParams.set("__auth_user", encodeURIComponent(user));
    }
    window.location.replace(targetUrl.toString());
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

