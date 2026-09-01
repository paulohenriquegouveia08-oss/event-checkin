import { useEffect, useState, type FormEvent } from "react";
import * as api from "../../api/client";

/**
 * Configuração do evento: endereço público, fuso, idioma, visibilidade e
 * quais módulos estão ligados.
 *
 * É a primeira aba que o organizador usa num evento novo — sem ligar um
 * módulo aqui, as abas dele nem aparecem.
 */
export function ConfigTab({ eventId }: { eventId: string }) {
  const [config, setConfig] = useState<api.EventConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mexendo, setMexendo] = useState<string | null>(null);

  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE");

  function carregar() {
    api
      .getEventConfig(eventId)
      .then((c) => {
        setConfig(c);
        setSlug(c.slug ?? "");
        setTimezone(c.timezone);
        setVisibility(c.visibility);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Falha ao carregar a configuração")
      );
  }

  useEffect(carregar, [eventId]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setSalvando(true);
    try {
      await api.updateEventConfig(eventId, {
        slug: slug.trim() === "" ? null : slug.trim(),
        timezone,
        visibility,
      });
      setAviso("Configuração salva.");
      carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarModulo(m: api.EventModuleInfo) {
    setError(null);
    setAviso(null);
    setMexendo(m.key);
    try {
      const r = await api.toggleEventModule(eventId, m.key, !m.enabled);
      // Desligar um módulo pode arrastar quem depende dele. Sem este aviso,
      // ver outra aba sumir sozinha pareceria defeito.
      if (r.alsoDisabled.length > 0) {
        const nomes = r.alsoDisabled
          .map((k) => config?.modules.find((x) => x.key === k)?.name ?? k)
          .join(", ");
        setAviso(`${m.name} desligado. ${nomes} foi desligado junto, porque depende dele.`);
      } else {
        setAviso(`${m.name} ${r.enabled ? "ligado" : "desligado"}.`);
      }
      carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao mudar o módulo");
    } finally {
      setMexendo(null);
    }
  }

  if (error && !config) return <p className="error-text">{error}</p>;
  if (!config) return <p className="muted">Carregando…</p>;

  return (
    <div className="stack">
      {error && <p className="error-text">{error}</p>}
      {aviso && <p className="muted">{aviso}</p>}

      <section className="card">
        <h3>Dados de acesso</h3>
        <p className="muted">
          O endereço público é como o evento aparece num link divulgado. Deixe em
          branco enquanto não quiser divulgar.
        </p>

        <form onSubmit={salvar} className="stack">
          <label>
            Endereço público
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="copol-2026"
            />
            <small className="muted">
              Só letras minúsculas, números e hífen.
              {slug.trim() && ` O evento ficará em /e/${slug.trim()}`}
            </small>
          </label>

          <label>
            Fuso horário
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/Sao_Paulo"
            />
            <small className="muted">
              Define como as datas aparecem para o organizador e nos e-mails.
            </small>
          </label>

          <label>
            Visibilidade
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "PRIVATE")}
            >
              <option value="PRIVATE">Privado — só quem tem o link direto</option>
              <option value="PUBLIC">Público — aparece na listagem</option>
            </select>
          </label>

          <button type="submit" className="btn" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </form>
      </section>

      <section className="card">
        <h3>Módulos</h3>
        <p className="muted">
          Ligue o que este evento vai usar. Desligar esconde a aba —{" "}
          <strong>nenhum dado é apagado</strong>, e religar traz tudo de volta.
        </p>

        <div className="stack">
          {config.modules.map((m) => {
            const bloqueado = m.requires.some(
              (r) => !config.modules.find((x) => x.key === r)?.enabled
            );
            return (
              <div key={m.key} className="spread">
                <div>
                  <strong>{m.name}</strong>
                  <div className="muted">{m.description}</div>
                  {m.requires.length > 0 && (
                    <div className="muted">
                      Depende de:{" "}
                      {m.requires
                        .map((r) => config.modules.find((x) => x.key === r)?.name ?? r)
                        .join(", ")}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className={m.enabled ? "btn btn-danger btn-sm" : "btn btn-sm"}
                  disabled={mexendo === m.key || (!m.enabled && bloqueado)}
                  title={
                    !m.enabled && bloqueado
                      ? "Ligue primeiro o módulo de que este depende"
                      : undefined
                  }
                  onClick={() => alternarModulo(m)}
                >
                  {mexendo === m.key ? "…" : m.enabled ? "Desligar" : "Ligar"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
