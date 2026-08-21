import { z } from "zod";

/**
 * Configuração do certificado/comprovante de um evento — mesmo princípio
 * de apps/backend/src/modules/events/site-content.ts: JSON livre em
 * Event.certificateSettings, campo ausente cai no fallback abaixo. Nada
 * disso fica hardcoded no template (ver certificate-template.ts) — nome,
 * data e local do evento sempre vêm de Event (nunca daqui), carga horária
 * e texto/signatários vêm daqui, com os valores do evento COPOL real como
 * padrão (evento existente continua funcionando sem reconfiguração).
 */
export const signatorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(200),
});

const hexColor = z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida — use o formato #RRGGBB");

export const certificateSettingsSchema = z.object({
  // Carga horária total exibida no certificado.
  workloadHours: z.coerce.number().int().min(1).max(1000).optional(),

  // Texto de fechamento do parágrafo descritivo, depois da frase com
  // nome/local/data/carga horária (montada dinamicamente, nunca aqui).
  closingText: z.string().trim().max(600).optional(),

  // Local exibido no chip de data do certificado (ex.: "Londrina/PR") —
  // pode ser mais curto/diferente do Event.location completo.
  locationLabel: z.string().trim().max(120).optional(),

  signatories: z.array(signatorySchema).max(3).optional(),

  // Chave do asset de fundo em apps/backend/assets/certificates/ — permite
  // no futuro outro evento usar outro template sem mudar código.
  templateAssetKey: z.string().trim().max(60).optional(),

  // Cor de destaque (nome do participante, nome do evento em negrito,
  // título do chip de data, nomes dos signatários) — era um teal fixo
  // (#044544) no código; agora configurável por evento.
  primaryColor: hexColor.optional(),

  // Cor do corpo do texto (parágrafo descritivo, local do chip de data,
  // cargo dos signatários) — era um cinza-escuro fixo (#1A1A1A).
  textColor: hexColor.optional(),
});

export type CertificateSettings = z.infer<typeof certificateSettingsSchema>;
type ResolvedCertificateSettings = Required<CertificateSettings>;

export const DEFAULT_CERTIFICATE_SETTINGS: ResolvedCertificateSettings = {
  workloadHours: 16,
  closingText: "O evento proporcionou atualização científica e integração entre profissionais e acadêmicos da odontologia.",
  locationLabel: "Londrina/PR",
  signatories: [
    { name: "Gustavo Nascimento De Souza Pinto", role: "Coordenador do Evento" },
    { name: "Pablo Guilherme Caldarelli", role: "Coordenador Geral do Campus Coordenador do Curso de Odontologia" },
    { name: "Amanda Vessoni Barbosa Kasuya", role: "Coordenador Adjunta do Curso de Odontologia." },
  ],
  templateAssetKey: "copol-2026",
  // Mesmas cores que já estavam fixas em certificate-template.ts (TEAL/INK)
  // — evento existente continua idêntico até alguém trocar pela UI.
  primaryColor: "#044544",
  textColor: "#1A1A1A",
};

export function resolveCertificateSettings(stored: unknown): ResolvedCertificateSettings {
  const parsed = certificateSettingsSchema.safeParse(stored ?? {});
  const content = parsed.success ? parsed.data : {};
  return {
    workloadHours: content.workloadHours || DEFAULT_CERTIFICATE_SETTINGS.workloadHours,
    closingText: content.closingText || DEFAULT_CERTIFICATE_SETTINGS.closingText,
    locationLabel: content.locationLabel || DEFAULT_CERTIFICATE_SETTINGS.locationLabel,
    signatories:
      content.signatories && content.signatories.length > 0 ? content.signatories : DEFAULT_CERTIFICATE_SETTINGS.signatories,
    templateAssetKey: content.templateAssetKey || DEFAULT_CERTIFICATE_SETTINGS.templateAssetKey,
    primaryColor: content.primaryColor || DEFAULT_CERTIFICATE_SETTINGS.primaryColor,
    textColor: content.textColor || DEFAULT_CERTIFICATE_SETTINGS.textColor,
  };
}
