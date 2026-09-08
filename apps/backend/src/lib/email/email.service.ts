import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import QRCode from "qrcode";
import { env } from "../../config/env.js";
import { botao, escaparHtml, montarEmail } from "./email-layout.js";
import { formatarRemetente, resolveEmailSettings, type ResolvedEmailSettings } from "./email-settings.js";

/**
 * O evento, do ponto de vista do e-mail.
 *
 * Só o que os e-mails precisam saber. Aceitar o registro inteiro do Prisma
 * amarraria este módulo ao schema; aceitar campos soltos faria cada
 * chamador montar o remetente por conta própria, que é como as marcas se
 * misturam entre eventos.
 */
export interface EventoParaEmail {
  id: string;
  name: string;
  location?: string | null;
  emailSettings?: unknown;
}

export interface ResultadoDoEnvio {
  success: boolean;
  id?: string;
  /** Nenhuma chave configurada: nada foi enviado de verdade. */
  mock?: boolean;
  erro?: string;
}

export interface SendReceiptEmailParams {
  to: string;
  participantName: string;
  inscriptionId: string;
  batchName: string;
  amount: number;
  qrToken: string;
  eventLocation?: string | null;
}

export interface SendCertificateEmailParams {
  to: string;
  participantName: string;
  workloadHours?: number | null;
  certificatePdfBuffer: Buffer;
  verificationUrl: string;
  /**
   * Identidade do conteúdo enviado. Entra na chave de idempotência: um
   * certificado regerado com conteúdo novo precisa poder ser reenviado.
   */
  certificateId: string;
  contentHash?: string;
}

export interface SendAttendanceProofEmailParams {
  to: string;
  participantName: string;
  participantId: string;
  proofPdfBuffer: Buffer;
  checkedInAt?: Date | null;
}

/** Anexo maior que isto o Resend recusa (40 MB já em Base64). */
const LIMITE_ANEXO_BYTES = Math.floor((40 * 1024 * 1024 * 3) / 4);

export class EmailService {
  private resend: Resend | null = null;

  constructor() {
    if (env.RESEND_API_KEY) {
      this.resend = new Resend(env.RESEND_API_KEY);
    }
  }

  private configuracao(evento: EventoParaEmail): ResolvedEmailSettings {
    return resolveEmailSettings(evento.emailSettings);
  }

  /**
   * O envio propriamente dito.
   *
   * `idempotencyKey` não é zelo: o Resend usa esse cabeçalho para não
   * entregar duas vezes a mesma coisa em até 24 h, e este sistema tem
   * caminhos que repetem — webhook de pagamento reenviado, admin clicando
   * duas vezes, reprocessamento de fila. Sem a chave, a pessoa recebe o
   * certificado em duplicata.
   *
   * Reenvio deliberado passa uma chave diferente de propósito (ver
   * `reenvio` nos métodos), senão o pedido explícito de alguém seria
   * engolido em silêncio pela própria proteção.
   */
  private async enviar(
    s: ResolvedEmailSettings,
    payload: {
      to: string;
      subject: string;
      html: string;
      attachments?: { filename: string; content: Buffer; contentId?: string }[];
      tags?: { name: string; value: string }[];
    },
    idempotencyKey: string,
  ): Promise<ResultadoDoEnvio> {
    const anexos = payload.attachments ?? [];
    const total = anexos.reduce((soma, a) => soma + a.content.length, 0);
    if (total > LIMITE_ANEXO_BYTES) {
      // Melhor recusar aqui, com o motivo, do que receber um erro do
      // Resend que não diz qual e-mail estourou.
      return { success: false, erro: `Anexos somam ${Math.round(total / 1024 / 1024)} MB; o limite do Resend é 40 MB.` };
    }

    if (!this.resend) {
      console.log(`[EmailService:MOCK] "${payload.subject}" para ${payload.to} (sem RESEND_API_KEY)`);
      return { success: true, mock: true, id: "mock" };
    }

    const { data, error } = await this.resend.emails.send(
      {
        from: formatarRemetente(s),
        to: payload.to,
        ...(s.replyTo ? { replyTo: s.replyTo } : {}),
        subject: payload.subject,
        html: payload.html,
        ...(anexos.length > 0 ? { attachments: anexos } : {}),
        ...(payload.tags ? { tags: payload.tags } : {}),
      },
      { idempotencyKey },
    );

    if (error) {
      console.error("[EmailService] Resend recusou o envio:", error);
      return { success: false, erro: error.message };
    }

    return { success: true, id: data?.id };
  }

