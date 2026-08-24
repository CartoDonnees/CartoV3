"use client";

import ResourceManager from "@/components/dashboard/ResourceManager";
import { StatusBadge, Badge } from "@/components/dashboard/ui";

const TYPES = [
  { value: "COVERAGE", label: "Couverture" },
  { value: "QOS", label: "Qualité de service" },
];
const STATUS = [
  { value: "ACTIVE", label: "Actif" },
  { value: "INACTIVE", label: "Inactif" },
];

export default function PeriodsPage() {
  return (
    <ResourceManager
      title="Périodes"
      subtitle="Semestres de couverture et campagnes de qualité de service."
      endpoint="/api/v1/admin/periods"
      singular="période"
      createLabel="Nouvelle période"
      defaultForm={{ type: "COVERAGE", status: "ACTIVE" }}
      toForm={(r) => ({ title: r.title, type: r.type, status: r.status })}
      columns={[
        { key: "title", label: "Intitulé", strong: true },
        { key: "type", label: "Type", render: (r) => <Badge tone={r.type === "QOS" ? "blue" : "green"}>{r.type === "QOS" ? "Qualité de service" : "Couverture"}</Badge> },
        { key: "status", label: "Statut", render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fields={[
        { name: "title", label: "Intitulé", required: true, placeholder: "2025-06-30", help: "Format date AAAA-MM-JJ pour les couvertures." },
        { name: "type", label: "Type", type: "select", options: TYPES, required: true },
        { name: "status", label: "Statut", type: "select", options: STATUS, required: true },
      ]}
    />
  );
}
