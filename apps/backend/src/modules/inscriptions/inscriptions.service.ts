import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "../../shared/errors.js";
import { generateQrToken } from "../../shared/tokens.js";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { getEventOrThrow } from "../events/events.service.js";
import { findTierAmount } from "../events/site-content.js";
import { picPayClient } from "../../lib/picpay/picpay.client.js";
import { mercadoPagoClient } from "../../lib/mercadopago/mercadopago.client.js";
import { emailService } from "../../lib/email/email.service.js";
import { resolveEmailSettings } from "../../lib/email/email-settings.js";
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

  // Inscrição em equipe: só quando o evento pede (Event.siteContent.equipe).
  // Em qualquer outro evento este bloco não faz nada — input.teamName e
  // input.teamMembers, se vierem, são simplesmente ignorados abaixo.
  const equipeConfig = (event.siteContent as { equipe?: { tamanho: number } } | null)?.equipe;
  if (equipeConfig && !input.soloParaSorteio) {
    const integrantesEsperados = equipeConfig.tamanho - 1; // o líder já é a Inscription
    if (!input.teamName) {
      throw new ValidationError("Informe o nome da equipe");
    }
    if (!input.teamMembers || input.teamMembers.length !== integrantesEsperados) {
      throw new ValidationError(
        `Informe o nome dos outros ${integrantesEsperados} integrantes da equipe (equipes de ${equipeConfig.tamanho} pessoas)`,
      );
    }
  }
  // soloParaSorteio: pessoa se inscreve como líder de si mesma (Inscription
  // normal, sem teamMembers) e fica com teamName nulo até sortearEquipes
  // agrupá-la com outras pessoas soltas.

  // 1. Resolução do valor e lote:
  // Se categoria não foi enviada (fluxo novo sem seleção de categoria), aplica o lote ativo automaticamente.
  // Se foi enviada, valida contra tiers/lotes existentes mantendo 100% de compatibilidade retroativa.
  let amount: number;
  let batchId: string | null = null;
  let category: string;

  if (!input.category) {
    const { activeBatch, currentBatch } = await batchesService.resolveActiveBatch(eventId);
    if (!activeBatch) {
      if (currentBatch && currentBatch.maxQuantity !== null) {
        throw new batchesService.LoteEsgotadoError(currentBatch.name);
      }
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
      teamName: equipeConfig ? input.teamName ?? null : null,
      teamMembers: equipeConfig ? input.teamMembers ?? [] : undefined,
    });
  });

  // 3. INSCRIÇÃO GRATUITA CONFIRMA NA HORA.
  //
  // Sem isto, um evento sem custo entraria no fluxo de pagamento: uma
  // cobrança de R$ 0,00 no PicPay, a inscrição parada em PENDING e o
  // participante nunca criado — ou seja, sem QR Code e sem certificado,
  // esperando para sempre um webhook que não vem.
  //
  // Confirma pelo MESMO caminho do pagamento aprovado (cria o
  // Participant com qrToken, marca CONFIRMED, dispara o comprovante), e
  // não por um atalho paralelo: um segundo caminho para o mesmo destino
  // é o que ninguém testa.
  if (amount === 0) {
    const confirmada = await confirmInscriptionPayment(inscription.id);
    return {
      id: confirmada.id,
      eventId: confirmada.eventId,
      batchId: confirmada.batchId,
      name: confirmada.name,
      email: confirmada.email,
      status: confirmada.status,
      amount: 0,
      category,
      gratuita: true,
      paymentUrl: null,
      qrCodeBase64: null,
      qrCodeContent: null,
    };
  }

  // 4. Gera a cobrança no PicPay
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
    batchId: inscription.batchId,
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
      include: { event: true, batch: true, teamMembers: { orderBy: { order: "asc" } } },
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

    // Inscrição em equipe: o líder já virou Participant acima — cada
    // outro integrante (só nome, sem e-mail/CPF) vira o seu próprio
    // Participant, com qrToken e certificado individuais. O check-in e a
    // emissão de certificado desses participantes seguem pelo painel
    // admin (não têm e-mail para acessar o portal sozinhos).
    for (const membro of inscription.teamMembers) {
      await tx.participant.create({
        data: {
          eventId: inscription.eventId,
          name: membro.name,
          qrToken: generateQrToken(),
          status: "ACTIVE",
        },
      });
    }

    return { inscription: updatedInscription, participant, alreadyConfirmed: false };
  });

  // Se já estava confirmado, não reenviar e-mail
  if (result.alreadyConfirmed || !("participant" in result) || !result.participant) {
    return result.inscription;
  }

  // Dispara o e-mail de comprovante com o QR Code de check-in (em background)
  // O evento inteiro vai junto: é dele que saem o remetente, as cores e o
  // endereço do site do e-mail. Antes essas três coisas eram as do COPOL
  // para qualquer evento.
  const configEmail = resolveEmailSettings(result.inscription.event.emailSettings);

  if (configEmail.autoSendReceipt) {
    emailService
      .sendRegistrationReceipt(result.inscription.event, {
        to: result.inscription.email,
        participantName: result.inscription.name,
        inscriptionId: result.inscription.id,
        batchName: result.inscription.batch?.name ?? result.inscription.category,
        amount: Number(result.inscription.amount),
        qrToken: result.participant.qrToken,
        eventLocation: result.inscription.event.location,
      })
      .catch((err) => console.error("[InscriptionsService] Falha ao enviar e-mail de comprovante:", err));
  }

  return result.inscription;
}

