/**
 * Stations mobiles et concentration des infrastructures.
 *
 * Module pur : aucune dépendance à React ni à Mapbox, pour que les
 * indicateurs et les couches soient vérifiables hors navigateur.
 *
 * DEUX SOURCES, DEUX USAGES - la distinction est structurante :
 *
 *  1. `stations.geojson` (extrait des jeux de tuiles ARTCI) donne la POSITION
 *     exacte des sites, leur technologie et leur nombre de cellules. Il ne
 *     porte AUCUNE information d'opérateur : le filtre par opérateur ne peut
 *     donc pas s'y appliquer.
 *
 *  2. Les fichiers de couverture datés portent, pour chaque localité puis pour
 *     chaque entité administrative, les champs `present{OPÉRATEUR}{TECHNO}` :
 *     un décompte de stations par opérateur ET par technologie, contrôlé
 *     additif et égal aux totaux nationaux. C'est la source de référence pour
 *     les statistiques et pour le choroplèthe de concentration.
 *
 * Les deux ne se recouvrent pas : les tuiles décrivent l'implantation physique
 * (3 933 sites), les fichiers de couverture le parc déclaré par période
 * (12 690 stations en 2024, 18 788 en 2026). Chaque affichage indique donc
 * clairement de quelle source il provient.
 */

import { OPERATORS, TECHNOLOGIES } from "@/config/artci";

export const OPERATOR_CODES = OPERATORS.map((o) => o.code);
export const TECH_CODES = TECHNOLOGIES.map((t) => t.code);

/* ------------------------------ Décomptes -------------------------------- */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Nombre de stations d'une entité pour une sélection d'opérateurs et de
 * technologies. Les champs `present{OP}{TECH}` se somment sans double compte :
 * contrôlé égal à `nombrepresent` sur toutes les entités, aux quatre
 * découpages et sur les deux référentiels.
 */
export function stationCount(props, operators = OPERATOR_CODES, technologies = TECH_CODES) {
  let total = 0;
  for (const op of operators) for (const t of technologies) total += num(props[`present${op}${t}`]);
  return total;
}

/** Décompte par technologie, pour une sélection d'opérateurs. */
export function countByTech(props, operators = OPERATOR_CODES) {
  return Object.fromEntries(
    TECH_CODES.map((t) => [t, operators.reduce((s, op) => s + num(props[`present${op}${t}`]), 0)]),
  );
}

/** Décompte par opérateur, pour une sélection de technologies. */
export function countByOperator(props, technologies = TECH_CODES) {
  return Object.fromEntries(
    OPERATOR_CODES.map((op) => [op, technologies.reduce((s, t) => s + num(props[`present${op}${t}`]), 0)]),
  );
}

/* --------------------------- Modes d'affichage --------------------------- */

export const STATION_MODES = [
  {
    key: "sites",
    label: "Stations",
    hint: "Sites 2G/3G/4G géolocalisés",
  },
  {
    key: "perLocality",
    label: "Concentration par localités",
    hint: "Stations rapportées au nombre de localités",
  },
  {
    key: "perPopulation",
    label: "Concentration par population",
    hint: "Stations rapportées à la population",
  },
];
export const DEFAULT_MODE = "sites";
export const isChoroplethMode = (mode) => mode === "perLocality" || mode === "perPopulation";

/* -------------------------- Indicateurs de concentration ----------------- */

/**
 * Deux lectures de la concentration. L'unité est portée par l'indicateur
 * lui-même et rappelée partout (légende, infobulle, export) : « 2,4 » ne veut
 * rien dire sans « stations par localité ».
 */
export const CONCENTRATION_METRICS = [
  {
    key: "perLocality",
    label: "Par localité",
    title: "Stations par localité",
    unit: "stations / localité",
    short: "st./loc.",
    /** Nombre de stations rapporté au nombre de localités de l'entité. */
    value: (props, count) => {
      const locs = num(props.locs);
      return locs ? count / locs : 0;
    },
    decimals: 2,
    scale: [
      { at: 0, color: "#eef2f7" },
      { at: 1, color: "#cfe3f7" },
      { at: 2, color: "#7fb6e8" },
      { at: 3, color: "#3b82c4" },
      { at: 4, color: "#1d4e89" },
      { at: 6, color: "#0b2a4a" },
    ],
  },
  {
    key: "perPopulation",
    label: "Par population",
    title: "Stations pour 10 000 habitants",
    unit: "stations / 10 000 hab.",
    short: "st./10k hab.",
    /**
     * Rapport station/population exprimé POUR 10 000 HABITANTS, et non
     * « habitants par station » : le sens de lecture reste alors le même que
     * pour l'autre indicateur - plus la valeur est haute, mieux l'entité est
     * équipée.
     */
    value: (props, count) => {
      const pop = num(props.pop);
      return pop ? (count / pop) * 10000 : 0;
    },
    decimals: 1,
    scale: [
      { at: 0, color: "#eef2f7" },
      { at: 4, color: "#cfe3f7" },
      { at: 8, color: "#7fb6e8" },
      { at: 12, color: "#3b82c4" },
      { at: 18, color: "#1d4e89" },
      { at: 25, color: "#0b2a4a" },
    ],
  },
];

export const DEFAULT_CONCENTRATION = "perLocality";

export const concentrationInfo = (key) =>
  CONCENTRATION_METRICS.find((m) => m.key === key) ?? CONCENTRATION_METRICS[0];

/** Le mode choisi désigne directement l'indicateur de concentration. */
export const metricForMode = (mode) => concentrationInfo(mode);

/**
 * Valeur de concentration d'une entité, pour la sélection courante.
 * Le décompte suit les filtres : changer d'opérateur change le numérateur,
 * jamais le dénominateur (localités ou population de l'entité).
 */
export function concentration(props, metric, operators, technologies) {
  return concentrationInfo(metric).value(props, stationCount(props, operators, technologies));
}

/* ------------------------------- Couleurs -------------------------------- */

/** Expression de remplissage, pilotée par le `feature-state` `rate`. */
export const concentrationColor = (metric) => [
  "interpolate", ["linear"], ["coalesce", ["feature-state", "rate"], 0],
  ...concentrationInfo(metric).scale.flatMap((s) => [s.at, s.color]),
];

/** Dégradé CSS de légende, positions calées sur l'échelle des valeurs. */
export const concentrationGradient = (metric) => {
  const scale = concentrationInfo(metric).scale;
  const max = scale[scale.length - 1].at;
  return `linear-gradient(to right, ${scale
    .map((s) => `${s.color} ${((s.at / max) * 100).toFixed(1)}%`)
    .join(", ")})`;
};

/* ------------------------------- Formats --------------------------------- */

/** Valeur formatée avec son unité - jamais un nombre nu. */
export function formatConcentration(value, metric) {
  const m = concentrationInfo(metric);
  return `${Number(value || 0).toFixed(m.decimals).replace(".", ",")} ${m.short}`;
}
