import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import jsQR from "jsqr";
import * as api from "../../api/client";

/**
 * Leitor de QR Code dentro do próprio painel — pra credenciar sem
 * instalar o app do terminal (útil em iPhone, que o app Android não
 * cobre).
 *
 * Segue A MESMA LÓGICA do app do terminal (ver
 * apps/mobile/src/services/checkin/checkinService.ts e ScannerScreen.tsx):
 * ativa um terminal de verdade com um código de ativação e chama
 * POST /events/:eventId/checkins com o token de TERMINAL resultante —
 * a mesma rota, o mesmo contrato, os mesmos quatro desfechos
 * (CONFIRMED / ALREADY_CHECKED_IN / credencial inválida / inativa). A
 * única coisa que este leitor NÃO reproduz é o modo offline com roster
 * local em SQLite: aqui o navegador está sempre online, então cada
 * leitura vai direto ao servidor.
 *
 * Câmera ao vivo (getUserMedia) exige contexto seguro (HTTPS) — o
 * painel hoje é servido em HTTP puro (ver docker-compose.yml). Por
 * isso, sempre que a câmera ao vivo não estiver disponível, cai para
 * "tirar foto" (abre o app de câmera nativo do celular mesmo em HTTP) e
 * decodifica a foto no navegador — funciona em qualquer navegador,
 * iPhone incluso.
 */

const FEEDBACK_DURATION_MS = 1800;
const STORAGE_PREFIX = "scanner_terminal_";

interface StoredTerminal {
  token: string;
  terminalId: string;
  terminalName: string;
}

type FeedbackStatus = "CONFIRMED" | "ALREADY_CHECKED_IN" | "INVALID_TOKEN" | "PARTICIPANT_INACTIVE";

interface Feedback {
  status: FeedbackStatus;
  participantName?: string;
  checkedInAt?: string;
}

const PRESETS: Record<FeedbackStatus, { symbol: string; title: string; color: string }> = {
  CONFIRMED: { symbol: "✓", title: "PRESENÇA CONFIRMADA", color: "var(--success)" },
  ALREADY_CHECKED_IN: { symbol: "!", title: "PRESENÇA JÁ REGISTRADA", color: "var(--warning)" },
  INVALID_TOKEN: { symbol: "✕", title: "CREDENCIAL INVÁLIDA", color: "var(--danger)" },
  PARTICIPANT_INACTIVE: { symbol: "✕", title: "CREDENCIAL INATIVA", color: "var(--danger)" },
};

function loadStoredTerminal(eventId: string): StoredTerminal | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + eventId);
    return raw ? (JSON.parse(raw) as StoredTerminal) : null;
  } catch {
    return null;
  }
}

function saveStoredTerminal(eventId: string, terminal: StoredTerminal) {
  localStorage.setItem(STORAGE_PREFIX + eventId, JSON.stringify(terminal));
}

function clearStoredTerminal(eventId: string) {
  localStorage.removeItem(STORAGE_PREFIX + eventId);
}

export function ScannerTab({ eventId }: { eventId: string }) {
  const [terminal, setTerminal] = useState<StoredTerminal | null>(() => loadStoredTerminal(eventId));

  useEffect(() => {
    setTerminal(loadStoredTerminal(eventId));
  }, [eventId]);

  if (!terminal) {
    return <SetupLeitor eventId={eventId} onAtivado={(t) => setTerminal(t)} />;
  }

  return (
    <Leitor
      eventId={eventId}
      terminal={terminal}
      onTrocarLeitor={() => {
        api.deleteTerminal(eventId, terminal.terminalId).catch(() => {
          // Se o terminal já não existe mais (excluído por outra pessoa
          // na aba Terminais, por exemplo), não há nada a desfazer — só
          // limpa a sessão local mesmo assim.
        });
        clearStoredTerminal(eventId);
        setTerminal(null);
      }}
    />
  );
}

function SetupLeitor({ eventId, onAtivado }: { eventId: string; onAtivado: (t: StoredTerminal) => void }) {
  const [nome, setNome] = useState("Leitor do painel");
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAtivando(true);
    try {
      // Os dois lados da ativação (criar o terminal e ativá-lo com o
      // código) acontecem na mesma sessão — diferente do app físico, não
      // há por que pedir pra copiar um código de uma tela pra outra.
      const criado = await api.createTerminal(eventId, nome.trim());
      if (!criado.activationCode) {
        throw new Error("O servidor não devolveu um código de ativação para este terminal.");
      }
      const ativado = await api.activateTerminal(criado.activationCode);
      const stored: StoredTerminal = {
        token: ativado.token,
        terminalId: ativado.terminal.id,
        terminalName: ativado.terminal.name,
      };
      saveStoredTerminal(eventId, stored);
      onAtivado(stored);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao ativar o leitor");
    } finally {
      setAtivando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card stack" style={{ maxWidth: 420 }}>
      <div>
        <h3 style={{ margin: "0 0 4px" }}>Ativar leitor de QR Code</h3>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Cria um terminal e ativa ele automaticamente para este navegador — mesma lógica do app do terminal, sem
          precisar instalar nada. Funciona em qualquer celular, iPhone incluso.
        </p>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="leitor-nome">Nome deste leitor (aparece nos relatórios)</label>
        <input id="leitor-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      {erro ? <p className="error-text">{erro}</p> : null}
      <button className="btn" type="submit" disabled={ativando || !nome.trim()}>
        {ativando ? "Ativando..." : "Ativar leitor"}
      </button>
    </form>
  );
}

