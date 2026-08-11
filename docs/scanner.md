# Integração com o scanner do Elgin M10 Pro — Investigação (Fase 0)

Status: **validado fisicamente em hardware real** em 10/08/2026.

Convenção de confiança usada neste documento: `CONFIRMADO` (evidência direta —
código-fonte oficial ou teste no equipamento real), `PROVÁVEL` (inferência forte,
sem teste direto), `NÃO CONFIRMADO` (hipótese não verificada).

## 1. Identidade real do equipamento — CONFIRMADO

O equipamento vendido pela Elgin como "M10 Pro" é, na prática, um dispositivo
**iMin D1** (ODM chinesa) com uma build de firmware rebrandizada para a Elgin.
Verificado via `adb` diretamente no aparelho:

```
ro.product.model         = D1
ro.product.manufacturer  = iMin
ro.product.brand         = iMin
ro.build.display.id      = 1.0.1.3.12_Elgin_Beta_241220
```

O aparelho já vem com pacotes `com.elgin.elginexperience` e `com.elgin.tefhub`
(apps oficiais Elgin) convivendo com um conjunto de serviços de sistema
`com.imin.*` nativos da ROM iMin. Isso significa que a superfície de API real
não é só a "Plataforma de Comunicação Elgin" (biblioteca `e1`, documentada
publicamente para a linha M8/PosGo) — é a base Android da iMin por baixo.

Ficha técnica (fonte: revenda oficial, consistente com a ficha do fabricante):

| Item | Valor |
|---|---|
| SO | Android 11 (SDK 30) |
| Processador | Octa-core (2×A75 + 6×A55, até 1,8GHz) |
| RAM / Storage | 2GB / 16GB |
| Tela | 10,1" touch, 1280×800 |
| Leitor | Câmera 1D/2D, 0,3MP, foco fixo |
| Impressora | Térmica, 100mm/s |
| Conectividade | Wi-Fi 2,4/5GHz, BT 5.0, 4G, 2×USB-A, RJ45, RJ12 |

## 2. Como o scanner NÃO funciona — CONFIRMADO

Hipótese inicial (baseada nos exemplos oficiais da Elgin para o M8: Java,
Kotlin, React Native, Flutter, Xamarin, Delphi — todos usando apenas
`EditText`/`TextInput` comuns) era que o scanner operaria como **teclado
(HID/keyboard wedge)**: o leitor "digitaria" o valor decodificado no campo
com foco, como um leitor USB tradicional.

Essa hipótese foi **refutada por inspeção direta do hardware real**:

```
adb shell getevent -pl
```

Lista todos os dispositivos de input do sistema. Resultado: apenas
`goodix-ts` (touchscreen), `gpio-keys` (volume/power), jack de fone e
vibrador. **Não existe nenhum dispositivo de input adicional tipo
teclado/scanner** — se o scanner emulasse HID, apareceria aqui.

Reforçando a refutação:
- O app de sistema `com.imin.scandemo` (`/system/app/IminScan/IminScan.apk`,
  extraído do aparelho via `adb pull` e inspecionado com `aapt dump xmltree`)
  solicita `android.permission.CAMERA` e usa CameraX (`androidx.camera.*`)
  diretamente — não haveria necessidade disso se o scanner fosse HID.
- Nenhum `BroadcastReceiver` ou `Service` exportado relacionado a scan foi
  encontrado nesse APK, nem no serviço central `com.imin.iotdeviceservice`
  (que existe, mas seu propósito aparente é gestão remota/MDM, não scanner).
- Não existe documentação pública de um SDK de scanner da iMin.

## 3. Como o scanner realmente funciona — CONFIRMADO (testado fisicamente)

A leitura é feita **inteiramente por software, dentro do próprio app**,
usando a câmera do aparelho. Não há atalho de sistema.

Implementação usada no teste: **CameraX (`ImageAnalysis`) + ML Kit Barcode
Scanning** (modelo local/bundled, funciona offline, sem dependência de rede
durante o evento).

