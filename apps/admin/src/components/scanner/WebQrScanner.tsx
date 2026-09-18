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
  const [cameraStarted, setCameraStarted] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isInsecureOrigin, setIsInsecureOrigin] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Checa se a origem é segura (HTTPS ou localhost)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isSecure =
        window.isSecureContext ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      setIsInsecureOrigin(!isSecure);
    }
  }, []);

  // Tenta iniciar câmera ao carregar (se estiver em HTTPS)
  useEffect(() => {
    if (manualMode) {
      stopScanner();
      return;
    }

    // Se estiver em HTTPS, tenta inicializar automaticamente
    if (typeof window !== "undefined" && window.isSecureContext) {
      startCamera();
    } else {
      // Em HTTP inseguro, não tenta autoplay para não gerar erro silencioso
      setCameraError(
        "Navegadores bloqueiam o uso de câmera de vídeo ao vivo sem HTTPS. Acesse via HTTPS seguro ou use o botão de foto abaixo."
      );
    }

    return () => {
      stopScanner();
    };
  }, [manualMode]);

  async function startCamera() {
    setInitializing(true);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Câmera de vídeo ao vivo requer HTTPS no celular. Utilize o botão 'Câmera do Aparelho (Foto)' abaixo ou abra o endereço seguro HTTPS."
        );
      }

      // Solicita permissão explicitamente via getUserMedia primeiro
      // No iOS Safari e Android Chrome, isso garante que o diálogo nativo apareça
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
      } catch (permErr) {
        console.warn("Falha no getUserMedia inicial, tentando Html5Qrcode direto:", permErr);
      } finally {
        if (stream) {
          // Fecha o stream de teste para liberar a câmera para o Html5Qrcode
          stream.getTracks().forEach((track) => track.stop());
        }
      }

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(CONTAINER_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }

      const scanner = scannerRef.current;

      const scanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
          return { width: Math.max(edge, 200), height: Math.max(edge, 200) };
        },
        aspectRatio: 1.0,
      };

      const handleDecoded = (decodedText: string) => {
        if (!pausedRef.current) {
          onScan(decodedText);
        }
      };

      // Tenta primeiro câmera traseira ("environment")
      try {
        await scanner.start(
          { facingMode: "environment" },
          scanConfig,
          handleDecoded,
          () => {}
        );
      } catch (envErr) {
        console.warn("Falha ao iniciar com facingMode environment, tentando padrão:", envErr);
        // Fallback para câmera frontal ou qualquer disponível
        await scanner.start(
          { facingMode: "user" },
          scanConfig,
          handleDecoded,
          () => {}
        );
      }

      isRunningRef.current = true;
      setCameraStarted(true);

      // Agora que a permissão foi concedida, lista as câmeras com rótulos reais
      try {
        const devices = await Html5Qrcode.getCameras();
        setCameras(devices);
      } catch {
        // Ignora
      }

      // Testa se há suporte a lanterna
      try {
        const capabilities = scanner.getRunningTrackCameraCapabilities();
        if (capabilities && "torch" in capabilities) {
          setHasTorch(true);
        }
      } catch {
        // Ignora
      }

      setInitializing(false);
      setCameraError(null);
    } catch (err) {
      setInitializing(false);
      setCameraStarted(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("Permission denied") ||
        msg.includes("NotAllowedError") ||
        msg.includes("PermissionDeniedError")
      ) {
        setCameraError(
          "Permissão de câmera não foi concedida. Toque no ícone ao lado da barra de endereço do navegador e autorize a Câmera."
        );
      } else if (msg.includes("NotFoundError") || msg.includes("DevicesNotFoundError")) {
        setCameraError("Nenhuma câmera encontrada neste dispositivo.");
      } else {
        setCameraError(msg || "Não foi possível iniciar a câmera de vídeo ao vivo.");
      }
    }
  }

  async function stopScanner() {
    if (scannerRef.current && isRunningRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Ignora
      }
      isRunningRef.current = false;
      setCameraStarted(false);
    }
  }

  // Alternar entre câmeras disponíveis
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
      setCameraStarted(true);
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

  // Escanear arquivo de imagem ou foto direta
  async function handleFileScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode("temp-qr-file-scan");
      const decoded = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      onScan(decoded);
    } catch {
      alert("Nenhum QR Code legível foi encontrado nesta imagem. Aproxime mais o celular e tente novamente.");
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

  const httpsUrl =
    typeof window !== "undefined"
      ? `https://137-131-233-254.sslip.io${window.location.pathname}${window.location.search}`
      : "https://137-131-233-254.sslip.io";

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

      {/* Aviso de HTTP não seguro com link de 1 clique para HTTPS */}
      {isInsecureOrigin && (
        <div
          style={{
            width: "100%",
            backgroundColor: "rgba(234, 179, 8, 0.14)",
            border: "1px solid rgba(234, 179, 8, 0.4)",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 16,
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 22 }}>🔒</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--warning)" }}>
                Câmera ao vivo exige HTTPS
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                No iPhone e Android, o navegador só pede permissão de câmera em conexão segura.
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              href={httpsUrl}
              className="btn btn-sm"
              style={{
                textDecoration: "none",
                fontSize: 12,
                background: "#16a34a",
                color: "#ffffff",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              👉 Abrir via HTTPS Seguro (Recomendado)
            </a>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              style={{ fontSize: 12 }}
            >
              📸 Ou usar Câmera do Aparelho (Foto)
            </button>
          </div>
        </div>
      )}

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

          {/* Mira e Laser decorativo (sobre o vídeo quando rodando) */}
          {cameraStarted && !initializing && !cameraError && !paused && (
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
                <div style={{ ...cornerStyle, top: 0, left: 0, borderTop: "4px solid #22c55e", borderLeft: "4px solid #22c55e" }} />
                <div style={{ ...cornerStyle, top: 0, right: 0, borderTop: "4px solid #22c55e", borderRight: "4px solid #22c55e" }} />
                <div style={{ ...cornerStyle, bottom: 0, left: 0, borderBottom: "4px solid #22c55e", borderLeft: "4px solid #22c55e" }} />
                <div style={{ ...cornerStyle, bottom: 0, right: 0, borderBottom: "4px solid #22c55e", borderRight: "4px solid #22c55e" }} />
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
              <p style={{ color: "var(--text)", fontSize: 14, margin: 0, fontWeight: 600 }}>
                Solicitando acesso à câmera...
              </p>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Toque em "Permitir" quando o navegador perguntar
              </span>
            </div>
          )}

          {/* Estado: Câmera não iniciada ou Erro */}
          {!cameraStarted && !initializing && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(16, 18, 20, 0.95)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                textAlign: "center",
                gap: 16,
                zIndex: 15,
              }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  backgroundColor: cameraError ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.15)",
                  color: cameraError ? "var(--danger)" : "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                {cameraError ? "!" : "📷"}
              </div>

              <div>
                <p style={{ color: "var(--text)", fontSize: 14, margin: "0 0 6px", lineHeight: 1.5, fontWeight: 600 }}>
                  {cameraError || "Toque para autorizar e iniciar a câmera"}
                </p>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  O navegador solicitará permissão para usar sua câmera.
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 280 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={startCamera}
                  style={{
                    padding: "12px 18px",
                    fontSize: 15,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    background: "#16a34a",
                  }}
                >
                  📷 Ativar Câmera ao Vivo
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: "10px 16px",
                    fontSize: 13,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  📸 Tirar Foto com Câmera do Aparelho
                </button>

                {isInsecureOrigin && (
                  <a
                    href={httpsUrl}
                    className="btn btn-secondary"
                    style={{
                      padding: "10px 16px",
                      fontSize: 13,
                      textDecoration: "none",
                      color: "var(--warning)",
                      borderColor: "rgba(234, 179, 8, 0.4)",
                      textAlign: "center",
                    }}
                  >
                    🔒 Abrir versão HTTPS
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Controles da Câmera quando ativa (Trocar Lente e Lanterna) */}
          {cameraStarted && !initializing && (
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
                  🔄 Lente
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

      {/* Input oculto nativo que abre a câmera traseira do sistema em qualquer celular */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFileScan}
      />

      {/* Barra de alternância de modo (Câmera / Foto / Manual) */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 14,
          padding: "4px 8px",
          flexWrap: "wrap",
          gap: 8,
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
          {manualMode ? "← Voltar para Câmera" : "⌨️ Digitar código manual"}
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
            📸 Foto com Câmera Nativa
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
