import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "../../proxy";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const eventId = request.nextUrl.searchParams.get("eventId") || "";
  const res = await proxyRequest(`/events/${eventId}/attendance-proof/download`, {
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
      "Content-Disposition": res.headers.get("content-disposition") || "attachment; filename=comprovante-presenca.pdf",
    },
  });
}
