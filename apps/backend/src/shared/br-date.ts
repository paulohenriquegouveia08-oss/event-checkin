/**
 * Formatação de datas em pt-BR, fixado no fuso America/Sao_Paulo.
 *
 * Não existe nenhuma lib de data no projeto (ver docs/architecture.md —
 * levantamento feito antes desta feature): todo o resto do código usa
 * Date + toLocaleString("pt-BR") sem fixar timezone, o que funciona hoje
 * porque tudo roda no fuso do processo Node. Aqui é diferente por dois
 * motivos: (1) o certificado é um documento formal, gerado uma vez e
 * baixado depois — precisa mostrar a mesma data não importa em que fuso
 * o servidor rodar; (2) Intl.DateTimeFormat com `timeZone` já resolve
 * isso nativamente, sem precisar adicionar date-fns-tz/luxon como
 * dependência nova só pra isso.
 *
 * A checagem de elegibilidade (event.endDate < now) NÃO precisa desse
 * helper: DateTime no Postgres/Prisma é um instante absoluto (UTC), então
 * comparar `new Date() > event.endDate` já é correto em qualquer fuso —
 * só a EXIBIÇÃO da data no PDF precisa ser fixada em horário de Brasília.
 */
const TIMEZONE = "America/Sao_Paulo";

/** Ex.: "20 de setembro de 2026" */
export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, day: "2-digit", month: "long", year: "numeric" }).format(date);
}

/** Ex.: "20/09/2026" */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

/** Ex.: "14:32" */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(date);
}

/**
 * Rótulo do período do evento pro parágrafo do certificado. Mesmo dia →
 * "20 de setembro de 2026". Dias diferentes, mesmo mês/ano → "20 e 21 de
 * setembro de 2026" (como no certificado de referência). Meses ou anos
 * diferentes → escreve as duas datas por extenso.
 */
export function formatEventDateRange(startDate: Date, endDate: Date): string {
  const startDay = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, day: "2-digit" }).format(startDate);
  const endDay = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, day: "2-digit" }).format(endDate);
  const startMonthYear = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, month: "long", year: "numeric" }).format(startDate);
  const endMonthYear = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, month: "long", year: "numeric" }).format(endDate);

  if (startMonthYear !== endMonthYear) {
    return `${formatLongDate(startDate)} a ${formatLongDate(endDate)}`;
  }
  if (startDay === endDay) {
    return formatLongDate(startDate);
  }
  return `${startDay} e ${endDay} de ${startMonthYear}`;
}

/** Versão curta do período do evento, pra espaços apertados (ex.: o chip
 * de data do certificado, ao lado dos logos de apoio) — o parágrafo
 * descritivo já mostra a data por extenso, então aqui não repete o mês por
 * extenso. Mesmo dia → "20/09/2026". Dias diferentes, mesmo mês/ano →
 * "20 e 21/09/2026". Meses/anos diferentes → "20/09/2026 a 05/10/2026". */
export function formatEventDateRangeShort(startDate: Date, endDate: Date): string {
  const startShort = formatShortDate(startDate);
  const endShort = formatShortDate(endDate);
  if (startShort === endShort) return startShort;

  const startDay = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, day: "2-digit" }).format(startDate);
  const startMonthYear = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, month: "2-digit", year: "numeric" }).format(startDate);
  const endMonthYear = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, month: "2-digit", year: "numeric" }).format(endDate);

  if (startMonthYear !== endMonthYear) {
    return `${startShort} a ${endShort}`;
  }
  return `${startDay} e ${endShort}`;
}

/** true quando o instante atual já passou do término do evento — comparação
 * direta de instantes absolutos, independente de fuso (ver nota acima). */
export function hasEventEnded(endDate: Date, now: Date = new Date()): boolean {
  return now.getTime() > endDate.getTime();
}
