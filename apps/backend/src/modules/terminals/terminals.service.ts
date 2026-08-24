import { NotFoundError, UnauthorizedError } from "../../shared/errors.js";
import { generateActivationCode } from "../../shared/tokens.js";
import { getEventOrThrow } from "../events/events.service.js";
import * as terminalsRepository from "./terminals.repository.js";

const ACTIVATION_CODE_TTL_HOURS = 72;
const MAX_IDENTIFIER_ATTEMPTS = 5;

/** Próximo número livre da sequência TERM-NNN.
 *
 * Derivado do MAIOR sufixo já existente, não da quantidade de linhas.
 * Com a contagem, apagar um terminal do meio da sequência deixava um
 * buraco e o próximo identificador calculado colidia com um que já
 * existia — permanentemente, porque a função era determinística: as
 * MAX_IDENTIFIER_ATTEMPTS tentativas de retry recalculavam exatamente
 * o mesmo valor, todas batiam no unique de `identifier` (P2002) e a
 * criação terminava em 500. Cenário real que quebrou:
 *
 *   existentes: TERM-001, TERM-003, TERM-004, TERM-005  (TERM-002 apagado)
 *   count = 4  →  "TERM-005"  →  já existe  →  colisão em todo retry
 *
 * Pelo maior sufixo (005) o próximo é 006, e buracos deixados por
 * exclusões simplesmente não são reaproveitados — o que também é mais
 * seguro: reciclar um identificador faria um terminal novo herdar a
 * identidade visual de um que foi removido.
 */
async function nextIdentifierNumber(): Promise<number> {
  const rows = await terminalsRepository.listTerminalIdentifiers();
  let highest = 0;
  for (const { identifier } of rows) {
    // Comparação numérica, não lexicográfica: "TERM-1000" < "TERM-999"
    // como string, o que escolheria o maior errado a partir do milésimo.
    const match = /^TERM-(\d+)$/.exec(identifier);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}

function formatIdentifier(sequence: number): string {
  return `TERM-${String(sequence).padStart(3, "0")}`;
}

export async function createTerminal(eventId: string, name: string) {
  await getEventOrThrow(eventId);

  const activationCode = generateActivationCode();
  const activationCodeExpiresAt = new Date(Date.now() + ACTIVATION_CODE_TTL_HOURS * 60 * 60 * 1000);

  let sequence = await nextIdentifierNumber();

  for (let attempt = 0; attempt < MAX_IDENTIFIER_ATTEMPTS; attempt++) {
    try {
      return await terminalsRepository.createTerminal({
        eventId,
        name,
        identifier: formatIdentifier(sequence),
        activationCode,
        activationCodeExpiresAt,
      });
    } catch (error) {
      // Só faz sentido tentar de novo quando o conflito foi no
      // `identifier`. `activationCode` também é unique, mas é aleatório
      // — repetir a mesma tentativa não resolveria nada e mascararia o
      // problema real.
      const err = error as { code?: string; meta?: { target?: string[] } };
      const isIdentifierConflict =
        err.code === "P2002" && (err.meta?.target ?? []).includes("identifier");
      if (!isIdentifierConflict || attempt === MAX_IDENTIFIER_ATTEMPTS - 1) throw error;
      // Avança de verdade antes de repetir: sob concorrência outro
      // request pode ter acabado de levar este número. Sem o ++, a
      // tentativa seguinte repetiria o mesmo identificador — que foi
      // exatamente o que transformou uma colisão recuperável num 500.
      sequence++;
    }
  }
  throw new Error("Não foi possível gerar um identificador de terminal único");
}

export async function listTerminals(eventId: string) {
  await getEventOrThrow(eventId);
  return terminalsRepository.listTerminalsByEvent(eventId);
}

export async function getTerminalStatus(terminalId: string) {
  const terminal = await terminalsRepository.findTerminalById(terminalId);
  if (!terminal) {
    throw new NotFoundError("Terminal não encontrado");
  }
  return terminal;
}

/** Valida o código de ativação (existe, não expirou, ainda não foi usado). */
export async function validateActivationCode(activationCode: string) {
  const terminal = await terminalsRepository.findTerminalByActivationCode(activationCode);
  if (!terminal) {
    throw new UnauthorizedError("Código de ativação inválido");
  }
  if (terminal.status !== "PENDING") {
    throw new UnauthorizedError("Este terminal já foi ativado");
  }
  if (!terminal.activationCodeExpiresAt || terminal.activationCodeExpiresAt < new Date()) {
    throw new UnauthorizedError("Código de ativação expirado");
  }
  return terminal;
}

export async function finalizeActivation(terminalId: string, credentialHash: string) {
  return terminalsRepository.activateTerminal(terminalId, credentialHash);
}

/** Exclui o terminal. A partir daqui, qualquer requisição vinda do
 * aparelho (sync ou check-in) recebe 401 do middleware requireTerminal —
 * o app do terminal detecta isso e se desconecta sozinho (ver
 * apps/mobile/src/services/api/client.ts). */
export async function deleteTerminal(eventId: string, terminalId: string) {
  const terminal = await terminalsRepository.findTerminalByIdAndEvent(eventId, terminalId);
  if (!terminal) {
    throw new NotFoundError("Terminal não encontrado");
  }
  await terminalsRepository.deleteTerminal(terminalId);
}
