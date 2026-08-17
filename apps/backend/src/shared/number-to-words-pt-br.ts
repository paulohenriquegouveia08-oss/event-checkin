/**
 * Número cardinal por extenso em português — usado só pra carga horária do
 * certificado (ex.: "16 (dezesseis) horas", como no certificado de
 * referência). Cobre 0–999, faixa mais que suficiente pra carga horária de
 * evento; fora dela, cai no fallback (ver certificate-template.ts) e mostra
 * só o número.
 */
const UNITS = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const TEENS = [
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

function twoDigitsToWords(n: number): string {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  const tens = Math.floor(n / 10);
  const units = n % 10;
  return units === 0 ? TENS[tens] : `${TENS[tens]} e ${UNITS[units]}`;
}

export function numberToWordsPtBr(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 999) return null;
  if (n === 0) return "zero";
  if (n === 100) return "cem";

  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  const parts: string[] = [];
  if (hundreds > 0) parts.push(HUNDREDS[hundreds]);
  if (rest > 0) parts.push(twoDigitsToWords(rest));

  return parts.join(" e ");
}
