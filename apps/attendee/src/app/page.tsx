"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginAttendee, selectEvent, type ParticipantData } from "@/lib/api";
import { CreditosParceiros } from "@/components/CreditosParceiros";

export const dynamic = "force-dynamic";

function formatarDataCurta(isoDate?: string): string {
  if (!isoDate) return "22/09";
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return "22/09";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ParticipantData[] | null>(null);
  const [singleEventSession, setSingleEventSession] = useState<{
    token: string;
    participant: ParticipantData;
  } | null>(null);

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
  const [abertos, setAbertos] = useState<{ slug: string; name: string; startDate?: string }[]>([
    { slug: "ecohub", name: "Sistemas Multi-Agente", startDate: "2026-09-22T22:00:00.000Z" },
  ]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      if (emailParam) {
        setEmail(emailParam);
      }
    }

    fetch("/api/publico/eventos-abertos")
      .then((r) => r.json())
      .then((c) => {
        const lista = Array.isArray(c?.data) ? c.data : [];
        setAbertos(
          lista
            .filter((e: { slug?: string; name?: string }) => {
              if (!e.slug) return false;
              const slug = e.slug.toLowerCase();
              const name = (e.name || "").toLowerCase();
              return !slug.includes("copol") && !name.includes("copol");
            })
            .map((e: { slug: string; name: string; startDate?: string }) => ({
              slug: e.slug,
              name: e.name,
              startDate: e.startDate,
            })),
        );
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const response = await loginAttendee(cleanEmail);

      const foundEvents: ParticipantData[] =
        response.data.events && response.data.events.length > 0
          ? response.data.events
          : response.data.participant
          ? [response.data.participant]
          : [];

      if (foundEvents.length === 0) {
        setError("Nenhum evento encontrado para este e-mail.");
        setLoading(false);
        return;
      }

      setEvents(foundEvents);

      if (response.data.token && response.data.participant) {
        setSingleEventSession({
          token: response.data.token,
          participant: response.data.participant,
        });
      } else {
        setSingleEventSession(null);
      }
    } catch (err: any) {
      setError(err.message ?? "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleAccessEvent = async (p: ParticipantData) => {
    setError(null);
    setLoading(true);

    try {
      if (singleEventSession && singleEventSession.participant.id === p.id) {
        localStorage.setItem("attendee_token", singleEventSession.token);
        localStorage.setItem(
          "attendee_data",
          JSON.stringify(singleEventSession.participant)
        );
        router.push("/checkin");
        return;
      }

      const response = await selectEvent(p.id);
      localStorage.setItem("attendee_token", response.data.token!);
      localStorage.setItem(
        "attendee_data",
        JSON.stringify(response.data.participant)
      );
      router.push("/checkin");
    } catch (err: any) {
      setError(err.message ?? "Erro ao acessar credencial do evento");
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

        <a
          href="/eti-summit-2026"
          className="flex items-center justify-between rounded-xl border border-[var(--primary)]/35 bg-[var(--primary)]/10 px-4 py-3 text-sm font-semibold transition hover:bg-[var(--primary)]/20"
        >
          <span>ETI Summit 2026 — programação completa</span>
          <span aria-hidden="true" className="text-[var(--primary)]">→</span>
        </a>

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
                        <div className="flex items-center gap-2.5">
                          <span>Inscrever-se em {e.name}</span>
                          <span className="rounded-md border border-[var(--primary)]/40 bg-[var(--primary)]/25 px-2 py-0.5 text-xs font-semibold text-blue-300">
                            {formatarDataCurta(e.startDate)}
                          </span>
                        </div>
                        <span aria-hidden="true" className="text-[var(--primary)]">→</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>
        ) : (
          <div className="cartao space-y-5 p-6 animate-in fade-in duration-300">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="text-center space-y-1">
              <span className="mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
                Inscrições Encontradas
              </span>
              <h2 className="text-xl font-bold">
                {events.length === 1 ? "Seu Evento Cadastrado" : "Selecione o Evento"}
              </h2>
              <p className="text-xs text-[var(--muted-foreground)]">
                Identificamos {events.length} {events.length === 1 ? "evento vinculado" : "eventos vinculados"} ao e-mail:
                <br />
                <strong className="text-[var(--foreground)] break-all">{email}</strong>
              </p>
            </div>

            <div className="space-y-3">
              {events.map((p) => {
                const dateFormatted = p.event.startDate
                  ? new Date(p.event.startDate).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      timeZone: "America/Sao_Paulo",
                    })
                  : "Data a confirmar";

                return (
                  <div
                    key={p.id}
                    onClick={() => !loading && handleAccessEvent(p)}
                    className="group relative flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-4 transition-all hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 hover:shadow-[0_6px_24px_-10px_rgba(59,91,255,0.4)] cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block rounded-md border border-[var(--primary)]/30 bg-[var(--primary)]/15 px-2 py-0.5 text-[0.7rem] font-semibold text-blue-300 mb-1.5">
                          {p.checkedIn ? "✓ Check-in Realizado" : "Inscrição Confirmada"}
                        </span>
                        <h3 className="text-base font-bold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                          {p.event.name}
                        </h3>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                      <span className="flex items-center gap-1.5">
                        📅 {dateFormatted}
                      </span>
                      {p.event.location && (
                        <span className="flex items-center gap-1.5">
                          📍 {p.event.location}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-[var(--primary-foreground)] shadow-[0_8px_20px_-10px_rgba(59,91,255,0.8)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
                    >
                      <span>{loading ? "Acessando..." : "Pegar QR Code para Check-in"}</span>
                      <span>→</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setEvents(null);
                setSingleEventSession(null);
                setError(null);
              }}
              className="w-full text-center text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors pt-2"
            >
              ← Buscar outro e-mail
            </button>
          </div>
        )}

        <CreditosParceiros className="border-t border-[var(--border)] pt-6 mt-8" />
      </div>
    </div>
  );
}