  /** Comprovante de inscrição, com o QR Code de check-in. */
  async sendRegistrationReceipt(
    evento: EventoParaEmail,
    params: SendReceiptEmailParams,
    opcoes: { reenvio?: boolean } = {},
  ): Promise<ResultadoDoEnvio> {
    const s = this.configuracao(evento);

    // O QR VAI COMO ANEXO EMBUTIDO, e não como `data:` no `src`.
    //
    // O Gmail não renderiza imagem em `data:` URI — mostra o e-mail sem
    // o código, ou o joga como anexo solto. Como o QR É o comprovante,
    // isso significava chegar inutilizável para boa parte dos inscritos.
    // `cid:` é o embutido de MIME de sempre, e o Gmail mostra.
    const qrPng = await QRCode.toBuffer(params.qrToken, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 280,
      color: { dark: s.primaryColor, light: "#FFFFFF" },
    });

    const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(params.amount);
    const agora = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const local = params.eventLocation ?? evento.location ?? null;

    const corpo = `
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Olá, <strong>${escaparHtml(params.participantName)}</strong>!
      </p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 28px; color: #475569;">
        Seu pagamento foi aprovado e sua inscrição está <strong>confirmada</strong>.
      </p>

      <table role="presentation" width="100%" style="background-color: #F0FDF4; border: 2px dashed #86EFAC; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 28px;">
        <tr><td align="center">
          <span style="background-color: #22C55E; color: #FFFFFF; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; text-transform: uppercase; letter-spacing: 1px;">
            SEU ACESSO AO EVENTO
          </span>
          <h3 style="margin: 14px 0 6px; font-size: 18px; color: ${s.primaryColor};">QR Code para Check-in</h3>
          <p style="margin: 0 0 16px; font-size: 13px; color: #166534;">
            Apresente este código na tela do celular no terminal de entrada:
          </p>
          <div style="background-color: #FFFFFF; padding: 12px; border-radius: 12px; display: inline-block;">
            <img src="cid:qrcode" alt="QR Code de Check-in" width="220" height="220" style="display: block; border-radius: 6px;" />
          </div>
        </td></tr>
      </table>

      <table role="presentation" width="100%" style="background-color: #F8FAFC; border-radius: 12px; border: 1px solid #E2E8F0; padding: 18px; font-size: 14px; margin-bottom: 28px;">
        <tr><td style="padding: 6px 0; color: #64748B;">Identificador:</td>
            <td style="padding: 6px 0; font-weight: 700; text-align: right; font-family: monospace;">${escaparHtml(params.inscriptionId)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748B;">Lote:</td>
            <td style="padding: 6px 0; font-weight: 700; text-align: right; color: ${s.primaryColor};">${escaparHtml(params.batchName)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748B;">Valor pago:</td>
            <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #16A34A;">${valor}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748B;">Confirmado em:</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right;">${agora}</td></tr>
        ${local ? `<tr><td style="padding: 6px 0; color: #64748B;">Local:</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right;">${escaparHtml(local)}</td></tr>` : ""}
      </table>

      <div style="border-left: 4px solid ${s.accentColor}; padding-left: 16px; margin-bottom: 28px;">
        <h4 style="margin: 0 0 6px; font-size: 14px; color: ${s.primaryColor};">Instruções para o dia:</h4>
        <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #475569; line-height: 1.6;">
          <li>Chegue com pelo menos 20 minutos de antecedência;</li>
          <li>Mantenha o brilho da tela alto ao aproximar do leitor;</li>
          <li>Se preferir, imprima este e-mail.</li>
        </ul>
      </div>

