import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";

/**
 * Conversa com o Mercado Pago (Pix transparente).
 *
 * Três regras que valem mais que o resto deste arquivo:
 *
 * 1. VOLTAR AO SITE NÃO É PROVA DE PAGAMENTO. Só o webhook validado,
 *    seguido de consulta à API, confirma inscrição.
 *
 * 2. A NOTIFICAÇÃO NÃO É FONTE DE VERDADE. Ela diz que algo mudou; o que
 *    mudou se descobre consultando o pagamento com o nosso token.
 *
 * 3. O VALOR PAGO PRECISA SER CONFERIDO contra o preço do lote. Sem isso,
 *    alguém cria um pagamento de R$ 0,01 com a nossa referência externa e
 *    entra no congresso.
 *
 * Sem MP_ACCESS_TOKEN o cliente entra em modo simulado, igual ao PicPay:
 * nenhuma chamada sai para fora, e os testes rodam sem tocar a conta real.
 */

const API = "https://api.mercadopago.com";

export interface PixPayer {
  firstName: string;
  lastName: string;
  document: string; // CPF
  email: string;
}

export interface CreatePixParams {
  /** Id da inscrição. Volta na notificação como external_reference. */
  referenceId: string;
  amount: number;
  description: string;
  expiresAt: Date;
  payer: PixPayer;
}

export interface PixPaymentResponse {
  paymentId: string;
  status: string;
  /** Código copia-e-cola. */
  qrCodeContent: string;
  /** Imagem do QR Code em base64 (sem o prefixo data:). */
  qrCodeBase64: string;
  /** Página do Mercado Pago com o Pix, usada como alternativa ao QR. */
  paymentUrl: string | null;
  expiresAt: string;
}

export interface CreateCardCheckoutParams {
  /** Id da inscrição. Volta na notificação como external_reference. */
  referenceId: string;
  amount: number;
  description: string;
  expiresAt: Date;
  payer: PixPayer;
  /** Para onde o Mercado Pago devolve a pessoa depois de pagar. */
  returnUrl: string;
}

export interface CardCheckoutResponse {
  preferenceId: string;
  /** Página de pagamento do Mercado Pago. */
  checkoutUrl: string;
  expiresAt: string;
}

export interface PagamentoConferido {
  aprovado: boolean;
  status: string;
  paymentId: string;
  /** payment_type_id do Mercado Pago: credit_card, debit_card, bank_transfer... */
  tipo: string;
  /** Em centavos, para comparar com o preço sem erro de ponto flutuante. */
  centavos: number;
  /** Id da inscrição que originou a cobrança. */
  referenceId: string;
}

export type ResultadoConferencia =
  | { ok: true; dados: PagamentoConferido }
  /** `definitivo` diz que repetir a consulta não vai mudar o resultado. */
  | { ok: false; erro: string; definitivo?: boolean };

function nomeDoPagador(payer: PixPayer) {
  return {
    first_name: payer.firstName,
    last_name: payer.lastName,
    email: payer.email,
    identification: {
      type: "CPF",
      number: payer.document.replace(/\D/g, ""),
    },
  };
}

export class MercadoPagoClient {
  get configurado(): boolean {
    return Boolean(env.MP_ACCESS_TOKEN);
  }

