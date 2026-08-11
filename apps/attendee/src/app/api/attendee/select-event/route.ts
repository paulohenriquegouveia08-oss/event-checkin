import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "../../proxy";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await proxyRequest("/attendee/select-event", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
