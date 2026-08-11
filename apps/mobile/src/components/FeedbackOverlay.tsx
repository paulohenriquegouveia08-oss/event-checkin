import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { CheckInResult } from "../types/index";

interface Props {
  result: CheckInResult;
}

const PRESETS: Record<
  CheckInResult["status"],
  { symbol: string; title: string; color: string }
> = {
  CONFIRMED: { symbol: "✓", title: "PRESENÇA CONFIRMADA", color: "#1B7F3B" },
  ALREADY_CHECKED_IN: { symbol: "!", title: "PRESENÇA JÁ REGISTRADA", color: "#B8860B" },
  INVALID_TOKEN: { symbol: "✕", title: "CREDENCIAL INVÁLIDA", color: "#B3261E" },
  PARTICIPANT_INACTIVE: { symbol: "✕", title: "CREDENCIAL INATIVA", color: "#B3261E" },
};

function formatTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Tela de resultado do check-in — seção 22 da especificação do produto.
 * Fica visível por um tempo curto e some sozinha (ver ScannerScreen),
 * pra não atrasar o próximo participante da fila. */
export function FeedbackOverlay({ result }: Props) {
  const preset = PRESETS[result.status];

  return (
    <View style={[styles.container, { backgroundColor: preset.color }]}>
      <Text style={styles.symbol}>{preset.symbol}</Text>
      <Text style={styles.title}>{preset.title}</Text>
      {result.participantName ? <Text style={styles.name}>{result.participantName}</Text> : null}
      {result.status === "ALREADY_CHECKED_IN" && result.checkedInAt ? (
        <Text style={styles.subtitle}>Registrado às {formatTime(result.checkedInAt)}</Text>
      ) : null}
      {result.status === "CONFIRMED" && result.checkedInAt ? (
        <Text style={styles.subtitle}>{formatTime(result.checkedInAt)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  symbol: { fontSize: 96, color: "#fff", fontWeight: "700" },
  title: { fontSize: 32, color: "#fff", fontWeight: "700", letterSpacing: 1 },
  name: { fontSize: 26, color: "#fff" },
  subtitle: { fontSize: 20, color: "#ffffffcc" },
});
