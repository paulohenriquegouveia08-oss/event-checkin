interface EventJsonLdProps {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  locationName?: string;
  locationCity?: string;
  locationRegion?: string;
  url?: string;
  imageUrl?: string;
  organizerName?: string;
}

export function EventJsonLd({
  name = "COPOL 2026 — Congresso de Odontologia de Londrina",
  description = "Site oficial do COPOL — Congresso de Odontologia de Londrina (3º COPOL). Evento sediado na Universidade Positivo — Campus Londrina com palestras sobre Toxina Botulínica: A Ciência por Trás do Resultado Natural.",
  startDate,
  endDate,
  locationName = "Universidade Positivo — Campus Londrina",
  locationCity = "Londrina",
  locationRegion = "PR",
  url = "https://copol2026.com.br/",
  imageUrl = "https://copol2026.com.br/og-image.png",
  organizerName = "Universidade Positivo",
}: EventJsonLdProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name,
    alternateName: [
      "3º COPOL",
      "Pré-Copol 2026",
      "Congresso Odontológico Positivo Londrinense",
      "COPOL Londrina",
    ],
    description,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url,
    image: [imageUrl, "https://copol2026.com.br/icon-mark.png"],
    location: {
      "@type": "Place",
      name: locationName,
      address: {
        "@type": "PostalAddress",
        addressLocality: locationCity,
        addressRegion: locationRegion,
        addressCountry: "BR",
      },
    },
    organizer: {
      "@type": "Organization",
      name: organizerName,
      url: "https://copol2026.com.br",
    },
    sponsor: [
      {
        "@type": "Organization",
        name: "Ecohub",
      },
      {
        "@type": "Organization",
        name: "LSPK Technology",
        url: "https://www.instagram.com/lspktech",
      },
    ],
  };

  if (startDate) {
    schema.startDate = startDate;
  }
  if (endDate) {
    schema.endDate = endDate;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
