"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";
import { getParticipantMe, connectSSE, type ParticipantData } from "@/lib/api";

type CheckInStatus = "CONFIRMED" | "ALREADY_CHECKED_IN" | "REJECTED" | null;

interface StatusEvent {
  type: "connected" | "check_in";
  participantId?: string;
  participantName?: string;
  status?: CheckInStatus;
  checkedInAt?: string;
}

export default function CheckInPage() {
  const router = useRouter();
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CheckInStatus>(null);
  const [statusVisible, setStatusVisible] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showStatus = useCallback((newStatus: CheckInStatus) => {
    setStatus(newStatus);
    setStatusVisible(true);

    // Clear previous timeout
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }

    // Hide status after 5 seconds
    statusTimeoutRef.current = setTimeout(() => {
      setStatusVisible(false);
    }, 5000);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("attendee_token");
    if (!token) {
      router.push("/");
      return;
    }

    // Load participant data
    const loadData = async () => {
      try {
        const stored = localStorage.getItem("attendee_data");
        if (stored) {
          setParticipant(JSON.parse(stored));
        }

        // Refresh from server
        const response = await getParticipantMe(token);
        if (response.success) {
          setParticipant(response.data);
          localStorage.setItem("attendee_data", JSON.stringify(response.data));

          // If already checked in, show status
          if (response.data.checkedIn) {
            showStatus("CONFIRMED");
          }
        } else {
          // Token invalid
          localStorage.removeItem("attendee_token");
          localStorage.removeItem("attendee_data");
          router.push("/");
        }
      } catch {
        setError("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Connect to SSE for real-time updates
    const disconnect = connectSSE(
      token,
      (event: StatusEvent) => {
        if (event.type === "connected") {
          setSseConnected(true);
        } else if (event.type === "check_in" && event.status) {
          showStatus(event.status);
          // Update local data
          setParticipant((prev) =>
            prev
              ? {
                  ...prev,
                  checkedIn: true,
                  lastCheckIn: {
                    id: "sse-" + Date.now(),
                    checkedInAt: event.checkedInAt ?? new Date().toISOString(),
                    terminal: null,
                  },
                }
              : prev
          );
        }
      },
      () => {
        setSseConnected(false);
      }
    );

    return () => {
      disconnect();
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, [router, showStatus]);

  const handleLogout = () => {
    localStorage.removeItem("attendee_token");
    localStorage.removeItem("attendee_data");
    router.push("/");
  };

  const handleDownloadPdf = () => {
    if (!participant) return;
    const canvas = document.getElementById("qr-canvas") as HTMLCanvasElement;
    if (!canvas) return;

    const imgData = canvas.toDataURL("image/png");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageW = doc.internal.pageSize.getWidth();

    // Background
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageW, 297, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text(participant.event.name, pageW / 2, 40, { align: "center" });

    if (participant.event.location) {
      doc.setFontSize(12);
      doc.setTextColor(160, 160, 160);
      doc.text(participant.event.location, pageW / 2, 50, { align: "center" });
    }

    // QR Code - white background behind it
    const qrSize = 70;
    const qrX = (pageW - qrSize) / 2;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX - 5, 65, qrSize + 10, qrSize + 10, 3, 3, "F");
    doc.addImage(imgData, "PNG", qrX, 70, qrSize, qrSize);

    // Participant name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(participant.name, pageW / 2, 155, { align: "center" });

    // Email
    doc.setFontSize(10);
    doc.setTextColor(160, 160, 160);
    doc.text(participant.email, pageW / 2, 163, { align: "center" });

    // Token
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Código: ${participant.qrToken}`, pageW / 2, 175, { align: "center" });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text("Apresente este QR code na entrada do evento", pageW / 2, 260, { align: "center" });

    doc.save(`qr-code-${participant.name.replace(/\s+/g, "_")}.pdf`);
  };

  const handleDownloadReceipt = () => {
    if (!participant) return;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;

    // Fundo branco
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, 297, "F");

    // Cabeçalho
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageW, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("COMPROVANTE DE PRESENCA", pageW / 2, 22, { align: "center" });

    let y = 50;

    // Evento
    doc.setTextColor(10, 10, 10);
    doc.setFontSize(10);
    doc.text("EVENTO", margin, y);
    y += 6;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(participant.event.name, margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    if (participant.event.location) {
      doc.text(participant.event.location, margin, y);
      y += 6;
    }
    const startDt = new Date(participant.event.startDate);
    const endDt = new Date(participant.event.endDate);
    doc.text(
      `${startDt.toLocaleDateString("pt-BR")} a ${endDt.toLocaleDateString("pt-BR")}`,
      margin,
      y
    );
    y += 12;

    // Separador
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 10;

    // Dados do participante
    doc.setTextColor(10, 10, 10);
    doc.setFontSize(10);
    doc.text("PARTICIPANTE", margin, y);
    y += 7;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(participant.name, margin, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`E-mail: ${participant.email}`, margin, y);
    y += 6;

    if (participant.phone) {
      doc.text(`Telefone: ${participant.phone}`, margin, y);
      y += 6;
    }

    if (participant.document) {
      doc.text(`CPF: ${participant.document}`, margin, y);
      y += 6;
    }

    y += 6;

    // Separador
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 10;

    // Dados do check-in
    doc.setTextColor(10, 10, 10);
    doc.setFontSize(10);
    doc.text("CHECK-IN", margin, y);
    y += 7;

    if (participant.lastCheckIn) {
      const checkInDt = new Date(participant.lastCheckIn.checkedInAt);
      doc.setFontSize(11);
      doc.setTextColor(0, 128, 0);
      doc.setFont("helvetica", "bold");
      doc.text("PRESENCA CONFIRMADA", margin, y);
      y += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Data/Hora: ${checkInDt.toLocaleString("pt-BR")}`, margin, y);
      y += 6;

      if (participant.lastCheckIn.terminal) {
        doc.text(`Terminal: ${participant.lastCheckIn.terminal.name}`, margin, y);
        y += 6;
      }
    } else {
      doc.setFontSize(11);
      doc.setTextColor(180, 120, 0);
      doc.text("Aguardando check-in na entrada", margin, y);
      y += 7;
    }

    y += 10;

    // Separador
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 10;

    // Rodapé
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.text("Este documento comprova sua presença no evento.", pageW / 2, y, { align: "center" });
    y += 5;
    doc.text("Apresente se solicitado pela organização.", pageW / 2, y, { align: "center" });

    // QR code pequeno no canto inferior direito
    const canvas = document.getElementById("qr-canvas") as HTMLCanvasElement;
    if (canvas) {
      const imgData = canvas.toDataURL("image/png");
      doc.addImage(imgData, "PNG", pageW - margin - 25, 255, 20, 20);
    }

    doc.save(`comprovante-${participant.name.replace(/\s+/g, "_")}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
          <p className="text-sm text-[--muted-foreground]">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400">Dados não encontrados</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 text-sm text-teal-400 hover:underline"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      {/* Status Overlay */}
      {statusVisible && status && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-300 ${
            statusVisible ? "opacity-100" : "opacity-0"
          } ${
            status === "CONFIRMED"
              ? "bg-teal-400/20"
              : status === "ALREADY_CHECKED_IN"
                ? "bg-yellow-500/20"
                : "bg-red-500/20"
          }`}
        >
          <div
            className={`rounded-2xl p-8 text-center ${
              status === "CONFIRMED"
                ? "bg-teal-400"
                : status === "ALREADY_CHECKED_IN"
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
          >
            {status === "CONFIRMED" && (
              <>
                <svg
                  className="mx-auto mb-4 h-16 w-16 text-black"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={3}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
                <h2 className="text-2xl font-bold text-black">
                  Presença Confirmada!
                </h2>
                <p className="mt-2 text-black/70">{participant.name}</p>
              </>
            )}
            {status === "ALREADY_CHECKED_IN" && (
              <>
                <svg
                  className="mx-auto mb-4 h-16 w-16 text-black"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={3}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
                <h2 className="text-2xl font-bold text-black">
                  Já Registrado!
                </h2>
                <p className="mt-2 text-black/70">
                  Sua presença já foi registrada anteriormente
                </p>
              </>
            )}
            {status === "REJECTED" && (
              <>
                <svg
                  className="mx-auto mb-4 h-16 w-16 text-black"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={3}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                <h2 className="text-2xl font-bold text-black">
                  Presença Negada!
                </h2>
                <p className="mt-2 text-black/70">
                  entre em contato com a organização
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-400/10">
            <svg
              className="h-6 w-6 text-teal-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold">{participant.event.name}</h1>
          {participant.event.location && (
            <p className="mt-1 text-sm text-[--muted-foreground]">
              {participant.event.location}
            </p>
          )}
        </div>

        {/* QR Code Card */}
        <div className="rounded-2xl border border-[--border] bg-[--muted] p-6 text-center">
          <p className="mb-4 text-sm text-[--muted-foreground]">
            Apresente este QR code na entrada do evento
          </p>

          <div className="mx-auto mb-4 flex w-48 items-center justify-center rounded-xl bg-white p-4">
            <QRCodeSVG
              value={participant.qrToken}
              size={160}
              level="M"
              includeMargin={false}
            />
            {/* Hidden canvas for PDF export */}
            <QRCodeCanvas
              id="qr-canvas"
              value={participant.qrToken}
              size={300}
              level="M"
              includeMargin={false}
              style={{ display: "none" }}
            />
          </div>

          <p className="text-xs text-[--muted-foreground]">
            Seu código:{" "}
            <span className="font-mono">{participant.qrToken.slice(0, 12)}...</span>
          </p>

          <button
            onClick={handleDownloadPdf}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[--border] bg-[--background] px-4 py-2 text-sm font-medium text-[--foreground] transition-colors hover:bg-[--muted]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Baixar QR Code
          </button>

          {participant.lastCheckIn && (
            <button
              onClick={handleDownloadReceipt}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Baixar Comprovante
            </button>
          )}
        </div>

        {/* Participant Info */}
        <div className="rounded-xl border border-[--border] bg-[--muted] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-400/10 text-sm font-bold text-teal-400">
              {participant.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{participant.name}</p>
              <p className="text-xs text-[--muted-foreground]">
                {participant.email}
              </p>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <div
            className={`h-2 w-2 rounded-full ${
              sseConnected ? "bg-teal-400" : "bg-red-500"
            }`}
          />
          <span className="text-[--muted-foreground]">
            {sseConnected
              ? "Conectado — aguardando scan"
              : "Reconectando..."}
          </span>
        </div>

        {/* Last Check-in */}
        {participant.lastCheckIn && (
          <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-4 text-center">
            <p className="text-sm text-teal-300">
              ✓ Presença registrada
            </p>
            <p className="mt-1 text-xs text-[--muted-foreground]">
              {new Date(participant.lastCheckIn.checkedInAt).toLocaleString(
                "pt-BR"
              )}
            </p>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full text-center text-sm text-[--muted-foreground] hover:text-[--foreground]"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
