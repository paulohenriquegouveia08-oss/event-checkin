import { env } from "../../config/env.js";

export interface PicPayBuyer {
  firstName: string;
  lastName: string;
  document: string; // CPF
  email: string;
  phone?: string | null;
}

export interface CreatePaymentParams {
  referenceId: string;
  value: number;
  expiresAt: string; // ISO string
  buyer: PicPayBuyer;
}

export interface PicPayPaymentResponse {
  referenceId: string;
  paymentUrl: string;
  qrcode: {
    content: string;
    base64: string;
  };
  expiresAt: string;
}

export interface PicPayStatusResponse {
  referenceId: string;
  status: "created" | "paid" | "expired" | "analysis" | "refunded" | "chargeback";
  authorizationId?: string;
}

function cleanPhone(phone?: string | null): string {
  if (!phone) return "+5511999999999";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  return `+55${digits}`;
}

export class PicPayClient {
  private readonly baseUrl = "https://appws.picpay.com/ecommerce/public";

  /**
   * Cria uma requisição de pagamento no PicPay.
   * Se PICPAY_TOKEN não estiver configurado (dev/teste), gera dados simulados funcionais.
   */
  async createPayment(params: CreatePaymentParams): Promise<PicPayPaymentResponse> {
    if (!env.PICPAY_TOKEN) {
      // Mock para desenvolvimento e testes
      return {
        referenceId: params.referenceId,
        paymentUrl: `https://app.picpay.com/checkout/mock-${params.referenceId}`,
        qrcode: {
          content: `https://app.picpay.com/checkout/mock-${params.referenceId}`,
          base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        },
        expiresAt: params.expiresAt,
      };
    }

    const payload = {
      referenceId: params.referenceId,
      callbackUrl: `${env.BACKEND_PUBLIC_URL}/inscriptions/picpay/webhook`,
      returnUrl: `${env.PRE_COPOL_BASE_URL}/confirmacao?id=${params.referenceId}`,
      value: Number(params.value.toFixed(2)),
      expiresAt: params.expiresAt,
      buyer: {
        firstName: params.buyer.firstName,
        lastName: params.buyer.lastName,
        document: params.buyer.document.replace(/\D/g, ""),
        email: params.buyer.email,
        phone: cleanPhone(params.buyer.phone),
      },
    };

    const response = await fetch(`${this.baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-picpay-token": env.PICPAY_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Falha na API PicPay (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    return {
      referenceId: data.referenceId,
      paymentUrl: data.paymentUrl,
      qrcode: {
        content: data.qrcode?.content ?? data.paymentUrl,
        base64: data.qrcode?.base64 ?? "",
      },
      expiresAt: data.expiresAt ?? params.expiresAt,
    };
  }

  /**
   * Consulta o status de um pagamento pelo referenceId.
   */
  async getPaymentStatus(referenceId: string): Promise<PicPayStatusResponse> {
    if (!env.PICPAY_TOKEN) {
      return {
        referenceId,
        status: "created",
      };
    }

    const response = await fetch(`${this.baseUrl}/payments/${referenceId}/status`, {
      method: "GET",
      headers: {
        "x-picpay-token": env.PICPAY_TOKEN,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Falha ao consultar status no PicPay (${response.status}): ${errorText}`);
    }

    return (await response.json()) as PicPayStatusResponse;
  }
}

export const picPayClient = new PicPayClient();
