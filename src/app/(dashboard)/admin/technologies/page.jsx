"use client";

import ResourceManager from "@/components/dashboard/ResourceManager";
import { StatusBadge } from "@/components/dashboard/ui";
import s from "@/components/dashboard/dashboard.module.css";

const STATUS = [
  { value: "ACTIVE", label: "Actif" },
  { value: "INACTIVE", label: "Inactif" },
];

export default function TechnologiesPage() {
  return (
    <ResourceManager
      title="Technologies"
      subtitle="Technologies réseau prises en charge (2G, 3G, 4G…)."
      endpoint="/api/v1/admin/technologies"
      singular="technologie"
      createLabel="Nouvelle technologie"
      defaultForm={{ status: "ACTIVE", color: "#8b5cf6" }}
      toForm={(r) => ({ name: r.name, color: r.color || "#8b5cf6", status: r.status, description: r.description || "" })}
      columns={[
        {
          key: "name",
          label: "Technologie",
          strong: true,
          render: (r) => (
            <span>
              <span className={s.swatch} style={{ background: r.color || "#94a3b8" }} />
              {r.name}
            </span>
          ),
        },
        { key: "status", label: "Statut", render: (r) => <StatusBadge status={r.status} /> },
        { key: "description", label: "Description", muted: true },
      ]}
      fields={[
        { name: "name", label: "Nom", required: true, placeholder: "4G" },
        { name: "color", label: "Couleur", type: "color" },
        { name: "status", label: "Statut", type: "select", options: STATUS, required: true },
        { name: "description", label: "Description", type: "textarea", full: true },
      ]}
    />
  );
}
