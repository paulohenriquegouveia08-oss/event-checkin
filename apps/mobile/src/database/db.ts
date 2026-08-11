import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "event-checkin.db";

let dbInstance: SQLite.SQLiteDatabase | null = null;

/** Abre (ou reaproveita) a conexão com o banco local e garante que o
 * schema exista. Chamado uma vez, na inicialização do app. */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    -- O token do terminal NÃO fica aqui — vai para o SecureStore
    -- (Keystore/Keychain), ver database/configRepository.ts.
    CREATE TABLE IF NOT EXISTS terminal_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      serverUrl TEXT NOT NULL,
      terminalId TEXT NOT NULL,
      terminalName TEXT NOT NULL,
      eventId TEXT NOT NULL,
      eventName TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      document TEXT,
      qrToken TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_participants_qrtoken ON participants (qrToken);

    CREATE TABLE IF NOT EXISTS checkins (
      localCheckInId TEXT PRIMARY KEY NOT NULL,
      participantId TEXT NOT NULL,
      participantName TEXT NOT NULL,
      qrToken TEXT NOT NULL,
      checkedInAt TEXT NOT NULL,
      syncStatus TEXT NOT NULL DEFAULT 'pending',
      rejectionReason TEXT,
      UNIQUE (participantId)
    );
    CREATE INDEX IF NOT EXISTS idx_checkins_syncstatus ON checkins (syncStatus);
  `);

  // Migration: add email/phone/document columns if missing (existing databases)
  const cols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(participants)");
  const colNames = cols.map((c) => c.name);
  if (!colNames.includes("email")) await db.execAsync("ALTER TABLE participants ADD COLUMN email TEXT");
  if (!colNames.includes("phone")) await db.execAsync("ALTER TABLE participants ADD COLUMN phone TEXT");
  if (!colNames.includes("document")) await db.execAsync("ALTER TABLE participants ADD COLUMN document TEXT");

  dbInstance = db;
  return db;
}

/** Usado só em testes/reset de configuração — apaga tudo e recria o
 * schema do zero (ex.: "desvincular terminal"). */
export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM terminal_config;
    DELETE FROM participants;
    DELETE FROM checkins;
  `);
}
