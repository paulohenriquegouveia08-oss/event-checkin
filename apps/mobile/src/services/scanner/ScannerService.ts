/**
 * Abstração do leitor de QR Code — definida na especificação do produto
 * (seção 5) para que a implementação concreta (câmera, HID, SDK
 * proprietário) possa ser trocada sem tocar a lógica de negócio.
 *
 * Investigação da Fase 0 (ver /docs/scanner.md): o Elgin M10 Pro real
 * (fisicamente um iMin D1) não expõe o scanner via sistema (HID, Intent,
 * serviço) — a leitura precisa ser feita por software, usando a câmera.
 * A implementação concreta usada aqui é `CameraScannerService`.
 */
export interface ScannerService {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  onScan(callback: (value: string) => void): void;
}
