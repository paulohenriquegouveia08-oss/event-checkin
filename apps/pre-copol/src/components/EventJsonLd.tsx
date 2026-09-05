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
}

export function EventJsonLd({
  name = "COPOL 2026 — Congresso de Odontologia de Londrina",
  description = "Site oficial do COPOL — Congresso de Odontologia de Londrina (3º COPOL). Informações do evento, temas de odontologia, palestras, programação e inscrições.",
  startDate,
  endDate,
  locationName = "Universidade Positivo",
  locationCity = "Londrina",
  locationRegion = "PR",
  url = "https://copol2026.com.br/",
  imageUrl = "https://copol2026.com.br/og-image.png",
}: EventJsonLdProps) {
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebSite",
      "@id": `${url}#website`,
      url,
      name,
      description,
      inLanguage: "pt-BR",
    },
    {
      "@type": "Organization",
      "@id": `${url}#organization`,
      name: "COPOL — Congresso de Odontologia de Londrina",
      alternateName: [
        "3º COPOL",
        "Pré-Copol 2026",
        "Congresso Odontológico Positivo Londrinense",
        "COPOL Londrina",
      ],
      url,
      logo: "https://copol2026.com.br/icon-mark.png",
      image: imageUrl,
      address: {
        "@type": "PostalAddress",
        addressLocality: locationCity,
        addressRegion: locationRegion,
        addressCountry: "BR",
      },
    },
  ];

  // O Google exige estritamente 'startDate' para reconhecer e validar um Event sem erros.
  // Se a data do evento estiver definida no sistema, injetamos a entidade Event completa.
  if (startDate) {
    const eventNode: Record<string, unknown> = {
      "@type": "Event",
      "@id": `${url}#event`,
      name,
      description,
      startDate,
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
        "@id": `${url}#organization`,
      },
    };

    if (endDate) {
      eventNode.endDate = endDate;
    }

    graph.push(eventNode);
  }

  const schema = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
