import { useEffect, useState } from "react";
import * as api from "../../api/client";
import { CheckIcon, GearIcon, PlusIcon } from "../../components/Icons";

interface BatchFormData {
  id?: string;
  batchNumber: number;
  name: string;
  price: number;
  allowPix: boolean;
  allowCard: boolean;
  maxQuantity: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: BatchFormData = {
  batchNumber: 1,
  name: "",
  price: 100,
  allowPix: true,
  allowCard: false,
  maxQuantity: "",
  startDate: "",
  endDate: "",
};

export function BatchesTab({ eventId }: { eventId: string }) {
  const [batches, setBatches] = useState<api.BatchItem[]>([]);
  const [activeBatch, setActiveBatch] = useState<api.BatchItem | null>(null);
  const [autoRelease, setAutoRelease] = useState<boolean>(false);
  const [savingAutoRelease, setSavingAutoRelease] = useState(false);
  const [event, setEvent] = useState<api.EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Formulário de Lote
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<BatchFormData>(EMPTY_FORM);
  const [isFree, setIsFree] = useState(false);
  const [savedPrice, setSavedPrice] = useState<number>(100);
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
      setAutoRelease(Boolean(batchRes.autoRelease));
      setEvent(eventRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar lotes do evento");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAutoRelease() {
    const nextVal = !autoRelease;
    setSavingAutoRelease(true);
    try {
      const res = await api.updateBatchSettings(eventId, { autoRelease: nextVal });
      setAutoRelease(res.autoRelease);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar configuração de liberação automática de lotes");
    } finally {
      setSavingAutoRelease(false);
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
      price: 100,
    });
    setIsFree(false);
    setSavedPrice(100);
    setIsModalOpen(true);
  }

  function handleOpenEdit(b: api.BatchItem) {
    const free = b.price === 0;
    setForm({
      id: b.id,
      batchNumber: b.batchNumber,
      name: b.name,
      price: b.price,
      allowPix: b.allowPix,
      allowCard: b.allowCard,
      maxQuantity: b.maxQuantity ? String(b.maxQuantity) : "",
      startDate: b.startDate ? b.startDate.split("T")[0]! : "",
      endDate: b.endDate ? b.endDate.split("T")[0]! : "",
    });
    setIsFree(free);
    setSavedPrice(free ? 100 : b.price);
    setIsModalOpen(true);
  }

  function handleToggleFree() {
    if (!isFree) {
      // Tornar lote gratuito
      if (form.price > 0) {
        setSavedPrice(form.price);
      }
      setIsFree(true);
      setForm((prev) => ({ ...prev, price: 0 }));
    } else {
      // Reverter para lote pago (restaura o valor anterior)
      const restorePrice = savedPrice > 0 ? savedPrice : 100;
      setIsFree(false);
      setForm((prev) => ({ ...prev, price: restorePrice }));
    }
  }

