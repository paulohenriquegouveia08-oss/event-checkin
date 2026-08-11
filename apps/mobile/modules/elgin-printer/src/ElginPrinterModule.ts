import { NativeModule, requireNativeModule } from "expo";

declare class ElginPrinterModule extends NativeModule<{}> {
  connect(tipo: number, modelo: string, host: string, porta: number): number;
  disconnect(): void;
  printText(text: string, align: number, isBold: boolean, isUnderline: boolean): number;
  feedLines(lines: number): number;
  cutPaper(): number;
  cutTotal(): number;
  paperStatus(): number;
  initialize(): number;
}

export default requireNativeModule<ElginPrinterModule>("ElginPrinter");
