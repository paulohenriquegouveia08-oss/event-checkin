import { useEffect, useState } from "react";
import * as api from "../api/client";
import { ScannerTab } from "./event/ScannerTab";

/**
 * Leitor de QR Code global — igual ao de dentro de cada evento, só que
 * acessível direto do menu principal, sem precisar entrar no evento
 * primeiro. Escolhe o evento aqui; o resto (ativar terminal, ler,
 * credenciar) é o mesmo componente usado antes dentro do evento.
 */
export function ScannerPage() {
  const [eventos, setEventos] = useState<api.EventRecord[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [eventoId, setEventoId] = useState<string | null>(null);

  useEffect(() => {
    api
      .listEvents()
      .then(setEventos)
      .catch((err) => setErro(err instanceof Error ? err.message : "Falha ao carregar eventos"));
  }, []);

  const eventosAtivos = eventos?.filter((e) => e.status === "ACTIVE") ?? [];
  const eventoSelecionado = eventos?.find((e) => e.id === eventoId) ?? null;

  return (
    <div className="stack">
      <h1 style={{ fontSize: 22, margin: 0 }}>Leitor QR</h1>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Credencia participantes direto do navegador, sem instalar o app do terminal — funciona em qualquer
        celular, iPhone incluso.
      </p>

      {erro ? <p className="error-text">{erro}</p> : null}

      <div className="field" style={{ maxWidth: 420, marginBottom: 0 }}>
        <label htmlFor="scanner-evento">Evento</label>
        <select
          id="scanner-evento"
          value={eventoId ?? ""}
          onChange={(e) => setEventoId(e.target.value || null)}
        >
          <option value="">Selecione um evento...</option>
          {eventosAtivos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        {eventos && eventosAtivos.length === 0 ? (
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Nenhum evento ativo no momento.
          </p>
        ) : null}
      </div>

      {eventoSelecionado ? (
        <ScannerTab key={eventoSelecionado.id} eventId={eventoSelecionado.id} />
      ) : (
        <p className="muted">Escolha um evento acima para começar a ler credenciais.</p>
      )}
    </div>
  );
}
