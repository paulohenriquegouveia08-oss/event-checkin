import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../shared/errors.js";
import { fail } from "../shared/response.js";

/**
 * Handler global de erros. Garante que:
 * - erros de domínio (AppError) viram respostas HTTP previsíveis;
 * - erros de validação (Zod) viram 422 com detalhes dos campos;
 * - qualquer outro erro vira 500 genérico — nunca stack trace pro cliente.
 * Todo erro é logado (com correlação via request.id), sem dados sensíveis.
 */
export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    request.log.warn({ err: error, code: error.code, reqId: request.id }, "request_error");
    return reply.status(error.statusCode).send(fail(error.code, error.message));
  }

  if (error instanceof ZodError) {
    request.log.warn({ err: error, reqId: request.id }, "validation_error");
    return reply.status(422).send(fail("VALIDATION_ERROR", "Dados inválidos", error.flatten()));
  }

  request.log.error({ err: error, reqId: request.id }, "unhandled_error");
  return reply.status(500).send(fail("INTERNAL_ERROR", "Erro interno do servidor"));
}
