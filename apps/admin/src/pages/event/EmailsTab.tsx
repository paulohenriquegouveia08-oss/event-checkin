import { useEffect, useState, type FormEvent } from "react";
import * as api from "../../api/client";

/**
 * Configuração e disparo dos e-mails do evento.
 *
 * Até aqui os e-mails eram do COPOL e só dele — a paleta, o endereço do
 * site e o remetente estavam escritos no código. Esta aba é o que permite
 * um segundo evento (a Semantix, por exemplo) mandar os e-mails dele com
 * a marca dele.
 *
 * Campo em branco significa "usa o padrão do sistema". Um evento novo
 * funciona sem preencher nada; preencher é para diferenciar.
 */
export function EmailsTab({ eventId }: { eventId: string }) {
  const [evento, setEvento] = useState<api.EventRecord | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [disparando, setDisparando] = useState<string | null>(null);

  const [form, setForm] = useState<api.EmailSettings>({});

  function carregar() {
    api
      .getEvent(eventId)
      .then((e) => {
        setEvento(e);
        setForm(e.emailSettings ?? {});
      })
      .catch((err) => setErro(err instanceof Error ? err.message : "Falha ao carregar o evento"));
  }

  useEffect(carregar, [eventId]);

  function campo<K extends keyof api.EmailSettings>(chave: K, valor: api.EmailSettings[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setSalvando(true);
    try {
      // Campo vazio é enviado como ausente, e não como string vazia: no
      // backend, ausente cai no padrão — string vazia seria um remetente
      // em branco, que faz o envio inteiro falhar.
      const limpo: api.EmailSettings = {};
      for (const [k, v] of Object.entries(form)) {
        if (typeof v === "string" && v.trim() === "") continue;
        if (v === undefined) continue;
        (limpo as Record<string, unknown>)[k] = typeof v === "string" ? v.trim() : v;
      }
      await api.updateEvent(eventId, { emailSettings: limpo } as never);
      setAviso("Configuração de e-mail salva.");
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function dispararTodos(tipo: "certificado" | "comprovante") {
    setErro(null);
    setAviso(null);
    setDisparando(tipo);
    try {
      const r =
        tipo === "certificado"
          ? await api.sendCertificatesBulk(eventId)
          : await api.sendAttendanceProofsBulk(eventId);

      setAviso(
        r.falharam === 0
          ? `${r.enviados} e-mail(s) enviado(s).`
          : `${r.enviados} enviado(s), ${r.falharam} falharam. Motivos: ${
              [...new Set(r.detalhes.filter((d) => !d.enviado).map((d) => d.motivo ?? "sem motivo"))].join("; ")
            }`,
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao disparar");
    } finally {
      setDisparando(null);
    }
  }

  if (erro && !evento) return <p className="error-text">{erro}</p>;
  if (!evento) return <p className="muted">Carregando…</p>;

  return (
    <div className="stack">
      {erro && <p className="error-text">{erro}</p>}
      {aviso && <p className="muted">{aviso}</p>}

      <section className="card">
        <h3>Remetente</h3>
        <p className="muted">
          O domínio do endereço remetente precisa estar <strong>verificado no Resend</strong>.
          Sem isso o envio é recusado e ninguém recebe — vale conferir antes do evento,
          e não no dia.
        </p>

        <form onSubmit={salvar} className="stack">
          <label>
            Nome do remetente
            <input
              type="text"
              value={form.fromName ?? ""}
              onChange={(e) => campo("fromName", e.target.value)}
              placeholder="Semantix 2026"
            />
            <small className="muted">É o que aparece na caixa de entrada. Em branco = padrão do sistema.</small>
          </label>

          <label>
            E-mail do remetente
            <input
              type="email"
              value={form.fromEmail ?? ""}
              onChange={(e) => campo("fromEmail", e.target.value)}
              placeholder="contato@semantix.com.br"
            />
          </label>

          <label>
            Responder para
            <input
              type="email"
              value={form.replyTo ?? ""}
              onChange={(e) => campo("replyTo", e.target.value)}
              placeholder="atendimento@semantix.com.br"
            />
            <small className="muted">
              Para onde vai a resposta de quem apertar "responder". Útil quando o
              remetente é um endereço que ninguém lê.
            </small>
          </label>

          <h3>Aparência</h3>
          <label>
            Cor principal
            <input
              type="color"
              value={form.primaryColor ?? "#0E3634"}
              onChange={(e) => campo("primaryColor", e.target.value.toUpperCase())}
            />
            <small className="muted">Cabeçalho e botões.</small>
          </label>

          <label>
            Cor de destaque
            <input
              type="color"
              value={form.accentColor ?? "#C8A261"}
              onChange={(e) => campo("accentColor", e.target.value.toUpperCase())}
            />
          </label>

          <label>
            Endereço do site do evento
            <input
              type="url"
              value={form.siteUrl ?? ""}
              onChange={(e) => campo("siteUrl", e.target.value)}
              placeholder="https://semantix.com.br"
            />
            <small className="muted">Destino do botão "Acessar página do evento".</small>
          </label>

          <label>
            Observação no rodapé
            <input
              type="text"
              value={form.footerNote ?? ""}
              onChange={(e) => campo("footerNote", e.target.value)}
              placeholder="Dúvidas: (43) 99999-0000"
            />
          </label>

          <h3>Envios automáticos</h3>
          <p className="muted">
            Desligado não impede o disparo manual aqui embaixo — impede só o automático.
          </p>

          <label className="inline">
            <input
              type="checkbox"
              checked={form.autoSendReceipt ?? true}
              onChange={(e) => campo("autoSendReceipt", e.target.checked)}
            />
            Comprovante de inscrição ao confirmar o pagamento
          </label>

          <label className="inline">
            <input
              type="checkbox"
              checked={form.autoSendCertificate ?? false}
              onChange={(e) => campo("autoSendCertificate", e.target.checked)}
            />
            Certificado quando ficar disponível
          </label>

          <label className="inline">
            <input
              type="checkbox"
              checked={form.autoSendAttendanceProof ?? false}
              onChange={(e) => campo("autoSendAttendanceProof", e.target.checked)}
            />
            Comprovante de presença após o check-in
          </label>

          <button type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar configuração"}
          </button>
        </form>
      </section>

      <section className="card">
        <h3>Disparar agora</h3>
        <p className="muted">
          Envia para todos que já têm direito ao documento. Não há como desfazer um
          e-mail enviado — confira a configuração acima antes.
        </p>

        <div className="row">
          <button
            type="button"
            disabled={disparando !== null}
            onClick={() => void dispararTodos("certificado")}
          >
            {disparando === "certificado" ? "Enviando…" : "Enviar certificados"}
          </button>

          <button
            type="button"
            disabled={disparando !== null}
            onClick={() => void dispararTodos("comprovante")}
          >
            {disparando === "comprovante" ? "Enviando…" : "Enviar comprovantes de presença"}
          </button>
        </div>

        <p className="muted">
          O envio é feito um a um, com pausa entre eles, para não estourar o limite
          do Resend e derrubar os outros e-mails do sistema. Uma lista grande demora.
        </p>
      </section>
    </div>
  );
}
