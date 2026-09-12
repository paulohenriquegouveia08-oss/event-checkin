import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import * as api from "../../api/client";
import { CheckIcon, TrashIcon } from "../../components/Icons";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";

function BanIcon({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

export function InscriptionsReportTab({ eventId }: { eventId: string }) {
  const [inscriptions, setInscriptions] = useState<api.InscriptionReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CONFIRMED" | "PENDING" | "CANCELLED">("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<api.InscriptionReportItem | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  useEffect(() => {
    loadInscriptions();
  }, [eventId]);

  async function loadInscriptions() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getInscriptionsReport(eventId);
      setInscriptions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar relatório de inscritos");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(item: api.InscriptionReportItem) {
    setActionLoading(item.id);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.confirmInscription(eventId, item.id);
      setSuccessMessage(`Inscrição de ${item.name} confirmada com sucesso. Ingresso e credencial gerados.`);
      await loadInscriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao confirmar inscrição");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(item: api.InscriptionReportItem) {
    setActionLoading(item.id);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.cancelInscription(eventId, item.id);
      setSuccessMessage(`Inscrição de ${item.name} cancelada com sucesso.`);
      await loadInscriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar inscrição");
    } finally {
      setActionLoading(null);
    }
  }

  // Filtros
  const filtered = inscriptions.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (!search.trim()) return true;

    const term = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(term) ||
      item.email.toLowerCase().includes(term) ||
      item.document.includes(term) ||
      (item.phone && item.phone.includes(term))
    );
  });

  // Métricas
  const totalCount = inscriptions.length;
  const confirmedCount = inscriptions.filter((i) => i.status === "CONFIRMED").length;
  const pendingCount = inscriptions.filter((i) => i.status === "PENDING").length;
  const cancelledCount = inscriptions.filter((i) => i.status === "CANCELLED").length;
  const totalRevenue = inscriptions
    .filter((i) => i.status === "CONFIRMED")
    .reduce((acc, curr) => acc + curr.amount, 0);

  function handleExportCsv() {
    const headers = ["Nome", "E-mail", "Telefone", "CPF", "Lote", "Valor", "Status", "Data de Inscrição"];
    const rows = filtered.map((i) => [
      `"${i.name.replace(/"/g, '""')}"`,
      `"${i.email}"`,
      `"${i.phone ?? ""}"`,
      `"${i.document}"`,
      `"${i.category}"`,
      `"R$ ${i.amount.toFixed(2).replace(".", ",")}"`,
      `"${i.status === "CONFIRMED" ? "Confirmado (Pago)" : i.status === "CANCELLED" ? "Cancelado" : "Aguardando Pagamento"}"`,
      `"${new Date(i.createdAt).toLocaleString("pt-BR")}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-inscritos-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleExportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 12;
    let y = 16;

    // Cabeçalho
    doc.setFillColor(14, 54, 52);
    doc.rect(0, 0, pageW, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO OFICIAL DE INSCRITOS — COPOL", pageW / 2, 12, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")} | Total de registros: ${filtered.length}`, pageW / 2, 19, { align: "center" });

    y = 32;

    // Resumo no topo
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Inscritos: ${totalCount} | Confirmados (Pagos): ${confirmedCount} | Pendentes: ${pendingCount} | Receita Confirmada: R$ ${totalRevenue.toFixed(2).replace(".", ",")}`, margin, y);
    y += 8;

    // Tabela Header
    doc.setFillColor(240, 245, 245);
    doc.rect(margin, y, pageW - margin * 2, 7, "F");
    doc.setFontSize(8);
    doc.setTextColor(14, 54, 52);
    doc.setFont("helvetica", "bold");

    const cols = [margin, margin + 65, margin + 125, margin + 155, margin + 185, margin + 225, margin + 245];
    doc.text("Nome Completo", cols[0] + 2, y + 4.8);
    doc.text("E-mail", cols[1] + 2, y + 4.8);
    doc.text("Telefone", cols[2] + 2, y + 4.8);
    doc.text("CPF", cols[3] + 2, y + 4.8);
    doc.text("Lote", cols[4] + 2, y + 4.8);
    doc.text("Valor", cols[5] + 2, y + 4.8);
    doc.text("Status", cols[6] + 2, y + 4.8);
    y += 8;

    // Linhas
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);

    for (const item of filtered) {
      if (y > 190) {
        doc.addPage();
        y = 16;
      }

      doc.text(truncate(item.name, 38), cols[0] + 2, y + 4);
      doc.text(truncate(item.email, 34), cols[1] + 2, y + 4);
      doc.text(item.phone ?? "—", cols[2] + 2, y + 4);
      doc.text(item.document, cols[3] + 2, y + 4);
      doc.text(truncate(item.category, 24), cols[4] + 2, y + 4);
      doc.text(`R$ ${item.amount.toFixed(2)}`, cols[5] + 2, y + 4);
      doc.text(
        item.status === "CONFIRMED" ? "Confirmado" : item.status === "CANCELLED" ? "Cancelado" : "Pendente",
        cols[6] + 2,
        y + 4
      );

      y += 6;
    }

    doc.save(`relatorio-inscritos-${new Date().toISOString().split("T")[0]}.pdf`);
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Resumo */}
      <div className="spread" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Relatório de Inscritos</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Lista completa de participantes com status de pagamento e dados de contato.
          </p>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCsv} disabled={filtered.length === 0}>
            Exportar CSV
          </button>
          <button className="btn btn-sm" onClick={handleExportPdf} disabled={filtered.length === 0}>
            Baixar PDF
          </button>
        </div>
      </div>

      {/* Mensagens de Sucesso e Erro */}
      {successMessage && (
        <div
          style={{
            background: "rgba(34, 197, 94, 0.15)",
            border: "1px solid var(--success)",
            borderRadius: "var(--radius)",
            padding: "10px 14px",
            color: "#4ade80",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#4ade80",
              cursor: "pointer",
              fontSize: 16,
              padding: "0 4px",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius)",
            padding: "10px 14px",
            color: "#f87171",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#f87171",
              cursor: "pointer",
              fontSize: 16,
              padding: "0 4px",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Cards de Métricas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <MetricCard label="Total de Inscritos" value={totalCount} />
        <MetricCard label="Pagamentos Confirmados" value={confirmedCount} highlight="success" />
        <MetricCard label="Aguardando Pagamento" value={pendingCount} highlight="warning" />
        <MetricCard label="Inscrições Canceladas" value={cancelledCount} highlight="danger" />
        <MetricCard
          label="Receita Confirmada"
          value={`R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          highlight="primary"
        />
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="spread" style={{ gap: 12, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Buscar por nome, e-mail ou CPF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 360, flex: 1 }}
        />

        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <FilterButton active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")}>
            Todos ({totalCount})
          </FilterButton>
          <FilterButton active={statusFilter === "CONFIRMED"} onClick={() => setStatusFilter("CONFIRMED")}>
            Confirmados ({confirmedCount})
          </FilterButton>
          <FilterButton active={statusFilter === "PENDING"} onClick={() => setStatusFilter("PENDING")}>
            Pendentes ({pendingCount})
          </FilterButton>
          <FilterButton active={statusFilter === "CANCELLED"} onClick={() => setStatusFilter("CANCELLED")}>
            Cancelados ({cancelledCount})
          </FilterButton>

          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />

          <button
            type="button"
            className={`btn btn-sm ${viewMode === "table" ? "" : "btn-secondary"}`}
            onClick={() => setViewMode("table")}
            style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600 }}
            title="Visualizar em Tabela Compacta sem rolagem lateral"
          >
            Tabela
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === "cards" ? "" : "btn-secondary"}`}
            onClick={() => setViewMode("cards")}
            style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600 }}
            title="Visualizar em Fichas / Cards"
          >
            Fichas
          </button>
        </div>
      </div>

      {/* Listagem de Inscritos */}
      {loading ? (
        <p className="muted">Carregando inscritos...</p>
      ) : error && filtered.length === 0 ? (
        <p className="error-text">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p className="muted" style={{ margin: 0 }}>Nenhuma inscrição encontrada para os filtros selecionados.</p>
        </div>
      ) : viewMode === "table" ? (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", fontSize: 13, tableLayout: "auto" }}>
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Participante / Contato</th>
                <th style={{ width: 140, whiteSpace: "nowrap" }}>Lote & Valor</th>
                <th style={{ width: 110, whiteSpace: "nowrap" }}>Status & Data</th>
                <th style={{ textAlign: "right", width: 200, whiteSpace: "nowrap" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{item.name}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        marginTop: 4,
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "4px 10px",
                      }}
                    >
                      <span title="E-mail">✉️ {item.email}</span>
                      {item.phone && <span title="Telefone">📞 {item.phone}</span>}
                      {item.document && (
                        <span title="CPF" style={{ fontFamily: "monospace" }}>
                          🪪 {item.document}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 500 }}>{item.category}</div>
                    <div style={{ fontWeight: 700, color: "var(--primary)", marginTop: 2, fontSize: 13 }}>
                      R$ {item.amount.toFixed(2).replace(".", ",")}
                    </div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div>
                      {item.status === "CONFIRMED" ? (
                        <span className="badge badge-success">Confirmado</span>
                      ) : item.status === "CANCELLED" ? (
                        <span className="badge badge-danger">Cancelado</span>
                      ) : (
                        <span className="badge badge-warning">Pendente</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                    </div>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                      {(item.status === "PENDING" || item.status === "CANCELLED") && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          title="Confirmar Inscrição"
                          disabled={actionLoading === item.id}
                          onClick={() => handleConfirm(item)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "5px 9px",
                            fontSize: 12,
                          }}
                        >
                          <CheckIcon size={13} />
                          {actionLoading === item.id ? "..." : "Confirmar"}
                        </button>
                      )}

                      {item.status === "PENDING" && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          title="Cancelar Inscrição"
                          disabled={actionLoading === item.id}
                          onClick={() => handleCancel(item)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "5px 9px",
                            fontSize: 12,
                          }}
                        >
                          <BanIcon size={13} />
                          {actionLoading === item.id ? "..." : "Cancelar"}
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        title="Excluir Permanentemente"
                        disabled={actionLoading === item.id}
                        onClick={() => setDeleteTarget(item)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "5px 9px",
                          fontSize: 12,
                        }}
                      >
                        <TrashIcon size={13} />
                        {actionLoading === item.id ? "..." : "Excluir"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {filtered.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div className="spread" style={{ alignItems: "flex-start", gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{item.name}</h4>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{item.email}</div>
                </div>
                {item.status === "CONFIRMED" ? (
                  <span className="badge badge-success">Confirmado</span>
                ) : item.status === "CANCELLED" ? (
                  <span className="badge badge-danger">Cancelado</span>
                ) : (
                  <span className="badge badge-warning">Pendente</span>
                )}
              </div>

              <div
                style={{
                  fontSize: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  background: "var(--bg)",
                  padding: "10px 12px",
                  borderRadius: "var(--radius)",
                }}
              >
                <div className="spread">
                  <span className="muted">Lote / Categoria:</span>
                  <span style={{ fontWeight: 500 }}>{item.category}</span>
                </div>
                <div className="spread">
                  <span className="muted">Valor:</span>
                  <strong style={{ color: "var(--primary)", fontSize: 13 }}>
                    R$ {item.amount.toFixed(2).replace(".", ",")}
                  </strong>
                </div>
                {item.phone && (
                  <div className="spread">
                    <span className="muted">Telefone:</span>
                    <span>{item.phone}</span>
                  </div>
                )}
                {item.document && (
                  <div className="spread">
                    <span className="muted">CPF:</span>
                    <span style={{ fontFamily: "monospace" }}>{item.document}</span>
                  </div>
                )}
                <div className="spread">
                  <span className="muted">Data da Inscrição:</span>
                  <span>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>

              <div
                className="row"
                style={{
                  gap: 8,
                  marginTop: "auto",
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                  justifyContent: "flex-end",
                }}
              >
                {(item.status === "PENDING" || item.status === "CANCELLED") && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={actionLoading === item.id}
                    onClick={() => handleConfirm(item)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      flex: 1,
                      justifyContent: "center",
                      padding: "6px 10px",
                      fontSize: 12,
                    }}
                  >
                    <CheckIcon size={14} />
                    {actionLoading === item.id ? "..." : "Confirmar"}
                  </button>
                )}
                {item.status === "PENDING" && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={actionLoading === item.id}
                    onClick={() => handleCancel(item)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      flex: 1,
                      justifyContent: "center",
                      padding: "6px 10px",
                      fontSize: 12,
                    }}
                  >
                    <BanIcon size={14} />
                    {actionLoading === item.id ? "..." : "Cancelar"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={actionLoading === item.id}
                  onClick={() => setDeleteTarget(item)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    flex: 1,
                    justifyContent: "center",
                    padding: "6px 10px",
                    fontSize: 12,
                  }}
                >
                  <TrashIcon size={14} />
                  {actionLoading === item.id ? "..." : "Excluir"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteTarget && (
        <ConfirmDeleteModal
          eventId={eventId}
          selectedId={deleteTarget.id}
          participantName={deleteTarget.name}
          participantEmail={deleteTarget.email}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => {
            setSuccessMessage(`Inscrição de ${deleteTarget.name} excluída permanentemente.`);
            setDeleteTarget(null);
            loadInscriptions();
          }}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "success" | "warning" | "danger" | "primary";
}) {
  const colorMap = {
    success: "var(--success, #16a34a)",
    warning: "var(--warning, #eab308)",
    danger: "var(--danger, #ef4444)",
    primary: "var(--primary, #0e3634)",
  };

  return (
    <div className="card" style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
      <strong style={{ fontSize: 20, color: highlight ? colorMap[highlight] : "inherit" }}>{value}</strong>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`btn btn-sm ${active ? "" : "btn-secondary"}`}
      onClick={onClick}
      style={{ fontSize: 12 }}
    >
      {children}
    </button>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

