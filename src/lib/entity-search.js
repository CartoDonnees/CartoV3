import { readFile } from "node:fs/promises";
import path from "node:path";

const COV_DIR = path.join(process.cwd(), "dataFiles", "data_server", "data_cov");
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
/** Normalisation insensible casse + accents (« bouaké » ↔ « bouake »). */
export const norm = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

const TECHS = ["2G", "3G", "4G"];
const OPS = ["ORANGE", "MTN", "MOOV"];

const ADMIN_LEVELS = [
  { level: "district", label: "District", file: (d) => `district_${d}.geojson`, nameProp: "ADM0_FR" },
  { level: "region", label: "Région", file: (d) => `region_${d}.geojson`, nameProp: "ADM1_FR" },
  { level: "department", label: "Département", file: (d) => `departments_${d}.geojson`, nameProp: "ADM2_FR" },
  { level: "subPrefecture", label: "Sous-préfecture", file: (d) => `subPrefecture_${d}.geojson`, nameProp: "ADM3_FR" },
];

/**
 * Matrice opérateur × technologie (reprise de la V2, modernisée).
 * Localité : drapeaux binaires → couverture oui/non + station présente.
 * Niveaux admin : nombre de localités couvertes + % population + stations.
 */
function coverageMatrix(p, isLocality) {
  return OPS.map((op) => ({
    op,
    byTech: TECHS.map((t) => {
      const cov = num(p[`cov${op}${t}`]);
      const pres = num(p[`present${op}${t}`]);
      return isLocality
        ? { tech: t, covered: cov === 1, station: pres === 1 }
        : { tech: t, locCov: cov, stations: pres, perPop: num(p[`perPop${op}${t}`]), perCov: num(p[`perCov${op}${t}`]) };
    }),
  }));
}

/** Projection compacte des statistiques d'une entité (mêmes champs pour admin & localité). */
function shapeEntity(p, isLocality = false) {
  const pop = num(p.pop);
  const perPopCov = num(p.perPopCov);
  const locs = num(p.locs);
  const locCov = num(p.locCov);
  return {
    pop,
    locs,
    locCov,
    locNoCov: p.locNoCov != null ? num(p.locNoCov) : Math.max(0, locs - locCov),
    perPopCov,
    perPopNoCov: p.perPopNoCov != null ? num(p.perPopNoCov) : Math.max(0, 100 - perPopCov),
    perLocCov: num(p.perLocCov),
    stations: num(p.nombrepresent),
    forecast: num(p.locForecast),
    perTech: TECHS.map((t) => ({ tech: t, perPop: num(p[`perPop${t}`]), perCov: num(p[`perCov${t}`]) })),
    operators: OPS.map((op) => ({
      op,
      perPop: num(p[`perPop${op}`]),
      byTech: TECHS.map((t) => ({ tech: t, perPop: num(p[`perPop${op}${t}`]) })),
    })),
    isLocality,
    matrix: coverageMatrix(p, isLocality),
  };
}

async function readGeo(dir, filename) {
  return JSON.parse(await readFile(path.join(dir, filename), "utf8"));
}

// Index de recherche par date : { name, _n, level, levelLabel, lng, lat, stats }.
const indexCache = new Map();
export function buildIndex(date) {
  if (indexCache.has(date)) return indexCache.get(date);
  const p = (async () => {
    const items = [];

    // Niveaux administratifs (nom + centre + stats agrégées).
    for (const lvl of ADMIN_LEVELS) {
      try {
        const g = await readGeo(COV_DIR, lvl.file(date));
        for (const f of g.features) {
          const name = f.properties[lvl.nameProp];
          if (!name) continue;
          items.push({
            name,
            _n: norm(name),
            level: lvl.level,
            levelLabel: lvl.label,
            lng: num(f.properties.centerLng),
            lat: num(f.properties.centerLat),
            stats: shapeEntity(f.properties),
          });
        }
      } catch {
        /* niveau indisponible pour cette date */
      }
    }

    // Localités : le nom est porté par ADM4_FR dans le fichier de couverture.
    try {
      const loc = await readGeo(COV_DIR, `locality_${date}.geojson`);
      loc.features.forEach((f) => {
        const name = f.properties.ADM4_FR;
        if (!name) return;
        items.push({
          name,
          _n: norm(name),
          level: "locality",
          levelLabel: "Localité",
          lng: num(f.properties.centerLng),
          lat: num(f.properties.centerLat),
          stats: shapeEntity(f.properties, true),
        });
      });
    } catch {
      /* localités indisponibles */
    }

    return items;
  })();
  indexCache.set(date, p);
  return p;
}

