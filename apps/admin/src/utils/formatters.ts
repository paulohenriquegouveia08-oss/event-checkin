/**
 * Funções utilitárias de formatação para o painel administrativo.
 */

/**
 * Formata um número de telefone no padrão nacional brasileiro:
 * - Celular com DDD (11 dígitos): (XX) XXXXX-XXXX
 * - Fixo com DDD (10 dígitos): (XX) XXXX-XXXX
 * - Celular sem DDD (9 dígitos): XXXXX-XXXX
 * - Fixo sem DDD (8 dígitos): XXXX-XXXX
 *
 * Remove automaticamente o DDI brasileiro (+55 ou 55) caso venha no início.
 */
export function formatPhone(phone?: string | null): string {
  if (!phone) return "—";
  const trimmed = phone.trim();
  if (!trimmed) return "—";

  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;

  // Se contém o DDI do Brasil (55) com 12 ou 13 dígitos totais, remove o 55
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("55") && digits[2] !== "9") {
    // Em celular no Brasil de 11 dígitos (DDD + 9 dígitos), o 3º caractere é SEMPRE '9'.
    // Se começa com '55' mas o 3º caractere não é '9' (ex: 55439918032), trata-se do DDI 55
    // seguido de DDD e dígitos truncados. Remove o '55' e formata com o DDD correto.
    digits = digits.slice(2);
    if (digits.length === 9) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
  }

  // Celular com DDD (11 dígitos): (43) 99999-9999
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  // Fixo com DDD (10 dígitos): (43) 3333-3333
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  // Celular sem DDD (9 dígitos): 99999-9999
  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  // Fixo sem DDD (8 dígitos): 3333-3333
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  // Caso não se encaixe nos tamanhos padrão mas comece com +55
  return trimmed.replace(/^\+?55\s*/, "");
}

/**
 * Formata CPF (ou CNPJ caso tenha 14 dígitos) no padrão nacional com máscara:
 * - CPF (11 dígitos): 000.000.000-00
 * - CPF com zero à esquerda ausente (10 dígitos): 000.000.000-00
 * - CNPJ (14 dígitos): 00.000.000/0000-00
 */
export function formatDocument(doc?: string | null): string {
  if (!doc) return "—";
  const trimmed = doc.trim();
  if (!trimmed) return "—";

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;

  // CPF padrão (11 dígitos)
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  // CPF que perdeu zero inicial no banco (10 dígitos)
  if (digits.length === 10) {
    const padded = digits.padStart(11, "0");
    return `${padded.slice(0, 3)}.${padded.slice(3, 6)}.${padded.slice(6, 9)}-${padded.slice(9)}`;
  }

  // CNPJ (14 dígitos)
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }

  return trimmed;
}
