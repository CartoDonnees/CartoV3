"use client";

import ResourceManager from "@/components/dashboard/ResourceManager";

const fr = (d) => (d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default function SyncsPage() {
  return (
    <ResourceManager
      readOnly
      searchable={false}
      title="Synchronisations"
      subtitle="Historique des imports du référentiel géographique depuis les fichiers cartographiques."
      endpoint="/api/v1/admin/syncs"
      singular="synchronisation"
      columns={[
        { key: "entityType", label: "Opération", strong: true },
        { key: "author", label: "Auteur" },
        { key: "dateUpdate", label: "Date", render: (r) => fr(r.dateUpdate) },
      ]}
      fields={[]}
    />
  );
}