### Teste realizado

1. App Android nativo mínimo (`tools/scanner-poc-android/` neste repositório)
   com uma `PreviewView` em tela cheia + `ImageAnalysis` rodando ML Kit.
2. Compilado localmente com Gradle 8.9 / AGP 8.5.2 / compileSdk 34.
3. Instalado no aparelho via `adb install` (conexão adb sobre Wi-Fi, mesma
   rede do terminal).
4. QR Code gerado localmente (`PK-DIGITAL-TESTE-FASE0-001`) exibido em um
   monitor e apresentado à câmera traseira do equipamento.
5. Resultado, extraído via `adb shell uiautomator dump` (a UI do app exibe
   histórico das últimas leituras com timestamp):

   ```
   LIDO (21:18:05): PK-DIGITAL-TESTE-FASE0-001
   21:18:05  PK-DIGITAL-TESTE-FASE0-001
   21:18:03  PK-DIGITAL-TESTE-FASE0-001
   21:18:01  PK-DIGITAL-TESTE-FASE0-001
   21:17:58  PK-DIGITAL-TESTE-FASE0-001
   ```

   O intervalo de ~2s entre leituras confirma que o mecanismo de debounce
   (implementado no app de teste, janela de 2000ms) também funciona: sem
   ele, o mesmo QR geraria dezenas de "leituras" por segundo enquanto
   estivesse em quadro — validando também o requisito da seção 24 da
   especificação do produto (prevenção contra leitura dupla).

6. Confirmado via `logcat` que a câmera abre e mantém uma sessão de captura
   ativa continuamente (`Camera2CameraImpl`, `CaptureSession.onConfigured`),
   sem erros.

Nota lateral: `adb shell screencap` não conseguiu capturar visualmente o
preview da câmera (tela aparece preta no PNG) porque a `PreviewView` do
CameraX usa `SurfaceView` por padrão nesse modo de performance, cujo
conteúdo é composto por hardware e não é capturado por `screencap` — isso é
uma limitação conhecida da ferramenta, não um defeito do app. A validação
funcional foi feita lendo o texto real da UI (`uiautomator dump`), não a
imagem.

## 4. Decisão de arquitetura para o `ScannerService`

A interface abstrata definida na especificação do produto continua válida
sem alterações:

```ts
interface ScannerService {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  onScan(callback: (value: string) => void): void;
}
```

O que muda é a **implementação concreta**, que passa a ser baseada em
câmera + decodificação em software, não em captura de teclado:

- React Native: `react-native-vision-camera` + um frame processor de
  code-scanning (ML Kit), ou o barcode scanner nativo do `expo-camera`
  caso o projeto opte por Expo. A escolha entre os dois será feita na Fase 2
  com base em: suporte a `frameProcessor` de alta performance, tamanho do
  bundle, e facilidade de build para uma applicationId customizada.
- Deduplicação/debounce deve ficar na camada do `ScannerService`
  (não na tela), replicando o comportamento já validado no PoC nativo.
- Manter o `MockScannerService` (entrada manual) desde o primeiro commit.

## 5. Pendências / próximos passos de validação

- [ ] Validar em condições de iluminação de evento real (não só ambiente de
      escritório) e a distâncias variadas, já que a câmera é fixed-focus
      0,3MP — pode exigir orientação visual na tela para o operador
      posicionar o QR a uma distância ideal.
- [ ] Validar tempo de decodificação ponta a ponta (da apresentação do QR ao
      resultado) em sequência, para garantir a meta de "poucos segundos por
      pessoa" (seção 23 da especificação).
- [ ] Confirmar se existe uma segunda unidade M10 Pro (não apenas o D1/iMin
      testado) com hardware de leitura diferente (ex. engine dedicado a
      laser), já que a Elgin pode vender variações da mesma nomenclatura
      comercial com fornecedores diferentes ao longo do tempo — reforça a
      importância de manter o `ScannerService` como abstração.
