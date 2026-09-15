"use client";

import ResourceManager from "@/components/dashboard/ResourceManager";
import { StatusBadge } from "@/components/dashboard/ui";
import { NETWORK_TYPES, networkLabel } from "@/lib/operators";
import { mediaUrl } from "@/lib/media";
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
      subtitle="Opérateurs de télécommunications suivis par l'observatoire."
      endpoint="/api/v1/admin/operators"
      singular="opérateur"
      createLabel="Nouvel opérateur"
      defaultForm={{ status: "ACTIVE", color: "#159a4e", network: "MOBILE", imagePath: "" }}
      toForm={(r) => ({
        name: r.name,
        color: r.color || "#159a4e",
        imagePath: r.imagePath || "",
        network: r.network || "MOBILE",
        fiberKm: r.fiberKm ?? "",
        status: r.status,
        description: r.description || "",
      })}
      columns={[
        {
          key: "name",
          label: "Opérateur",
          strong: true,
          render: (r) => (
            <span>
              <span className={s.logoCell}>
                {mediaUrl(r.imagePath) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(r.imagePath)} alt="" />
                ) : (
                  <span className={s.swatch} style={{ background: r.color, margin: 0 }} />
                )}
              </span>
              {r.name}
            </span>
          ),
        },
        {
          key: "network",
          label: "Réseau",
          render: (r) => networkLabel(r.network),
        },
        {
          key: "fiberKm",
          label: "Fibre (km)",
          render: (r) => (r.fiberKm != null ? r.fiberKm.toLocaleString("fr-FR") : "-"),
        },
        { key: "status", label: "Statut", render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fields={[
        { name: "name", label: "Nom", required: true },
        {
          name: "network",
          label: "Type de réseau",
          type: "select",
          options: NETWORK_TYPES.map((n) => ({ value: n.value, label: n.label })),
          required: true,
          help: "Fixe, mobile, ou les deux.",
        },
        {
          name: "imagePath",
          label: "Logo",
          type: "image",
          full: true,
          help: "PNG, JPEG, WebP, SVG, GIF ou AVIF — 2 Mo maximum. Le logo est repris dans tous les filtres par opérateur.",
        },
        { name: "color", label: "Couleur", type: "color", required: true },
        { name: "fiberKm", label: "Fibre optique (km)", type: "number" },
        { name: "status", label: "Statut", type: "select", options: STATUS, required: true },
        { name: "description", label: "Description", type: "textarea", full: true },
      ]}
    />
  );
}
