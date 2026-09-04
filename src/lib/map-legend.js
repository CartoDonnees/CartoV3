/**
 * Légende des couches réellement affichées sur la carte.
 *
 * Module pur : il ne lit que l'état du panneau de filtres et les couleurs
 * déclarées dans `config/artci`, celles-là mêmes qu'emploie le gestionnaire
 * de couches. La légende ne peut donc pas diverger du rendu.
 */
import {
  OPERATORS, TECHNOLOGIES, ADMIN_LIMITS,
  FIBER_LAYERS, ADMIN_LINE_STYLE, ROAD_LAYERS, COVERAGE_SCALE, POINT_COLORS,
} from "@/config/artci";

const OP = Object.fromEntries(OPERATORS.map((o) => [o.code, o]));
const TECH = Object.fromEntries(TECHNOLOGIES.map((t) => [t.code, t]));
const LEVEL_LABEL = Object.fromEntries(ADMIN_LIMITS.map((l) => [l.key, l.label]));

/** Formes de symbole reconnues par le rendu PDF. */
const POINT = "point";
const LINE = "line";
const SWATCH = "swatch";

/**
 * Construit la légende à partir de l'état du panneau.
 * @returns [{ title, items: [{ label, color, shape }] }] - groupes non vides
 */
export function buildLegend(state = {}) {
  const {
    controls = {},
    technologies = [],
    mapOperators = [],
    operatorTechs = {},
    qosOperators = [],
    showWhiteZones = false,
    coverageLevel = null,
    adminLimits = {},
  } = state;

  const groups = [];
  const push = (title, items) => {
    const kept = items.filter(Boolean);
    if (kept.length) groups.push({ title, items: kept });
  };

  /* ---------------------------- Couverture ----------------------------- */
  push("Couverture des localités", [
    controls.showLocality && { label: "Localité", color: POINT_COLORS.locality, shape: POINT },
    ...(controls.showCovLocalities
      ? technologies.map((t) => ({ label: `Couverte en ${t}`, color: TECH[t]?.color, shape: POINT }))
      : []),
    controls.showNoCovLocalities && {
      label: technologies.length
        ? `Non couverte (${technologies.join(", ")})`
        : "Localité non couverte",
      color: POINT_COLORS.uncovered,
      shape: POINT,
    },
    showWhiteZones && {
      label: "Zone blanche - ni couverture ni prévision",
      color: POINT_COLORS.whiteZone,
      shape: POINT,
    },
  ]);

  /* ------------------------ Couverture par opérateur -------------------- */
  push(
    "Couverture par opérateur",
    mapOperators.map((code) => {
      const techs = operatorTechs[code] ?? technologies;
      return {
        label: `${OP[code]?.name ?? code}${techs?.length ? ` - ${techs.join(", ")}` : ""}`,
        color: OP[code]?.color,
        shape: POINT,
      };
    }),
  );

  /* ---------------------------- Choroplèthe ----------------------------- */
  if (coverageLevel) {
    push(
      `Taux de couverture par ${(LEVEL_LABEL[coverageLevel] ?? coverageLevel).toLowerCase().replace(/s$/, "")}`,
      COVERAGE_SCALE.map((s) => ({ label: s.label, color: s.color, shape: SWATCH })),
    );
  }

  /* -------------------------- Qualité de service ------------------------ */
  const services = [
    controls.showVoiceService && "Voix",
    controls.showSmsService && "SMS",
    controls.showDataService && "Internet",
  ].filter(Boolean);

  push("Qualité de service", [
    controls.showFieldLevel && {
      label: "Localité auditée",
      color: POINT_COLORS.audited,
      shape: POINT,
    },
    ...(controls.showServiceBase && qosOperators.length
      ? services.map((s) => ({
          label: `Audit ${s} - ${qosOperators.map((c) => OP[c]?.name ?? c).join(", ")}`,
          color: POINT_COLORS.whiteZone,
          shape: POINT,
        }))
      : []),
    ...(controls.showServiceBase && qosOperators.length && services.length
      ? qosOperators.map((code) => ({
          label: `Anneau ${OP[code]?.name ?? code}`,
          color: OP[code]?.color,
          shape: SWATCH,
        }))
      : []),
  ]);

  /* --------------------------- Infrastructures -------------------------- */
  push(
    "Infrastructures",
    FIBER_LAYERS.filter((f) => controls[f.ctrl]).map((f) => ({
      label: f.label,
      color: f.color,
      shape: LINE,
    })),
  );

  /* ------------------- Réseau routier et ferroviaire -------------------- */
  push(
    "Réseau routier et ferroviaire",
    ROAD_LAYERS.filter((r) => controls[r.key]).map((r) => ({
      label: r.label,
      color: r.color,
      shape: LINE,
    })),
  );

  /* ----------------------- Limites administratives ---------------------- */
  push(
    "Limites administratives",
    ADMIN_LINE_STYLE.filter((a) => adminLimits[a.level]).map((a) => ({
      label: a.label,
      color: a.color,
      shape: LINE,
    })),
  );

  return groups;
}

/** Nombre de colonnes de légende pour une largeur de page donnée (en mm). */
export const legendColumnCount = (widthMm) => (widthMm > 240 ? 4 : widthMm > 170 ? 3 : 2);

/** Nombre total d'entrées, tous groupes confondus. */
export const legendItemCount = (groups) => groups.reduce((n, g) => n + g.items.length, 0);

/**
 * Hauteur du bandeau de légende, en millimètres, pour une largeur donnée.
 * Les groupes sont répartis en colonnes ; chaque colonne porte son titre puis
 * ses entrées. Sert à réserver la place AVANT de rendre la carte.
 */
export function legendHeightMm(groups, widthMm, { lineMm = 4.2, titleMm = 5, padMm = 4 } = {}) {
  const columns = legendColumnCount(widthMm);
  if (!groups.length) return 0;
  // Répartition gloutonne : on équilibre le nombre de lignes par colonne.
  const cost = (g) => titleMm + g.items.length * lineMm;
  const heights = new Array(columns).fill(0);
  for (const g of groups) {
    const i = heights.indexOf(Math.min(...heights));
    heights[i] += cost(g) + 1.5;
  }
  return Math.max(...heights) + padMm * 2;
}

/** Répartit les groupes en colonnes, dans le même ordre que `legendHeightMm`. */
export function legendColumns(groups, columns = 3) {
  const cols = Array.from({ length: columns }, () => []);
  const heights = new Array(columns).fill(0);
  for (const g of groups) {
    const i = heights.indexOf(Math.min(...heights));
    cols[i].push(g);
    heights[i] += 5 + g.items.length * 4.2 + 1.5;
  }
  return cols;
}
