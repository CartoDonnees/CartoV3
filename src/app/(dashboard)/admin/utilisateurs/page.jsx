"use client";

import ResourceManager from "@/components/dashboard/ResourceManager";
import { RoleBadge, StatusBadge } from "@/components/dashboard/ui";

const ROLES = [
  { value: "CLIENT", label: "Citoyen" },
  { value: "OPERATOR", label: "Opérateur" },
  { value: "CONTROLLER", label: "Contrôleur" },
  { value: "SUPERVISOR", label: "Superviseur" },
  { value: "ADMIN", label: "Administrateur" },
];
const STATUS = [
  { value: "ACTIVE", label: "Actif" },
  { value: "INACTIVE", label: "Inactif" },
  { value: "PENDING", label: "En attente" },
  { value: "SUSPENDED", label: "Suspendu" },
];

export default function UsersPage() {
  return (
    <ResourceManager
      title="Utilisateurs"
      subtitle="Comptes du back-office et citoyens inscrits."
      endpoint="/api/v1/admin/users"
      singular="utilisateur"
      createLabel="Nouvel utilisateur"
      defaultForm={{ role: "CLIENT", status: "ACTIVE" }}
      toForm={(r) => ({
        firstName: r.firstName || "",
        lastName: r.lastName || "",
        email: r.email || "",
        phone: r.phone || "",
        role: r.role,
        operatorCode: r.operatorCode || "",
        status: r.status,
        password: "",
      })}
      columns={[
        { key: "lastName", label: "Nom", strong: true, render: (r) => `${r.firstName || ""} ${r.lastName}`.trim() },
        { key: "email", label: "E-mail" },
        { key: "role", label: "Rôle", render: (r) => <RoleBadge role={r.role} /> },
        { key: "operatorName", label: "Opérateur", render: (r) => r.operatorName || "-" },
        { key: "status", label: "Statut", render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fields={[
        { name: "firstName", label: "Prénom" },
        { name: "lastName", label: "Nom", required: true },
        { name: "email", label: "E-mail", type: "email", required: true },
        { name: "phone", label: "Téléphone" },
        { name: "role", label: "Rôle", type: "select", options: ROLES, required: true },
        {
          name: "operatorCode",
          label: "Opérateur rattaché",
          type: "select",
          remote: { endpoint: "/api/v1/admin/operators", valueKey: "code", labelKey: "name" },
          showIf: (f) => f.role === "OPERATOR",
          required: true,
        },
        { name: "status", label: "Statut", type: "select", options: STATUS, required: true },
        { name: "password", label: "Mot de passe", type: "password", required: true, full: true, help: "À l'édition, laisser vide pour conserver le mot de passe actuel." },
      ]}
    />
  );
}
