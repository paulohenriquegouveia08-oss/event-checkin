import { Resend } from "resend";
import QRCode from "qrcode";
import { env } from "../../config/env.js";

export interface SendReceiptEmailParams {
  to: string;
  participantName: string;
  eventName: string;
  inscriptionId: string;
  batchName: string;
  amount: number;
  qrToken: string;
  eventStartDate?: string;
  eventLocation?: string | null;
}

export interface SendCertificateEmailParams {
  to: string;
  participantName: string;
  eventName: string;
  workloadHours?: number | null;
  certificatePdfBuffer: Buffer;
  verificationUrl: string;
}

export class EmailService {
  private resend: Resend | null = null;

  constructor() {
    if (env.RESEND_API_KEY) {
      this.resend = new Resend(env.RESEND_API_KEY);
    }
  }

  /**
   * Envia o Comprovante de Inscrição Oficial com o QR Code de Check-in embutido.
   */
  async sendRegistrationReceipt(params: SendReceiptEmailParams): Promise<{ success: boolean; id?: string }> {
    // Gera o QR Code em Base64 Data URL para exibição direta no corpo do e-mail
    const qrDataUrl = await QRCode.toDataURL(params.qrToken, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 280,
      color: {
        dark: "#0E3634",
        light: "#FFFFFF",
      },
    });

