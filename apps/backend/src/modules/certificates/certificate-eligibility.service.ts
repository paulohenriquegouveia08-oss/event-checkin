import type { CertificateStatus, Event } from "@prisma/client";
import { hasEventEnded } from "../../shared/br-date.js";

export type EligibilityReason = "EVENT_NOT_ENDED" | "NOT_PRESENT";

export interface EligibilityResult {
  eligible: boolean;
  reason: EligibilityReason | null;
}

/**
 * Única fonte de verdade sobre "esta pessoa pode ter um certificado?" —
 * nunca replicar esta regra no frontend (admin/attendee), sempre consultar
 * este serviço no backend. Hoje a regra é exatamente a pedida:
 *
 *   eventEnded === true AND existe um CheckIn para (eventId, participantId)
 *
 * Ponto de extensão pra regras futuras (presença mínima em múltiplos dias,
 * percentual de participação, aprovação manual etc.): adicionar um novo
 * critério aqui dentro de isEligible(), sem mudar a assinatura pública nem
 * nenhum chamador — certificates.service.ts só chama isEligible() e reage
 * ao resultado, não decide sozinho quais critérios existem.
 */
export function isEligible(params: { event: Pick<Event, "endDate">; hasCheckIn: boolean; now?: Date }): EligibilityResult {
  const { event, hasCheckIn, now } = params;

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