      ${botao(s, s.siteUrl, "Acessar página do evento")}`;

    return this.enviar(
      s,
      {
        to: params.to,
        subject: `Comprovante de Inscrição — ${evento.name}`,
        html: montarEmail({
          settings: s, eventName: evento.name,
          eyebrow: "CONFIRMAÇÃO DE VAGA", subtitle: "COMPROVANTE OFICIAL DE INSCRIÇÃO",
          body: corpo,
        }),
        attachments: [{ filename: "qrcode.png", content: qrPng, contentId: "qrcode" }],
        tags: [{ name: "tipo", value: "comprovante-inscricao" }, { name: "evento", value: tagSegura(evento.id) }],
      },
      chaveDeIdempotencia("receipt", params.inscriptionId, opcoes.reenvio),
    );
  }

  /** Certificado de participação, em anexo. */
  async sendCertificate(
    evento: EventoParaEmail,
    params: SendCertificateEmailParams,
    opcoes: { reenvio?: boolean } = {},
  ): Promise<ResultadoDoEnvio> {
    const s = this.configuracao(evento);

    const corpo = `
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Parabéns, <strong>${escaparHtml(params.participantName)}</strong>!
      </p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px; color: #475569;">
        Seu <strong>certificado oficial de participação</strong> está pronto e segue em anexo, em PDF.
      </p>
      ${params.workloadHours ? `<p style="font-size: 15px; margin: 0 0 24px; color: #475569;">Carga horária registrada: <strong>${params.workloadHours} horas</strong>.</p>` : ""}
      ${botao(s, params.verificationUrl, "Validar autenticidade")}
      <p style="margin: 20px 0 0; font-size: 12px; color: #64748B; text-align: center;">
        Qualquer pessoa pode conferir a validade deste certificado pelo endereço acima.
      </p>`;

    return this.enviar(
      s,
      {
        to: params.to,
        subject: `Seu Certificado de Participação — ${evento.name}`,
        html: montarEmail({
          settings: s, eventName: evento.name,
          eyebrow: "CERTIFICADO", subtitle: "CERTIFICADO DE PARTICIPAÇÃO",
          body: corpo,
        }),
        attachments: [{ filename: nomeDeArquivo("certificado", params.participantName), content: params.certificatePdfBuffer }],
        tags: [{ name: "tipo", value: "certificado" }, { name: "evento", value: tagSegura(evento.id) }],
      },
      chaveDeIdempotencia(`cert:${params.contentHash ?? "v1"}`, params.certificateId, opcoes.reenvio),
    );
  }

  /** Comprovante de presença, em anexo. */
  async sendAttendanceProof(
    evento: EventoParaEmail,
    params: SendAttendanceProofEmailParams,
    opcoes: { reenvio?: boolean } = {},
  ): Promise<ResultadoDoEnvio> {
    const s = this.configuracao(evento);

    const quando = params.checkedInAt
      ? params.checkedInAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : null;

    const corpo = `
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Olá, <strong>${escaparHtml(params.participantName)}</strong>!
      </p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px; color: #475569;">
        Segue em anexo o seu <strong>comprovante de presença</strong> no evento, em PDF.
      </p>
      ${quando ? `<p style="font-size: 15px; margin: 0 0 24px; color: #475569;">Presença registrada em <strong>${quando}</strong>.</p>` : ""}
      <p style="font-size: 13px; margin: 0 0 24px; color: #64748B;">
        O comprovante de presença atesta o seu check-in. Ele é diferente do
        certificado de participação, que depende dos critérios do evento.
      </p>
      ${botao(s, s.siteUrl, "Acessar página do evento")}`;

    return this.enviar(
      s,
      {
        to: params.to,
        subject: `Comprovante de Presença — ${evento.name}`,
        html: montarEmail({
          settings: s, eventName: evento.name,
          eyebrow: "PRESENÇA CONFIRMADA", subtitle: "COMPROVANTE DE PRESENÇA",
          body: corpo,
        }),
        attachments: [{ filename: nomeDeArquivo("comprovante-presenca", params.participantName), content: params.proofPdfBuffer }],
        tags: [{ name: "tipo", value: "comprovante-presenca" }, { name: "evento", value: tagSegura(evento.id) }],
      },
      chaveDeIdempotencia("proof", `${evento.id}:${params.participantId}`, opcoes.reenvio),
    );
  }
}

/**
 * A chave de idempotência.
 *
 * Estável para o envio automático — repetir o mesmo webhook não manda o
 * e-mail duas vezes. Única para reenvio pedido por alguém, senão o pedido
 * seria descartado pela própria proteção e o admin ficaria clicando num
 * botão que não faz nada.
 */
export function chaveDeIdempotencia(tipo: string, identidade: string, reenvio?: boolean): string {
  const base = `${tipo}:${identidade}`;
  if (!reenvio) return base.slice(0, 256);

  // Aleatório, e não `Date.now()`.
  //
  // O relógio tem resolução de milissegundo: dois reenvios no mesmo
  // milissegundo — que é o que um disparo em massa faz — gerariam a
  // MESMA chave, e o Resend descartaria o segundo em silêncio. O teste
  // pegou isso; o relógio parecia único e não é.
  //
  // O sufixo entra ANTES do corte para nunca ser o que se perde quando
  // a identidade é longa.
  const sufixo = randomUUID();
  return `${sufixo}:${base}`.slice(0, 256);
}

/** Tags do Resend só aceitam letras ASCII, números, `_` e `-`. */
function tagSegura(valor: string): string {
  return valor.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 256);
}

function nomeDeArquivo(prefixo: string, nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefixo}-${limpo || "participante"}.pdf`;
}

export const emailService = new EmailService();