  /**
   * Cria a cobrança Pix e devolve o QR Code.
   *
   * O `X-Idempotency-Key` é o id da inscrição: se a mesma inscrição tentar
   * gerar cobrança duas vezes (retry de rede, duplo clique), o Mercado Pago
   * devolve a MESMA cobrança em vez de criar uma segunda.
   */
  async createPixPayment(params: CreatePixParams): Promise<PixPaymentResponse> {
    if (!this.configurado) {
      // Modo simulado — desenvolvimento e testes.
      return {
        paymentId: `mock-${params.referenceId}`,
        status: "pending",
        qrCodeContent: `00020126580014BR.GOV.BCB.PIX-MOCK-${params.referenceId}`,
        qrCodeBase64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        paymentUrl: null,
        expiresAt: params.expiresAt.toISOString(),
      };
    }

    const corpo = {
      transaction_amount: Number(params.amount.toFixed(2)),
      description: params.description,
      payment_method_id: "pix",
      // Quem paga o Pix não precisa ter conta no Mercado Pago; estes dados
      // são só para identificar a cobrança na conta de quem recebe.
      payer: nomeDoPagador(params.payer),
      // Carrega o id da inscrição de ida e volta: é por ele que o webhook
      // sabe qual inscrição confirmar.
      external_reference: params.referenceId,
      notification_url: `${env.BACKEND_PUBLIC_URL}/inscriptions/mercadopago/webhook`,
      date_of_expiration: params.expiresAt.toISOString(),
    };

    const resposta = await fetch(`${API}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": params.referenceId,
      },
      body: JSON.stringify(corpo),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      throw new Error(`Falha na API Mercado Pago (${resposta.status}): ${detalhe.slice(0, 300)}`);
    }

    const d = (await resposta.json()) as {
      id?: number | string;
      status?: string;
      date_of_expiration?: string;
      point_of_interaction?: {
        transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
      };
    };

    const dadosPix = d.point_of_interaction?.transaction_data;
    if (!d.id || !dadosPix?.qr_code) {
      throw new Error("Mercado Pago não devolveu o QR Code do Pix");
    }

    return {
      paymentId: String(d.id),
      status: d.status ?? "pending",
      qrCodeContent: dadosPix.qr_code,
      qrCodeBase64: dadosPix.qr_code_base64 ?? "",
      paymentUrl: dadosPix.ticket_url ?? null,
      expiresAt: d.date_of_expiration ?? params.expiresAt.toISOString(),
    };
  }

  /**
   * Cria a preferência do Checkout Pro — o caminho do CARTÃO.
   *
   * Aqui o pagamento não é transparente como o Pix: a pessoa vai para uma
   * página do Mercado Pago e volta. É de propósito — dado de cartão não
   * passa pelo nosso site, e portanto não há o que guardar nem vazar.
   *
   * Pix e boleto ficam FORA da preferência. Ela só é criada para lote que
   * não aceita Pix; oferecer Pix aqui desfaria a escolha do admin.
   *
   * VOLTAR AO SITE NÃO É PROVA DE PAGAMENTO: quem confirma a inscrição
   * continua sendo o webhook de `payment`, que já valida assinatura e
   * consulta o valor. As back_urls existem só para a pessoa não ficar
   * perdida no fim.
   */
  async createCardCheckout(params: CreateCardCheckoutParams): Promise<CardCheckoutResponse> {
    if (!this.configurado) {
      // Modo simulado — desenvolvimento e testes.
      return {
        preferenceId: `mock-pref-${params.referenceId}`,
        checkoutUrl: `https://www.mercadopago.com.br/checkout/mock/${params.referenceId}`,
        expiresAt: params.expiresAt.toISOString(),
      };
    }

    const corpo = {
      items: [
        {
          id: params.referenceId,
          title: params.description,
          quantity: 1,
          unit_price: Number(params.amount.toFixed(2)),
          currency_id: "BRL",
        },
      ],
      // ATENÇÃO: a preferência usa `name`/`surname`, enquanto /v1/payments
      // usa `first_name`/`last_name`. Mandar o formato errado não dá erro —
      // o Mercado Pago só ignora, e o checkout aparece sem os dados.
      payer: {
        name: params.payer.firstName,
        surname: params.payer.lastName,
        email: params.payer.email,
        identification: {
          type: "CPF",
          number: params.payer.document.replace(/\D/g, ""),
        },
      },
      external_reference: params.referenceId,
      notification_url: `${env.BACKEND_PUBLIC_URL}/inscriptions/mercadopago/webhook`,
      back_urls: {
        success: params.returnUrl,
        pending: params.returnUrl,
        failure: params.returnUrl,
      },
      auto_return: "approved",
      expires: true,
      expiration_date_to: params.expiresAt.toISOString(),
      payment_methods: {
        excluded_payment_types: [{ id: "ticket" }, { id: "bank_transfer" }],
      },
    };

