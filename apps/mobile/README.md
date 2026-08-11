# apps/mobile — App do terminal (Elgin M10 Pro / iMin D1)

Expo + React Native + TypeScript. Fase 2 da especificação do produto,
**validada fisicamente** no equipamento real (ver
[`docs/scanner.md`](../../docs/scanner.md) para a investigação que
fundamentou as decisões abaixo).

## O que faz

- Assistente de configuração inicial (URL do servidor + código de
  ativação de uso único).
- Leitura de QR Code via câmera (`expo-camera`, ML Kit por baixo) —
  **não** por teclado/HID, confirmado fisicamente inviável neste
  hardware.
- Modo de entrada manual (sem câmera) para testes.
- Feedback visual + sonoro + tátil por resultado (confirmado, já
  registrado, inválido, inativo).
- Cache local (SQLite) de participantes + fila de check-ins offline,
  sincronizados automaticamente quando a rede volta.
- Token do terminal guardado no Keystore/Keychain (`expo-secure-store`),
  nunca em texto puro no banco local.

## Rodando localmente

Requer JDK 17 e Android SDK (build-tools 34+, platform 34+).

```bash
npm install
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

Não use `assembleDebug`/`expo start` para gerar o APK final — o build
debug depende do Metro (bundler de desenvolvimento) rodando na mesma
rede; o build **release** embute o bundle JS e roda standalone, que é o
que efetivamente é instalado no equipamento.

## Limitações conhecidas

- `android:usesCleartextTraffic` está habilitado (via plugin
  `expo-build-properties`) para permitir `http://` sem TLS — necessário
  enquanto o backend não tiver HTTPS configurado (ver
  [`../../docs/security.md`](../../docs/security.md)). Deve ser
  reavaliado quando o backend tiver certificado válido.
- Timeout de rede do check-in é intencionalmente curto (3s — ver
  `src/services/api/client.ts`) para não travar o operador quando o
  servidor está inacessível; isso significa que uma rede muito lenta
  (mas funcional) pode ser tratada como offline com mais frequência do
  que o ideal. Trade-off consciente a favor de responsividade.
