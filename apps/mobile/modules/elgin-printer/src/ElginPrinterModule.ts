import { NativeModule, requireNativeModule } from "expo";

declare class ElginPrinterModule extends NativeModule<{}> {
  /** Abre a conexão com a impressora térmica interna. Retorna 0 em
   * sucesso (convenção da lib nativa da Elgin — qualquer valor != 0 é erro). */
  connect(): number;
  disconnect(): void;
  /** align: 0 esquerda, 1 centro, 2 direita. */
  printText(text: string, align: number, isBold: boolean, isUnderline: boolean): number;
  feedLines(lines: number): number;
  cutPaper(): number;
  /** 0 = tem papel; != 0 = sem papel/erro (convenção da lib nativa). */
  paperStatus(): number;
}

export default requireNativeModule<ElginPrinterModule>("ElginPrinter");
