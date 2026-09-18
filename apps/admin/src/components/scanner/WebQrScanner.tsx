import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats, type CameraDevice } from "html5-qrcode";

interface Props {
  onScan: (decodedText: string) => void;
  paused: boolean;
  manualMode: boolean;
  onToggleManual: () => void;
}

const CONTAINER_ID = "web-qr-scanner-viewport";

export function WebQrScanner({ onScan, paused, manualMode, onToggleManual }: Props) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [manualInput, setManualInput] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicialização do leitor de câmera
  useEffect(() => {
    if (manualMode) {
      stopScanner();
      return;
    }

    let isMounted = true;

    async function initCamera() {
      setInitializing(true);
      setCameraError(null);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Seu navegador não suporta acesso direto à câmera (WebRTC).");
        }

        // Obtém lista de câmeras
        const devices = await Html5Qrcode.getCameras().catch(() => []);
        if (isMounted) setCameras(devices);

        // Prioriza câmera traseira (environment)
        let selectedId: string | { facingMode: string } = { facingMode: "environment" };
        if (devices.length > 0) {
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes("back") ||
              d.label.toLowerCase().includes("traseira") ||
              d.label.toLowerCase().includes("environment") ||
              d.label.toLowerCase().includes("rear")
          );
          if (backCam) {
            selectedId = backCam.id;
            if (isMounted) setCurrentCameraId(backCam.id);
          } else {
            selectedId = devices[0].id;
            if (isMounted) setCurrentCameraId(devices[0].id);
          }
        }

        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(CONTAINER_ID, {
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            verbose: false,
          });
        }

        const scanner = scannerRef.current;

        await scanner.start(
          selectedId,
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
              return { width: Math.max(edge, 200), height: Math.max(edge, 200) };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!pausedRef.current) {
              onScan(decodedText);
            }
          },
          () => {
            // Frame sem QR code detectado (ignorado)
          }
        );

        isRunningRef.current = true;

        // Testa se há suporte a lanterna
        try {
          const capabilities = scanner.getRunningTrackCameraCapabilities();
          if (capabilities && "torch" in capabilities) {
            if (isMounted) setHasTorch(true);
          }
        } catch {
          // Ignora se não conseguir checar torch
        }

        if (isMounted) {
          setInitializing(false);
          setCameraError(null);
        }
      } catch (err) {
        if (!isMounted) return;
        setInitializing(false);
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Permission denied") || msg.includes("NotAllowedError")) {
          setCameraError(
            "Permissão de câmera negada. No celular, autorize o navegador a usar a câmera nas configurações do site."
          );
        } else if (msg.includes("NotFoundError") || msg.includes("DevicesNotFoundError")) {
          setCameraError("Nenhuma câmera encontrada neste dispositivo.");
        } else {
          setCameraError(
            "Não foi possível iniciar a câmera de vídeo ao vivo. Verifique as permissões do navegador ou utilize a entrada manual."
          );
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [manualMode]);

  async function stopScanner() {
    if (scannerRef.current && isRunningRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Ignora erro se já estiver parado
      }
      isRunningRef.current = false;
    }
  }

  // Alternar entre câmeras disponíveis (ex: múltiplas lentes no iPhone ou frontal/traseira)
  async function handleSwitchCamera() {
    if (cameras.length <= 1 || !scannerRef.current) return;
    const currentIndex = cameras.findIndex((c) => c.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];

    try {
      await stopScanner();
      setCurrentCameraId(nextCamera.id);
      await scannerRef.current.start(
        nextCamera.id,
        {
          fps: 15,
          qrbox: (w, h) => {
            const edge = Math.floor(Math.min(w, h) * 0.72);
            return { width: Math.max(edge, 200), height: Math.max(edge, 200) };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (!pausedRef.current) onScan(decodedText);
        },
        () => {}
      );
      isRunningRef.current = true;
    } catch (err) {
      console.warn("Erro ao alternar câmera:", err);
    }
  }

  // Alternar lanterna
  async function handleToggleTorch() {
    if (!scannerRef.current || !isRunningRef.current) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn(nextTorch);
    } catch {
      setHasTorch(false);
    }
  }

  // Escanear arquivo de imagem (fallback caso câmera não abra)
  async function handleFileScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode("temp-qr-file-scan");
      const decoded = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      onScan(decoded);
    } catch {
      alert("Nenhum QR Code legível foi encontrado nesta imagem.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualInput.trim()) return;
    onScan(manualInput.trim());
    setManualInput("");
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
      }}
    >
      <div id="temp-qr-file-scan" style={{ display: "none" }} />

      {!manualMode ? (
        <div
          style={{
            width: "100%",
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: "#000000",
            position: "relative",
            minHeight: 340,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            border: "2px solid var(--border)",
          }}
        >
          {/* Elemento que recebe o vídeo da câmera */}
          <div
            id={CONTAINER_ID}
            style={{
              width: "100%",
              height: "100%",
              minHeight: 340,
            }}
          />

          {/* Mira e Laser decorativo (sobre o vídeo) */}
          {!initializing && !cameraError && !paused && (
            <div
              style={
                {
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                } as CSSProperties
              }
            >
              {/* Moldura de mira quadrada com cantos */}
              <div
                style={{
                  width: "68%",
                  aspectRatio: "1/1",
                  maxWidth: 240,
                  position: "relative",
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)",
                  borderRadius: 12,
                }}
              >
                {/* Cantos verdes da mira */}
                <div style={{ ...cornerStyle, top: 0, left: 0, borderTop: "4px solid #22c55e", borderLeft: "4px solid #22c55e" }} />
                <div style={{ ...cornerStyle, top: 0, right: 0, borderTop: "4px solid #22c55e", borderRight: "4px solid #22c55e" }} />
                <div style={{ ...cornerStyle, bottom: 0, left: 0, borderBottom: "4px solid #22c55e", borderLeft: "4px solid #22c55e" }} />
                <div style={{ ...cornerStyle, bottom: 0, right: 0, borderBottom: "4px solid #22c55e", borderRight: "4px solid #22c55e" }} />
                {/* Linha laser pulsante */}
                <div className="laser-line" />
              </div>
            </div>
          )}

          {/* Loading do leitor */}
          {initializing && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(16, 18, 20, 0.92)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                zIndex: 10,
              }}
            >
              <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
              <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
                Iniciando câmera...
              </p>
            </div>
          )}

          {/* Erro de câmera */}
          {cameraError && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(16, 18, 20, 0.96)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                textAlign: "center",
                gap: 14,
                zIndex: 15,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  color: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  fontWeight: 700,
                }}
              >
                !
              </div>
              <p style={{ color: "var(--text)", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                {cameraError}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setCameraError(null);
                    setInitializing(true);
                  }}
                >
                  Tentar novamente
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Carregar foto/galeria
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onToggleManual}
                >
                  Entrada manual
                </button>
              </div>
            </div>
          )}

          {/* Controles de Câmera (Trocar Lente e Lanterna) */}
          {!initializing && !cameraError && (
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                display: "flex",
                gap: 8,
                zIndex: 20,
              }}
            >
              {hasTorch && (
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  style={cameraControlBtn}
                  title="Alternar lanterna"
                >
                  {torchOn ? "🔦 Ligada" : "🔦"}
                </button>
              )}
              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  style={cameraControlBtn}
                  title="Alternar câmera"
                >
                  🔄 Trocar Câmera
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Modo Manual (digitar ou colar token / simulação) */
        <form
          onSubmit={handleManualSubmit}
          className="card"
          style={{
            width: "100%",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>Entrada Manual</h3>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
              Digite ou cole o token do participante (ex: <code>evt_...</code>)
            </p>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <input
              type="text"
              placeholder="Cole ou digite evt_..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              style={{
                fontSize: 16,
                padding: "12px 14px",
                fontFamily: "monospace",
              }}
            />
          </div>

          <button
            type="submit"
            className="btn"
            disabled={!manualInput.trim()}
            style={{ padding: 12, fontSize: 15 }}
          >
            CONFIRMAR CREDENCIAMENTO
          </button>
        </form>
      )}

      {/* Input oculto para upload de foto de QR Code */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFileScan}
      />

      {/* Barra de alternância de modo (Câmera / Manual) */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 14,
          padding: "4px 8px",
        }}
      >
        <button
          type="button"
          onClick={onToggleManual}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--primary)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            padding: "6px 8px",
          }}
        >
          {manualMode ? "← Voltar para Câmera" : "⌨️ Digitar token manualmente"}
        </button>

        {!manualMode && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 13,
              cursor: "pointer",
              padding: "6px 8px",
            }}
          >
            📁 Ler de Foto/Galeria
          </button>
        )}
      </div>

      <style>{`
        #${CONTAINER_ID} video {
          object-fit: cover !important;
          border-radius: 14px;
          width: 100% !important;
          height: 100% !important;
        }
        .laser-line {
          position: absolute;
          width: 100%;
          height: 2px;
          background: #22c55e;
          box-shadow: 0 0 10px #22c55e, 0 0 20px #22c55e;
          top: 0;
          animation: scanAnimation 2.2s infinite ease-in-out;
        }
        @keyframes scanAnimation {
          0% { top: 4%; opacity: 0.8; }
          50% { top: 96%; opacity: 1; }
          100% { top: 4%; opacity: 0.8; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

const cornerStyle: CSSProperties = {
  position: "absolute",
  width: 20,
  height: 20,
  borderRadius: 2,
};

const cameraControlBtn: CSSProperties = {
  backgroundColor: "rgba(0, 0, 0, 0.65)",
  backdropFilter: "blur(6px)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: 8,
  color: "#ffffff",
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
