import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "../../proxy";

/** Repassa o PDF binário do certificado — diferente das outras rotas deste
 * diretório, a resposta do backend não é JSON (é application/pdf), então
 * não pode passar por res.json() como as demais. Erros (403/404) o
 * backend ainda manda em JSON — nesse caso repassa como está. */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const eventId = request.nextUrl.searchParams.get("eventId") || "";
  const res = await proxyRequest(`/events/${eventId}/certificates/download`, {
    method: "GET",
    headers: { Authorization: authHeader },
  });

  if (!res.ok) {
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": res.headers.get("content-disposition") || "attachment; filename=certificado.pdf",
    },
  });
}
