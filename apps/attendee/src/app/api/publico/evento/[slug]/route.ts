import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "../../../proxy";

/** O evento pelo endereço divulgado. Público: sem token. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const res = await proxyRequest(`/public/events/${encodeURIComponent(slug)}`, { method: "GET" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