    const formattedAmount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(params.amount);
    const currentDate = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprovante de Inscrição — ${params.eventName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #E2E8F0;">
          
          <!-- Topo com Identidade do Evento -->
          <tr>
            <td style="background: linear-gradient(135deg, #0E3634 0%, #175451 100%); padding: 36px 32px; text-align: center; color: #FFFFFF;">
              <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #C8A261; font-weight: 700; margin-bottom: 8px;">
                CONFIRMAÇÃO DE VAGA
              </div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; line-height: 1.2;">
                ${params.eventName}
              </h1>
              <p style="margin: 10px 0 0; color: #E2E8F0; font-size: 14px;">
                COMPROVANTE OFICIAL DE INSCRIÇÃO
              </p>
            </td>
          </tr>

          <!-- Corpo do Comprovante -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Olá, <strong>${params.participantName}</strong>!
              </p>
              <p style="font-size: 15px; line-height: 1.6; margin: 0 0 28px; color: #475569;">
                Seu pagamento foi aprovado com sucesso e sua inscrição está <strong>100% confirmada</strong>.
              </p>

              <!-- Bloco Destaque: QR Code de Entrada -->
              <table role="presentation" width="100%" style="background-color: #F0FDF4; border: 2px dashed #86EFAC; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <span style="background-color: #22C55E; color: #FFFFFF; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; text-transform: uppercase; letter-spacing: 1px;">
                      SEU ACESSO AO EVENTO
                    </span>
                    <h3 style="margin: 14px 0 6px; font-size: 18px; color: #0E3634;">
                      QR Code para Check-in
                    </h3>
                    <p style="margin: 0 0 16px; font-size: 13px; color: #166534;">
                      Apresente este código na tela do seu celular no terminal de entrada:
                    </p>
                    <div style="background-color: #FFFFFF; padding: 12px; border-radius: 12px; display: inline-block; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                      <img src="${qrDataUrl}" alt="QR Code de Check-in" width="220" height="220" style="display: block; border-radius: 6px;" />
                    </div>
                    <p style="margin: 12px 0 0; font-family: monospace; font-size: 12px; color: #64748B;">
                      Código único: ${params.qrToken.slice(0, 12)}...
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Detalhes da Inscrição -->
              <table role="presentation" width="100%" style="background-color: #F8FAFC; border-radius: 12px; border: 1px solid #E2E8F0; padding: 18px; font-size: 14px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748B;">Identificador:</td>
                  <td style="padding: 6px 0; font-weight: 700; text-align: right; font-family: monospace;">${params.inscriptionId}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748B;">Lote:</td>
                  <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #0E3634;">${params.batchName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748B;">Valor Pago:</td>
                  <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #16A34A;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748B;">Status:</td>
                  <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #16A34A;">✓ PAGO / CONFIRMADO</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748B;">Data da Confirmação:</td>
                  <td style="padding: 6px 0; font-weight: 600; text-align: right;">${currentDate}</td>
                </tr>
                ${params.eventLocation ? `
                <tr>
                  <td style="padding: 6px 0; color: #64748B;">Local:</td>
                  <td style="padding: 6px 0; font-weight: 600; text-align: right;">${params.eventLocation}</td>
                </tr>` : ""}
              </table>

              <!-- Dicas Importantes -->
              <div style="border-left: 4px solid #C8A261; padding-left: 16px; margin-bottom: 28px;">
                <h4 style="margin: 0 0 6px; font-size: 14px; color: #0E3634;">Instruções para o Dia:</h4>
                <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #475569; line-height: 1.6;">
                  <li>Chegue com pelo menos 20 minutos de antecedência;</li>
                  <li>Mantenha o brilho da tela do celular alto ao aproximar do leitor Elgin M10 Pro;</li>
                  <li>Caso prefira, você também pode imprimir este e-mail.</li>
                </ul>
              </div>

              <!-- Botão Acessar Portal -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${env.PRE_COPOL_BASE_URL}" target="_blank" style="display: inline-block; background-color: #0E3634; color: #FFFFFF; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 8px rgba(14, 54, 52, 0.25);">
                      Acessar Página do Evento
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color: #F1F5F9; padding: 20px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0;">
              Este é um e-mail oficial gerado pelo sistema de credenciamento do ${params.eventName}.<br>
              Por favor, guarde esta mensagem como comprovante.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    if (!this.resend) {
      console.log(`[EmailService:MOCK] Comprovante enviado para ${params.to} (Inscrição ${params.inscriptionId})`);
      return { success: true, id: "mock-receipt-id" };
    }

    const { data, error } = await this.resend.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: `Comprovante de Inscrição — ${params.eventName}`,
      html: htmlContent,
    });

    if (error) {
      console.error("[EmailService] Erro no Resend ao enviar comprovante:", error);
      return { success: false };
    }

    return { success: true, id: data?.id };
  }

  /**
   * Envia o Certificado de Participação com o PDF anexado.
   */
  async sendCertificate(params: SendCertificateEmailParams): Promise<{ success: boolean; id?: string }> {
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Certificado de Participação</title></head>
<body style="font-family: sans-serif; background-color: #F8FAFC; padding: 32px 16px; color: #1E293B;">
  <div style="max-width: 600px; margin: 0 auto; background: #FFF; border-radius: 12px; padding: 32px; border: 1px solid #E2E8F0;">
    <h2 style="color: #0E3634; margin-top: 0;">Parabéns, ${params.participantName}!</h2>
    <p>O seu <strong>Certificado Oficial de Participação</strong> no <strong>${params.eventName}</strong> está pronto e disponível.</p>
    ${params.workloadHours ? `<p>Carga horária registrada: <strong>${params.workloadHours} horas</strong>.</p>` : ""}
    <p>Enviamos o arquivo oficial em PDF em anexo a esta mensagem.</p>
    <p style="margin-top: 24px;">
      <a href="${params.verificationUrl}" style="background-color: #0E3634; color: #FFF; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
        Validar Autenticidade do Certificado
      </a>
    </p>
  </div>
</body>
</html>
    `.trim();

    if (!this.resend) {
      console.log(`[EmailService:MOCK] Certificado enviado para ${params.to}`);
      return { success: true, id: "mock-cert-id" };
    }

    const { data, error } = await this.resend.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: `Seu Certificado de Participação — ${params.eventName}`,
      html: htmlContent,
      attachments: [
        {
          filename: `certificado-${params.participantName.toLowerCase().replace(/\s+/g, "-")}.pdf`,
          content: params.certificatePdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("[EmailService] Erro no Resend ao enviar certificado:", error);
      return { success: false };
    }

    return { success: true, id: data?.id };
  }
}

export const emailService = new EmailService();