/**
 * Taux de couverture d'une entité pour un jeu d'opérateurs/technologies -
 * même logique que `computeRate` (max sur les opérateurs, moyenne sur les
 * technologies), mais à partir des statistiques déjà projetées.
 */
export function rateFromStats(stats, operators, technologies) {
  const ops = operators?.length ? operators : OPS;
  const techs = technologies?.length ? technologies : TECHS;
  if (!stats?.matrix?.length) return 0;
  const perTech = techs.map((t) =>
    Math.max(
      0,
      ...ops.map((o) => {
        const cell = stats.matrix.find((m) => m.op === o)?.byTech.find((c) => c.tech === t);
        if (!cell) return 0;
        return stats.isLocality ? (cell.covered ? 100 : 0) : cell.perCov ?? 0;
      }),
    ),
  );
  return perTech.reduce((a, b) => a + b, 0) / (perTech.length || 1);
}

/** Toutes les entités d'un niveau (depuis l'index mémoïsé). */
export async function entitiesAtLevel(date, level) {
  const index = await buildIndex(date);
  return index.filter((it) => it.level === level);
}

/** Centre approximatif de la Côte d'Ivoire (vue nationale). */
const CI_CENTER = { lng: -5.55, lat: 7.54 };

/**
 * Entité « nationale » : couverture sur toute l'étendue du territoire.
 * Utilisée quand une demande ne cite aucun lieu (ex. « couverture 2G Orange »).
 */
export async function nationalEntity(date) {
  if (!DATE_RE.test(date || "")) return null;
  try {
    const p = JSON.parse(await readFile(path.join(COV_DIR, `statsnationales_${date}.json`), "utf8"));
    return {
      name: "Côte d'Ivoire",
      level: "national",
      levelLabel: "National",
      lng: CI_CENTER.lng,
      lat: CI_CENTER.lat,
      stats: shapeEntity(p, false),
    };
  } catch {
    return null;
  }
}

/**
 * Recherche d'entités par nom.
 * @param {string} q requête (brute, normalisée ici)
 * @param {string} date période AAAA-MM-JJ
 * @param {{limit?: number, level?: string}} opts
 */
export async function searchEntities(q, date, { limit = 12, level } = {}) {
  const nq = norm(q);
  if (nq.length < 2 || !DATE_RE.test(date || "")) return [];

  const index = await buildIndex(date);
  let matches = index.filter((it) => it._n.includes(nq));
  if (level) {
    const only = matches.filter((it) => it.level === level);
    if (only.length) matches = only; // le niveau demandé, s'il existe
  }
  // Priorité : correspondance exacte, puis « commence par », puis le plus court.
  matches.sort((a, b) => {
    const ae = a._n === nq ? 0 : 1;
    const be = b._n === nq ? 0 : 1;
    if (ae !== be) return ae - be;
    const as = a._n.startsWith(nq) ? 0 : 1;
    const bs = b._n.startsWith(nq) ? 0 : 1;
    if (as !== bs) return as - bs;
    return a._n.length - b._n.length;
  });

  return matches.slice(0, limit).map(({ name, level: lv, levelLabel, lng, lat, stats }) => ({
    name,
    level: lv,
    levelLabel,
    lng,
    lat,
    stats,
  }));
}
