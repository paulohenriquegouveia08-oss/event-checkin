import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { SETTINGS_PASSWORD } from "../config/constants";
import { theme } from "../config/theme";

interface Props {
  onUnlocked: () => void;
  onCancel: () => void;
}

export function PasswordGateScreen({ onUnlocked, onCancel }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit() {
    if (password === SETTINGS_PASSWORD) {
      setPassword("");
      setError(false);
      onUnlocked();
    } else {
      setError(true);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.title}>Configurações protegidas</Text>
      <Text style={styles.subtitle}>Digite o PIN para continuar</Text>

      <TextInput
        style={styles.input}
        placeholder="PIN"
        placeholderTextColor={theme.textMuted}
        secureTextEntry
        autoFocus
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setError(false);
        }}
        onSubmitEditing={handleSubmit}
      />

      {error ? <Text style={styles.error}>PIN incorreto.</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>ENTRAR</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
        <Text style={styles.cancelText}>Cancelar</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background, padding: 32, justifyContent: "center" },
  title: { color: theme.text, fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  subtitle: { color: theme.textMuted, fontSize: 14, textAlign: "center", marginBottom: 28 },
  input: {
    backgroundColor: theme.surfaceAlt,
    color: theme.text,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    textAlign: "center",
    letterSpacing: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  error: { color: theme.danger, marginTop: 12, textAlign: "center" },
  button: { marginTop: 24, backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  buttonText: { color: theme.white, fontSize: 16, fontWeight: "700", letterSpacing: 1 },
  cancelButton: { marginTop: 16, alignItems: "center" },
  cancelText: { color: theme.primary, fontSize: 14 },
});
