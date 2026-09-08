import type { ResolvedEmailSettings } from "./email-settings.js";

/** Escapa texto que vem do banco antes de entrar no HTML do e-mail. */
export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface LayoutParams {
  settings: ResolvedEmailSettings;
  eventName: string;
  /** Etiqueta pequena acima do título, em maiúsculas. */
  eyebrow: string;
  /** Linha abaixo do nome do evento. */
  subtitle: string;
  /** O miolo, já em HTML. */
  body: string;
}

/**
 * O invólucro comum dos e-mails do sistema.
 *
 * Um só lugar com o cabeçalho, o rodapé e a estrutura de tabelas que os
 * clientes de e-mail exigem. Antes cada e-mail trazia a sua cópia, com a
 * paleta do COPOL escrita dentro — o que tornava impossível um segundo
 * evento sem duplicar o HTML inteiro.
 *
 * As cores vêm das configurações do evento; o texto vem de quem chama.
 */
export function montarEmail({ settings, eventName, eyebrow, subtitle, body }: LayoutParams): string {
  const nome = escaparHtml(eventName);
  const rodapeExtra = settings.footerNote ? `${escaparHtml(settings.footerNote)}<br>` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escaparHtml(subtitle)} — ${nome}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #E2E8F0;">

          <tr>
            <td style="background-color: ${settings.primaryColor}; padding: 36px 32px; text-align: center; color: #FFFFFF;">
              <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: ${settings.accentColor}; font-weight: 700; margin-bottom: 8px;">
                ${escaparHtml(eyebrow)}
              </div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; line-height: 1.2;">${nome}</h1>
              <p style="margin: 10px 0 0; color: #E2E8F0; font-size: 14px;">${escaparHtml(subtitle)}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px;">${body}</td>
          </tr>

          <tr>
            <td style="background-color: #F1F5F9; padding: 20px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0;">
              ${rodapeExtra}
              Este é um e-mail oficial do ${nome}.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Botão que leva ao site do evento. */
export function botao(settings: ResolvedEmailSettings, url: string, texto: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr><td align="center">
    <a href="${escaparHtml(url)}" target="_blank" style="display: inline-block; background-color: ${settings.primaryColor}; color: #FFFFFF; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 8px; text-decoration: none;">
      ${escaparHtml(texto)}
    </a>
  </td></tr>
</table>`;
}
