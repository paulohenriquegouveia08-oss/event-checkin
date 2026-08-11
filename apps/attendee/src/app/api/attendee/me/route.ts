import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "../proxy";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const res = await proxyRequest("/attendee/me", {
    method: "GET",
    headers: { Authorization: authHeader },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
