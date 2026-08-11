import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as checkinsRepository from "../../database/checkinsRepository";
import type { TerminalConfig } from "../../types/index";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(config: TerminalConfig, rows: { name: string; time: string }[]): string {
  const generatedAt = new Date().toLocaleString("pt-BR");
  const body = rows.length
    ? rows
        .map(
          (r, i) =>
            `<tr><td>${i + 1}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.time)}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="3" class="empty">Nenhuma presença registrada por este terminal ainda.</td></tr>`;

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; padding: 24px; }
          h1 { font-size: 20px; margin: 0 0 2px; }
          h2 { font-size: 14px; font-weight: normal; color: #555; margin: 0 0 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #ddd; }
          th { background: #f2f2f2; text-transform: uppercase; font-size: 11px; color: #555; }
          td.empty { text-align: center; color: #888; padding: 24px; }
          .meta { margin-top: 24px; font-size: 11px; color: #888; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(config.eventName)}</h1>
        <h2>Terminal: ${escapeHtml(config.terminalName)} — Relatório de presença</h2>
        <table>
          <thead><tr><th>#</th><th>Participante</th><th>Horário</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
        <p class="meta">Gerado em ${generatedAt} · ${rows.length} presença(s) registrada(s) por este terminal.</p>
      </body>
    </html>
  `;
}

/**
 * Gera um PDF com as presenças confirmadas por ESTE terminal (nome +
 * horário, seção pedida pelo cliente), com o nome do evento e do
 * terminal no topo, e abre o menu de compartilhamento do Android pra
 * exportar (e-mail, WhatsApp, Drive, etc.).
 *
 * Importante: reflete só os check-ins que passaram por este aparelho —
 * não é o relatório consolidado do evento inteiro (isso exigiria um
 * endpoint novo no backend agregando todos os terminais; o painel admin
 * já mostra esse agregado na aba Estatísticas).
 */
export async function generateAndShareAttendanceReport(config: TerminalConfig): Promise<{ count: number }> {
  const checkIns = await checkinsRepository.listConfirmed();
  const rows = checkIns.map((c) => ({
    name: c.participantName,
    time: new Date(c.checkedInAt).toLocaleString("pt-BR"),
  }));

  const html = buildHtml(config, rows);
  const { uri } = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `Relatório de presença — ${config.terminalName}`,
    });
  }

  return { count: rows.length };
}
