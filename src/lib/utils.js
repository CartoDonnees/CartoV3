import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Fusionne des classes Tailwind de façon sûre (clsx + tailwind-merge). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Formate un entier avec des séparateurs de milliers (fr-FR). */
export function formatNumber(value) {
  if (value == null) return "-";
  return new Intl.NumberFormat("fr-FR").format(value);
}

/** Formate un pourcentage avec 1 décimale. */
export function formatPercent(value) {
  if (value == null) return "-";
  return `${Number(value).toFixed(1)} %`;
}

/** Format compact (22.7 M, 8.5 k). */
export function formatCompact(value) {
  if (value == null) return "-";
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
