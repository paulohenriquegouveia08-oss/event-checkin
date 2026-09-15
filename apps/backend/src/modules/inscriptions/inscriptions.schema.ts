import { z } from "zod";

export const createInscriptionSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200),
  email: z.string().trim().email("E-mail inválido"),
  document: z.string().trim().min(1, "CPF é obrigatório").max(20),
  phone: z.string().trim().max(20).optional().nullable(),
  // Opcional para suportar tanto o formulário novo (sem seleção) quanto chamadas legadas
  category: z.string().trim().max(50).optional(),
  institution: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),

  // Versao do termo que estava na tela quando a pessoa marcou o aceite.
  //
  // Obrigatoria, e nao um booleano "aceitou: true": um booleano diria
  // que houve concordancia, mas nao COM O QUE — e o texto muda. A LGPD
  // (art. 8o, §1o) poe no controlador o onus de provar o consentimento,
  // e prova sem o objeto nao e' prova.
  //
  // A data e o IP NAO vem daqui: sao carimbados pelo servidor. Valor
  // que o cliente escolhe nao serve de evidencia contra ele mesmo.
  consentVersion: z
    .string()
    .trim()
    .min(1, "É necessário aceitar o termo de inscrição")
    .max(20),

  // Inscrição em equipe (só exigido pelo service quando o evento pede —
  // ver Event.siteContent.equipe). Aqui ficam opcionais porque o schema
  // não conhece o evento; quem decide se são obrigatórios é o service.
  teamName: z.string().trim().min(1).max(150).optional(),
  teamMembers: z.array(z.string().trim().min(1, "Nome não pode ficar em branco").max(200)).max(19).optional(),
  // Pessoa se inscreve sozinha e pede pra ser alocada depois numa equipe
  // sorteada (ver inscriptionsService.sortearEquipes) — dispensa teamName
  // e teamMembers mesmo em evento com inscrição em equipe.
  soloParaSorteio: z.boolean().optional(),
});

export type CreateInscriptionInput = z.infer<typeof createInscriptionSchema>;

export const inscriptionEventParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
});

export const picPayWebhookSchema = z.object({
  referenceId: z.string().min(1, "referenceId é obrigatório"),
  authorizationId: z.string().optional(),
});

export const eventInscriptionParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
  id: z.string().uuid("id inválido"),
});

