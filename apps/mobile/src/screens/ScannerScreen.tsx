import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraScannerService } from "../services/scanner/CameraScannerService";
import { CameraScannerView } from "../services/scanner/CameraScannerView";
import { MockScannerService } from "../services/scanner/MockScannerService";
import { performCheckIn } from "../services/checkin/checkinService";
import { syncPendingCheckIns, syncRoster } from "../services/sync/syncService";
import { isOnline, subscribeConnectivity } from "../services/network/connectivity";
import * as checkinsRepository from "../database/checkinsRepository";
import * as participantsRepository from "../database/participantsRepository";
import { useFeedback } from "../hooks/useFeedback";
import { FeedbackOverlay } from "../components/FeedbackOverlay";
import type { CheckInResult, TerminalConfig } from "../types/index";

interface Props {
  config: TerminalConfig;
  onOpenSettings: () => void;
}

const FEEDBACK_DURATION_MS = 1800;
const SYNC_INTERVAL_MS = 20000;

export function ScannerScreen({ config, onOpenSettings }: Props) {
  const insets = useSafeAreaInsets();
  const scannerService = useRef(new CameraScannerService()).current;
  const mockService = useRef(new MockScannerService()).current;
  const { play } = useFeedback();

  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [feedback, setFeedback] = useState<CheckInResult | null>(null);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [participantCount, setParticipantCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const processingRef = useRef(false);

  async function refreshPendingCount() {
    const counts = await checkinsRepository.counts();
    setPendingCount(counts.pending);
  }

  async function refreshParticipantCount() {
    setParticipantCount(await participantsRepository.count());
  }

  /** Sincronização manual, acionada pelo operador tocando no indicador de
   * status — útil tanto para forçar uma atualização quanto para os casos
   * em que a sincronização automática ainda não rodou (ex.: logo após a
   * ativação, se a rede cair no momento exato da primeira tentativa). */
  async function handleManualSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      if (await isOnline()) {
        await syncRoster();
        await syncPendingCheckIns();
      }
    } catch {
      // Mantém o cache atual — tenta de novo na próxima tentativa manual
      // ou no próximo ciclo automático.
    } finally {
      await refreshParticipantCount();
      await refreshPendingCount();
      setSyncing(false);
    }
  }

  async function handleScan(value: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    await scannerService.stop();
    mockService.stop();

    try {
      const result = await performCheckIn(value);
      setFeedback(result);
      play(result.status);
    } catch {
      setFeedback({ status: "INVALID_TOKEN" });
    } finally {
      await refreshPendingCount();
      setTimeout(async () => {
        setFeedback(null);
        processingRef.current = false;
        if (!manualMode) await scannerService.start();
        else await mockService.start();
      }, FEEDBACK_DURATION_MS);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      await scannerService.initialize();
      scannerService.onScan(handleScan);
      await mockService.initialize();
      mockService.onScan(handleScan);
      if (!manualMode) await scannerService.start();

      const initiallyOnline = await isOnline();
      if (mounted) setOnline(initiallyOnline);
      await refreshPendingCount();
      await refreshParticipantCount();

      // Autocorreção: se por algum motivo o terminal ficou sem nenhum
      // participante em cache (ex.: a sincronização da ativação falhou
      // silenciosamente), tenta sincronizar assim que a tela principal abre.
      const currentCount = await participantsRepository.count();
      if (currentCount === 0 && initiallyOnline) {
        try {
          await syncRoster();
        } catch {
          // Sem sorte agora — o operador ainda pode forçar manualmente
          // tocando no indicador de status, ou o ciclo automático tenta de novo.
        } finally {
          if (mounted) await refreshParticipantCount();
        }
      }
    })();

    const unsubscribe = subscribeConnectivity((value) => {
      if (mounted) setOnline(value);
    });

    return () => {
      mounted = false;
      unsubscribe();
      scannerService.stop();
      mockService.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronização periódica em segundo plano: puxa check-ins pendentes
  // assim que há rede, sem exigir ação do operador (seção 13).
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!(await isOnline())) return;
      try {
        await syncPendingCheckIns();
        await syncRoster();
      } catch {
        // Rede instável — tenta de novo no próximo ciclo, sem interromper a operação.
      } finally {
        await refreshPendingCount();
        await refreshParticipantCount();
      }
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (manualMode) {
      scannerService.stop();
      mockService.start();
    } else {
      mockService.stop();
      if (!processingRef.current) scannerService.start();
    }
  }, [manualMode]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onOpenSettings} hitSlop={12} style={styles.settingsButton}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.eventName}>{config.eventName}</Text>
            <Text style={styles.terminalName}>{config.terminalName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerRight} onPress={handleManualSync} disabled={syncing}>
          <Text style={styles.cacheText}>
            {syncing ? "Sincronizando..." : `${participantCount} credenciado(s) em cache`}
          </Text>
          {pendingCount > 0 ? (
            <Text style={styles.pendingBadge}>{pendingCount} pendente(s) de envio</Text>
          ) : null}
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: online ? "#2ECC71" : "#E67E22" }]} />
            <Text style={styles.statusText}>{online ? "ONLINE" : "OFFLINE"}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraArea}>
        {!manualMode ? (
          <CameraScannerView service={scannerService} />
        ) : (
          <View style={styles.manualArea}>
            <Text style={styles.manualLabel}>Entrada manual (modo de teste)</Text>
            <TextInput
              style={styles.manualInput}
              placeholder="evt_..."
              placeholderTextColor="#8a94a6"
              autoCapitalize="none"
              value={manualValue}
              onChangeText={setManualValue}
            />
            <TouchableOpacity
              style={styles.manualButton}
              onPress={() => {
                mockService.simulateScan(manualValue);
                setManualValue("");
              }}
            >
              <Text style={styles.manualButtonText}>SIMULAR LEITURA</Text>
            </TouchableOpacity>
          </View>
        )}

        {!feedback ? <Text style={styles.waiting}>Aguardando leitura...</Text> : null}
        {feedback ? <FeedbackOverlay result={feedback} /> : null}
      </View>

      <TouchableOpacity
        style={[styles.modeToggle, { paddingBottom: insets.bottom + 14, paddingLeft: insets.left + 14, paddingRight: insets.right + 14 }]}
        onPress={() => setManualMode((v) => !v)}
      >
        <Text style={styles.modeToggleText}>
          {manualMode ? "Usar câmera" : "Entrada manual (teste)"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#0B1F3A",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingsButton: { padding: 4 },
  settingsIcon: { color: "#8FB8FF", fontSize: 22 },
  eventName: { color: "#fff", fontSize: 18, fontWeight: "700" },
  terminalName: { color: "#c7d0e0", fontSize: 13 },
  headerRight: { alignItems: "flex-end", gap: 4 },
  cacheText: { color: "#8FB8FF", fontSize: 11 },
  pendingBadge: { color: "#E67E22", fontSize: 12, fontWeight: "600" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  cameraArea: { flex: 1, position: "relative" },
  waiting: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    color: "#fff",
    fontSize: 16,
    backgroundColor: "#00000088",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  manualArea: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 16 },
  manualLabel: { color: "#c7d0e0", fontSize: 14 },
  manualInput: {
    width: "100%",
    backgroundColor: "#132a4d",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  manualButton: { backgroundColor: "#2F6FED", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  manualButtonText: { color: "#fff", fontWeight: "700" },
  modeToggle: { padding: 14, alignItems: "center", backgroundColor: "#0B1F3A" },
  modeToggleText: { color: "#8FB8FF", fontSize: 13 },
});
