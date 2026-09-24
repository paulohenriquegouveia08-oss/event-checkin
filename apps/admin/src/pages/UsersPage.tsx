import { useEffect, useState, type FormEvent } from "react";
import * as api from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<api.UserRecord[] | null>(null);
  const [roles, setRoles] = useState<api.RoleRecord[]>([]);
  const [events, setEvents] = useState<api.EventRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<api.UserRecord | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  function reload() {
    api
      .listUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar usuários"));
    api.listRoles().then(setRoles).catch(() => {});
    api.listEvents().then(setEvents).catch(() => {});
  }

  useEffect(reload, []);

  async function handleToggleActive(u: api.UserRecord) {
    setError(null);
    setBusyUserId(u.id);
    try {
      await api.toggleUserActive(u.id, !u.isActive);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar usuário");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleDelete(u: api.UserRecord) {
    if (!confirm(`Excluir o usuário "${u.name}"? Essa ação não pode ser desfeita.`)) return;
    setError(null);
    setBusyUserId(u.id);
    try {
      await api.deleteUser(u.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir usuário");
    } finally {
      setBusyUserId(null);
    }
  }

  const canCreate = hasPermission("users.create");
  const canEdit = hasPermission("users.edit");
  const canToggle = hasPermission("users.toggle_active");
  const canDelete = hasPermission("users.delete");

  return (
    <div className="stack">
      <div className="spread">
        <h1 style={{ fontSize: 22, margin: 0 }}>Usuários</h1>
        {canCreate ? (
          <button
            className="btn"
            onClick={() => {
              setEditing(null);
              setShowForm((v) => !v);
            }}
          >
            {showForm ? "Cancelar" : "+ Novo usuário"}
          </button>
        ) : null}
      </div>

      {showForm ? (
        <UserForm
          roles={roles}
          events={events}
          onSaved={() => {
            setShowForm(false);
            reload();
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      {editing ? (
        <UserForm
          roles={roles}
          events={events}
          user={editing}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {!users ? (
        <p className="muted">Carregando...</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Eventos</th>
                  <th>Status</th>
                  <th>Último login</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.name}
                      {u.id === currentUser?.id ? <span className="muted"> (você)</span> : null}
                    </td>
                    <td className="muted">{u.email}</td>
                    <td>{u.role.name}</td>
                    <td className="muted">
                      {u.allowedEventIds.length === 0
                        ? "Todos"
                        : u.allowedEventIds
                            .map((id) => events.find((ev) => ev.id === id)?.name ?? "Evento removido")
                            .join(", ")}
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? "badge-success" : "badge-muted"}`}>
                        {u.isActive ? "Ativo" : "Desativado"}
                      </span>
                    </td>
                    <td className="muted">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-BR") : "Nunca"}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        {canEdit ? (
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(u)}>
                            Editar
                          </button>
                        ) : null}
                        {canToggle ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleToggleActive(u)}
                            disabled={busyUserId === u.id || u.id === currentUser?.id}
                            title={u.id === currentUser?.id ? "Você não pode desativar sua própria conta" : undefined}
                          >
                            {u.isActive ? "Desativar" : "Ativar"}
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDelete(u)}
                            disabled={busyUserId === u.id || u.id === currentUser?.id}
                            title={u.id === currentUser?.id ? "Você não pode excluir sua própria conta" : undefined}
                          >
                            Excluir
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function UserForm({
  roles,
  events,
  user,
  onSaved,
  onCancel,
}: {
  roles: api.RoleRecord[];
  events: api.EventRecord[];
  user?: api.UserRecord;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(user?.role.id ?? roles[0]?.id ?? "");
  // Vazio = todos os eventos (ver User.allowedEventIds no backend).
  const [allowedEventIds, setAllowedEventIds] = useState<string[]>(user?.allowedEventIds ?? []);
  const [restrito, setRestrito] = useState((user?.allowedEventIds.length ?? 0) > 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (restrito && allowedEventIds.length === 0) {
      setError("Escolha ao menos um evento, ou desmarque a restrição.");
      return;
    }
    setSaving(true);
    const eventos = restrito ? allowedEventIds : [];
    try {
      if (user) {
        await api.updateUser(user.id, {
          name,
          email,
          roleId: roleId || undefined,
          password: password || undefined,
          allowedEventIds: eventos,
        });
      } else {
        if (!roleId) {
          setError("Selecione um perfil.");
          setSaving(false);
          return;
        }
        await api.createUser({ name, email, password, roleId, allowedEventIds: eventos });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar usuário");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>{user ? `Editar ${user.name}` : "Novo usuário"}</h3>
      <div className="field">
        <label htmlFor="user-name">Nome</label>
        <input id="user-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="user-email">E-mail</label>
        <input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="user-password">{user ? "Nova senha (deixe em branco pra manter)" : "Senha"}</label>
        <input
          id="user-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required={!user}
          placeholder={user ? "••••••••" : undefined}
        />
      </div>
      <div className="field">
        <label htmlFor="user-role">Tipo de usuário</label>
        <select id="user-role" value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
          <option value="" disabled>
            Selecione...
          </option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {roles.length === 0 ? (
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Nenhum perfil cadastrado ainda — crie um em "Perfis" antes de criar usuários.
          </p>
        ) : null}
      </div>
      <div className="field">
        <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={restrito}
            onChange={(e) => setRestrito(e.target.checked)}
          />
          Restringir a eventos específicos
        </label>
        <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
          O perfil decide o que a pessoa faz; aqui você decide em quais eventos. Sem restrição, vê todos.
        </p>
        {restrito ? (
          <div className="stack" style={{ gap: 6, marginTop: 8, maxHeight: 220, overflowY: "auto" }}>
            {events.map((ev) => (
              <label key={ev.id} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", margin: 0 }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={allowedEventIds.includes(ev.id)}
                  onChange={(e) =>
                    setAllowedEventIds((ids) =>
                      e.target.checked ? [...ids, ev.id] : ids.filter((id) => id !== ev.id)
                    )
                  }
                />
                <span style={{ color: "var(--text)" }}>{ev.name}</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {new Date(ev.startDate).toLocaleDateString("pt-BR")}
                </span>
              </label>
            ))}
          </div>
        ) : null}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
