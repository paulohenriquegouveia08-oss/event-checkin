import { QRCodeSVG } from "qrcode.react";

interface Props {
  participantName: string;
  qrToken: string;
  onClose: () => void;
}

/**
 * Exibe/permite baixar a credencial (QR) de um participante — seção 21
 * da especificação do produto. O QR carrega só o token opaco
 * (qrToken), nunca nome/e-mail/CPF (seção 9/10).
 */
export function QrCodeModal({ participantName, qrToken, onClose }: Props) {
  function handleDownload() {
    const svg = document.getElementById("credential-qr");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credencial-${participantName.replace(/\s+/g, "-").toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000aa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div className="card stack" style={{ width: 340, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{participantName}</h2>
        <p className="muted" style={{ margin: 0 }}>
          Apresente este código na entrada do evento.
        </p>
        <div style={{ background: "#fff", padding: 16, borderRadius: 8, alignSelf: "center" }}>
          <QRCodeSVG id="credential-qr" value={qrToken} size={220} />
        </div>
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn" onClick={handleDownload}>
            Baixar QR
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
