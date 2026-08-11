import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { activateTerminal, checkServerHealth } from "../services/api/client";
import * as configRepository from "../database/configRepository";
import { syncRoster } from "../services/sync/syncService";
import { SERVER_URL } from "../config/constants";
import type { TerminalConfig } from "../types/index";

interface Props {
  onActivated: (config: TerminalConfig) => void;
  /** Mostrado quando a tela é aberta porque o terminal foi desconectado
   * automaticamente (ex.: excluído no painel admin) — ver App.tsx. */
  notice?: string;
}

/**
 * Assistente de configuração inicial — seção 16 da especificação do
 * produto. O servidor é fixo (SERVER_URL, ver config/constants.ts) — este
 * cliente opera com uma única VPS, então o operador só precisa do código
 * de ativação (gerado no painel admin, aba Terminais do evento). Menos
 * campo pra digitar errado em campo.
 */
export function SetupScreen({ onActivated, notice }: Props) {
  const [activationCode, setActivationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleActivate() {
    setError(null);
    if (!activationCode.trim()) {
      setError("Digite o código de ativação.");
      return;
    }
    setLoading(true);
    try {
      setStatusMessage("Conectando ao servidor...");
      const healthy = await checkServerHealth(SERVER_URL);
      if (!healthy) {
        setError("Não foi possível conectar ao servidor. Confira a conexão de rede do terminal.");
        return;
      }

      setStatusMessage("Ativando terminal...");
      const activation = await activateTerminal(SERVER_URL, activationCode.trim().toUpperCase());

      const config: TerminalConfig = {
        serverUrl: SERVER_URL,
        token: activation.token,
        terminalId: activation.terminal.id,
        terminalName: activation.terminal.name,
        eventId: activation.event.id,
        eventName: activation.event.name,
      };
      await configRepository.saveConfig(config);

      // Sincroniza o roster imediatamente após ativar, pra o terminal já
      // conseguir validar leituras mesmo que a internet caia em seguida.
      // Diferente de antes, uma falha aqui é mostrada ao operador (não
      // silenciada) — sem o roster, nenhuma leitura vai validar.
      setStatusMessage("Sincronizando participantes...");
      try {
        const { participantCount } = await syncRoster();
        setStatusMessage(`${participantCount} participante(s) sincronizado(s).`);
      } catch (syncError) {
        setError(
          `Terminal ativado, mas a sincronização de participantes falhou: ${
            syncError instanceof Error ? syncError.message : String(syncError)
          }. Você pode tentar sincronizar de novo na tela principal.`
        );
      }

      onActivated(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao ativar o terminal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>CONFIGURAÇÃO DO TERMINAL</Text>
      <Text style={styles.serverText}>{SERVER_URL}</Text>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Text style={styles.label}>Código de ativação</Text>
      <TextInput
        style={[styles.input, styles.codeInput]}
        placeholder="XXXX-XXXX"
        placeholderTextColor="#8a94a6"
        autoCapitalize="characters"
        autoCorrect={false}
        value={activationCode}
        onChangeText={setActivationCode}
        editable={!loading}
        autoFocus
      />

      {statusMessage && loading ? <Text style={styles.status}>{statusMessage}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleActivate}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ATIVAR TERMINAL</Text>}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1F3A", padding: 32, justifyContent: "center" },
  title: { color: "#fff", fontSize: 26, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  serverText: { color: "#8fa0bd", fontSize: 13, textAlign: "center", marginBottom: 16 },
  notice: {
    color: "#E67E22",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
    backgroundColor: "#3a2410",
    padding: 10,
    borderRadius: 8,
  },
  label: { color: "#c7d0e0", fontSize: 14, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: "#132a4d",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    borderWidth: 1,
    borderColor: "#2a3f61",
  },
  codeInput: { letterSpacing: 4, textAlign: "center", fontSize: 22 },
  status: { color: "#8FB8FF", marginTop: 16, textAlign: "center" },
  error: { color: "#ff6b6b", marginTop: 16, textAlign: "center" },
  button: {
    marginTop: 32,
    backgroundColor: "#2F6FED",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "700", letterSpacing: 1 },
});
