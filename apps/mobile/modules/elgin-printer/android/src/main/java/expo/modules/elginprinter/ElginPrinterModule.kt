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
 * - AbreConexaoImpressora(tipo, modelo, host, porta): tipo 6 = impressora
 *   interna (a única que nos interessa aqui — o M10 Pro não tem
 *   impressora externa via IP/USB neste projeto).
 */
class ElginPrinterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ElginPrinter")

    Function("connect") {
      val activity = appContext.currentActivity
        ?: throw Exceptions.MissingActivity()
      Termica.setContext(activity)
      Termica.AbreConexaoImpressora(6, "M10", "", 0)
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