  async function handleSaveBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.price < 0) {
      alert("Por favor, preencha o nome do lote e um valor válido (ou marque como gratuito).");
      return;
    }

    setSaving(true);
    try {
      if (form.id) {
        await api.updateBatch(form.id, {
          batchNumber: form.batchNumber,
          name: form.name.trim(),
          price: form.price,
          allowPix: form.allowPix,
          allowCard: form.allowCard,
          maxQuantity: form.maxQuantity ? parseInt(form.maxQuantity, 10) : null,
          startDate: form.startDate ? `${form.startDate}T00:00:00.000Z` : null,
          endDate: form.endDate ? `${form.endDate}T23:59:59.999Z` : null,
        });
      } else {
        await api.createBatch(eventId, {
          batchNumber: form.batchNumber,
          name: form.name.trim(),
          price: form.price,
          allowPix: form.allowPix,
          allowCard: form.allowCard,
          maxQuantity: form.maxQuantity ? parseInt(form.maxQuantity, 10) : null,
          startDate: form.startDate ? `${form.startDate}T00:00:00.000Z` : null,
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
      return (
        <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <CheckIcon size={12} /> Ativo Agora
        </span>
      );
    }
    if (b.status === "CLOSED") {
      return <span className="badge" style={{ background: "rgba(100, 116, 139, 0.15)", color: "#64748B" }}>Encerrado</span>;
    }
    if (b.status === "UPCOMING") {
      if (b.startDate && new Date(b.startDate) > new Date()) {
        return (
          <span className="badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#D97706" }}>
            Início em {new Date(b.startDate).toLocaleDateString("pt-BR")}
          </span>
        );
      }
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

      {/* Regra de Liberação Automática vs Manual de Lotes */}
      <div
        className="card spread"
        style={{
          padding: "16px 20px",
          alignItems: "center",
          background: autoRelease ? "rgba(14, 165, 233, 0.05)" : "rgba(245, 158, 11, 0.05)",
          border: `1px solid ${autoRelease ? "rgba(14, 165, 233, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: autoRelease ? "#0284C7" : "#D97706",
              }}
            >
              Transição de Lotes
            </span>
            <span
              className="badge"
              style={{
                background: autoRelease ? "rgba(14, 165, 233, 0.2)" : "rgba(245, 158, 11, 0.2)",
                color: autoRelease ? "#0284C7" : "#D97706",
                fontWeight: 800,
                letterSpacing: "0.5px",
              }}
            >
              {autoRelease ? "[ ATIVADA ]" : "[ DESATIVADA ]"}
            </span>
          </div>
          <h3 style={{ margin: "2px 0 0", fontSize: 16 }}>
            Liberação automática de lotes: <strong>{autoRelease ? "ATIVADA" : "DESATIVADA"}</strong>
          </h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.4 }}>
            {autoRelease
              ? "Ao esgotar as vagas ou o prazo do lote atual, o sistema ativa automaticamente o próximo lote elegível."
              : "Ao esgotar as vagas do lote atual, as vendas são bloqueadas até que o administrador clique em 'Ativar Agora' manualmente."}
          </p>
        </div>

        <button
          className={`btn btn-sm ${autoRelease ? "btn-secondary" : ""}`}
          onClick={handleToggleAutoRelease}
          disabled={savingAutoRelease}
          style={{ minWidth: 220 }}
        >
          {savingAutoRelease
            ? "Salvando..."
            : autoRelease
            ? "Desativar Liberação Automática"
            : "Ativar Liberação Automática"}
        </button>
      </div>

      {/* Cabeçalho */}
      <div className="spread" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Lotes e Valores do Evento</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Configure valores, limite de vagas e datas. O valor dos próximos lotes é ocultado automaticamente do público até que sejam ativados.
          </p>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleSeedDefault} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <GearIcon size={14} /> Carregar Padrão COPOL
          </button>
          <button className="btn btn-sm" onClick={handleOpenCreate} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <PlusIcon size={14} /> Adicionar Lote
          </button>
        </div>
      </div>

      {/* Destaque do Lote Ativo */}
      {activeBatch ? (
        <div
          className="card"
          style={{
            padding: 24,
            borderLeft: "4px solid var(--primary, #3b5bff)",
            background: "rgba(59, 91, 255, 0.05)",
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
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: activeBatch.price === 0 ? "var(--success, #22c55e)" : "var(--primary, #3b5bff)",
                }}
              >
                {activeBatch.price === 0 ? "GRÁTIS" : `R$ ${activeBatch.price.toFixed(2).replace(".", ",")}`}
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
                <th>Valor (Admin)</th>
                <th>Limite de Vagas</th>
                <th>Confirmados</th>
                <th>Início das Vendas</th>
                <th>Encerramento</th>
                <th>Status</th>
                <th style={{ width: 200, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr
                  key={batch.id}
                  style={batch.isActive ? { background: "rgba(45, 212, 191, 0.05)", fontWeight: 600 } : undefined}
                >
                  <td style={{ fontWeight: 700 }}>#{batch.batchNumber}</td>
                  <td>{batch.name}</td>
                  <td style={{ fontWeight: 700 }}>
                    {batch.price === 0 ? (
                      <span className="badge badge-success" style={{ fontSize: 11, fontWeight: 700 }}>
                        Grátis
                      </span>
                    ) : (
                      `R$ ${batch.price.toFixed(2).replace(".", ",")}`
                    )}
                  </td>
                  <td>{batch.maxQuantity ? `${batch.maxQuantity} vagas` : "Ilimitado"}</td>
                  <td>
                    <strong>{batch.confirmedCount}</strong>
                    {batch.maxQuantity ? ` / ${batch.maxQuantity}` : ""}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {batch.startDate ? new Date(batch.startDate).toLocaleDateString("pt-BR") : "Imediato"}
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
                        title="Ativar este lote manualmente agora no ar (sobrepõe datas automáticas)"
                      >
                        Ativar Agora
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

              <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                <div className="stack" style={{ flex: 1, gap: 4 }}>
                  <div className="spread" style={{ alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Valor (R$) *</span>
                    <button
                      type="button"
                      onClick={handleToggleFree}
                      className="btn btn-sm"
                      style={{
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        borderRadius: 6,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        ...(isFree
                          ? {
                              background: "rgba(59, 130, 246, 0.2)",
                              color: "#60a5fa",
                              border: "1px solid rgba(59, 130, 246, 0.4)",
                            }
                          : {
                              background: "rgba(34, 197, 94, 0.15)",
                              color: "#4ade80",
                              border: "1px solid rgba(34, 197, 94, 0.35)",
                            }),
                      }}
                      title={
                        isFree
                          ? "Reverter para lote pago (restaura o valor anterior)"
                          : "Definir este lote como gratuito (R$ 0,00)"
                      }
                    >
                      {isFree ? "↩ Reverter para Pago" : "🎁 Tornar Grátis"}
                    </button>
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    disabled={isFree}
                    value={isFree ? 0 : form.price}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setForm({ ...form, price: val });
                      if (val > 0) setSavedPrice(val);
                    }}
                    required
                    style={
                      isFree
                        ? {
                            opacity: 0.7,
                            background: "rgba(34, 197, 94, 0.08)",
                            borderColor: "rgba(34, 197, 94, 0.4)",
                            fontWeight: 600,
                          }
                        : undefined
                    }
                  />

                  {isFree ? (
                    <span
                      className="badge badge-success"
                      style={{ alignSelf: "flex-start", fontSize: 11, padding: "2px 8px" }}
                    >
                      Lote 100% Gratuito (R$ 0,00)
                    </span>
                  ) : (
                    <small className="muted">Oculto do público nos lotes futuros.</small>
                  )}
                </div>

                <label className="stack" style={{ flex: 1, gap: 4, fontSize: 12 }}>
                  <span>Limite de Vagas</span>
                  <input
                    type="number"
                    placeholder="Vazio = ilimitado"
                    value={form.maxQuantity}
                    onChange={(e) => setForm({ ...form, maxQuantity: e.target.value })}
                  />
                  <small className="muted">Deixe vazio para vagas ilimitadas.</small>
                </label>
              </div>

              <div className="row" style={{ gap: 10 }}>
                <label className="stack" style={{ flex: 1, gap: 4, fontSize: 12 }}>
                  <span>Início das Vendas (opcional)</span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                  <small className="muted">Ativação automática a partir desta data.</small>
                </label>

                <label className="stack" style={{ flex: 1, gap: 4, fontSize: 12 }}>
                  <span>Encerramento (opcional)</span>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                  <small className="muted">Encerra às 23:59 desta data.</small>
                </label>
              </div>

              <div className="stack" style={{ gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Formas de pagamento deste lote</span>
                <div className="row" style={{ gap: 18 }}>
                  <label className="row" style={{ gap: 6, alignItems: "center", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={form.allowPix}
                      onChange={(e) => setForm({ ...form, allowPix: e.target.checked })}
                    />
                    <span>Pix</span>
                  </label>

                  <label className="row" style={{ gap: 6, alignItems: "center", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={form.allowCard}
                      onChange={(e) => setForm({ ...form, allowCard: e.target.checked })}
                    />
                    <span>Cartão</span>
                  </label>
                </div>
                <small className="muted">
                  Hoje a cobrança automática sai apenas no Pix. Cartão fica registrado para quando o
                  checkout entrar — e um lote sem Pix não gera cobrança automática.
                </small>
              </div>

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
