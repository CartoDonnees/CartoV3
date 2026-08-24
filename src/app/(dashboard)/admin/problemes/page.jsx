"use client";

import ResourceManager from "@/components/dashboard/ResourceManager";
import { StatusBadge, Badge } from "@/components/dashboard/ui";

const TYPES = [
  { value: "NETWORK", label: "Réseau" },
  { value: "APPLICATION", label: "Application" },
];
const LEVELS = [
  { value: "VOICE", label: "Voix" },
  { value: "SMS", label: "SMS" },
  { value: "DATA", label: "Data" },
  { value: "HIGH", label: "Élevé" },
  { value: "MEDIUM", label: "Moyen" },
  { value: "LOW", label: "Faible" },
];
const STATUS = [
  { value: "ACTIVE", label: "Actif" },
  { value: "INACTIVE", label: "Inactif" },
];
const LEVEL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.value, l.label]));

export default function ProblemsPage() {
  return (
    <ResourceManager
      title="Problèmes"
      subtitle="Taxonomie des problèmes proposés aux citoyens lors d'un signalement."
      endpoint="/api/v1/admin/problems"
      singular="problème"
      createLabel="Nouveau problème"
      defaultForm={{ type: "NETWORK", level: "VOICE", status: "ACTIVE" }}
      toForm={(r) => ({ type: r.type, level: r.level, title: r.title, status: r.status, description: r.description || "" })}
      columns={[
        { key: "title", label: "Intitulé", strong: true },
        { key: "type", label: "Type", render: (r) => <Badge tone={r.type === "NETWORK" ? "blue" : "amber"}>{r.type === "NETWORK" ? "Réseau" : "Application"}</Badge> },
        { key: "level", label: "Niveau", render: (r) => LEVEL_LABEL[r.level] || r.level },
        { key: "status", label: "Statut", render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fields={[
        { name: "title", label: "Intitulé", required: true, full: true },
        { name: "type", label: "Type", type: "select", options: TYPES, required: true },
        { name: "level", label: "Niveau", type: "select", options: LEVELS, required: true },
        { name: "status", label: "Statut", type: "select", options: STATUS, required: true },
        { name: "description", label: "Description", type: "textarea", full: true },
      ]}
    />
  );
}
