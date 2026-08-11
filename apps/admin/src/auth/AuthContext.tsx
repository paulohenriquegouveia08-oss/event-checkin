import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as api from "../api/client";

interface AuthState {
  user: api.AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/** Sessão do admin: token JWT persistido em localStorage. Sem refresh
 * token nesta fase — expirado (JWT_ADMIN_EXPIRES_IN, padrão 8h no
 * backend), o admin cai de volta pro login (interceptado pelo ApiError
 * 401 em api/client.ts, que já limpa o token). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<api.AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Não há endpoint de "quem sou eu" nesta fase do backend — se existe
    // um token salvo, assumimos a sessão válida até a primeira chamada
    // autenticada falhar (então o usuário é redirecionado ao login).
    const stored = localStorage.getItem("admin_user");
    if (stored && api.getToken()) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const { token, user: loggedUser } = await api.login(email, password);
    api.setToken(token);
    localStorage.setItem("admin_user", JSON.stringify(loggedUser));
    setUser(loggedUser);
  }

  function logout() {
    api.clearToken();
    localStorage.removeItem("admin_user");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
