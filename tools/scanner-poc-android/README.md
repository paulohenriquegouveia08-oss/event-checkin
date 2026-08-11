# scanner-poc-android

App Android nativo mínimo (Kotlin) usado para validar fisicamente a leitura
de QR Code no Elgin M10 Pro / iMin D1. Não faz parte do produto final — é a
prova de conceito que fundamentou a decisão de arquitetura registrada em
[`../../docs/scanner.md`](../../docs/scanner.md).

## O que faz

Abre a câmera traseira em tela cheia (CameraX), roda ML Kit Barcode Scanning
sobre cada frame, e mostra na tela o valor decodificado + histórico das
últimas leituras com timestamp. Tem deduplicação (debounce de 2s) para não
reprocessar o mesmo código múltiplas vezes seguidas.

## Build e instalação

Requer JDK 17 e Android SDK (build-tools 34, platform 34). Não usa Gradle
Wrapper commitado — use um Gradle 8.9 local:

```bash
export ANDROID_HOME=/caminho/para/android-sdk
gradle assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell pm grant com.pkdigital.scannertest android.permission.CAMERA
adb shell am start -n com.pkdigital.scannertest/.MainActivity
```