/**
 * Trata notificações de webhook do Mercado Pago.
 *
 * Devolve o código HTTP junto com o corpo porque o Mercado Pago REENVIA a
 * notificação até receber 200/201. Isso inverte a intuição: quase tudo
 * aqui responde 200, inclusive o que ignoramos — responder erro para algo
 * que nunca vai dar certo faz o reenvio nunca parar.
 *
 * A exceção é assinatura inválida: 401 é a resposta certa, porque nesse
 * caso a requisição não veio do Mercado Pago.
 */
export async function handleMercadoPagoWebhook(
  headers: { xSignature: string | null; xRequestId: string | null },
  query: { dataId?: string | null; type?: string | null },
  body: { type?: string; action?: string; data?: { id?: string | number } }
): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
  const dataId = query.dataId ?? (body.data?.id != null ? String(body.data.id) : null);

  // A assinatura é conferida ANTES de qualquer outra coisa. Sem isso, quem
  // descobrisse o endereço mandaria "pagamento aprovado" e confirmaria
  // inscrição sem pagar.
  const assinatura = mercadoPagoClient.assinaturaConfere({
    xSignature: headers.xSignature,
    xRequestId: headers.xRequestId,
    dataId,
  });

  if (!assinatura.ok) {
    console.warn("[MercadoPago] assinatura recusada:", assinatura.motivo);
    return { httpStatus: 401, body: { erro: "assinatura_invalida", motivo: assinatura.motivo } };
  }

  const tipo = String(body.type ?? query.type ?? "");
  if (tipo !== "payment") {
    return { httpStatus: 200, body: { ok: true, ignorado: tipo || "sem_tipo" } };
  }

  if (!dataId) {
    return { httpStatus: 200, body: { ok: true, ignorado: "sem_data_id" } };
  }

  // A notificação diz QUE algo mudou; ela não é fonte de verdade sobre o
  // quê. Quem confirma valor e situação é a API do Mercado Pago,
  // consultada com o nosso token.
  const conferencia = await mercadoPagoClient.conferirPagamento(dataId);

  if (!conferencia.ok) {
    // O botão de teste do painel manda data.id "123456", que não existe.
    // Responder erro faria o teste falhar sempre e, em produção, o
    // Mercado Pago reenviaria essa notificação para sempre.
    if (conferencia.definitivo) {
      return { httpStatus: 200, body: { ok: true, ignorado: conferencia.erro } };
    }

    // Falha temporária (token recusado, MP fora do ar): aqui 500 é o certo,
    // porque queremos o reenvio depois de consertarmos. O corpo aparece no
    // painel de notificações do Mercado Pago, então diz o que fazer.
    const comoResolver: Record<string, string> = {
      mp_sem_access_token: "MP_ACCESS_TOKEN não está definida no ambiente do backend.",
      mp_consulta_401:
        "O MP_ACCESS_TOKEN foi recusado. Confira se é o token da mesma aplicação do webhook e se teste e produção não foram trocados.",
      mp_consulta_403: "O MP_ACCESS_TOKEN não tem permissão para consultar este pagamento.",
      mp_inacessivel: "Não foi possível falar com a API do Mercado Pago.",
    };
    console.error("[MercadoPago] falha temporária:", conferencia.erro);
    return {
      httpStatus: 500,
      body: { erro: conferencia.erro, comoResolver: comoResolver[conferencia.erro] ?? "Ver logs do backend." },
    };
  }

  const pagamento = conferencia.dados;

  if (!pagamento.aprovado) {
    // "pending" e "in_process" são estados legítimos e ainda NÃO são
    // pagamento. Confirmar aqui daria credencial antes de o dinheiro existir.
    return { httpStatus: 200, body: { ok: true, ignorado: "nao_aprovado", status: pagamento.status } };
  }

  const inscription = await inscriptionsRepository.findInscriptionById(pagamento.referenceId);
  if (!inscription) {
    return { httpStatus: 200, body: { ok: true, ignorado: "inscricao_inexistente" } };
  }

  if (inscription.status === "CONFIRMED") {
    return { httpStatus: 200, body: { ok: true, status: "already_confirmed" } };
  }

  // O VALOR PAGO PRECISA COBRIR O PREÇO.
  //
  // Sem esta conferência, alguém cria pelo próprio Mercado Pago um
  // pagamento de R$ 0,01 com o id desta inscrição como referência externa
  // e entra no congresso por um centavo.
  const esperadoEmCentavos = Math.round(Number(inscription.amount) * 100);
  if (pagamento.centavos < esperadoEmCentavos) {
    console.warn(
      `[MercadoPago] valor abaixo do preço: pagou ${pagamento.centavos}, esperado ${esperadoEmCentavos}, inscrição ${inscription.id}`
    );
    return {
      httpStatus: 200,
      body: { ok: true, ignorado: "valor_insuficiente", pago: pagamento.centavos, esperado: esperadoEmCentavos },
    };
  }

  // Confirma pelo MESMO caminho de sempre: é ele que trava a linha, cria o
  // participante com QR Code e dispara o comprovante. Reentrega simultânea
  // não duplica participante por causa dessa trava.
  await confirmInscriptionPayment(inscription.id, pagamento.paymentId);

  await prisma.inscription.update({
    where: { id: inscription.id },
    data: { paymentProvider: "MERCADO_PAGO", paymentMethod: "PIX" },
  });

  return { httpStatus: 200, body: { ok: true, status: "confirmed" } };
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

  const event = (inscription as any).event ?? current.event;

  return {
    id: inscription.id,
    status: inscription.status,
    name: inscription.name,
    amount: Number(inscription.amount),
    category: inscription.category,
    pixKey: event?.pixKey ?? null,
    pixKeyType: event?.pixKeyType ?? null,
    pixReceiverName: event?.pixReceiverName ?? null,
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

/**
 * Cancela manualmente uma inscrição no painel administrativo:
 * 1. Verifica se a inscrição existe e pertence ao evento indicado
 * 2. Atualiza o status para CANCELLED
 * 3. Se houver participante vinculado, atualiza seu status para CANCELLED
 * 4. Retorna a inscrição atualizada
 */
export async function cancelInscription(eventId: string, id: string) {
  const inscription = await prisma.inscription.findUnique({
    where: { id },
  });

  if (!inscription || inscription.eventId !== eventId) {
    throw new NotFoundError("Inscrição não encontrada");
  }

  return prisma.$transaction(async (tx) => {
    if (inscription.participantId) {
      await tx.participant.updateMany({
        where: { id: inscription.participantId },
        data: { status: "CANCELLED" },
      });
    }

    const updated = await tx.inscription.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: { batch: true, event: true },
    });

    return updated;
  });
}

