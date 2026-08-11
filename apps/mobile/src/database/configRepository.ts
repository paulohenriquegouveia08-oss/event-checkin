import * as SecureStore from "expo-secure-store";
import { getDatabase } from "./db";
import type { TerminalConfig } from "../types/index";

// O token do terminal é a credencial mais sensível do aparelho (seção 18
// da especificação: "nunca colocar secrets do backend dentro do APK" —
// aqui o token não vem no APK, mas é recebido na ativação e precisa ficar
// protegido em repouso). Guardado no Keystore/Keychain via SecureStore,
// separado dos demais dados de configuração (que não são segredo e ficam
// no SQLite junto com o resto do cache local).
const TOKEN_KEY = "terminal_token";

export async function saveConfig(config: TerminalConfig): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, config.token);

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO terminal_config (id, serverUrl, terminalId, terminalName, eventId, eventName)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       serverUrl = excluded.serverUrl,
       terminalId = excluded.terminalId,
       terminalName = excluded.terminalName,
       eventId = excluded.eventId,
       eventName = excluded.eventName`,
    [config.serverUrl, config.terminalId, config.terminalName, config.eventId, config.eventName]
  );
}

export async function loadConfig(): Promise<TerminalConfig | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Omit<TerminalConfig, "token">>(
    `SELECT serverUrl, terminalId, terminalName, eventId, eventName FROM terminal_config WHERE id = 1`
  );
  if (!row) return null;

  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return null; // configuração inconsistente — força reativação

  return { ...row, token };
}

export async function clearConfig(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM terminal_config WHERE id = 1`);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
