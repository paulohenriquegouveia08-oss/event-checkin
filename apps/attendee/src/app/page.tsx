"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAttendee, selectEvent, type ParticipantData } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ParticipantData[] | null>(null);

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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10">
            <svg
              className="h-8 w-8 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Event Check-in</h1>
          <p className="mt-2 text-sm text-[--muted-foreground]">
            Acesse seu QR code para marcar presença
          </p>
        </div>

        {!events ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm text-[--muted-foreground]"
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
                className="w-full rounded-lg border border-[--border] bg-[--muted] px-4 py-3 text-[--foreground] placeholder:text-[--muted-foreground] focus:border-green-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-black transition-colors hover:bg-green-400 disabled:opacity-50"
            >
              {loading ? "Buscando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <p className="text-sm text-[--muted-foreground] text-center">
              Você está cadastrado em {events.length} eventos. Qual deseja acessar?
            </p>

            <div className="space-y-2">
              {events.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectEvent(p.id)}
                  disabled={loading}
                  className="w-full rounded-lg border border-[--border] bg-[--muted] px-4 py-3 text-left transition-colors hover:border-green-500 hover:bg-green-500/5 disabled:opacity-50"
                >
                  <p className="font-medium">{p.event.name}</p>
                  <p className="text-xs text-[--muted-foreground]">
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
              className="w-full text-sm text-[--muted-foreground] hover:text-[--foreground]"
            >
              Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
