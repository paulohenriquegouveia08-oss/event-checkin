/**
 * Inicia automaticamente o download do app APK do leitor de QR Code / credenciamento.
 * Disparado ao dar duplo clique (ou duplo toque rápido em telas touch) na logo do Copol.
 */

let lastTap = 0;

export function downloadApk() {
  if (typeof window === "undefined") return;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://137-131-233-254.sslip.io";
  const downloadUrl = `${apiUrl.replace(/\/+$/, "")}/apk`;

  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "pk-digital-credenciamento.apk";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Handler utilitário para suportar duplo toque rápido (mobile) além do onDoubleClick nativo (desktop).
 */
export function handleLogoDoubleAction(e: React.MouseEvent | React.TouchEvent) {
  downloadApk();
}

export function handleLogoTouchEnd(e: React.TouchEvent) {
  const now = Date.now();
  if (now - lastTap < 350 && now - lastTap > 0) {
    e.preventDefault();
    downloadApk();
    lastTap = 0;
  } else {
    lastTap = now;
  }
}
