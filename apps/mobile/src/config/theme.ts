/**
 * Tema visual do app — paleta teal escura combinando com a identidade do
 * evento (arte do 3º COPOL, ver event-checkin/assets/brand/). Centralizada
 * pra manter consistência entre todas as telas, e com o mesmo conjunto de
 * tokens do painel admin (index.css) e do portal do participante
 * (globals.css) — os três sistemas compartilham a mesma paleta.
 */
export const theme = {
  background: "#0E3634",
  surface: "#154B4C",
  surfaceAlt: "#1C5F5F",
  border: "#2A6F6E",
  text: "#F0FAF9",
  textMuted: "#9FC4C2",
  primary: "#2DD4BF",
  primaryDark: "#16A69A",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  white: "#ffffff",
} as const;
