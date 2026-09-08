"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginAttendee, selectEvent, type ParticipantData } from "@/lib/api";
import { CreditosParceiros } from "@/components/CreditosParceiros";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ParticipantData[] | null>(null);

  /**
   * Eventos com inscrição aberta.
   *
   * Esta tela é para quem JÁ se inscreveu: digita o e-mail e vê o QR.
   * Quem chega pelo link de divulgação ainda não está cadastrado, digita
   * o e-mail e recebe "não encontrado" — sem nenhuma saída na tela. O
   * aviso abaixo é essa saída.
   *
   * Buscado do servidor, e não cravado: um evento novo aparece sozinho.
   */
  const [abertos, setAbertos] = useState<{ slug: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/publico/eventos-abertos")
      .then((r) => r.json())
      .then((c) => {
        const lista = Array.isArray(c?.data) ? c.data : [];
        // Sem filtrar de novo: a rota já devolve só quem tem endereço
        // público e inscrição aberta. Repetir o filtro com um campo que
        // ela não manda (`registrationsOpen`) esconderia tudo.
        setAbertos(
          lista
            .filter((e: { slug?: string }) => Boolean(e.slug))
            .map((e: { slug: string; name: string }) => ({ slug: e.slug, name: e.name })),
        );
      })
      .catch(() => setAbertos([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await loginAttendee(email);

      if (response.data.requiresEventSelection && response.data.events) {
        setEvents(response.data.events);
        setLoading(false);
        return;
      }

      localStorage.setItem("attendee_token", response.data.token!);
      localStorage.setItem(
        "attendee_data",
        JSON.stringify(response.data.participant)
      );
      router.push("/checkin");
    } catch (err: any) {
      setError(err.message ?? "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = async (participantId: string) => {
    setError(null);
    setLoading(true);

    try {
      const response = await selectEvent(participantId);
      localStorage.setItem("attendee_token", response.data.token!);
      localStorage.setItem(
        "attendee_data",
        JSON.stringify(response.data.participant)
      );
      router.push("/checkin");
    } catch (err: any) {
      setError(err.message ?? "Erro ao selecionar evento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lspk-symbol.svg" alt="LSPK Technology" className="h-16 w-16" />
          </div>
          <p className="mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-[var(--primary)]">
            LSPK Technology
          </p>
          <h1 className="mt-1 text-3xl font-bold">Credenciamento</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-[var(--muted-foreground)]">
            Acesse seu QR Code, comprovante de presença e certificado.
          </p>
        </div>

        {!events ? (
          <form onSubmit={handleSubmit} className="cartao space-y-4 p-6">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm text-[var(--muted-foreground)]"
              >
                E-mail cadastrado
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/60 px-4 py-3 text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[var(--primary)] px-4 py-3.5 font-bold text-[var(--primary-foreground)] shadow-[0_10px_24px_-12px_rgba(59,91,255,0.9)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? "Buscando..." : "Entrar"}
            </button>

            {abertos.length > 0 && (
              <div className="border-t border-[var(--border)] pt-4">
                <p className="mono text-[0.68rem] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Ainda não se inscreveu?
                </p>
                <ul className="mt-3 space-y-2">
                  {abertos.map((e) => (
                    <li key={e.slug}>
                      <a
                        href={`/inscricao/${e.slug}`}
                        className="flex items-center justify-between rounded-xl border border-[var(--primary)]/35 bg-[var(--primary)]/10 px-4 py-3 text-sm font-semibold transition hover:bg-[var(--primary)]/20"
                      >
                        <span>Inscrever-se em {e.name}</span>
                        <span aria-hidden="true" className="text-[var(--primary)]">→</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <p className="text-sm text-[var(--muted-foreground)] text-center">
              Você está cadastrado em {events.length} eventos. Qual deseja acessar?
            </p>

            <div className="space-y-2">
              {events.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectEvent(p.id)}
                  disabled={loading}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-left transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 disabled:opacity-50"
                >
                  <p className="font-medium">{p.event.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {p.event.location || "Sem local definido"} •{" "}
                    {new Date(p.event.startDate).toLocaleDateString("pt-BR")}
                  </p>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setEvents(null);
                setEmail("");
                setError(null);
              }}
              className="w-full text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Voltar
            </button>
          </div>
        )}

        <CreditosParceiros className="border-t border-[var(--border)] pt-6 mt-8" />
      </div>
    </div>
  );
}
