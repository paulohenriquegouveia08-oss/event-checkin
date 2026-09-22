// Utilitário de feedback sonoro e tátil no navegador
// Reproduz os sons exatos de confirmação, duplicidade e erro do APK, usando a Web Audio API (sem precisar baixar arquivos externos).

export type CheckInFeedbackStatus =
  | "CONFIRMED"
  | "ALREADY_CHECKED_IN"
  | "INVALID_TOKEN"
  | "PARTICIPANT_INACTIVE"
  | "ERROR";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioCtxClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Inicializa o contexto de áudio em resposta a um clique/toque do usuário
 * (necessário para destravar o áudio no iOS Safari e Android Chrome).
 */
export function initAudio() {
  getAudioContext();
}

/**
 * Emite som e vibração de acordo com o resultado da leitura,
 * idêntico ao comportamento do APK.
 */
export function playCheckInFeedback(status: CheckInFeedbackStatus) {
  // 1. Vibração (se suportada pelo navegador, ex: Android Chrome)
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      if (status === "CONFIRMED") {
        navigator.vibrate([120]);
      } else if (status === "ALREADY_CHECKED_IN") {
        navigator.vibrate([100, 60, 100]);
      } else {
        navigator.vibrate([300]);
      }
    } catch {
      // Ignora erro de vibração se bloqueado por permissão
    }
  }

  // 2. Síntese Sonora via Web Audio API
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (status === "CONFIRMED") {
      // Som de sucesso: Arpeggio alegre ascendente (Dó - Mi - Sol)
      const notes = [
        { freq: 523.25, start: 0, dur: 0.08 },    // C5
        { freq: 659.25, start: 0.08, dur: 0.08 }, // E5
        { freq: 783.99, start: 0.16, dur: 0.20 }, // G5
      ];

      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(n.freq, now + n.start);

        gain.gain.setValueAtTime(0.001, now + n.start);
        gain.gain.exponentialRampToValueAtTime(0.35, now + n.start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur);
      }
    } else if (status === "ALREADY_CHECKED_IN") {
      // Som de aviso: Dois beeps curtos de atenção (440Hz / A4)
      const beeps = [
        { start: 0, dur: 0.09 },
        { start: 0.13, dur: 0.12 },
      ];

      for (const b of beeps) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now + b.start);

        gain.gain.setValueAtTime(0.001, now + b.start);
        gain.gain.exponentialRampToValueAtTime(0.3, now + b.start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + b.start + b.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + b.start);
        osc.stop(now + b.start + b.dur);
      }
    } else {
      // Som de erro/recusa: Tom grave baixo (140Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch {
    // Silencioso se der erro no áudio
  }
}

/**
 * Emite um sino suave e agradável quando uma nova inscrição é recebida em tempo real.
 */
export function playNewInscriptionNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [
      { freq: 659.25, start: 0, dur: 0.12 },   // E5
      { freq: 987.77, start: 0.1, dur: 0.35 },  // B5
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.2, now + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur);
    }
  } catch {
    // Ignora bloqueios de autoplay
  }
}
