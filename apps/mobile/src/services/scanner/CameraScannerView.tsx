import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraScannerService } from "./CameraScannerService";

interface Props {
  service: CameraScannerService;
}

/** Ponte entre o componente de câmera do Expo (declarativo) e o
 * CameraScannerService (imperativo, é o que o resto do app conhece).
 * Fica escondido atrás do ScannerService — trocar por outra
 * implementação de câmera não muda nada fora deste arquivo. */
export function CameraScannerView({ service }: Props) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) {
    return <View style={styles.fill} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.centered]}>
        <Text style={styles.message}>
          Permissão de câmera negada. Ative em Configurações do Android para usar o scanner.
        </Text>
      </View>
    );
  }

  return (
    <CameraView
      style={styles.fill}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      onBarcodeScanned={(result) => service.handleRawScan(result.data)}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center", padding: 24 },
  message: { color: "#fff", fontSize: 16, textAlign: "center" },
});
