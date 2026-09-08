import { z } from "zod";
import { env } from "../../config/env.js";

/**
 * Configuração de e-mail de um evento — mesmo princípio de
 * certificate-settings.ts e site-content.ts: JSON livre em
 * Event.emailSettings, campo ausente cai no fallback abaixo.
 *
 * Existe porque os e-mails eram do COPOL, e só dele: a paleta verde/dourada,
 * o endereço do site e o remetente estavam escritos no HTML e no env. Um
 * segundo evento — a Semantix — receberia o comprovante dele com a marca do
 * COPOL e um botão levando ao site do COPOL.
 *
 * Os padrões são os valores reais do COPOL de propósito, pela mesma razão
 * do certificado: o evento que já existe continua funcionando sem ninguém
 * precisar reconfigurar nada.
 */

const hexColor = z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida — use o formato #RRGGBB");

/**
 * O remetente precisa ser de um domínio VERIFICADO no Resend.
 *
 * Não é detalhe de configuração: o Resend recusa o envio se o domínio do
 * `from` não estiver verificado na conta. Por isso o campo é validado aqui
 * e o erro é explicado na hora de salvar, e não descoberto no dia do
 * evento quando ninguém recebe o comprovante.
 */
export const emailSettingsSchema = z.object({
  /** Nome que aparece como remetente. Ex.: "Semantix 2026". */
  fromName: z.string().trim().min(1).max(80).optional(),

  /** Endereço remetente. O domínio precisa estar verificado no Resend. */
  fromEmail: z.string().trim().email().max(160).optional(),

  /**
   * Para onde vai a resposta de quem apertar "responder".
   *
   * Separado do remetente porque o remetente costuma ser um endereço que
   * ninguém lê ("nao-responda@"), e uma dúvida sobre inscrição precisa
   * chegar a alguém.
   */
  replyTo: z.string().trim().email().max(160).optional(),

  /** Cor do cabeçalho e dos botões. */
  primaryColor: hexColor.optional(),
  /** Cor de destaque sobre o cabeçalho (etiquetas, linhas finas). */
  accentColor: hexColor.optional(),

  /** Endereço do site do evento — botão "Acessar página do evento". */
  siteUrl: z.string().trim().url().max(300).optional(),

  /** Linha final do rodapé. O nome do evento é acrescentado pelo sistema. */
  footerNote: z.string().trim().max(300).optional(),

  /**
   * Quais e-mails saem SOZINHOS.
   *
   * Desligado não impede o envio manual pelo painel — impede só o
   * automático. Um evento pode querer conferir a lista antes de disparar
   * certificado para todo mundo.
   */
  autoSendReceipt: z.boolean().optional(),
  autoSendCertificate: z.boolean().optional(),
  autoSendAttendanceProof: z.boolean().optional(),
});

export type EmailSettings = z.infer<typeof emailSettingsSchema>;

export interface ResolvedEmailSettings {
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  primaryColor: string;
  accentColor: string;
  siteUrl: string;
  footerNote: string | null;
  autoSendReceipt: boolean;
  autoSendCertificate: boolean;
  autoSendAttendanceProof: boolean;
}

/**
 * Os padrões são o COPOL — o evento que já existe e já envia e-mail.
 *
 * `EMAIL_FROM` vem do env no formato "Nome <endereco>", que é o formato do
 * Resend. É separado em duas partes aqui porque a configuração por evento
 * trata nome e endereço como campos distintos: trocar só o nome exibido é
 * a mudança mais comum, e obrigar a reescrever o endereço junto convida ao
 * erro de digitação num campo que faz o envio inteiro falhar.
 */
function remetenteDoAmbiente(): { nome: string; endereco: string } {
  const bruto = env.EMAIL_FROM.trim();
  const comNome = bruto.match(/^(.*?)\s*<([^>]+)>$/);
  if (comNome) return { nome: comNome[1]!.trim(), endereco: comNome[2]!.trim() };
  return { nome: "", endereco: bruto };
}

export function resolveEmailSettings(stored: unknown): ResolvedEmailSettings {
  const parsed = emailSettingsSchema.safeParse(stored ?? {});
  const c = parsed.success ? parsed.data : {};
  const ambiente = remetenteDoAmbiente();

  return {
    fromName: c.fromName || ambiente.nome,
    fromEmail: c.fromEmail || ambiente.endereco,
    replyTo: c.replyTo || null,
    primaryColor: c.primaryColor || "#0E3634",
    accentColor: c.accentColor || "#C8A261",
    siteUrl: c.siteUrl || env.PRE_COPOL_BASE_URL,
    footerNote: c.footerNote || null,

    // Só o comprovante de inscrição já saía sozinho, e continua saindo.
    // Certificado e comprovante de presença começam DESLIGADOS: ligar um
    // envio em massa para todo mundo sem alguém pedir seria uma decisão
    // do sistema sobre a caixa de entrada de terceiros.
    autoSendReceipt: c.autoSendReceipt ?? true,
    autoSendCertificate: c.autoSendCertificate ?? false,
    autoSendAttendanceProof: c.autoSendAttendanceProof ?? false,
  };
}

/** O remetente no formato que o Resend espera. */
export function formatarRemetente(s: ResolvedEmailSettings): string {
  return s.fromName ? `${s.fromName} <${s.fromEmail}>` : s.fromEmail;
}
