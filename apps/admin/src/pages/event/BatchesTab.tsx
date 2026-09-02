import { useEffect, useState } from "react";
import * as api from "../../api/client";

export function BatchesTab({ eventId }: { eventId: string }) {
  const [batches, setBatches] = useState<api.BatchItem[]>([]);
  const [activeBatch, setActiveBatch] = useState<api.BatchItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBatches();
  }, [eventId]);

  async function loadBatches() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBatches(eventId);
      setBatches(res.batches);
      setActiveBatch(res.activeBatch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar lotes");
    } finally {
      setLoading(false);
    }
  }

  function formatStatus(status: api.BatchItem["status"]) {
    switch (status) {
      case "ACTIVE":
        return <span className="badge badge-success">Ativo Agora</span>;
      case "CLOSED":
        return <span className="badge" style={{ background: "rgba(100, 116, 139, 0.15)", color: "#64748B" }}>Encerrado</span>;
      case "UPCOMING":
        return <span className="badge" style={{ background: "rgba(14, 165, 233, 0.15)", color: "#0284C7" }}>Próximo Lote</span>;
      case "FINISHED":
        return <span className="badge badge-warning">Finalizado</span>;
    }
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      {/* Cabeçalho */}
      <div className="spread" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Gerenciamento de Lotes</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Acompanhamento das regras automáticas de transição dos 4 lotes do evento.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadBatches} disabled={loading}>
          Atualizar Dados
        </button>
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
                LOTE ATUALMENTE EM VIGOR NO SITE
              </span>
              <h3 style={{ margin: "6px 0 2px", fontSize: 20 }}>{activeBatch.name}</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                {activeBatch.batchNumber === 1
                  ? `Virada automática por quantidade: encerrará ao atingir ${activeBatch.maxQuantity} inscrições pagas.`
                  : activeBatch.endDate
                  ? `Virada automática por data: válido até ${new Date(activeBatch.endDate).toLocaleDateString("pt-BR")}.`
                  : "Último lote programado."}
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
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th>Lote</th>
                <th>Nome</th>
                <th>Valor</th>
                <th>Vagas</th>
                <th>Inscrições Realizadas</th>
                <th>Encerramento</th>
                <th>Status</th>
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
                    {batch.batchNumber === 1
                      ? "Ao atingir 60 vagas"
                      : batch.endDate
                      ? new Date(batch.endDate).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td>{formatStatus(batch.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
