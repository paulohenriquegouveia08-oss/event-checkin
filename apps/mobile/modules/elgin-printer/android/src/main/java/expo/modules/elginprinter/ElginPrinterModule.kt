package expo.modules.elginprinter

import com.elgin.e1.Impressora.Termica
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Ponte pra impressora térmica embutida do Elgin M10 Pro (iMin D1),
 * usando a mesma biblioteca oficial da Elgin ("e1") usada nos exemplos
 * públicos da plataforma M8/M10/PosGo — ver
 * modules/elgin-printer/android/build.gradle e docs/printer.md pra
 * evidência/investigação completa.
 *
 * Convenções da classe `Termica` (todas confirmadas no código-fonte
 * oficial da Elgin, não inventadas):
 * - align: 0 = esquerda, 1 = centralizado, 2 = direita
 * - style: soma de flags — 1 = fonte B, 2 = sublinhado, 8 = negrito
 * - AbreConexaoImpressora(tipo, modelo, host, porta): tipo 6 = "coupled"/
 *   embutida (CONEXAO_M8) — internamente exige Build.MODEL igual a
 *   "MiniPDV M8"/"MiniPDV M10"/"EP5855" (confirmado via decompilação do
 *   e1-V02.16.00 — ver docs/printer.md). Neste M10 Pro físico, Build.MODEL
 *   é "D1" (é um iMin D1 rebrandeado — Fase 0), então tipo 6 SEMPRE falha
 *   com erro -5 aqui, independente do parâmetro "modelo". tipo 10 =
 *   CONEXAO_SERVICO: abre um Socket TCP cru (host, porta) pro serviço de
 *   impressão local do aparelho, sem checar Build.MODEL — é o caminho que
 *   este módulo usa. tipo/host/porta ficam configuráveis por parâmetro
 *   pra permitir testar variações em campo sem precisar recompilar.
 */
class ElginPrinterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ElginPrinter")

    Function("connect") { tipo: Int, modelo: String, host: String, porta: Int ->
      val activity = appContext.currentActivity
        ?: throw Exceptions.MissingActivity()
      Termica.setContext(activity)
      Termica.AbreConexaoImpressora(tipo, modelo, host, porta)
    }

    Function("disconnect") {
      Termica.FechaConexaoImpressora()
    }

    Function("printText") { text: String, align: Int, isBold: Boolean, isUnderline: Boolean ->
      var style = 0
      if (isUnderline) style += 2
      if (isBold) style += 8
      Termica.ImpressaoTexto(text, align, style, 0)
    }

    Function("feedLines") { lines: Int ->
      Termica.AvancaPapel(lines)
    }

    Function("cutPaper") {
      Termica.Corte(1)
    }

    // Sensor de papel — usado pra avisar o operador antes de tentar
    // imprimir um relatório longo sem papel na bobina.
    Function("paperStatus") {
      Termica.StatusImpressora(3)
    }
  }
}
