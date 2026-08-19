import { useEffect, useState } from "react";
import * as api from "../api/client";

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ApkPage() {
  const [info, setInfo] = useState<api.ApkInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getApkInfo()
      .then(setInfo)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Falha ao carregar informações do APK"));
  }, []);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      await api.downloadApk();
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Falha ao baixar o APK");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 22, margin: 0 }}>App do terminal (APK)</h1>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
          Build Android do app usado nos terminais de credenciamento (Elgin M10 Pro / iMin D1).
        </p>
      </div>

      {loadError ? <p className="error-text">{loadError}</p> : null}

      {!loadError && !info ? (
        <p className="muted">Carregando...</p>
      ) : info && !info.available ? (
        <div className="card">
          <p className="muted">
            Nenhum APK disponível no servidor ainda. Faça o build (
            <code>cd apps/mobile/android && ./gradlew assembleRelease</code>) e publique o arquivo gerado no
            servidor.
          </p>
        </div>
      ) : info?.available ? (
        <div className="card">
          <p style={{ margin: "0 0 4px" }}>
            <strong>Tamanho:</strong> {formatSize(info.sizeBytes!)}
          </p>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
            Última atualização: {new Date(info.updatedAt!).toLocaleString("pt-BR")}
          </p>
          <button className="btn" onClick={handleDownload} disabled={downloading}>
            {downloading ? "Baixando..." : "Baixar APK"}
          </button>
          {downloadError ? (
            <p className="error-text" style={{ marginTop: 12 }}>
              {downloadError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
