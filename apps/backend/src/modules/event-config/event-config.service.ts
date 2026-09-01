import { prisma } from "../../database/prisma.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import {
  EVENT_MODULES,
  dependentsOf,
  isEventModuleKey,
  MODULE_REQUIRES,
  type EventModuleKey,
} from "../../shared/event-modules.js";
import type { UpdateEventConfigInput } from "./event-config.schema.js";

/**
 * Configuração do evento: endereço público, fuso, idioma, visibilidade e
 * quais módulos estão ligados.
 */

async function findEventOrThrow(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFoundError("Evento não encontrado");
  return event;
}

/**
 * O runtime é a autoridade sobre fuso horário, não uma lista nossa.
 *
 * A IANA publica atualizações (fusos mudam quando um país muda de regra),
 * então uma lista fixa no código envelhece sem avisar. `Intl` conhece o que
 * o Node conhece, que é exatamente o que vai formatar as datas depois.
 */
function timezoneValida(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function getConfig(eventId: string) {
  const event = await findEventOrThrow(eventId);
  const ligados = await prisma.eventModule.findMany({
    where: { eventId },
    select: { module: true, enabledAt: true, enabledBy: true },
  });

  const porChave = new Map(ligados.map((m) => [m.module, m]));

  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    timezone: event.timezone,
    language: event.language,
    visibility: event.visibility,
    // O catálogo vem do código; o banco só diz o que está ligado. Assim a
    // tela lista sempre todos os módulos possíveis, mesmo os desligados —
    // sem isso o organizador não descobre que existe um módulo novo.
    modules: EVENT_MODULES.map((m) => {
      const linha = porChave.get(m.key);
      return {
        key: m.key,
        name: m.name,
        description: m.description,
        enabled: !!linha,
        enabledAt: linha?.enabledAt ?? null,
        requires: MODULE_REQUIRES[m.key] ?? [],
      };
    }),
  };
}

export async function updateConfig(eventId: string, input: UpdateEventConfigInput) {
  await findEventOrThrow(eventId);

  if (input.timezone !== undefined && !timezoneValida(input.timezone)) {
    throw new ValidationError(
      `Fuso horário desconhecido: ${input.timezone}. Use o formato IANA, ex.: America/Sao_Paulo.`
    );
  }

  try {
    return await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      },
      select: {
        id: true,
        slug: true,
        timezone: true,
        language: true,
        visibility: true,
      },
    });
  } catch (err) {
    // P2002 = violação de índice único. Aqui só existe um campo único nesta
    // tabela, e o conflito acontece de verdade: dois organizadores tentando
    // "copol-2026" no mesmo dia. A mensagem precisa dizer qual é o problema,
    // senão vira "erro ao salvar" e a pessoa tenta o mesmo valor de novo.
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw new ConflictError(
        "slug_taken",
        `O endereço "${input.slug}" já está em uso por outro evento.`
      );
    }
    throw err;
  }
}

/**
 * Liga ou desliga um módulo.
 *
 * As dependências são verificadas nos dois sentidos, e é isso que impede o
 * evento de chegar num estado que a interface não sabe desenhar:
 *
 *   ligar Avaliação sem Submissão  → recusa (pareceres sobre o quê?)
 *   desligar Submissão com Avaliação ligada → desliga as duas
 *
 * Desligar NUNCA apaga dado. O módulo some da navegação e volta com tudo
 * onde estava — trabalhos submetidos, pareceres, tudo. Perder um mês de
 * submissões por um clique errado não é uma opção que o sistema deva
 * oferecer.
 */
export async function toggleModule(
  eventId: string,
  moduleKey: string,
  enabled: boolean,
  userId: string | null
) {
  await findEventOrThrow(eventId);
  if (!isEventModuleKey(moduleKey)) {
    throw new ValidationError(`Módulo desconhecido: ${moduleKey}`);
  }

  if (enabled) {
    const faltando: EventModuleKey[] = [];
    for (const req of MODULE_REQUIRES[moduleKey] ?? []) {
      const tem = await prisma.eventModule.findUnique({
        where: { eventId_module: { eventId, module: req } },
      });
      if (!tem) faltando.push(req);
    }
    if (faltando.length > 0) {
      const nomes = faltando
        .map((k) => EVENT_MODULES.find((m) => m.key === k)?.name ?? k)
        .join(", ");
      throw new ValidationError(
        `Ligue ${nomes} antes — este módulo depende dele.`
      );
    }

    await prisma.eventModule.upsert({
      where: { eventId_module: { eventId, module: moduleKey } },
      create: { eventId, module: moduleKey, enabledBy: userId },
      update: {},
    });
    return { module: moduleKey, enabled: true, alsoDisabled: [] as string[] };
  }

  // Desligar arrasta quem depende junto.
  const arrastados = dependentsOf(moduleKey);
  await prisma.eventModule.deleteMany({
    where: { eventId, module: { in: [moduleKey, ...arrastados] } },
  });

  return {
    module: moduleKey,
    enabled: false,
    // Devolvido para a tela poder avisar. Desligar Submissão e ver
    // Avaliação sumir junto, sem explicação, pareceria defeito.
    alsoDisabled: arrastados,
  };
}

/** Um módulo está ligado neste evento? Use antes de servir dados dele. */
export async function isModuleEnabled(
  eventId: string,
  moduleKey: EventModuleKey
): Promise<boolean> {
  const linha = await prisma.eventModule.findUnique({
    where: { eventId_module: { eventId, module: moduleKey } },
  });
  return !!linha;
}