/**
 * Exclui fisicamente um registro de inscrição e participante vinculado:
 * 1. Verifica se a inscrição existe e pertence ao evento indicado
 * 2. Em uma transação Prisma:
 *    - Se inscription.participantId existir, deleta o registro em Participant
 *      (o banco faz ON DELETE CASCADE para checkIns, certificates, attendanceProofs)
 *    - Deleta a Inscription
 * 3. Retorna { success: true, deletedId: id }
 */
export async function deleteInscription(eventId: string, id: string) {
  const inscription = await prisma.inscription.findUnique({
    where: { id },
  });

  if (!inscription || inscription.eventId !== eventId) {
    throw new NotFoundError("Inscrição não encontrada");
  }

  await prisma.$transaction(async (tx) => {
    if (inscription.participantId) {
      await tx.participant.deleteMany({
        where: { id: inscription.participantId },
      });
    }

    await tx.inscription.delete({
      where: { id },
    });
  });

  return { success: true, deletedId: id };
}

/**
 * Sorteia equipes para quem se inscreveu sozinho pedindo alocação aleatória
 * (soloParaSorteio — ver createInscription).
 *
 * Só olha inscrições CONFIRMED sem teamName. Embaralha, divide em grupos do
 * tamanho configurado em Event.siteContent.equipe e dá um nome de equipe a
 * cada grupo — sem criar nem mexer em Participant, que já existe desde a
 * confirmação. Pode rodar de novo: quem já tem teamName não é tocado de
 * novo, então só entra gente nova (ou quem foi excluída de uma equipe).
 */
