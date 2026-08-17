import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";
import { env } from "../../config/env.js";

/**
 * Abstração de storage de arquivos gerados (certificados e comprovantes em
 * PDF). Não existia nenhum mecanismo de storage no projeto até esta
 * feature (upload de CSV de participantes, por exemplo, é feito 100% em
 * memória) — então esta interface é o ponto de extensão desacoplado
 * pedido: trocar disco local por Supabase Storage/S3/R2 no futuro é
 * implementar esta interface de novo, sem tocar em certificates.service.ts
 * nem em nenhum outro chamador.
 */
export interface CertificateStorage {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
}

/**
 * Implementação padrão: disco local, sob STORAGE_DIR (ver .env.example).
 * `key` é sempre gerado pelo próprio backend (nunca vem de input do
 * cliente) — mesmo assim, normaliza e recusa qualquer valor que escape do
 * diretório raiz, como defesa em profundidade contra path traversal.
 */
class LocalDiskCertificateStorage implements CertificateStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private resolveKey(key: string): string {
    const target = resolve(this.root, normalize(key));
    if (!target.startsWith(this.root)) {
      throw new Error(`Chave de storage inválida: "${key}"`);
    }
    return target;
  }

  async save(key: string, data: Buffer): Promise<void> {
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await readFile(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }
}

export const certificateStorage: CertificateStorage = new LocalDiskCertificateStorage(env.STORAGE_DIR);

/** Chave de storage padronizada — um arquivo por (evento, participante),
 * então regenerar sobrescreve em vez de acumular versões antigas órfãs. */
export function certificateFileKey(eventId: string, participantId: string): string {
  return join("certificates", eventId, `${participantId}.pdf`);
}

export function attendanceProofFileKey(eventId: string, participantId: string): string {
  return join("attendance-proofs", eventId, `${participantId}.pdf`);
}
