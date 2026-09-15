/**
 * Référentiel des opérateurs côté interface.
 *
 * Module pur : il ne dépend ni de React ni de Mapbox, et sert de source unique
 * aux libellés, aux logos de repli et à la nature du réseau. Les données
 * réelles viennent de la base (`/api/v1/operators`) ; ce qui est ici sert de
 * repli quand la base n'a pas encore répondu, et de vocabulaire commun.
 */

import { OPERATORS } from "@/config/artci";

/** Nature du réseau exploité (miroir de l'enum Prisma `NetworkType`). */
export const NETWORK_TYPES = [
  { value: "FIXED", label: "Fixe", short: "Fixe" },
  { value: "MOBILE", label: "Mobile", short: "Mobile" },
  { value: "HYBRID", label: "Hybride (fixe et mobile)", short: "Hybride" },
];

export const DEFAULT_NETWORK = "MOBILE";

/** Libellé lisible d'une nature de réseau. */
export const networkLabel = (value) =>
  NETWORK_TYPES.find((n) => n.value === value)?.label ?? networkFallback(value);

/** Libellé court, pour les pastilles et les listes serrées. */
export const networkShort = (value) =>
  NETWORK_TYPES.find((n) => n.value === value)?.short ?? networkFallback(value);

const networkFallback = (value) => (value ? String(value) : "-");

/**
 * Logos livrés avec l'application, servis depuis `public/`.
 *
 * Ils tiennent lieu de repli tant que la base n'a pas répondu, et couvrent le
 * cas d'un opérateur dont le logo n'a jamais été renseigné. Un logo téléversé
 * depuis l'administration l'emporte toujours.
 */
export const OPERATOR_LOGOS = {
  ORANGE: "/images/logo/operateurs/orange.png",
  MTN: "/images/logo/operateurs/mtn.png",
  MOOV: "/images/logo/operateurs/moov.png",
};

/**
 * Logo d'un opérateur : celui enregistré en base, sinon celui livré avec
 * l'application, sinon rien (l'appelant retombe alors sur la pastille de
 * couleur).
 */
export const operatorLogo = (operator) => {
  const stored = typeof operator === "object" ? operator?.imagePath : null;
  const code = typeof operator === "object" ? operator?.code ?? operator?.key : operator;
  return stored || OPERATOR_LOGOS[String(code || "").toUpperCase()] || null;
};

/** Descripteur de repli d'un opérateur, depuis la configuration. */
export const operatorFallback = (code) => {
  const cfg = OPERATORS.find((o) => o.code === code);
  return cfg
    ? { code: cfg.code, name: cfg.name, color: cfg.color, imagePath: OPERATOR_LOGOS[cfg.code] ?? null, network: DEFAULT_NETWORK }
    : null;
};
