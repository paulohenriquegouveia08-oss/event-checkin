import { NativeModule, requireNativeModule } from "expo";

declare class ElginPrinterModule extends NativeModule<{}> {
  /** Abre a conexão com a impressora térmica interna. Retorna 0 em
   * sucesso (convenção da lib nativa da Elgin — qualquer valor != 0 é erro).
   * tipo: 6 = CONEXAO_M8 (embutida "coupled" — exige Build.MODEL
   * "MiniPDV M8/M10", não funciona neste hardware); 10 = CONEXAO_SERVICO
   * (socket TCP local host:porta, não checa Build.MODEL). Ver docs/printer.md. */
  connect(tipo: number, modelo: string, host: string, porta: number): number;
  disconnect(): void;
  /** align: 0 esquerda, 1 centro, 2 direita. */
  printText(text: string, align: number, isBold: boolean, isUnderline: boolean): number;
  feedLines(lines: number): number;
  cutPaper(): number;
  /** 0 = tem papel; != 0 = sem papel/erro (convenção da lib nativa). */
  paperStatus(): number;
}

export default requireNativeModule<ElginPrinterModule>("ElginPrinter");
