/**
 * Envelope de resposta padrão da API. Todo endpoint responde nesse formato,
 * para o cliente (app do terminal, admin) nunca precisar tratar formatos
 * diferentes de sucesso/erro.
 */
export function ok<T>(data: T) {
  return { success: true as const, data };
}

export function fail(code: string, message: string, details?: unknown) {
  return { success: false as const, error: { code, message, details } };
}
