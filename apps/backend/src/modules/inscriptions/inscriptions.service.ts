import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "../../shared/errors.js";
import { generateQrToken } from "../../shared/tokens.js";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { getEventOrThrow } from "../events/events.service.js";
import { findTierAmount } from "../events/site-content.js";
import { picPayClient } from "../../lib/picpay/picpay.client.js";
import { emailService } from "../../lib/email/email.service.js";
import * as batchesService from "../batches/batches.service.js";
import * as inscriptionsRepository from "./inscriptions.repository.js";
import type { CreateInscriptionInput } from "./inscriptions.schema.js";

export async function createInscription(
  eventId: string,
  input: CreateInscriptionInput,
  /** Endereco de onde veio a inscricao, para a prova do consentimento.
   *  Vem da conexao, nunca do corpo da requisicao. */
  consentIp?: string | null,
) {
  const event = await getEventOrThrow(eventId);

  if (!event.registrationsOpen) {
    throw new ForbiddenError("As inscrições para este evento estão encerradas");
  }

  // 1. Resolução do valor e lote:
  // Se categoria não foi enviada (fluxo novo sem seleção de categoria), aplica o lote ativo automaticamente.
  // Se foi enviada, valida contra tiers/lotes existentes mantendo 100% de compatibilidade retroativa.
  let amount: number;
  let batchId: string | null = null;
  let category: string;

  if (!input.category) {
    const { activeBatch } = await batchesService.resolveActiveBatch(eventId);
    if (!activeBatch) {
      throw new ForbiddenError("Todos os lotes de inscrição para este evento foram encerrados");
    }
    amount = Number(activeBatch.price);
    batchId = activeBatch.id;
    category = activeBatch.name;
  } else {
    const tierAmount = findTierAmount(event.siteContent, input.category);
    if (tierAmount !== null) {
      amount = tierAmount;
      category = input.category;
    } else {
      const { activeBatch } = await batchesService.resolveActiveBatch(eventId);
      if (activeBatch && (input.category === activeBatch.name || input.category === `LOTE_${activeBatch.batchNumber}`)) {
        amount = Number(activeBatch.price);
        batchId = activeBatch.id;
        category = activeBatch.name;
      } else {
        throw new ValidationError("Categoria de inscrição inválida para este evento");
      }
    }
  }

  // 2. Reserva a vaga e cria a inscrição PENDING — NA MESMA TRANSAÇÃO.
  //
  // As duas coisas juntas são o ponto todo. Antes, a vaga era conferida
  // em `resolveActiveBatch` e a inscrição era criada depois, em outra
  // consulta: entre uma e outra, qualquer número de requisições passava
  // pela mesma brecha. Duas pessoas viam "resta 1" e as duas entravam.
  //
  // Dentro da transação, `reservarVaga` trava a linha do lote e conta;
  // quem chega depois espera o commit e conta de novo, já enxergando a
  // inscrição anterior.
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h para pagamento
  const inscription = await prisma.$transaction(async (tx) => {
    if (batchId) {
      await batchesService.reservarVaga(tx, batchId);
    }

    return inscriptionsRepository.createInscription(tx, {
      eventId,
      name: input.name,
      email: input.email,
      document: input.document,
      phone: input.phone,
      institution: input.institution,
      category,
      amount,
      batchId,
      notes: input.notes,
      paymentExpiresAt: expiresAt,
      consentVersion: input.consentVersion,
      // A hora e' a do SERVIDOR. O relogio do visitante pode estar
      // errado, ou ajustado de proposito — e e' justamente contra a
      // versao dele que o registro precisa valer.
      consentAcceptedAt: new Date(),
      consentIp: consentIp ?? null,
    });
  });

  // 3. Gera a cobrança no PicPay
  const nameParts = input.name.trim().split(/\s+/);
  const firstName = nameParts[0] || "Participante";
  const lastName = nameParts.slice(1).join(" ") || "COPOL";

  let paymentUrl: string | null = null;
  let qrCodeBase64: string | null = null;
  let qrCodeContent: string | null = null;

  try {
    const payment = await picPayClient.createPayment({
      referenceId: inscription.id,
      value: amount,
      expiresAt: expiresAt.toISOString(),
      buyer: {
        firstName,
        lastName,
        document: input.document,
        email: input.email,
        phone: input.phone,
      },
    });

    paymentUrl = payment.paymentUrl;
    qrCodeBase64 = payment.qrcode.base64;
    qrCodeContent = payment.qrcode.content;

    // Atualiza a inscrição com os dados de pagamento gerados
    await inscriptionsRepository.updateInscriptionPayment(inscription.id, {
      paymentUrl,
      qrCodeBase64,
      qrCodeContent,
      paymentExpiresAt: expiresAt,
    });
  } catch (err) {
    console.error("[InscriptionsService] Falha ao gerar cobrança PicPay:", err);
    // Em caso de falha externa do gateway, a inscrição continua PENDING para retry
  }

  return {
    id: inscription.id,
    eventId: inscription.eventId,
    name: inscription.name,
    email: inscription.email,
    status: inscription.status,
    amount: Number(inscription.amount),
    category: inscription.category,
    paymentUrl,
    qrCodeBase64,
    qrCodeContent,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getInscription(id: string) {
  const inscription = await inscriptionsRepository.findInscriptionById(id);
  if (!inscription) throw new NotFoundError("Inscrição não encontrada");
  return inscription;
}

export async function listInscriptions(eventId: string) {
  return inscriptionsRepository.listInscriptionsByEvent(eventId);
}

/**
 * Confirmação atômica do pagamento:
 * 1. Transforma Inscription em CONFIRMED
 * 2. Cria o Participant com novo qrToken
 * 3. Envia o comprovante de inscrição por e-mail via Resend
 */
export async function confirmInscriptionPayment(inscriptionId: string, authorizationId?: string) {
  const result = await prisma.$transaction(async (tx) => {
    // TRAVA a linha da inscrição antes de olhar o status.
    //
    // O PicPay reenvia o webhook quando não recebe resposta a tempo, e
    // as reentregas se CRUZAM — não chegam uma depois da outra. Sem o
    // bloqueio, cinco reentregas simultâneas liam a inscrição como
    // PENDING antes de qualquer uma comitar, todas passavam pela
    // guarda abaixo e todas criavam um participante.
    //
    // Cinco participantes para uma inscrição são cinco credenciais,
    // cinco QR codes e cinco entradas no evento por um pagamento só.
    // Medido: era exatamente isso que acontecia.
    //
    // Com o FOR UPDATE, a segunda reentrega espera o commit da
    // primeira e então enxerga CONFIRMED — e sai pela guarda.
    await tx.$queryRaw`SELECT id FROM inscriptions WHERE id = ${inscriptionId} FOR UPDATE`;

    const inscription = await tx.inscription.findUnique({
      where: { id: inscriptionId },
      include: { event: true, batch: true },
    });

    if (!inscription) {
      throw new NotFoundError("Inscrição não encontrada");
    }

    if (inscription.status === "CONFIRMED" && inscription.participantId) {
      return { inscription, participantId: inscription.participantId, alreadyConfirmed: true };
    }

    // Gera o qrToken do participante
    const qrToken = generateQrToken();

    // Cria o participante na tabela participants
    const participant = await tx.participant.create({
      data: {
        eventId: inscription.eventId,
        name: inscription.name,
        email: inscription.email,
        phone: inscription.phone,
        document: inscription.document,
        qrToken,
        status: "ACTIVE",
      },
    });

    // Atualiza a inscrição para CONFIRMED e vincula o participante
    const updatedInscription = await tx.inscription.update({
      where: { id: inscription.id },
      data: {
        status: "CONFIRMED",
        participantId: participant.id,
        paymentId: authorizationId ?? inscription.paymentId,
      },
      include: { event: true, batch: true },
    });

    return { inscription: updatedInscription, participant, alreadyConfirmed: false };
  });

  // Se já estava confirmado, não reenviar e-mail
  if (result.alreadyConfirmed || !("participant" in result) || !result.participant) {
    return result.inscription;
  }

  // Dispara o e-mail de comprovante com o QR Code de check-in (em background)
  emailService
    .sendRegistrationReceipt({
      to: result.inscription.email,
      participantName: result.inscription.name,
      eventName: result.inscription.event.name,
      inscriptionId: result.inscription.id,
      batchName: result.inscription.batch?.name ?? result.inscription.category,
      amount: Number(result.inscription.amount),
      qrToken: result.participant.qrToken,
      eventStartDate: result.inscription.event.startDate.toISOString(),
      eventLocation: result.inscription.event.location,
    })
    .catch((err) => console.error("[InscriptionsService] Falha ao enviar e-mail de comprovante:", err));

  return result.inscription;
}

/**
 * Trata notificações de webhook do PicPay.
 */
export async function handlePicPayWebhook(
  xSellerToken: string | undefined,
  payload: { referenceId: string; authorizationId?: string }
) {
  if (env.PICPAY_SELLER_TOKEN && xSellerToken !== env.PICPAY_SELLER_TOKEN) {
    throw new UnauthorizedError("Token de vendedor PicPay inválido");
  }

  const inscription = await inscriptionsRepository.findInscriptionById(payload.referenceId);
  if (!inscription) {
    throw new NotFoundError("Inscrição não encontrada para o referenceId fornecido");
  }

  if (inscription.status === "CONFIRMED") {
    return { status: "already_confirmed" };
  }

  // Consulta status no PicPay para validação dupla
  const picPayStatus = await picPayClient.getPaymentStatus(payload.referenceId);
  if (picPayStatus.status === "paid" || !env.PICPAY_TOKEN) {
    await confirmInscriptionPayment(
      payload.referenceId,
      payload.authorizationId ?? picPayStatus.authorizationId ?? "AUTHORIZED"
    );
    return { status: "confirmed" };
  }

  return { status: picPayStatus.status };
}

/**
 * Consulta de status em tempo real usada pelo polling da tela de confirmação.
 */
export async function getInscriptionPaymentStatus(id: string) {
  const current = await prisma.inscription.findUnique({
    where: { id },
    include: {
      batch: true,
      event: true,
    },
  });

  if (!current) throw new NotFoundError("Inscrição não encontrada");
  let inscription = current;

  // Fallback ativo: se ainda está PENDING, faz uma checagem ativa no PicPay
  if (inscription.status === "PENDING" && env.PICPAY_TOKEN) {
    try {
      const picPayStatus = await picPayClient.getPaymentStatus(id);
      if (picPayStatus.status === "paid") {
        const confirmed = await confirmInscriptionPayment(
          id,
          picPayStatus.authorizationId ?? "AUTO_POLL_VERIFIED"
        );
        inscription = confirmed as any;
      }
    } catch {
      // Ignora erro temporário de rede do PicPay durante polling
    }
  }

  // Busca dados do participante se já confirmado
  let qrToken: string | null = null;
  if (inscription.participantId) {
    const participant = await prisma.participant.findUnique({
      where: { id: inscription.participantId },
      select: { qrToken: true },
    });
    qrToken = participant?.qrToken ?? null;
  }

  return {
    id: inscription.id,
    status: inscription.status,
    amount: Number(inscription.amount),
    category: inscription.category,
    paymentUrl: inscription.paymentUrl,
    qrCodeBase64: inscription.qrCodeBase64,
    qrCodeContent: inscription.qrCodeContent,
    paymentExpiresAt: inscription.paymentExpiresAt?.toISOString() ?? null,
    participantId: inscription.participantId,
    qrToken,
    attendeePortalUrl: qrToken ? `${env.PRE_COPOL_BASE_URL}` : null,
  };
}

/**
 * Relatório completo de inscritos para o painel administrativo.
 */
export async function getInscriptionsReport(eventId: string) {
  const inscriptions = await prisma.inscription.findMany({
    where: { eventId },
    include: {
      batch: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return inscriptions.map((ins) => ({
    id: ins.id,
    name: ins.name,
    email: ins.email,
    phone: ins.phone,
    document: ins.document,
    institution: ins.institution,
    category: ins.batch?.name ?? ins.category,
    amount: Number(ins.amount),
    status: ins.status,
    paymentId: ins.paymentId,
    participantId: ins.participantId,
    createdAt: ins.createdAt.toISOString(),
  }));
}
