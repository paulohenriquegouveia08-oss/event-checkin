import { useEffect, useState } from "react";
import * as api from "../../api/client";

interface BatchFormData {
  id?: string;
  batchNumber: number;
  name: string;
  price: number;
  maxQuantity: string;
  endDate: string;
}

const EMPTY_FORM: BatchFormData = {
  batchNumber: 1,
  name: "",
  price: 100,
  maxQuantity: "",
  endDate: "",
};

export function BatchesTab({ eventId }: { eventId: string }) {
  const [batches, setBatches] = useState<api.BatchItem[]>([]);
  const [activeBatch, setActiveBatch] = useState<api.BatchItem | null>(null);
  const [event, setEvent] = useState<api.EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Formulário de Lote
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<BatchFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingRegistrations, setTogglingRegistrations] = useState(false);

  useEffect(() => {
    loadData();
  }, [eventId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [batchRes, eventRes] = await Promise.all([
        api.getBatches(eventId),
        api.getEvent(eventId),
      ]);
      setBatches(batchRes.batches);
      setActiveBatch(batchRes.activeBatch);
      setEvent(eventRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar lotes do evento");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleRegistrations() {
    if (!event) return;
    const newState = !event.registrationsOpen;
    setTogglingRegistrations(true);
    try {
      const updated = await api.updateEvent(eventId, { registrationsOpen: newState });
      setEvent(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao alterar status das inscrições");
    } finally {
      setTogglingRegistrations(false);
    }
  }

  function handleOpenCreate() {
    const nextNumber = batches.length > 0 ? Math.max(...batches.map((b) => b.batchNumber)) + 1 : 1;
    setForm({
      ...EMPTY_FORM,
      batchNumber: nextNumber,
      name: `${nextNumber}º Lote`,
    });
    setIsModalOpen(true);
  }

  function handleOpenEdit(b: api.BatchItem) {
    setForm({
      id: b.id,
      batchNumber: b.batchNumber,
      name: b.name,
      price: b.price,
      maxQuantity: b.maxQuantity ? String(b.maxQuantity) : "",
      endDate: b.endDate ? b.endDate.split("T")[0]! : "",
    });
    setIsModalOpen(true);
  }

  async function handleSaveBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.price <= 0) {
      alert("Por favor, preencha o nome e um valor positivo para o lote.");
      return;
    }

    setSaving(true);
    try {
      if (form.id) {
        await api.updateBatch(form.id, {
          batchNumber: form.batchNumber,
          name: form.name.trim(),
          price: form.price,
          maxQuantity: form.maxQuantity ? parseInt(form.maxQuantity, 10) : null,
          endDate: form.endDate ? `${form.endDate}T23:59:59.999Z` : null,
        });
      } else {
        await api.createBatch(eventId, {
          batchNumber: form.batchNumber,
          name: form.name.trim(),
          price: form.price,
          maxQuantity: form.maxQuantity ? parseInt(form.maxQuantity, 10) : null,
          endDate: form.endDate ? `${form.endDate}T23:59:59.999Z` : null,
        });
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar lote");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBatch(id: string) {
    if (!confirm("Tem certeza que deseja excluir este lote?")) return;
    try {
      await api.deleteBatch(id);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível excluir o lote");
    }
  }

  async function handleActivateManual(id: string) {
    try {
      const res = await api.activateBatch(eventId, id);
      setBatches(res.batches);
      setActiveBatch(res.activeBatch);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao ativar lote");
    }
  }

  async function handleSeedDefault() {
    if (!confirm("Deseja aplicar a estrutura padrão de 4 lotes do Copol para este evento?")) return;
    try {
      await api.seedDefaultBatches(eventId);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao gerar lotes padrão");
    }
  }

  function formatStatus(b: api.BatchItem) {
    if (b.status === "ACTIVE") {
      return <span className="badge badge-success">✓ Ativo Agora</span>;
    }
    if (b.status === "CLOSED") {
      return <span className="badge" style={{ background: "rgba(100, 116, 139, 0.15)", color: "#64748B" }}>Encerrado</span>;
    }
    if (b.status === "UPCOMING") {
      return <span className="badge" style={{ background: "rgba(14, 165, 233, 0.15)", color: "#0284C7" }}>Próximo Lote</span>;
    }
    return <span className="badge badge-warning">Finalizado</span>;
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      {/* Barra de Controle de Inscrições do Evento */}
      {event && (
        <div
          className="card spread"
          style={{
            padding: "16px 20px",
            alignItems: "center",
            background: event.registrationsOpen ? "rgba(34, 197, 94, 0.05)" : "rgba(239, 68, 68, 0.05)",
            border: `1px solid ${event.registrationsOpen ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          }}
        >
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: event.registrationsOpen ? "var(--success)" : "var(--destructive)" }}>
              Status das Inscrições
            </span>
            <h3 style={{ margin: "2px 0 0", fontSize: 16 }}>
              {event.registrationsOpen ? "Inscrições Abertas ao Público" : "Inscrições Fechadas / Pausadas"}
            </h3>
          </div>

          <button
            className={`btn btn-sm ${event.registrationsOpen ? "btn-secondary" : ""}`}
            onClick={handleToggleRegistrations}
            disabled={togglingRegistrations}
            style={{ minWidth: 160 }}
          >
            {togglingRegistrations
              ? "Atualizando..."
              : event.registrationsOpen
              ? "Encerrar Inscrições"
              : "Abrir Inscrições"}
          </button>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="spread" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Lotes e Valores do Evento</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Configure valores, limite de vagas e prazos. As transições ocorrem automaticamente pelas regras cadastradas.
          </p>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleSeedDefault}>
            ⚙️ Carregar Padrão COPOL
          </button>
          <button className="btn btn-sm" onClick={handleOpenCreate}>
            + Adicionar Lote
          </button>
        </div>
      </div>

      {/* Destaque do Lote Ativo */}
      {activeBatch ? (
        <div
          className="card"
          style={{
            padding: 24,
            borderLeft: "4px solid var(--primary, #0E3634)",
            background: "rgba(14, 54, 52, 0.03)",
          }}
        >
          <div className="spread" style={{ flexWrap: "wrap", gap: 16 }}>
            <div>
              <span className="badge badge-success" style={{ marginBottom: 8 }}>
                LOTE ATIVO NO FORMULÁRIO DE INSCRIÇÃO
              </span>
              <h3 style={{ margin: "6px 0 2px", fontSize: 20 }}>{activeBatch.name}</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                {activeBatch.maxQuantity
                  ? `Vagas: ${activeBatch.confirmedCount} de ${activeBatch.maxQuantity} preenchidas.`
                  : activeBatch.endDate
                  ? `Válido até ${new Date(activeBatch.endDate).toLocaleDateString("pt-BR")}.`
                  : "Sem limite de vagas ou prazo definido."}
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--primary, #0E3634)" }}>
                R$ {activeBatch.price.toFixed(2).replace(".", ",")}
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                {activeBatch.confirmedCount} {activeBatch.maxQuantity ? `/ ${activeBatch.maxQuantity}` : ""} confirmados
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tabela de Lotes */}
      {loading ? (
        <p className="muted">Carregando lotes...</p>
      ) : error ? (
        <p className="error-text">{error}</p>
      ) : batches.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <p className="muted" style={{ margin: "0 0 16px" }}>Nenhum lote configurado para este evento.</p>
          <div className="row" style={{ justifyContent: "center", gap: 12 }}>
            <button className="btn btn-sm" onClick={handleSeedDefault}>
              Carregar 4 Lotes Padrão do COPOL
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleOpenCreate}>
              Criar Lote Personalizado
            </button>
          </div>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>Ordem</th>
                <th>Nome do Lote</th>
                <th>Valor</th>
                <th>Limite de Vagas</th>
                <th>Confirmados</th>
                <th>Encerramento</th>
                <th>Status</th>
                <th style={{ width: 180, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr
                  key={batch.id}
                  style={batch.isActive ? { background: "rgba(14, 54, 52, 0.04)", fontWeight: 600 } : undefined}
                >
                  <td style={{ fontWeight: 700 }}>#{batch.batchNumber}</td>
                  <td>{batch.name}</td>
                  <td style={{ fontWeight: 700 }}>R$ {batch.price.toFixed(2).replace(".", ",")}</td>
                  <td>{batch.maxQuantity ? `${batch.maxQuantity} vagas` : "Ilimitado"}</td>
                  <td>
                    <strong>{batch.confirmedCount}</strong>
                    {batch.maxQuantity ? ` / ${batch.maxQuantity}` : ""}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {batch.endDate ? new Date(batch.endDate).toLocaleDateString("pt-BR") : "Sem prazo fixo"}
                  </td>
                  <td>{formatStatus(batch)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {!batch.isActive && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginRight: 6, fontSize: 11 }}
                        onClick={() => handleActivateManual(batch.id)}
                        title="Ativar este lote manualmente agora"
                      >
                        Ativar
                      </button>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginRight: 6, fontSize: 11 }}
                      onClick={() => handleOpenEdit(batch)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: "var(--destructive, #ef4444)", fontSize: 11 }}
                      onClick={() => handleDeleteBatch(batch.id)}
                      disabled={batch.confirmedCount > 0}
                      title={batch.confirmedCount > 0 ? "Não pode excluir lote com inscrições confirmadas" : "Excluir lote"}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Adicionar / Editar Lote */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 460, width: "100%", padding: 24 }}>
            <h3 style={{ margin: "0 0 16px" }}>{form.id ? "Editar Lote" : "Novo Lote"}</h3>

            <form onSubmit={handleSaveBatch} className="stack" style={{ gap: 14 }}>
              <div className="row" style={{ gap: 10 }}>
                <label className="stack" style={{ width: 100, gap: 4, fontSize: 12 }}>
                  <span>Nº do Lote *</span>
                  <input
                    type="number"
                    min={1}
                    value={form.batchNumber}
                    onChange={(e) => setForm({ ...form, batchNumber: parseInt(e.target.value, 10) || 1 })}
                    required
                  />
                </label>

                <label className="stack" style={{ flex: 1, gap: 4, fontSize: 12 }}>
                  <span>Nome do Lote *</span>
                  <input
                    type="text"
                    placeholder="Ex: 1º Lote — Promocional"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="row" style={{ gap: 10 }}>
                <label className="stack" style={{ flex: 1, gap: 4, fontSize: 12 }}>
                  <span>Valor (R$) *</span>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </label>

                <label className="stack" style={{ flex: 1, gap: 4, fontSize: 12 }}>
                  <span>Limite de Vagas</span>
                  <input
                    type="number"
                    placeholder="Vazio = ilimitado"
                    value={form.maxQuantity}
                    onChange={(e) => setForm({ ...form, maxQuantity: e.target.value })}
                  />
                </label>
              </div>

              <label className="stack" style={{ gap: 4, fontSize: 12 }}>
                <span>Data de Encerramento (opcional)</span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
                <small className="muted">O lote encerrará automaticamente às 23:59 desta data.</small>
              </label>

              <div className="spread" style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Lote"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
