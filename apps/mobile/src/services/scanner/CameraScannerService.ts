import type { ScannerService } from "./ScannerService";

const DEBOUNCE_MS = 2000;

/**
 * Implementação real do scanner, baseada em câmera (CameraX/ML Kit por
 * baixo, via expo-camera) — validada fisicamente no M10 Pro/iMin D1 na
 * Fase 0 (ver /docs/scanner.md e /tools/scanner-poc-android).
 *
 * O componente React <CameraScannerView> (services/scanner/CameraScannerView.tsx)
 * é quem efetivamente renderiza a câmera e chama `handleRawScan()` a cada
 * frame decodificado — esta classe só cuida do contrato ScannerService
 * (start/stop/onScan) e da deduplicação (seção 24 da especificação: o
 * mesmo QR pode ser decodificado várias vezes por segundo enquanto está
 * em quadro; sem debounce isso viraria várias requisições de check-in).
 */
export class CameraScannerService implements ScannerService {
  private active = false;
  private listeners: Array<(value: string) => void> = [];
  private lastValue: string | null = null;
  private lastTimestamp = 0;

  async initialize(): Promise<void> {
    // Permissão de câmera é pedida pela UI (hook useCameraPermissions do
    // expo-camera) — nada a inicializar aqui além do estado interno.
    this.active = false;
  }

  async start(): Promise<void> {
    this.active = true;
  }

  async stop(): Promise<void> {
    this.active = false;
  }

  onScan(callback: (value: string) => void): void {
    this.listeners.push(callback);
  }

  isActive(): boolean {
    return this.active;
  }

  /** Chamado pelo <CameraScannerView> a cada leitura bruta da câmera. Não
   * faz parte da interface pública ScannerService — é o ponto de ligação
   * entre o componente React (declarativo) e este serviço (imperativo). */
  handleRawScan(value: string): void {
    if (!this.active) return;

    const now = Date.now();
    if (value === this.lastValue && now - this.lastTimestamp < DEBOUNCE_MS) {
      return;
    }
    this.lastValue = value;
    this.lastTimestamp = now;

    for (const listener of this.listeners) {
      listener(value);
    }
  }
}
