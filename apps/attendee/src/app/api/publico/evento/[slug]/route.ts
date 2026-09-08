import { NextRequest, NextResponse } from "next/server";
import { cabecalhosDeOrigem, proxyRequest } from "../../../proxy";

/** O evento pelo endereço divulgado. Público: sem token. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const res = await proxyRequest(`/public/events/${encodeURIComponent(slug)}`, { method: "GET", headers: cabecalhosDeOrigem(request) });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
