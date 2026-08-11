import { NotFoundError, UnauthorizedError } from "../../shared/errors.js";
import { generateActivationCode } from "../../shared/tokens.js";
import { getEventOrThrow } from "../events/events.service.js";
import * as terminalsRepository from "./terminals.repository.js";

const ACTIVATION_CODE_TTL_HOURS = 72;
const MAX_IDENTIFIER_ATTEMPTS = 5;

async function nextIdentifier(): Promise<string> {
  // Sequencial simples (TERM-001, TERM-002, ...) com retry em caso de
  // colisão sob concorrência — criação de terminal é uma operação rara
  // e feita por admin, então uma sequência real (tabela dedicada) seria
  // overengineering para o volume esperado.
  const count = await terminalsRepository.countTerminals();
  return `TERM-${String(count + 1).padStart(3, "0")}`;
}

export async function createTerminal(eventId: string, name: string) {
  await getEventOrThrow(eventId);

  const activationCode = generateActivationCode();
  const activationCodeExpiresAt = new Date(Date.now() + ACTIVATION_CODE_TTL_HOURS * 60 * 60 * 1000);

  for (let attempt = 0; attempt < MAX_IDENTIFIER_ATTEMPTS; attempt++) {
    const identifier = await nextIdentifier();
    try {
      return await terminalsRepository.createTerminal({
        eventId,
        name,
        identifier,
        activationCode,
        activationCodeExpiresAt,
      });
    } catch (error) {
      const isUniqueConflict = (error as { code?: string }).code === "P2002";
      if (!isUniqueConflict || attempt === MAX_IDENTIFIER_ATTEMPTS - 1) throw error;
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
