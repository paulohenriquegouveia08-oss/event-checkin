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
import { theme } from "../config/theme";
import type { TerminalConfig } from "../types/index";

interface Props {
  onActivated: (config: TerminalConfig) => void;
  notice?: string;
}

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
        placeholderTextColor={theme.textMuted}
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
        {loading ? <ActivityIndicator color={theme.white} /> : <Text style={styles.buttonText}>ATIVAR TERMINAL</Text>}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background, padding: 32, justifyContent: "center" },
  title: { color: theme.text, fontSize: 26, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  serverText: { color: theme.textMuted, fontSize: 13, textAlign: "center", marginBottom: 16 },
  notice: {
    color: theme.warning,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
    backgroundColor: theme.surfaceAlt,
    padding: 10,
    borderRadius: 8,
  },
  label: { color: theme.textMuted, fontSize: 14, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: theme.surfaceAlt,
    color: theme.text,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    borderWidth: 1,
    borderColor: theme.border,
  },
  codeInput: { letterSpacing: 4, textAlign: "center", fontSize: 22 },
  status: { color: theme.primary, marginTop: 16, textAlign: "center" },
  error: { color: theme.danger, marginTop: 16, textAlign: "center" },
  button: {
    marginTop: 32,
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: theme.white, fontSize: 18, fontWeight: "700", letterSpacing: 1 },
});
