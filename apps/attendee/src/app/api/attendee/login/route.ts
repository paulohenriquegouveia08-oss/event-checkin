import { NextRequest, NextResponse } from "next/server";
import { cabecalhosDeOrigem, proxyRequest } from "../../proxy";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await proxyRequest("/attendee/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: cabecalhosDeOrigem(request),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
