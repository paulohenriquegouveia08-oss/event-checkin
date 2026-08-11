package expo.modules.elginprinter

import android.util.Log
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.imin.printer.PrinterHelper
import com.imin.printerlib.IminPrintUtils

/**
 * Expo module para impressora iMin D1.
 * Usa IminPrintUtils (SDK 1.0) via conexão USB interna.
 */
class ElginPrinterModule : Module() {
  private var iminPrintUtils: IminPrintUtils? = null
  private var initialized = false

  override fun definition() = ModuleDefinition {
    Name("ElginPrinter")

    OnCreate {
      val ctx = appContext.reactContext ?: throw Exceptions.MissingActivity()
      PrinterHelper.getInstance().initPrinterService(ctx)
      val utils = IminPrintUtils.getInstance(ctx)
      utils.initPrinter(IminPrintUtils.PrintConnectType.USB)
      iminPrintUtils = utils
      initialized = true
      Log.d("ElginPrinter", "iMin printer initialized (USB)")
    }

    Function("connect") { tipo: Int, modelo: String, host: String, porta: Int ->
      if (initialized) 0 else -1
    }

    Function("disconnect") {
      // Keep service alive
    }

    Function("printText") { text: String, align: Int, isBold: Boolean, isUnderline: Boolean ->
      val printer = iminPrintUtils ?: return@Function -1
      try {
        printer.setAlignment(align)
        printer.setTextStyle(if (isBold) 1 else 0)
        printer.setTextSize(24)
        printer.setUnderline(isUnderline)
        printer.printText(text)
        printer.printAndLineFeed()
        0
      } catch (e: Exception) {
        Log.e("ElginPrinter", "printText error", e)
        -1
      }
    }

    Function("feedLines") { lines: Int ->
      val printer = iminPrintUtils ?: return@Function -1
      try {
        for (i in 0 until lines) {
          printer.printAndLineFeed()
        }
        0
      } catch (e: Exception) {
        Log.e("ElginPrinter", "feedLines error", e)
        -1
      }
    }

    Function("cutPaper") {
      val printer = iminPrintUtils ?: return@Function -1
      try {
        printer.partialCut()
        0
      } catch (e: Exception) {
        0
      }
    }

    Function("cutTotal") {
      val printer = iminPrintUtils ?: return@Function -1
      try {
        printer.partialCut()
        0
      } catch (e: Exception) {
        0
      }
    }

    Function("paperStatus") {
      val printer = iminPrintUtils ?: return@Function -1
      try {
        printer.getPrinterStatus()
      } catch (e: Exception) {
        -1
      }
    }

    Function("initialize") {
      val printer = iminPrintUtils ?: return@Function -1
      try {
        printer.initPrinter(IminPrintUtils.PrintConnectType.USB)
        0
      } catch (e: Exception) {
        Log.e("ElginPrinter", "initialize error", e)
        -1
      }
    }
  }
}
