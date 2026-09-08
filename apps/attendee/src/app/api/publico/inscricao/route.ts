import { NextRequest, NextResponse } from "next/server";
import { cabecalhosDeOrigem, proxyRequest } from "../../proxy";

/**
 * Cria a inscrição.
 *
 * Passa pelo proxy como todo o resto: o navegador nunca fala direto com a
 * API, e o IP de origem chega ao backend pelo cabeçalho encaminhado — é
 * ele que vira prova do consentimento (LGPD art. 8º, §1º).
 */
export async function POST(request: NextRequest) {
  const { eventId, ...corpo } = await request.json();

  if (typeof eventId !== "string" || eventId.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: "EVENTO_AUSENTE", message: "Evento não informado." } },
      { status: 400 },
    );
  }

  // O IP DO VISITANTE PRECISA CHEGAR AO BACKEND.
  //
  // Esta chamada sai do servidor do Next, não do navegador: sem
  // encaminhar, o backend registraria o IP do próprio contêiner como
  // prova do consentimento — o mesmo endereço para todo mundo, o que não
  // prova nada (LGPD art. 8º, §1º).
  const res = await proxyRequest(`/events/${encodeURIComponent(eventId)}/inscriptions`, {
    method: "POST",
    body: JSON.stringify(corpo),
    headers: cabecalhosDeOrigem(request),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
