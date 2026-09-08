import { NextResponse } from "next/server";
import { proxyRequest } from "../../proxy";

/** Eventos ativos com inscrição aberta e endereço público. */
export async function GET() {
  const res = await proxyRequest("/events/active", { method: "GET" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