function Leitor({
  eventId,
  terminal,
  onTrocarLeitor,
}: {
  eventId: string;
  terminal: StoredTerminal;
  onTrocarLeitor: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modo, setModo] = useState<"iniciando" | "ao_vivo" | "foto">("iniciando");
  const [avisoCamera, setAvisoCamera] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [manualValor, setManualValor] = useState("");

  const pararCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const registrarLeitura = useCallback(
    async (valor: string) => {
      if (processingRef.current || !valor) return;
      processingRef.current = true;

      try {
        const resultado = await api.submitTerminalCheckIn(terminal.token, eventId, valor);
        setFeedback({
          status: resultado.status,
          participantName: resultado.participant.name,
          checkedInAt: resultado.checkedInAt,
        });
      } catch (err) {
        if (err instanceof api.ApiError && err.code === "NOT_FOUND") {
          setFeedback({ status: "INVALID_TOKEN" });
        } else if (err instanceof api.ApiError && err.code === "FORBIDDEN") {
          setFeedback({ status: "PARTICIPANT_INACTIVE" });
        } else {
          setFeedback({ status: "INVALID_TOKEN" });
        }
      } finally {
        setTimeout(() => {
          setFeedback(null);
          processingRef.current = false;
        }, FEEDBACK_DURATION_MS);
      }
    },
    [eventId, terminal.token],
  );

  // Loop de leitura ao vivo: desenha o frame atual do vídeo num canvas
  // oculto e roda o jsQR em cima — é assim que se lê QR em vídeo sem
  // depender de uma API nativa de câmera (que o navegador não tem).
  const loopAoVivo = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(loopAoVivo);
      return;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(loopAoVivo);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const codigo = jsQR(imageData.data, imageData.width, imageData.height);

    if (codigo && !processingRef.current) {
      void registrarLeitura(codigo.data);
    }
    rafRef.current = requestAnimationFrame(loopAoVivo);
  }, [registrarLeitura]);

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelado) setModo("foto");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setModo("ao_vivo");
        rafRef.current = requestAnimationFrame(loopAoVivo);
      } catch {
        // Câmera ao vivo exige HTTPS (ou localhost) — em HTTP puro, é
        // exatamente aqui que o navegador recusa. Cai pro modo foto sem
        // travar o operador.
        if (!cancelado) {
          setAvisoCamera(
            "A câmera ao vivo não está disponível neste endereço (exige conexão segura/HTTPS). Use \"Tirar foto\" abaixo.",
          );
          setModo("foto");
        }
      }
    }

    void iniciar();
    return () => {
      cancelado = true;
      pararCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFotoSelecionada(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo em seguida
    if (!arquivo) return;

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const codigo = jsQR(imageData.data, imageData.width, imageData.height);
      URL.revokeObjectURL(img.src);
      if (codigo) {
        void registrarLeitura(codigo.data);
      } else {
        setFeedback({ status: "INVALID_TOKEN" });
        setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS);
      }
    };
    img.src = URL.createObjectURL(arquivo);
  }

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    const valor = manualValor.trim();
    if (!valor) return;
    setManualValor("");
    void registrarLeitura(valor);
  }

  return (
    <div className="stack">
      <div className="spread">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Leitor ativo: <strong style={{ color: "var(--text)" }}>{terminal.terminalName}</strong>
        </p>
        <button className="btn btn-secondary btn-sm" onClick={onTrocarLeitor} type="button">
          Trocar leitor
        </button>
      </div>

      <div
        className="card"
        style={{
          position: "relative",
          padding: 0,
          aspectRatio: "4 / 3",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: 420,
        }}
      >
        {modo === "ao_vivo" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : modo === "foto" ? (
          <div className="stack" style={{ alignItems: "center", padding: 24, textAlign: "center" }}>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Toque para tirar uma foto do QR Code da credencial.
            </p>
            <button className="btn" type="button" onClick={() => fileInputRef.current?.click()}>
              📷 Tirar foto
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFotoSelecionada}
              style={{ display: "none" }}
            />
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Iniciando câmera...
          </p>
        )}

        {feedback ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: PRESETS[feedback.status].color,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "#fff",
              textAlign: "center",
              padding: 16,
            }}
          >
            <span style={{ fontSize: 56, fontWeight: 700 }}>{PRESETS[feedback.status].symbol}</span>
            <strong style={{ fontSize: 18, letterSpacing: 0.5 }}>{PRESETS[feedback.status].title}</strong>
            {feedback.participantName ? <span style={{ fontSize: 16 }}>{feedback.participantName}</span> : null}
            {feedback.checkedInAt ? (
              <span style={{ fontSize: 13, opacity: 0.85 }}>
                {new Date(feedback.checkedInAt).toLocaleTimeString("pt-BR")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {avisoCamera ? (
        <p className="muted" style={{ fontSize: 12, maxWidth: 420 }}>
          {avisoCamera}
        </p>
      ) : null}

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <details style={{ maxWidth: 420 }}>
        <summary className="muted" style={{ fontSize: 13, cursor: "pointer" }}>
          Digitar o código da credencial manualmente
        </summary>
        <form onSubmit={handleManualSubmit} className="row" style={{ marginTop: 8, gap: 8 }}>
          <input
            value={manualValor}
            onChange={(e) => setManualValor(e.target.value)}
            placeholder="Código da credencial"
            style={{ flex: 1 }}
          />
          <button className="btn btn-secondary btn-sm" type="submit" disabled={!manualValor.trim()}>
            Registrar
          </button>
        </form>
      </details>
    </div>
  );
}
