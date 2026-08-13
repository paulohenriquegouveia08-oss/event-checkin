import { useEffect, useState } from "react";
import * as api from "../api/client";

const ACTION_LABELS: Record<string, string> = {
  "user.create": "Criou usuário",
  "user.update": "Editou usuário",
  "user.activate": "Ativou usuário",
  "user.deactivate": "Desativou usuário",
  "user.delete": "Excluiu usuário",
  "role.create": "Criou perfil",
  "role.update": "Editou perfil",
  "role.delete": "Excluiu perfil",
  "role.update_permissions": "Alterou permissões do perfil",
  "event.create": "Criou evento",
  "event.update": "Editou evento",
  "event.close_registrations": "Encerrou inscrições",
  "event.reopen_registrations": "Reabriu inscrições",
  "participant.create": "Cadastrou participante",
  "participant.update": "Editou participante",
  "participant.delete": "Excluiu participante",
  "participant.rotate_qr_token": "Gerou novo QR Code",
  "participant.import": "Importou participantes",
  "terminal.create": "Criou terminal",
  "terminal.delete": "Excluiu terminal",
};

export function AuditPage() {
  const [logs, setLogs] = useState<api.AuditLogRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listAuditLogs()
      .then(setLogs)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar auditoria"));
  }, []);

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 22, margin: 0 }}>Auditoria</h1>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
          Histórico de ações administrativas sensíveis (usuários, perfis, eventos).
        </p>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {!logs ? (
        <p className="muted">Carregando...</p>
      ) : logs.length === 0 ? (
        <p className="muted">Nenhum registro ainda.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>Ação</th>
                  <th>Entidade</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="muted">{new Date(log.createdAt).toLocaleString("pt-BR")}</td>
                    <td>{log.actorEmail}</td>
                    <td>{ACTION_LABELS[log.action] ?? log.action}</td>
                    <td className="muted">
                      {log.entityType}
                      {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}
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
