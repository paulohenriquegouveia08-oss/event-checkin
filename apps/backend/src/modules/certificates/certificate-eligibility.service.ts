import type { CertificateStatus, Event } from "@prisma/client";
import { hasEventEnded } from "../../shared/br-date.js";

export type EligibilityReason = "EVENT_NOT_ENDED" | "NOT_PRESENT";

export interface EligibilityResult {
  eligible: boolean;
  reason: EligibilityReason | null;
  /** True quando a elegibilidade veio de uma liberação manual do admin,
   * e não da regra automática. Só serve para a UI do admin distinguir
   * "liberado na mão" de "liberado pelo fluxo normal" — o participante
   * não vê diferença nenhuma. */
  manual?: boolean;
}

/**
 * Única fonte de verdade sobre "esta pessoa pode ter um certificado?" —
 * nunca replicar esta regra no frontend (admin/attendee), sempre consultar
 * este serviço no backend. Hoje a regra é exatamente a pedida:
 *
 *   eventEnded === true AND existe um CheckIn para (eventId, participantId)
 *
 * Ponto de extensão pra regras futuras (presença mínima em múltiplos dias,
 * percentual de participação etc.): adicionar um novo critério aqui dentro
 * de isEligible(), sem mudar a assinatura pública nem nenhum chamador —
 * certificates.service.ts só chama isEligible() e reage ao resultado, não
 * decide sozinho quais critérios existem.
 *
 * `manuallyReleased` é o primeiro desses critérios adicionais: quando o
 * admin libera o certificado de alguém na mão (Certificate.manuallyReleasedAt),
 * isso ATROPELA a regra automática — é justamente o caso em que ela não
 * cobre a realidade: a pessoa participou mas o check-in não foi
 * registrado, o terminal falhou, o evento ainda não encerrou formalmente.
 * Como o critério mora aqui, todo o resto do sistema (download do
 * participante, /my-documents, status no painel) passa a respeitá-lo sem
 * nenhuma alteração adicional.
 */
export function isEligible(params: {
  event: Pick<Event, "endDate">;
  hasCheckIn: boolean;
  manuallyReleased?: boolean;
  now?: Date;
}): EligibilityResult {
  const { event, hasCheckIn, manuallyReleased, now } = params;

  // Verificado antes das demais regras: uma liberação manual existe
  // exatamente para os casos que elas reprovariam.
  if (manuallyReleased) {
    return { eligible: true, reason: null, manual: true };
  }
  if (!hasEventEnded(event.endDate, now)) {
    return { eligible: false, reason: "EVENT_NOT_ENDED" };
  }
  if (!hasCheckIn) {
    return { eligible: false, reason: "NOT_PRESENT" };
  }
  return { eligible: true, reason: null };
}

/** Deriva o status "de exibição" (o enum do banco) a partir da elegibilidade
 * calculada + do estado já persistido do certificado. O status persistido
 * nunca regride sozinho (GENERATED/REVOKED são estados terminais definidos
 * por uma ação explícita — gerar ou revogar), mas LOCKED/ELIGIBLE são
 * sempre recalculados na hora, então mudam de LOCKED pra ELIGIBLE
 * automaticamente assim que o evento termina, sem precisar de um job. */
export function resolveDisplayStatus(params: {
  eligibility: EligibilityResult;
  persistedStatus: CertificateStatus | null;
}): CertificateStatus {
  const { eligibility, persistedStatus } = params;
  if (persistedStatus === "REVOKED") return "REVOKED";
  if (persistedStatus === "GENERATED") return "GENERATED";
  return eligibility.eligible ? "ELIGIBLE" : "LOCKED";
}
