/**
 * Briques du back-office - simples adaptations des primitives communes
 * (`@/components/ui/kit`) afin que l'administration, les tableaux de bord
 * publics et la carte partagent exactement le même design.
 */
import { Badge, Card, Empty, Loading, Meter, PageHead, Tile } from "@/components/ui/kit";

export { Badge, Card, Meter, PageHead };

/** Indicateur clé (même vignette que les tableaux de bord de couverture). */
export const StatCard = Tile;

export function Spinner({ label = "Chargement…" }) {
  return <Loading label={label} />;
}

export function EmptyState({ icon, children }) {
  return <Empty icon={icon}>{children}</Empty>;
}

const STATUS_TONE = {
  ACTIVE: "green",
  INACTIVE: "gray",
  PENDING: "amber",
  SUSPENDED: "red",
  RESOLVED: "green",
  IN_REVIEW: "blue",
  REJECTED: "red",
};
const STATUS_LABEL = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  PENDING: "En attente",
  SUSPENDED: "Suspendu",
  IN_REVIEW: "En cours",
  RESOLVED: "Résolu",
  REJECTED: "Rejeté",
};
export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status] || "gray"}>{STATUS_LABEL[status] || status}</Badge>;
}

const ROLE_TONE = { ADMIN: "red", SUPERVISOR: "blue", CONTROLLER: "blue", OPERATOR: "amber", CLIENT: "gray" };
const ROLE_LABEL = { ADMIN: "Administrateur", SUPERVISOR: "Superviseur", CONTROLLER: "Contrôleur", OPERATOR: "Opérateur", CLIENT: "Citoyen" };
export function RoleBadge({ role }) {
  return <Badge tone={ROLE_TONE[role] || "gray"}>{ROLE_LABEL[role] || role}</Badge>;
}
