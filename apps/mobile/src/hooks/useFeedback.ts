import { useCallback } from "react";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import type { CheckInResultStatus } from "../types/index";

const successSound = require("../../assets/sounds/success.wav");
const errorSound = require("../../assets/sounds/error.wav");
const warningSound = require("../../assets/sounds/warning.wav");

/** Feedback sonoro/tátil imediato após cada leitura — seção 11 da
 * especificação do produto ("emitir som de confirmação") e seção 23
 * (desempenho: o operador precisa de um sinal instantâneo, sem esperar
 * animação de tela). Um som/vibração diferente por desfecho: sucesso,
 * duplicidade (aviso) e inválido/inativo (erro). */
export function useFeedback() {
  const successPlayer = useAudioPlayer(successSound);
  const warningPlayer = useAudioPlayer(warningSound);
  const errorPlayer = useAudioPlayer(errorSound);

  const play = useCallback(
    (status: CheckInResultStatus) => {
      switch (status) {
        case "CONFIRMED":
          successPlayer.seekTo(0);
          successPlayer.play();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case "ALREADY_CHECKED_IN":
          warningPlayer.seekTo(0);
          warningPlayer.play();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case "INVALID_TOKEN":
        case "PARTICIPANT_INACTIVE":
          errorPlayer.seekTo(0);
          errorPlayer.play();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    },
    [successPlayer, warningPlayer, errorPlayer]
  );

  return { play };
}
