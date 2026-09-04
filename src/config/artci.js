/**
 * Constantes métier ARTCI / CARTODONNEES.
 * Centralise la charte, les opérateurs, technologies et niveaux administratifs.
 */

export const BRAND = {
  name: "CARTODONNEES",
  authority: "ARTCI",
  fullName: "Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire",
  domain: "cartodonnees.artci.ci",
  colors: {
    green: "#159a4e ",
    orange: "#f47b20",
    gray: "#647570",
  },
};

export const OPERATORS = [
  { code: "MOOV", name: "Moov Africa", color: "#0aa0dd", fiberKm: 4612 },
  { code: "MTN", name: "MTN", color: "#ffcc00", fiberKm: 5800 },
  { code: "ORANGE", name: "Orange", color: "#f47b20", fiberKm: 12296 },
];

/** Autres réseaux de fibre optique (opérateurs d'infrastructure). */
export const FIBER_PROVIDERS = [
  { code: "ANSUT", name: "ANSUT", color: "#ef4444", km: 5207 },
  { code: "AWALE", name: "Awalé", color: "#056c11", km: 2388 },
];

/** Réseau routier / ferroviaire (couches infrastructure). */
/**
 * Réseau routier et ferroviaire.
 *
 * Les trois classes routières n'existent dans aucun fichier du projet : elles
 * sont tracées à partir du réseau routier du fond de carte Mapbox (couche
 * vectorielle « road »), filtré sur le champ `class`. Le chemin de fer, lui,
 * vient du fichier ivoirien `railways.geojson`, plus précis que le fond.
 */
export const ROAD_LAYERS = [
  {
    key: "highway", label: "Autoroutes", color: "#f59e0b", dashed: false,
    classes: ["motorway", "motorway_link"], width: 2.6,
  },
  {
    key: "nationalRoad", label: "Routes nationales", color: "#ef4444", dashed: false,
    classes: ["trunk", "trunk_link", "primary", "primary_link"], width: 1.8,
  },
  {
    key: "track", label: "Pistes", color: "#a16207", dashed: true,
    classes: ["track"], width: 1.1,
  },
  // Tracé national, servi par /api/v1/geo (pas de classe Mapbox).
  { key: "railway", label: "Chemins de fer", color: "#334155", dashed: true, width: 1.5 },
];

/**
 * Couches de fibre optique dessinées sur la carte - source unique partagée
 * par le gestionnaire de couches et la légende des exports.
 */
export const FIBER_LAYERS = [
  { ctrl: "showFiberORANGE", op: "orange", label: "Fibre optique Orange", color: "#f47b20" },
  { ctrl: "showFiberMTN", op: "mtn", label: "Fibre optique MTN", color: "#ffcc00" },
  { ctrl: "showFiberAwale", op: "awale", label: "Fibre optique Awalé", color: "#056c11" },
  {
    // Réseau national haut débit de l'ANSUT. La version 2 l'affichait depuis un
    // jeu de tuiles Mapbox limité aux zooms 8 à 14, donc invisible à l'échelle
    // du pays. Le tracé a été extrait de ces tuiles vers un GeoJSON local
    // (voir `dataFiles/.../fiber_ansut.geojson`) : il s'affiche désormais à
    // tous les niveaux de zoom, comme les trois autres réseaux.
    ctrl: "showFiberAnsut",
    op: "ansut",
    label: "Fibre optique ANSUT (RNHD)",
    color: "#ef4444",
  },
];

/** Tracé des limites administratives sur la carte (couleur et épaisseur). */
export const ADMIN_LINE_STYLE = [
  { level: "district", label: "Districts", color: "#7c3aed", width: 2 },
  { level: "region", label: "Régions", color: "#2563eb", width: 1.4 },
  { level: "department", label: "Départements", color: "#0891b2", width: 1 },
  { level: "subPrefecture", label: "Sous-préfectures", color: "#94a3b8", width: 0.6 },
];

/** Paliers de la choroplèthe de couverture (taux → couleur). */
export const COVERAGE_SCALE = [
  { from: 0, color: "#e2e8e5", label: "Sans donnée" },
  { from: 40, color: "#e11d48", label: "moins de 40 %" },
  { from: 60, color: "#f47b20", label: "40 à 60 %" },
  { from: 80, color: "#86e0a8", label: "60 à 80 %" },
  { from: 100, color: "#0b6d37", label: "80 à 100 %" },
];

/** Couleurs des points de localité (hors technologies et opérateurs). */
export const POINT_COLORS = {
  locality: "#334155",
  uncovered: "#e11d48",
  whiteZone: "#0f172a",
  audited: "#0f8442",
};

/** Niveaux de limites administratives. */
export const ADMIN_LIMITS = [
  { key: "district", label: "Districts", color: "#000000" },
  { key: "region", label: "Régions", color: "#933902" },
  { key: "department", label: "Départements", color: "#7400FF" },
  { key: "subPrefecture", label: "Sous-préfectures", color: "#F905B6" },
];

export const TECHNOLOGIES = [
  { code: "2G", name: "2G", color: "#4eda03", desc: "Voix et SMS (réseau de base)." },
  { code: "3G", name: "3G", color: "#E21273", desc: "Internet mobile (haut débit)." },
  { code: "4G", name: "4G", color: "#8b5cf6", desc: "Internet mobile très haut débit." },
];

/** Couleurs par technologie (couverture des localités) - alignées sur les icônes carte. */
export const TECH_COLORS = { "2G": "#4eda03", "3G": "#E21273", "4G": "#8b5cf6" };
/** Priorité d'affichage : la meilleure technologie disponible prime (4G > 3G > 2G). */
export const TECH_PRIORITY = ["4G", "3G", "2G"];

export const ADMIN_LEVELS = [
  { key: "district", label: "Districts", count: 12 },
  { key: "region", label: "Régions", count: 31 },
  { key: "department", label: "Départements", count: 108 },
  { key: "subPrefecture", label: "Sous-préfectures", count: 509 },
  { key: "locality", label: "Localités", count: 8518 },
];

/** Légende des données de couverture. */
export const COVERAGE_LEGEND = [
  { key: "locality", label: "Localité", color: "#0e1512" },
  { key: "covered", label: "Localité couverte", color: "#159a4e" },
  { key: "uncovered", label: "Localité non couverte", color: "#e11d48" },
  { key: "white", label: "Localité blanche", color: "#e5e7ea" },
];
