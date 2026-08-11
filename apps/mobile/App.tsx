import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as configRepository from "./src/database/configRepository";
import { SetupScreen } from "./src/screens/SetupScreen";
import { ScannerScreen } from "./src/screens/ScannerScreen";
import { PasswordGateScreen } from "./src/screens/PasswordGateScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { PrintLayoutEditor } from "./src/screens/PrintLayoutEditor";
import { onTerminalUnauthorized } from "./src/services/session/sessionEvents";
import { theme } from "./src/config/theme";
import type { TerminalConfig } from "./src/types/index";

type Screen = "scanner" | "password" | "settings" | "print-editor";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<TerminalConfig | null>(null);
  const [screen, setScreen] = useState<Screen>("scanner");
  const [disconnectedNotice, setDisconnectedNotice] = useState<string | undefined>();

  useEffect(() => {
    configRepository
      .loadConfig()
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return onTerminalUnauthorized(() => {
      configRepository.clearConfig().finally(() => {
        setConfig(null);
        setScreen("scanner");
        setDisconnectedNotice(
          "Este terminal foi desconectado (revogado no painel admin). Ative novamente com um novo código."
        );
      });
    });
  }, []);

  function handleActivated(newConfig: TerminalConfig) {
    setDisconnectedNotice(undefined);
    setConfig(newConfig);
    setScreen("scanner");
  }

  function handleReconfigured() {
    setConfig(null);
    setScreen("scanner");
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" hidden />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : !config ? (
        <SetupScreen onActivated={handleActivated} notice={disconnectedNotice} />
      ) : screen === "password" ? (
        <PasswordGateScreen onUnlocked={() => setScreen("settings")} onCancel={() => setScreen("scanner")} />
      ) : screen === "settings" ? (
        <SettingsScreen
          config={config}
          onBack={() => setScreen("scanner")}
          onReconfigured={handleReconfigured}
          onOpenPrintEditor={() => setScreen("print-editor")}
        />
      ) : screen === "print-editor" ? (
        <PrintLayoutEditor onBack={() => setScreen("settings")} />
      ) : (
        <ScannerScreen config={config} onOpenSettings={() => setScreen("password")} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: theme.background, justifyContent: "center", alignItems: "center" },
});
