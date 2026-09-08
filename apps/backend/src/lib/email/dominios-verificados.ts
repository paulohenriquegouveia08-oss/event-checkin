import { Resend } from "resend";
import { env } from "../../config/env.js";

/**
 * Quais domínios a conta do Resend pode usar como remetente.
 *
 * Existe para transformar uma falha no dia do evento numa mensagem de erro
 * na hora de salvar. O Resend recusa com 403 qualquer envio de domínio não
 * verificado — e essa recusa só apareceria quando o primeiro participante
 * se inscrevesse, com ninguém olhando o log.
 *
 * O MODELO É UM DOMÍNIO SÓ, MUITOS EVENTOS. O credenciamento é serviço
 * prestado: quem manda o e-mail somos nós, não o evento. O cliente não precisa
 * ter domínio — o que muda por evento é o NOME EXIBIDO
 * ("Semantix 2026 <eventos@…>") e o responder-para, não o endereço.
 */

let cache: { dominios: string[]; quando: number } | null = null;

/** Cinco minutos: verificar domínio é raro, e a consulta gasta cota. */
const VALIDADE_MS = 5 * 60 * 1000;

export interface ConsultaDeDominios {
  /** Nulo quando não foi possível perguntar — diferente de "nenhum". */
  dominios: string[] | null;
  motivo?: string;
}

export async function dominiosVerificados(forcar = false): Promise<ConsultaDeDominios> {
  if (!env.RESEND_API_KEY) {
    return { dominios: null, motivo: "RESEND_API_KEY não configurada." };
  }

  if (!forcar && cache && Date.now() - cache.quando < VALIDADE_MS) {
    return { dominios: cache.dominios };
  }

  try {
    const { data, error } = await new Resend(env.RESEND_API_KEY).domains.list();
    if (error) return { dominios: null, motivo: error.message };

    const dominios = (data?.data ?? [])
      .filter((d) => d.status === "verified")
      .map((d) => d.name.toLowerCase());

    cache = { dominios, quando: Date.now() };
    return { dominios };
  } catch (erro) {
    // Rede fora não pode impedir alguém de mexer na configuração do
    // evento — só deixa de conferir.
    return { dominios: null, motivo: erro instanceof Error ? erro.message : "Falha ao consultar o Resend." };
  }
}

/**
 * Domínios de e-mail gratuito.
 *
 * Não é possível usá-los como remetente, e a mensagem de erro genérica
 * ("domínio não verificado") sugere que bastaria verificar — quando
 * verificar exigiria criar registros DNS no domínio do Google. A
 * confusão é comum o bastante para merecer resposta própria.
 */
const CORREIO_GRATUITO = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com",
  "yahoo.com", "yahoo.com.br", "bol.com.br", "uol.com.br", "terra.com.br",
  "icloud.com", "me.com", "proton.me", "protonmail.com",
]);

export function dominioDe(email: string): string {
  return email.split("@").pop()?.trim().toLowerCase() ?? "";
}

export interface Veredito {
  ok: boolean;
  /** Verdadeiro quando não deu para conferir — salva, mas avisa. */
  naoConferido?: boolean;
  mensagem?: string;
}

/**
 * O remetente pode ser usado?
 *
 * Não conseguir perguntar NÃO reprova. Bloquear a configuração por causa
 * de uma instabilidade do Resend deixaria o organizador sem conseguir
 * mexer no evento por um motivo que não é dele.
 */
export async function conferirRemetente(fromEmail: string): Promise<Veredito> {
  const consulta = await dominiosVerificados();

  if (consulta.dominios === null) {
    return {
      ok: true,
      naoConferido: true,
      mensagem: `Não consegui confirmar o domínio no Resend (${consulta.motivo ?? "motivo desconhecido"}). A configuração foi salva, mas confira antes do evento.`,
    };
  }

  const dominio = dominioDe(fromEmail);
  if (consulta.dominios.includes(dominio)) return { ok: true };

  if (CORREIO_GRATUITO.has(dominio)) {
    return {
      ok: false,
      mensagem:
        `"${dominio}" é um provedor de e-mail gratuito e NUNCA poderá ser usado como ` +
        `remetente — verificá-lo exigiria criar registros DNS no domínio do próprio ` +
        `provedor, o que só ele pode fazer. Não é uma etapa pendente: é impossível. ` +
        `Use um endereço de um domínio seu (por exemplo, contato@seudominio.com.br) e ` +
        `verifique esse domínio no Resend.`,
    };
  }

  const lista = consulta.dominios.length > 0
    ? `Verificados hoje: ${consulta.dominios.join(", ")}.`
    : "Não há nenhum domínio verificado nesta conta ainda.";

  return {
    ok: false,
    mensagem:
      `O domínio "${dominio}" não está verificado no Resend, e o envio seria recusado — ` +
      `ninguém receberia comprovante nem certificado. ${lista} ` +
      `Use um endereço de um domínio seu já verificado; para diferenciar o evento, mude o NOME do remetente.`,
  };
}
