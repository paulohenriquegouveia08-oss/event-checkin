/**
 * Catálogo dos módulos que um evento pode ligar.
 *
 * Mora no código, e não no banco, porque cada módulo corresponde a rotas
 * e telas que existem em arquivos. Uma linha em `event_modules` apontando
 * para um módulo sem código não ligaria nada — seria uma mentira
 * persistida, e o menu do organizador mostraria uma aba que leva a lugar
 * nenhum.
 *
 * O banco guarda só QUEM tem O QUÊ; o que cada coisa É fica aqui.
 */

export const EVENT_MODULES = [
  {
    key: "inscription",
    name: "Inscrições",
    description:
      "Tipos de ingresso, formulário de inscrição e acompanhamento de quem se inscreveu.",
  },
  {
    key: "submission",
    name: "Submissão de trabalhos",
    description:
      "Chamada de trabalhos científicos: modalidades, áreas temáticas e envio de arquivos pelos autores.",
  },
  {
    key: "review",
    name: "Avaliação de trabalhos",
    description:
      "Distribuição dos trabalhos para pareceristas e registro dos pareceres. Depende de Submissão.",
  },
  {
    key: "schedule",
    name: "Programação",
    description: "Atividades, locais e palestrantes do evento.",
  },
  {
    key: "checkin",
    name: "Credenciamento",
    description:
      "Check-in no dia do evento pelos terminais, com QR code do crachá.",
  },
  {
    key: "certificate",
    name: "Certificados",
    description: "Emissão e envio dos certificados aos participantes.",
  },
] as const;

export type EventModuleKey = (typeof EVENT_MODULES)[number]["key"];

export const EVENT_MODULE_KEYS = new Set<string>(
  EVENT_MODULES.map((m) => m.key)
);

export function isEventModuleKey(value: string): value is EventModuleKey {
  return EVENT_MODULE_KEYS.has(value);
}

/**
 * Módulos de que outro módulo depende para fazer sentido.
 *
 * Avaliação sem Submissão seria uma tela de pareceres sobre trabalhos que
 * não existem. A dependência é verificada ao ligar (não dá para ligar
 * Avaliação sem Submissão) e ao desligar (desligar Submissão desliga
 * Avaliação junto) — senão o evento fica num estado que a interface não
 * sabe representar.
 */
export const MODULE_REQUIRES: Partial<Record<EventModuleKey, EventModuleKey[]>> =
  {
    review: ["submission"],
  };

/** Módulos que deixam de fazer sentido se `key` for desligado. */
export function dependentsOf(key: EventModuleKey): EventModuleKey[] {
  return (Object.keys(MODULE_REQUIRES) as EventModuleKey[]).filter((dep) =>
    MODULE_REQUIRES[dep]?.includes(key)
  );
}
