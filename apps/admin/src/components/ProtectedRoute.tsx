import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface Props {
  /** Se informado, além de exigir sessão válida, exige essa permissão —
   * sem ela, redireciona pra /eventos em vez de mostrar a tela vazia.
   * A checagem real de verdade é sempre no backend (requirePermission);
   * isso aqui só evita mostrar uma tela que o usuário não tem acesso. */
  permission?: string;
}

export function ProtectedRoute({ permission }: Props) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(permission)) return <Navigate to="/eventos" replace />;

  return <Outlet />;
}
