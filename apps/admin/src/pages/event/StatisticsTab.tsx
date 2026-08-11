import { useEffect, useState } from "react";
import * as api from "../../api/client";

export function StatisticsTab({ eventId }: { eventId: string }) {
  const [stats, setStats] = useState<api.EventStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api
      .getStatistics(eventId)
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar estatísticas"));
  }

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (error) return <p className="error-text">{error}</p>;
  if (!stats) return <p className="muted">Carregando...</p>;

  return (
    <div className="stack">
      <div className="row" style={{ gap: 16 }}>
        <StatCard label="Inscritos" value={stats.totalRegistered} />
        <StatCard label="Presentes" value={stats.totalCheckedIn} color="var(--success)" />
        <StatCard label="Ausentes" value={stats.totalAbsent} color="var(--warning)" />
        <StatCard label="Presença" value={`${stats.attendancePercentage.toFixed(2)}%`} color="var(--primary)" />
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>Check-ins por terminal</h2>
        {stats.checkInsByTerminal.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nenhum check-in registrado ainda.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Terminal</th>
                <th>Check-ins</th>
              </tr>
            </thead>
            <tbody>
              {stats.checkInsByTerminal.map((row) => (
                <tr key={row.terminalId ?? "sem-terminal"}>
                  <td className="muted">{row.terminalId ?? "—"}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card" style={{ flex: 1, textAlign: "center" }}>
      <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: color ?? "var(--text)" }}>{value}</p>
    </div>
  );
}
