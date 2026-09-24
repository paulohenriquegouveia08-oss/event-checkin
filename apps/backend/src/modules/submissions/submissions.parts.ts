import { ValidationError } from "../../shared/errors.js";

/**
 * Arquivo do trabalho enviado em partes, pelo site.
 *
 * O site do COPOL chega à API por um proxy HTTPS que recusa corpo acima de
 * 1 MB — e o 413 dele vem sem CORS, então o navegador do autor mostra só
 * "Failed to fetch". Um PDF com figuras passa disso fácil. Em vez de
 * depender da configuração de um servidor que não está neste repositório,
 * o site manda o arquivo em pedaços pequenos e o envio final só aponta
 * para eles pelo `uploadId`.
 *
 * Fica em memória: é um trânsito de segundos entre a primeira parte e o
 * envio do formulário. Se o backend reiniciar no meio, o autor envia de
 * novo. Os tetos abaixo impedem que isto vire um jeito de encher a memória.
 */

/** Tempo para o formulário ser enviado depois da última parte recebida. */
const VALIDADE_MS = 30 * 60 * 1000;

/** Soma de tudo que está em trânsito, de todos os autores. */
const TETO_EM_TRANSITO_BYTES = 256 * 1024 * 1024;

/** O site manda ~525 KB por parte; a folga cobre outro cliente. */
export const TAMANHO_MAX_PARTE_BYTES = 768 * 1024;

interface EnvioEmPartes {
  eventId: string;
  total: number;
  partes: Buffer[];
  bytes: number;
  atualizadoEm: number;
}

const envios = new Map<string, EnvioEmPartes>();

function limparVencidos(agora = Date.now()) {
  for (const [id, envio] of envios) {
    if (agora - envio.atualizadoEm > VALIDADE_MS) envios.delete(id);
  }
}

function bytesEmTransito(): number {
  let total = 0;
  for (const envio of envios.values()) total += envio.bytes;
  return total;
}

const PERDIDO =
  "O envio do arquivo foi interrompido ou demorou demais. Envie o trabalho de novo.";

/**
 * Guarda uma parte. As partes chegam em ordem — o site manda uma de cada
 * vez — e reenviar a última (a resposta se perdeu na rede) troca em vez de
 * duplicar. A parte 0 sempre recomeça o envio.
 */
export function receberParte(params: {
  eventId: string;
  uploadId: string;
  index: number;
  total: number;
  dados: Buffer;
  limiteBytes: number;
  limiteMb: number;
}): { recebidas: number; total: number } {
  const { eventId, uploadId, index, total, dados, limiteBytes, limiteMb } = params;
  limparVencidos();

  if (dados.length === 0) throw new ValidationError("Parte do arquivo vazia.");
  if (dados.length > TAMANHO_MAX_PARTE_BYTES) {
    throw new ValidationError("Parte do arquivo maior que o permitido.");
  }

  let envio = envios.get(uploadId);
  if (index === 0) {
    if (envio) envios.delete(uploadId);
    envio = { eventId, total, partes: [], bytes: 0, atualizadoEm: Date.now() };
  }
  if (!envio || envio.eventId !== eventId || envio.total !== total) {
    throw new ValidationError(PERDIDO);
  }

  let substituida = 0;
  if (index === envio.partes.length - 1) {
    substituida = envio.partes[index].length;
  } else if (index !== envio.partes.length) {
    throw new ValidationError(PERDIDO);
  }

  const bytes = envio.bytes - substituida + dados.length;
  if (bytes > limiteBytes) {
    envios.delete(uploadId);
    throw new ValidationError(`Arquivo muito grande — o limite deste evento é ${limiteMb} MB.`);
  }
  const outros = bytesEmTransito() - (envios.has(uploadId) ? envio.bytes : 0);
  if (outros + bytes > TETO_EM_TRANSITO_BYTES) {
    throw new ValidationError(
      "Muitos arquivos sendo enviados agora. Aguarde alguns minutos e tente de novo."
    );
  }

  envio.partes[index] = dados;
  envio.bytes = bytes;
  envio.atualizadoEm = Date.now();
  envios.set(uploadId, envio);
  return { recebidas: envio.partes.length, total };
}

/**
 * Junta as partes e as tira da memória. Consome: se o formulário voltar
 * com erro, o site gera outro `uploadId` e manda o arquivo de novo.
 */
export function retirarArquivo(eventId: string, uploadId: string): Buffer {
  limparVencidos();
  const envio = envios.get(uploadId);
  if (!envio || envio.eventId !== eventId || envio.partes.length !== envio.total) {
    throw new ValidationError(PERDIDO);
  }
  envios.delete(uploadId);
  return Buffer.concat(envio.partes);
}
