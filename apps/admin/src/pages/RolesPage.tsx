import { useEffect, useState, type FormEvent } from "react";
import * as api from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function RolesPage() {
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState<api.RoleRecord[] | null>(null);
  const [permissions, setPermissions] = useState<api.PermissionDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  function reload() {
    api
      .listRoles()
      .then(setRoles)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar perfis"));
    api.listPermissions().then(setPermissions).catch(() => {});
  }

  useEffect(reload, []);

  async function handleDelete(role: api.RoleRecord) {
    if (!confirm(`Excluir o perfil "${role.name}"?`)) return;
    setError(null);
    try {
      await api.deleteRole(role.id);
      if (selectedRoleId === role.id) setSelectedRoleId(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir perfil");
    }
  }

  const selectedRole = roles?.find((r) => r.id === selectedRoleId) ?? null;
  const canCreate = hasPermission("roles.create");
  const canDelete = hasPermission("roles.delete");
  const canManagePermissions = hasPermission("roles.manage_permissions");

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Perfis de acesso</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Crie os tipos de usuário do sistema e defina exatamente o que cada um pode fazer.
          </p>
        </div>
        {canCreate ? (
          <button className="btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancelar" : "+ Novo perfil"}
          </button>
        ) : null}
      </div>

      {showForm ? (
        <RoleForm
          onSaved={() => {
            setShowForm(false);
            reload();
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {!roles ? (
        <p className="muted">Carregando...</p>
      ) : (
        <div className="row" style={{ gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="card" style={{ padding: 0, flex: "1 1 320px", minWidth: 320 }}>
            <table>
              <thead>
                <tr>
                  <th>Perfil</th>
                  <th>Usuários</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    style={{ cursor: "pointer", background: selectedRoleId === role.id ? "var(--surface-alt)" : undefined }}
                  >
                    <td>
                      {role.name}
                      {role.isSystem ? <span className="badge badge-success" style={{ marginLeft: 8 }}>Protegido</span> : null}
                      {role.description ? (
                        <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
                          {role.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="muted">{role.userCount}</td>
                    <td>
                      {canDelete && !role.isSystem ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(role);
                          }}
                        >
                          Excluir
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ flex: "1 1 380px", minWidth: 320 }}>
            {selectedRole ? (
              <PermissionEditor
                role={selectedRole}
                permissions={permissions}
                readOnly={!canManagePermissions}
                onSaved={reload}
              />
            ) : (
              <div className="card">
                <p className="muted" style={{ margin: 0 }}>
                  Selecione um perfil na lista pra ver ou editar as permissões.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RoleForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createRole({ name, description: description || undefined });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Novo perfil</h3>
      <div className="field">
        <label htmlFor="role-name">Nome</label>
        <input
          id="role-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Coordenação do Evento"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="role-description">Descrição (opcional)</label>
        <input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Criando..." : "Criar perfil"}
        </button>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: "12px 0 0" }}>
        O perfil é criado sem nenhuma permissão — defina o que ele pode fazer logo em seguida, na lista ao lado.
      </p>
    </form>
  );
}

function PermissionEditor({
  role,
  permissions,
  readOnly,
  onSaved,
}: {
  role: api.RoleRecord;
  permissions: api.PermissionDef[];
  readOnly: boolean;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissionKeys));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setSelected(new Set(role.permissionKeys));
    setNotice(null);
    setError(null);
  }, [role.id]);

  const categories = Array.from(new Set(permissions.map((p) => p.category)));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.updateRolePermissions(role.id, Array.from(selected));
      setNotice("Permissões salvas.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar permissões");
    } finally {
      setSaving(false);
    }
  }

  if (role.isSystem) {
    return (
      <div className="card">
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{role.name}</h3>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Perfil protegido — sempre tem acesso completo a todas as funcionalidades do sistema. Não é possível
          restringir suas permissões.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{role.name}</h3>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
        Marque tudo que este perfil pode fazer no sistema.
      </p>

      <div className="stack" style={{ gap: 16 }}>
        {categories.map((category) => (
          <div key={category}>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>{category}</p>
            <div className="stack" style={{ gap: 6 }}>
              {permissions
                .filter((p) => p.category === category)
                .map((p) => (
                  <label key={p.key} className="row" style={{ gap: 8, cursor: readOnly ? "default" : "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selected.has(p.key)}
                      onChange={() => toggle(p.key)}
                      disabled={readOnly}
                      style={{ width: "auto", flexShrink: 0, padding: 0, background: "none", border: "none" }}
                    />
                    <span style={{ fontSize: 14 }}>{p.description}</span>
                  </label>
                ))}
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {notice ? <p style={{ color: "var(--success)", fontSize: 13 }}>{notice}</p> : null}

      {!readOnly ? (
        <button className="btn" onClick={handleSave} disabled={saving} style={{ marginTop: 16 }}>
          {saving ? "Salvando..." : "Salvar permissões"}
        </button>
      ) : null}
    </div>
  );
}