    const resposta = await fetch(`${API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        // Mesma inscrição tentando duas vezes recebe a MESMA preferência.
        "X-Idempotency-Key": `pref-${params.referenceId}`,
      },
      body: JSON.stringify(corpo),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      throw new Error(`Falha na API Mercado Pago (${resposta.status}): ${detalhe.slice(0, 300)}`);
    }

    const d = (await resposta.json()) as {
      id?: string | number;
      init_point?: string;
      expiration_date_to?: string;
    };

    if (!d.id || !d.init_point) {
      throw new Error("Mercado Pago não devolveu a página de pagamento do cartão");
    }

    return {
      preferenceId: String(d.id),
      checkoutUrl: d.init_point,
      expiresAt: d.expiration_date_to ?? params.expiresAt.toISOString(),
    };
  }

  /**
   * Consulta o pagamento na API — a única fonte de verdade sobre valor e
   * situação.
   */
  async conferirPagamento(paymentId: string): Promise<ResultadoConferencia> {
    if (!this.configurado) {
      return {
        ok: true,
        dados: {
          aprovado: true,
          status: "approved",
          tipo: "bank_transfer",
          paymentId,
          centavos: 0,
          referenceId: paymentId.replace(/^mock-/, ""),
        },
      };
    }

    let resposta: Response;
    try {
      resposta = await fetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
      });
    } catch {
      return { ok: false, erro: "mp_inacessivel" };
    }

    if (!resposta.ok) {
      // 404 é o caso do botão de teste do painel, que manda data.id
      // "123456", e o de notificação sobre pagamento de outra conta. Não é
      // falha temporária: quem chama precisa responder 200, senão o
      // Mercado Pago reenvia a mesma notificação para sempre.
      return {
        ok: false,
        erro: resposta.status === 404 ? "pagamento_inexistente" : `mp_consulta_${resposta.status}`,
        definitivo: resposta.status === 404 || resposta.status === 400,
      };
    }

    const d = (await resposta.json()) as {
      id?: number | string;
      status?: string;
      payment_type_id?: string;
      transaction_amount?: number;
      external_reference?: string;
    };

    const referenceId = String(d.external_reference ?? "");
    if (!referenceId) {
      // Pagamento que não veio do nosso fluxo. Reenviar não conserta.
      return { ok: false, erro: "sem_referencia_externa", definitivo: true };
    }

    return {
      ok: true,
      dados: {
        // Só "approved" confirma. "pending" e "in_process" são estados
        // legítimos e ainda NÃO são pagamento: confirmar neles daria
        // credencial antes de o dinheiro existir.
        aprovado: d.status === "approved",
        status: d.status ?? "unknown",
        // Diz se o dinheiro veio de cartão ou de Pix. O relatório do admin
        // separa por isso.
        tipo: d.payment_type_id ?? "unknown",
        paymentId: String(d.id ?? paymentId),
        // Arredonda para centavo inteiro: o MP devolve decimal, e
        // 100.00 * 100 em ponto flutuante pode não dar exatamente 10000.
        centavos: Math.round((d.transaction_amount ?? 0) * 100),
        referenceId,
      },
    };
  }

  /**
   * Confere a assinatura da notificação.
   *
   * O cabeçalho vem como `ts=1704908010,v1=<hmac_hex>`, e o texto assinado
   * tem formato exato:
   *
   *     id:{data.id};request-id:{x-request-id};ts:{ts};
   *
   * Três detalhes que quebram a validação em silêncio: o `data.id` vai em
   * MINÚSCULAS; o segredo é o do webhook, NÃO o access token; e segmento
   * ausente é omitido inteiro, não deixado vazio.
   *
   * Sem esta conferência, quem descobrir o endereço manda "pagamento
   * aprovado" e confirma inscrição sem pagar.
   */
  assinaturaConfere(opcoes: {
    xSignature: string | null;
    xRequestId: string | null;
    dataId: string | null;
  }): { ok: boolean; motivo?: string } {
    if (!env.MP_WEBHOOK_SECRET) return { ok: false, motivo: "sem_segredo_configurado" };
    if (!opcoes.xSignature) return { ok: false, motivo: "sem_assinatura" };

    const partes = new Map(
      opcoes.xSignature.split(",").map((p) => {
        const [chave, ...resto] = p.split("=");
        return [chave?.trim() ?? "", resto.join("=").trim()];
      })
    );

    const ts = partes.get("ts");
    const v1 = partes.get("v1");
    if (!ts || !v1) return { ok: false, motivo: "assinatura_malformada" };

    // Notificação antiga é recusada: sem isso, uma notificação válida
    // capturada uma vez poderia ser reenviada para sempre.
    const idadeEmSegundos = Math.abs(Date.now() / 1000 - Number(ts));
    if (!Number.isFinite(idadeEmSegundos) || idadeEmSegundos > 15 * 60) {
      return { ok: false, motivo: "assinatura_expirada" };
    }

    let manifesto = "";
    if (opcoes.dataId) manifesto += `id:${opcoes.dataId.toLowerCase()};`;
    if (opcoes.xRequestId) manifesto += `request-id:${opcoes.xRequestId};`;
    manifesto += `ts:${ts};`;

    const esperado = createHmac("sha256", env.MP_WEBHOOK_SECRET).update(manifesto).digest("hex");

    // Comparação em tempo constante: a comum para no primeiro byte
    // diferente, e essa diferença de tempo permite descobrir a assinatura
    // correta byte a byte.
    const a = Buffer.from(esperado, "utf8");
    const b = Buffer.from(v1, "utf8");
    if (a.length !== b.length) return { ok: false, motivo: "assinatura_invalida" };

    return timingSafeEqual(a, b) ? { ok: true } : { ok: false, motivo: "assinatura_invalida" };
  }

  /** Usado quando for preciso criar cobrança fora do fluxo de inscrição. */
  novaChaveDeIdempotencia(): string {
    return randomUUID();
  }
}

export const mercadoPagoClient = new MercadoPagoClient();
