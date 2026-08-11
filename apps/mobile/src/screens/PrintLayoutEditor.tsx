import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../config/theme";
import {
  loadPrintLayout,
  savePrintLayout,
} from "../services/report/printReport";
import {
  type PrintLayout,
  type PrintLayoutField,
} from "../services/report/printLayout";

interface Props {
  onBack: () => void;
}

const ALIGN_OPTIONS = ["left", "center", "right"] as const;
const ALIGN_LABELS = { left: "Esquerda", center: "Centro", right: "Direita" };

export function PrintLayoutEditor({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [layout, setLayout] = useState<PrintLayout | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrintLayout().then(setLayout);
  }, []);

  function updateField(id: string, changes: Partial<PrintLayoutField>) {
    if (!layout) return;
    setLayout({
      ...layout,
      fields: layout.fields.map((f) => (f.id === id ? { ...f, ...changes } : f)),
    });
  }

  function cycleAlign(id: string) {
    if (!layout) return;
    const field = layout.fields.find((f) => f.id === id);
    if (!field) return;
    const idx = ALIGN_OPTIONS.indexOf(field.align);
    const next = ALIGN_OPTIONS[(idx + 1) % ALIGN_OPTIONS.length];
    updateField(id, { align: next });
  }

  async function handleSave() {
    if (!layout) return;
    setSaving(true);
    try {
      await savePrintLayout(layout);
      Alert.alert("Salvo", "Layout de impressão atualizado com sucesso!");
    } catch {
      Alert.alert("Erro", "Não foi possível salvar o layout.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    Alert.alert("Restaurar padrão", "Isso vai restaurar o layout original. Continuar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Restaurar",
        onPress: async () => {
          const { DEFAULT_PRINT_LAYOUT } = await import("../services/report/printLayout");
          setLayout({ ...DEFAULT_PRINT_LAYOUT });
        },
      },
    ]);
  }

  if (!layout) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <Text style={styles.backLink}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Editor de Impressão</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header text */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cabeçalho</Text>
          <Text style={styles.label}>Texto do cabeçalho</Text>
          <TextInput
            style={styles.input}
            value={layout.headerText}
            onChangeText={(t) => setLayout({ ...layout, headerText: t })}
            placeholder="RELATÓRIO DE PRESENÇA"
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Footer text */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rodapé</Text>
          <Text style={styles.label}>Texto do rodapé</Text>
          <TextInput
            style={styles.input}
            value={layout.footerText}
            onChangeText={(t) => setLayout({ ...layout, footerText: t })}
            placeholder="Obrigado!"
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Feed before cut */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Corte</Text>
          <Text style={styles.label}>Linhas antes do corte: {layout.feedBeforeCut}</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => setLayout({ ...layout, feedBeforeCut: Math.max(0, layout.feedBeforeCut - 1) })}
            >
              <Text style={styles.stepperBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{layout.feedBeforeCut}</Text>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => setLayout({ ...layout, feedBeforeCut: Math.min(10, layout.feedBeforeCut + 1) })}
            >
              <Text style={styles.stepperBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Fields */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Campos do Relatório</Text>
          <Text style={styles.hint}>Arraste para reordenar. Toque no alinhamento para ciclar.</Text>

          {layout.fields.map((field) => (
            <View key={field.id} style={styles.fieldRow}>
              <View style={styles.fieldInfo}>
                <Switch
                  value={field.enabled}
                  onValueChange={(v) => updateField(field.id, { enabled: v })}
                  trackColor={{ false: theme.surfaceAlt, true: theme.primary }}
                  thumbColor={theme.white}
                />
                <Text style={[styles.fieldLabel, !field.enabled && styles.fieldLabelDisabled]}>
                  {field.label}
                </Text>
              </View>

              <View style={styles.fieldControls}>
                <TouchableOpacity style={styles.alignBtn} onPress={() => cycleAlign(field.id)}>
                  <Text style={styles.alignBtnText}>{ALIGN_LABELS[field.align]}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.styleBtn, field.bold && styles.styleBtnActive]}
                  onPress={() => updateField(field.id, { bold: !field.bold })}
                >
                  <Text style={[styles.styleBtnText, field.bold && styles.styleBtnTextActive]}>N</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.styleBtn, field.underline && styles.styleBtnActive]}
                  onPress={() => updateField(field.id, { underline: !field.underline })}
                >
                  <Text style={[styles.styleBtnText, field.underline && styles.styleBtnTextActive]}>S</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? "Salvando..." : "Salvar Layout"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetBtnText}>Restaurar Padrão</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingBottom: 14,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backLink: { color: theme.primary, fontSize: 16 },
  title: { color: theme.text, fontSize: 18, fontWeight: "700" },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  card: { backgroundColor: theme.surfaceAlt, borderRadius: 10, padding: 16, gap: 10 },
  sectionTitle: { color: theme.text, fontSize: 16, fontWeight: "700" },
  label: { color: theme.textMuted, fontSize: 13, marginBottom: 4 },
  hint: { color: theme.textMuted, fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: theme.surface,
    color: theme.text,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16 },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: { color: theme.text, fontSize: 20, fontWeight: "700" },
  stepperValue: { color: theme.text, fontSize: 18, fontWeight: "600", minWidth: 30, textAlign: "center" },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  fieldInfo: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  fieldLabel: { color: theme.text, fontSize: 14 },
  fieldLabelDisabled: { color: theme.textMuted },
  fieldControls: { flexDirection: "row", alignItems: "center", gap: 6 },
  alignBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  alignBtnText: { color: theme.primary, fontSize: 11, fontWeight: "600" },
  styleBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  styleBtnActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  styleBtnText: { color: theme.textMuted, fontSize: 13, fontWeight: "700" },
  styleBtnTextActive: { color: theme.white },
  actions: { gap: 12, marginTop: 8 },
  saveBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  saveBtnText: { color: theme.white, fontSize: 16, fontWeight: "700" },
  resetBtn: {
    backgroundColor: theme.surfaceAlt,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  resetBtnText: { color: theme.textMuted, fontSize: 14, fontWeight: "600" },
});
