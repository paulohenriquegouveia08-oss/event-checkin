import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as configRepository from "../database/configRepository";
import * as participantsRepository from "../database/participantsRepository";
import * as checkinsRepository from "../database/checkinsRepository";
import { syncPendingCheckIns, syncRoster } from "../services/sync/syncService";
import { isOnline } from "../services/network/connectivity";
import { generateAndShareAttendanceReport } from "../services/report/attendanceReport";
import { printAttendanceReport } from "../services/report/printReport";
import type { TerminalConfig } from "../types/index";

interface Props {
  config: TerminalConfig;
  onBack: () => void;
  /** Chamado depois que o terminal é desvinculado — volta pro assistente
   * de configuração inicial (App.tsx troca pra <SetupScreen>). */
  onReconfigured: () => void;
}

/**
 * Tela de configurações do terminal — permite trocar de terminal/evento
 * sem depender de reinstalar o app ou limpar dados manualmente. Acessada
 * a partir do ícone de engrenagem na tela principal de scanner.
 */
export function SettingsScreen({ config, onBack, onReconfigured }: Props) {
  const insets = useSafeAreaInsets();
  const [participantCount, setParticipantCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [busy, setBusy] = useState<"sync" | "reset" | "pdf" | "print" | null>(null);

  async function refresh() {
    setParticipantCount(await participantsRepository.count());
    setPendingCount((await checkinsRepository.counts()).pending);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleForceSync() {
    setBusy("sync");
    try {
      if (!(await isOnline())) {
        Alert.alert("Sem conexão", "O terminal está offline agora. Tente novamente quando houver rede.");
        return;
      }
      await syncPendingCheckIns();
      await syncRoster();
      await refresh();
      Alert.alert("Sincronizado", "Participantes e check-ins pendentes foram sincronizados.");
    } catch (err) {
      Alert.alert("Falha na sincronização", err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setBusy(null);
    }
  }

  async function handleGeneratePdf() {
    setBusy("pdf");
    try {
      const { count } = await generateAndShareAttendanceReport(config);
      if (count === 0) {
        Alert.alert("Sem presenças", "Este terminal ainda não registrou nenhuma presença.");
      }
    } catch (err) {
      Alert.alert("Falha ao gerar relatório", err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePrintReport() {
    setBusy("print");
    try {
      const { count } = await printAttendanceReport(config);
      if (count === 0) {
        Alert.alert("Sem presenças", "Este terminal ainda não registrou nenhuma presença.");
      }
    } catch (err) {
      Alert.alert(
        "Falha ao imprimir",
        err instanceof Error ? err.message : "Não foi possível usar a impressora do terminal."
      );
    } finally {
      setBusy(null);
    }
  }

  function handleReconfigure() {
    const proceed = async () => {
      setBusy("reset");
      try {
        await configRepository.clearConfig();
        onReconfigured();
      } finally {
        setBusy(null);
      }
    };

    if (pendingCount > 0) {
      Alert.alert(
        "Existem check-ins não sincronizados",
        `Este terminal tem ${pendingCount} check-in(s) feito(s) offline que ainda não chegaram ao servidor. ` +
          "Trocar de terminal agora vai apagar esses registros locais antes de serem enviados. " +
          "Prefira sincronizar primeiro (use \"Forçar sincronização\" acima, com internet disponível).",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Trocar mesmo assim", style: "destructive", onPress: proceed },
        ]
      );
      return;
    }

    Alert.alert(
      "Desvincular este terminal?",
      `Isso desconecta o terminal de "${config.eventName}" e volta pra tela de configuração inicial. ` +
        "Você vai precisar de um novo código de ativação para reconfigurar.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Desvincular", style: "destructive", onPress: proceed },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <Text style={styles.backLink}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Configurações do terminal</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Row label="Servidor" value={config.serverUrl} />
          <Row label="Evento" value={config.eventName} />
          <Row label="Terminal" value={config.terminalName} />
          <Row label="ID do terminal" value={config.terminalId} mono />
        </View>

        <View style={styles.card}>
          <Row label="Participantes em cache" value={String(participantCount)} />
          <Row label="Check-ins pendentes de envio" value={String(pendingCount)} highlight={pendingCount > 0} />
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={handleForceSync}
          disabled={busy !== null}
        >
          <Text style={styles.buttonSecondaryText}>
            {busy === "sync" ? "Sincronizando..." : "Forçar sincronização agora"}
          </Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary, styles.buttonHalf]}
            onPress={handleGeneratePdf}
            disabled={busy !== null}
          >
            <Text style={styles.buttonSecondaryText}>{busy === "pdf" ? "Gerando..." : "Relatório em PDF"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary, styles.buttonHalf]}
            onPress={handlePrintReport}
            disabled={busy !== null}
          >
            <Text style={styles.buttonSecondaryText}>
              {busy === "print" ? "Imprimindo..." : "Imprimir na impressora"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonDanger]}
          onPress={handleReconfigure}
          disabled={busy !== null}
        >
          <Text style={styles.buttonDangerText}>
            {busy === "reset" ? "Desvinculando..." : "Trocar de terminal"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          O relatório lista as presenças registradas por ESTE terminal (nome e horário), com o evento e o
          terminal no cabeçalho. Pra ver o total do evento somando todos os terminais, use a aba Estatísticas
          no painel admin.
        </Text>

        <Text style={styles.hint}>
          "Trocar de terminal" desvincula este aparelho e volta pra tela onde você digita um novo código de
          ativação — gere o código no painel admin (aba Terminais do evento) antes de continuar. O servidor
          já vem configurado, não precisa digitar de novo.
        </Text>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, mono && styles.mono, highlight && styles.rowValueHighlight]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1F3A" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingBottom: 14,
    backgroundColor: "#0B1F3A",
    borderBottomWidth: 1,
    borderBottomColor: "#1c2c4a",
  },
  backLink: { color: "#8FB8FF", fontSize: 16 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  content: { padding: 20, gap: 16 },
  card: { backgroundColor: "#132a4d", borderRadius: 10, padding: 16, gap: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { color: "#8fa0bd", fontSize: 13, flexShrink: 0 },
  rowValue: { color: "#fff", fontSize: 14, flexShrink: 1, textAlign: "right" },
  rowValueHighlight: { color: "#E67E22", fontWeight: "700" },
  mono: { fontFamily: "monospace" },
  button: { borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  buttonHalf: { flex: 1 },
  buttonSecondary: { backgroundColor: "#132a4d", borderWidth: 1, borderColor: "#2a3f61" },
  buttonSecondaryText: { color: "#fff", fontWeight: "600" },
  buttonDanger: { backgroundColor: "#3a1414", borderWidth: 1, borderColor: "#B3261E" },
  buttonDangerText: { color: "#ff8a80", fontWeight: "700" },
  hint: { color: "#8fa0bd", fontSize: 12, lineHeight: 18 },
});
