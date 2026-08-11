import type { ScannerService } from "./ScannerService";

/**
 * Implementação de teste — permite inserir manualmente um código para
 * testar o fluxo de check-in inteiro sem o scanner físico (seção 5 da
 * especificação do produto). Usada pela tela de scanner quando o modo
 * "entrada manual" está ativo (útil para QA e para digitar um qrToken
 * copiado do painel admin durante desenvolvimento).
 */
export class MockScannerService implements ScannerService {
  private active = false;
  private listeners: Array<(value: string) => void> = [];

  async initialize(): Promise<void> {
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

  /** Chamado pela UI de entrada manual (um TextInput + botão "Simular leitura"). */
  simulateScan(value: string): void {
    if (!this.active || !value.trim()) return;
    for (const listener of this.listeners) {
      listener(value.trim());
    }
  }
}
