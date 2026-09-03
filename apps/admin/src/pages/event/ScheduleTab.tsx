import { useEffect, useState } from "react";
import * as api from "../../api/client";
import { CalendarIcon, PlusIcon } from "../../components/Icons";

interface FormData {
  id?: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  speaker: string;
  location: string;
  description: string;
  type: string;
}

const INITIAL_FORM: FormData = {
  date: new Date().toISOString().split("T")[0]!,
  startTime: "08:00",
  endTime: "09:00",
  title: "",
  speaker: "",
  location: "",
  description: "",
  type: "Palestra",
};

export function ScheduleTab({ eventId }: { eventId: string }) {
  const [schedule, setSchedule] = useState<api.ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Formulário
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSchedule();
  }, [eventId]);

  async function loadSchedule() {
    setLoading(true);
    setError(null);
    try {
      const items = await api.getSchedule(eventId);
      setSchedule(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar programação");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setForm(INITIAL_FORM);
    setIsModalOpen(true);
  }

  function handleOpenEdit(item: api.ScheduleItem) {
    setForm({
      id: item.id,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime ?? "",
      title: item.title,
      speaker: item.speaker ?? "",
      location: item.location ?? "",
      description: item.description ?? "",
      type: item.type ?? "Palestra",
    });
    setIsModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date || !form.startTime) return;

    setSaving(true);
    try {
      if (form.id) {
        await api.updateScheduleItem(form.id, {
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime || null,
          title: form.title.trim(),
          speaker: form.speaker.trim() || null,
          location: form.location.trim() || null,
          description: form.description.trim() || null,
          type: form.type || null,
        });
      } else {
        await api.createScheduleItem(eventId, {
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime || null,
          title: form.title.trim(),
          speaker: form.speaker.trim() || null,
          location: form.location.trim() || null,
          description: form.description.trim() || null,
          type: form.type || null,
          order: schedule.length,
        });
      }

      setIsModalOpen(false);
      await loadSchedule();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar atividade");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja remover esta atividade da programação?")) return;

    try {
      await api.deleteScheduleItem(id);
      await loadSchedule();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir atividade");
    }
  }

  // Agrupamento por data
  const grouped: Record<string, api.ScheduleItem[]> = {};
  schedule.forEach((item) => {
    if (!grouped[item.date]) grouped[item.date] = [];
    grouped[item.date]!.push(item);
  });

  const dates = Object.keys(grouped).sort();

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Topo */}
      <div className="spread" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Programação do Evento</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Gerencie as palestras, credenciamento e atividades exibidas na página pública.
          </p>
        </div>

        <button className="btn btn-sm" onClick={handleOpenCreate} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <PlusIcon size={14} /> Nova Atividade
        </button>
      </div>

      {loading ? (
        <p className="muted">Carregando programação...</p>
      ) : error ? (
        <p className="error-text">{error}</p>
      ) : schedule.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <p className="muted" style={{ margin: "0 0 16px" }}>Nenhuma atividade cadastrada na programação ainda.</p>
          <button className="btn btn-sm" onClick={handleOpenCreate}>
            Criar Primeira Atividade
          </button>
        </div>
      ) : (
        <div className="stack" style={{ gap: 24 }}>
          {dates.map((dateStr) => {
            const items = grouped[dateStr] ?? [];
            return (
              <div key={dateStr} className="stack" style={{ gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: "var(--primary, #0E3634)", display: "flex", alignItems: "center", gap: 8 }}>
                  <CalendarIcon size={16} /> {dateStr}
                </h3>

                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <table className="table" style={{ width: "100%", fontSize: 13, margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 140 }}>Horário</th>
                        <th>Atividade / Tema</th>
                        <th>Palestrante</th>
                        <th>Local</th>
                        <th>Tipo</th>
                        <th style={{ width: 120, textAlign: "right" }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                            {item.startTime} {item.endTime ? `— ${item.endTime}` : ""}
                          </td>
                          <td>
                            <strong>{item.title}</strong>
                            {item.description && (
                              <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                                {item.description}
                              </p>
                            )}
                          </td>
                          <td>{item.speaker || "—"}</td>
                          <td>{item.location || "—"}</td>
                          <td>
                            <span className="badge" style={{ fontSize: 11 }}>
                              {item.type || "Geral"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ marginRight: 6 }}
                              onClick={() => handleOpenEdit(item)}
                            >
                              Editar
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ color: "var(--destructive, #ef4444)" }}
                              onClick={() => handleDelete(item.id)}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição */}
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
          <div className="card" style={{ maxWidth: 500, width: "100%", padding: 24 }}>
            <h3 style={{ margin: "0 0 16px" }}>{form.id ? "Editar Atividade" : "Nova Atividade"}</h3>

            <form onSubmit={handleSave} className="stack" style={{ gap: 14 }}>
              <div className="row" style={{ gap: 10 }}>
                <label className="stack" style={{ flex: 1, gap: 4, fontSize: 12 }}>
                  <span>Data (AAAA-MM-DD) *</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </label>

                <label className="stack" style={{ width: 110, gap: 4, fontSize: 12 }}>
                  <span>Início *</span>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    required
                  />
                </label>

                <label className="stack" style={{ width: 110, gap: 4, fontSize: 12 }}>
                  <span>Término</span>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  />
                </label>
              </div>

              <label className="stack" style={{ gap: 4, fontSize: 12 }}>
                <span>Título / Tema da Palestra *</span>
                <input
                  type="text"
                  placeholder="Ex: Toxina Botulínica em Odontologia"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </label>

              <div className="row" style={{ gap: 10 }}>
                <label className="stack" style={{ flex: 1, gap: 4, fontSize: 12 }}>
                  <span>Palestrante</span>
                  <input
                    type="text"
                    placeholder="Ex: Dra. Ana Paula"
                    value={form.speaker}
                    onChange={(e) => setForm({ ...form, speaker: e.target.value })}
                  />
                </label>

                <label className="stack" style={{ flex: 1, gap: 4, fontSize: 12 }}>
                  <span>Local / Sala</span>
                  <input
                    type="text"
                    placeholder="Ex: Auditório Principal"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </label>
              </div>

              <label className="stack" style={{ gap: 4, fontSize: 12 }}>
                <span>Tipo de Atividade</span>
                <input
                  type="text"
                  placeholder="Ex: Palestra, Credenciamento, Intervalo, Mesa Redonda"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                />
              </label>

              <label className="stack" style={{ gap: 4, fontSize: 12 }}>
                <span>Descrição / Resumo</span>
                <textarea
                  rows={3}
                  placeholder="Detalhes adicionais sobre o conteúdo da atividade..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ resize: "vertical" }}
                />
              </label>

              <div className="spread" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Atividade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