export async function sortearEquipes(eventId: string) {
  const event = await getEventOrThrow(eventId);
  const equipeConfig = (event.siteContent as { equipe?: { tamanho: number } } | null)?.equipe;
  if (!equipeConfig) {
    throw new ValidationError("Este evento não usa inscrição em equipe");
  }

  const semEquipe = await prisma.inscription.findMany({
    where: { eventId, status: "CONFIRMED", teamName: null },
    select: { id: true, name: true },
  });

  if (semEquipe.length === 0) {
    return { equipesFormadas: 0, pessoasAlocadas: 0, pessoasRestantes: 0 };
  }

  // Fisher-Yates — embaralhar de verdade, não só reordenar por um campo.
  const embaralhado = [...semEquipe];
  for (let i = embaralhado.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [embaralhado[i], embaralhado[j]] = [embaralhado[j], embaralhado[i]];
  }

  // Conta quantas "Equipe N" já existem pra não colidir nome ao sortear de novo.
  const existentes = await prisma.inscription.findMany({
    where: { eventId, teamName: { startsWith: "Equipe " } },
    select: { teamName: true },
    distinct: ["teamName"],
  });
  let proximoNumero = existentes.length + 1;

  const tamanho = equipeConfig.tamanho;
  const grupos: { id: string }[][] = [];
  for (let i = 0; i < embaralhado.length; i += tamanho) {
    grupos.push(embaralhado.slice(i, i + tamanho));
  }

  await prisma.$transaction(
    grupos.map((grupo) => {
      const nomeEquipe = `Equipe ${proximoNumero++}`;
      return prisma.inscription.updateMany({
        where: { id: { in: grupo.map((g) => g.id) } },
        data: { teamName: nomeEquipe },
      });
    }),
  );

  const ultimoGrupo = grupos[grupos.length - 1];
  const grupoIncompleto = ultimoGrupo.length < tamanho;

  return {
    equipesFormadas: grupos.length,
    pessoasAlocadas: embaralhado.length,
    pessoasRestantes: 0,
    ultimaEquipeIncompleta: grupoIncompleto ? ultimoGrupo.length : null,
  };
}

