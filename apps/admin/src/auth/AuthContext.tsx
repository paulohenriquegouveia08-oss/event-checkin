import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as api from "../api/client";

interface AuthState {
  user: api.AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** ADMINISTRADOR (permissions === "ALL") sempre retorna true, igual o
   * backend trata isSystem — ver requirePermission() em middleware/auth.ts. */
  hasPermission: (key: string) => boolean;
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
    //
    // O formato de AdminUser mudou com o RBAC (role virou objeto, ganhou
    // "permissions") — uma sessão salva ANTES dessa mudança (formato
    // antigo, ainda no localStorage do navegador de quem já estava
    // logado) não bate com o que o resto do app espera, e usar esse
    // objeto quebrado sem checar quebra o render inteiro (tela em
    // branco). Por isso valida o formato antes de confiar; se não bater,
    // limpa a sessão velha e cai pro login normalmente, em vez de travar.
    const stored = localStorage.getItem("admin_user");
    if (stored && api.getToken()) {
      try {
        const parsed = JSON.parse(stored);
        const hasValidShape =
          parsed &&
          typeof parsed.role === "object" &&
          parsed.role !== null &&
          typeof parsed.role.name === "string" &&
          (parsed.permissions === "ALL" || Array.isArray(parsed.permissions));
        if (hasValidShape) {
          setUser(parsed);
        } else {
          api.clearToken();
          localStorage.removeItem("admin_user");
        }
      } catch {
        api.clearToken();
        localStorage.removeItem("admin_user");
      }
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

  function hasPermission(key: string): boolean {
    if (!user) return false;
    if (user.permissions === "ALL") return true;
    return user.permissions.includes(key);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
