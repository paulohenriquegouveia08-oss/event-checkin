import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { SETTINGS_PASSWORD } from "../config/constants";

interface Props {
  onUnlocked: () => void;
  onCancel: () => void;
}

/** Trava simples antes de entrar nas configurações do terminal — ver
 * config/constants.ts para o porquê do PIN ficar em claro no código. */
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
        placeholderTextColor="#8a94a6"
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
  container: { flex: 1, backgroundColor: "#0B1F3A", padding: 32, justifyContent: "center" },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  subtitle: { color: "#8fa0bd", fontSize: 14, textAlign: "center", marginBottom: 28 },
  input: {
    backgroundColor: "#132a4d",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    textAlign: "center",
    letterSpacing: 6,
    borderWidth: 1,
    borderColor: "#2a3f61",
  },
  error: { color: "#ff6b6b", marginTop: 12, textAlign: "center" },
  button: { marginTop: 24, backgroundColor: "#2F6FED", paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 1 },
  cancelButton: { marginTop: 16, alignItems: "center" },
  cancelText: { color: "#8FB8FF", fontSize: 14 },
});
