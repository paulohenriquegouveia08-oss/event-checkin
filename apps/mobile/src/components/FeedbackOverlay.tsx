import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../config/theme";
import type { CheckInResult } from "../types/index";

interface Props {
  result: CheckInResult;
}

const PRESETS: Record<
  CheckInResult["status"],
  { symbol: string; title: string; color: string }
> = {
  CONFIRMED: { symbol: "✓", title: "PRESENÇA CONFIRMADA", color: theme.success },
  ALREADY_CHECKED_IN: { symbol: "!", title: "PRESENÇA JÁ REGISTRADA", color: theme.warning },
  INVALID_TOKEN: { symbol: "✕", title: "CREDENCIAL INVÁLIDA", color: theme.danger },
  PARTICIPANT_INACTIVE: { symbol: "✕", title: "CREDENCIAL INATIVA", color: theme.danger },
};

function formatTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

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
  symbol: { fontSize: 96, color: theme.white, fontWeight: "700" },
  title: { fontSize: 32, color: theme.white, fontWeight: "700", letterSpacing: 1 },
  name: { fontSize: 26, color: theme.white },
  subtitle: { fontSize: 20, color: "#ffffffcc" },
});
