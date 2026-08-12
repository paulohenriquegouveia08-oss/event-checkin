import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import * as api from "../../api/client";

export function ReportTab({ eventId }: { eventId: string }) {
  const [report, setReport] = useState<api.EventReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api
      .getReport(eventId)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar relatório"));
  }, [eventId]);

  function handleDownloadPdf() {
    if (!report) return;
    setGenerating(true);

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = 20;

      // Header
      doc.setFillColor(14, 54, 52);
      doc.rect(0, 0, pageW, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("RELATORIO DE PRESENCA", pageW / 2, 18, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(report.eventName, pageW / 2, 25, { align: "center" });

      y = 40;

      // Summary
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo", margin, y);
      y += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Evento: ${report.eventName}`, margin, y); y += 5;
      if (report.eventLocation) {
        doc.text(`Local: ${report.eventLocation}`, margin, y); y += 5;
      }
      doc.text(`Total de inscritos: ${report.totalRegistered}`, margin, y); y += 5;
      doc.text(`Total de presentes: ${report.totalCheckedIn}`, margin, y); y += 5;
      const absent = report.totalRegistered - report.totalCheckedIn;
      doc.text(`Ausentes: ${absent}`, margin, y); y += 5;
      const pct = report.totalRegistered > 0 ? ((report.totalCheckedIn / report.totalRegistered) * 100).toFixed(1) : "0";
      doc.text(`Taxa de presenca: ${pct}%`, margin, y); y += 5;
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, y); y += 10;

      // Table header
      doc.setFillColor(240, 250, 249);
      doc.rect(margin, y, pageW - margin * 2, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      const cols = [margin, margin + 42, margin + 85, margin + 115, margin + 140, margin + 160];
      doc.text("Participante", cols[0] + 2, y + 5.5);
      doc.text("E-mail", cols[1] + 2, y + 5.5);
      doc.text("CPF", cols[2] + 2, y + 5.5);
      doc.text("Terminal", cols[3] + 2, y + 5.5);
      doc.text("Origem", cols[4] + 2, y + 5.5);
      doc.text("Data/Hora", cols[5] + 2, y + 5.5);
      y += 8;

      // Table rows
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(40, 40, 40);

      for (const row of report.checkIns) {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }

        const dt = new Date(row.checkedInAt);
        const dateStr = dt.toLocaleDateString("pt-BR");
        const timeStr = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

        doc.text(truncate(row.participantName, 28), cols[0] + 2, y + 4);
        doc.text(truncate(row.participantEmail ?? "—", 24), cols[1] + 2, y + 4);
        doc.text(truncate(row.participantDocument ?? "—", 14), cols[2] + 2, y + 4);
        doc.text(truncate(row.terminalName ?? "—", 12), cols[3] + 2, y + 4);
        doc.text(row.source === "ONLINE" ? "Online" : "Offline", cols[4] + 2, y + 4);
        doc.text(`${dateStr} ${timeStr}`, cols[5] + 2, y + 4);

        y += 6;
      }

      // Footer
      y += 5;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Total: ${report.checkIns.length} presenca(s)`, margin, y);
      y += 5;
      doc.text("Copol | LSPK Tecnology", pageW / 2, y, { align: "center" });

      doc.save(`relatorio-${report.eventName.replace(/\s+/g, "_")}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!report) return <p className="muted">Carregando...</p>;

  return (
    <div className="stack">
      <div className="spread">
        <div className="row" style={{ gap: 16 }}>
          <StatCard label="Inscritos" value={report.totalRegistered} />
          <StatCard label="Presentes" value={report.totalCheckedIn} color="var(--success)" />
          <StatCard label="Ausentes" value={report.totalRegistered - report.totalCheckedIn} color="var(--warning)" />
          <StatCard
            label="Presenca"
            value={`${report.totalRegistered > 0 ? ((report.totalCheckedIn / report.totalRegistered) * 100).toFixed(1) : 0}%`}
            color="var(--primary)"
          />
        </div>
        <button className="btn" onClick={handleDownloadPdf} disabled={generating}>
          {generating ? "Gerando..." : "Baixar PDF"}
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {report.checkIns.length === 0 ? (
          <p className="muted" style={{ padding: 20, margin: 0 }}>
            Nenhum check-in registrado ainda.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Participante</th>
                  <th>E-mail</th>
                  <th>CPF</th>
                  <th>Terminal</th>
                  <th>Origem</th>
                  <th>Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                {report.checkIns.map((row, i) => {
                  const dt = new Date(row.checkedInAt);
                  return (
                    <tr key={i}>
                      <td>{row.participantName}</td>
                      <td className="muted">{row.participantEmail ?? "—"}</td>
                      <td className="muted">{row.participantDocument ?? "—"}</td>
                      <td className="muted">{row.terminalName ?? "—"}</td>
                      <td>
                        <span className={`badge ${row.source === "ONLINE" ? "badge-success" : "badge-muted"}`}>
                          {row.source === "ONLINE" ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="muted">
                        {dt.toLocaleDateString("pt-BR")} {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card" style={{ flex: 1, textAlign: "center", padding: 14 }}>
      <p className="muted" style={{ margin: "0 0 6px", fontSize: 12 }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: color ?? "var(--text)" }}>{value}</p>
    </div>
  );
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}
