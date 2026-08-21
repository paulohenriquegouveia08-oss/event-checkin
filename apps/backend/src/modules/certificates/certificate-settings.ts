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

/**
 * Chaves de valores dinâmicos que podem aparecer dentro do parágrafo
 * descritivo — cada um vira um "chip" protegido no editor de texto rico
 * do admin (RichTextEditor.tsx), porque o valor real só existe na hora de
 * gerar o PDF de cada participante (nunca é texto livre editável).
 */
export const paragraphTokenKeySchema = z.enum(["eventName", "locationLabel", "eventDateRange", "workloadHours"]);
export type ParagraphTokenKey = z.infer<typeof paragraphTokenKeySchema>;

const segmentStyle = {
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  // Ausente = usa textColor do certificado (ver resolveCertificateSettings).
  color: hexColor.optional(),
};

export const paragraphSegmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(2000), ...segmentStyle }),
  z.object({ type: z.literal("token"), key: paragraphTokenKeySchema, ...segmentStyle }),
]);
export type ParagraphSegment = z.infer<typeof paragraphSegmentSchema>;

export const certificateSettingsSchema = z.object({
  // Carga horária total exibida no certificado (chip de data e token
  // {workloadHours} no parágrafo).
  workloadHours: z.coerce.number().int().min(1).max(1000).optional(),

  // Campo antigo, mantido só pra migração de eventos que ainda não têm
  // paragraphSegments — ver buildDefaultParagraphSegments() abaixo. Não é
  // mais usado diretamente pra renderizar o PDF.
  closingText: z.string().trim().max(600).optional(),

  // Local exibido no chip de data do certificado (ex.: "Londrina/PR") e
  // no token {locationLabel} do parágrafo — pode ser mais curto/diferente
  // do Event.location completo.
  locationLabel: z.string().trim().max(120).optional(),

  signatories: z.array(signatorySchema).max(3).optional(),

  // Chave do asset de fundo em apps/backend/assets/certificates/ — permite
  // no futuro outro evento usar outro template sem mudar código.
  templateAssetKey: z.string().trim().max(60).optional(),

  // Cor de destaque (nome do participante, título do chip de data, nomes
  // dos signatários, e cor padrão de qualquer token no parágrafo) — era
  // um teal fixo (#044544) no código; agora configurável por evento.
  primaryColor: hexColor.optional(),

  // Cor padrão do corpo do texto (chip de data, cargo dos signatários, e
  // cor padrão de qualquer trecho de texto no parágrafo sem cor própria)
  // — era um cinza-escuro fixo (#1A1A1A).
  textColor: hexColor.optional(),

  // O parágrafo descritivo inteiro ("Participou do evento X, realizado em
  // Y..."), como uma sequência de trechos de texto livre + tokens
  // dinâmicos, cada um com negrito/itálico/cor próprios — editado pelo
  // RichTextEditor na aba Certificados. Ausente (evento criado antes
  // dessa feature) = sintetiza a partir de workloadHours/locationLabel/
  // closingText, reproduzindo exatamente o texto fixo que sempre existiu.
  paragraphSegments: z.array(paragraphSegmentSchema).max(120).optional(),
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
  paragraphSegments: buildDefaultParagraphSegments(
    "#044544",
    "O evento proporcionou atualização científica e integração entre profissionais e acadêmicos da odontologia."
  ),
};

/** Reproduz, como segmentos, o parágrafo que sempre foi montado na unha
 * em certificate-template.ts ("Participou do {evento}, realizado em
 * {local}, nos dias {datas}, com carga horária total de {horas} horas.
 * {texto de fechamento}"). Usado como fallback pra qualquer evento sem
 * paragraphSegments salvo — nunca perde a customização de closingText que
 * já existia. */
function buildDefaultParagraphSegments(primaryColor: string, closingText: string): ParagraphSegment[] {
  return [
    { type: "text", text: "Participou do " },
    { type: "token", key: "eventName", bold: true, color: primaryColor },
    { type: "text", text: ", realizado em " },
    { type: "token", key: "locationLabel" },
    { type: "text", text: ", nos dias " },
    { type: "token", key: "eventDateRange" },
    { type: "text", text: ", com carga horária total de " },
    { type: "token", key: "workloadHours" },
    { type: "text", text: " horas. " },
    { type: "text", text: closingText },
  ];
}

export function resolveCertificateSettings(stored: unknown): ResolvedCertificateSettings {
  const parsed = certificateSettingsSchema.safeParse(stored ?? {});
  const content = parsed.success ? parsed.data : {};
  const primaryColor = content.primaryColor || DEFAULT_CERTIFICATE_SETTINGS.primaryColor;
  const closingText = content.closingText || DEFAULT_CERTIFICATE_SETTINGS.closingText;
  return {
    workloadHours: content.workloadHours || DEFAULT_CERTIFICATE_SETTINGS.workloadHours,
    closingText,
    locationLabel: content.locationLabel || DEFAULT_CERTIFICATE_SETTINGS.locationLabel,
    signatories:
      content.signatories && content.signatories.length > 0 ? content.signatories : DEFAULT_CERTIFICATE_SETTINGS.signatories,
    templateAssetKey: content.templateAssetKey || DEFAULT_CERTIFICATE_SETTINGS.templateAssetKey,
    primaryColor,
    textColor: content.textColor || DEFAULT_CERTIFICATE_SETTINGS.textColor,
    paragraphSegments:
      content.paragraphSegments && content.paragraphSegments.length > 0
        ? content.paragraphSegments
        : buildDefaultParagraphSegments(primaryColor, closingText),
  };
}
