"use client";

import ResourceManager from "@/components/dashboard/ResourceManager";
import { StatusBadge } from "@/components/dashboard/ui";
import s from "@/components/dashboard/dashboard.module.css";

const STATUS = [
  { value: "ACTIVE", label: "Actif" },
  { value: "INACTIVE", label: "Inactif" },
  { value: "SUSPENDED", label: "Suspendu" },
];

export default function OperatorsPage() {
  return (
    <ResourceManager
      title="Opérateurs"
      subtitle="Opérateurs mobiles suivis par l'observatoire."
      endpoint="/api/v1/admin/operators"
      singular="opérateur"
      createLabel="Nouvel opérateur"
      defaultForm={{ status: "ACTIVE", color: "#159a4e" }}
      toForm={(r) => ({ name: r.name, color: r.color || "#159a4e", fiberKm: r.fiberKm ?? "", status: r.status, description: r.description || "" })}
      columns={[
        {
          key: "name",
          label: "Opérateur",
          strong: true,
          render: (r) => (
            <span>
              <span className={s.swatch} style={{ background: r.color }} />
              {r.name}
            </span>
          ),
        },
        { key: "fiberKm", label: "Fibre (km)", render: (r) => (r.fiberKm != null ? r.fiberKm.toLocaleString("fr-FR") : "—") },
        { key: "status", label: "Statut", render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fields={[
        { name: "name", label: "Nom", required: true },
        { name: "color", label: "Couleur", type: "color", required: true },
        { name: "fiberKm", label: "Fibre optique (km)", type: "number" },
        { name: "status", label: "Statut", type: "select", options: STATUS, required: true },
        { name: "description", label: "Description", type: "textarea", full: true },
      ]}
    />
  );
}
