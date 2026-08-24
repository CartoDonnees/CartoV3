"use client";

import ResourceManager from "@/components/dashboard/ResourceManager";
import { Badge } from "@/components/dashboard/ui";

const fr = (d) => (d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default function DownloadsPage() {
  return (
    <ResourceManager
      readOnly
      searchable={false}
      title="Téléchargements"
      subtitle="Journal des extractions de données effectuées par les utilisateurs."
      endpoint="/api/v1/admin/downloads"
      singular="téléchargement"
      columns={[
        { key: "type", label: "Format", render: (r) => <Badge tone="blue">{r.type}</Badge> },
        { key: "domain", label: "Domaine", render: (r) => r.domain || "—" },
        { key: "user", label: "Utilisateur" },
        { key: "createdAt", label: "Date", render: (r) => fr(r.createdAt) },
      ]}
      fields={[]}
    />
  );
}
