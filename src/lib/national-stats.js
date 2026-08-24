import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const COV_DIR = path.join(process.cwd(), "dataFiles", "data_server", "data_cov");
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Liste des dates de couverture disponibles (fichiers statsnationales), plus récentes d'abord. */
export async function listStatDates() {
  const files = await readdir(COV_DIR).catch(() => []);
  return files
    .map((f) => /^statsnationales_(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1])
    .filter(Boolean)
    .sort((a, b) => (a < b ? 1 : -1));
}

/** Charge les statistiques nationales brutes pour une date (ou la plus récente). */
export async function loadNationalStats(date) {
  const dates = await listStatDates();
  if (!dates.length) return null;
  const chosen = date && DATE.test(date) && dates.includes(date) ? date : dates[0];
  const filePath = path.join(COV_DIR, `statsnationales_${chosen}.json`);
  if (!filePath.startsWith(COV_DIR)) return null;
  try {
    const raw = await readFile(filePath, "utf8");
    return { date: chosen, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

const OPS = ["ORANGE", "MTN", "MOOV"];
const TECHS = ["2G", "3G", "4G"];

/**
 * Projection synthétique et sûre des stats nationales pour les dashboards.
 * Filtre optionnel par opérateur (espace opérateur).
 */
export function shapeStats(s, { operator } = {}) {
  if (!s) return null;
  const num = (v) => (Number.isFinite(v) ? v : 0);

  const perTech = TECHS.map((t) => ({
    tech: t,
    pop: num(s[`pop${t}`]),
    perPop: num(s[`perPop${t}`]),
    cov: num(s[`cov${t}`]),
    perCov: num(s[`perCov${t}`]),
    present: num(s[`present${t}`]),
    forecast: num(s[`forecast${t}`]),
  }));

  const operators = OPS.map((op) => ({
    operator: op,
    pop: num(s[`pop${op}`]),
    perPop: num(s[`perPop${op}`]),
    byTech: TECHS.map((t) => ({
      tech: t,
      pop: num(s[`pop${op}${t}`]),
      perPop: num(s[`perPop${op}${t}`]),
      present: num(s[`present${op}${t}`]),
    })),
  }));

  const base = {
    date: s.date,
    population: num(s.pop),
    localities: num(s.locs),
    localitiesCovered: num(s.locCov),
    localitiesUncovered: num(s.locNoCov),
    localitiesForecast: num(s.locForecast),
    perLocCovered: num(s.perLocCov),
    popCovered: num(s.popCov),
    perPopCovered: num(s.perPopCov),
    popUncovered: num(s.popNoCov),
    perPopUncovered: num(s.perPopNoCov),
    stations: num(s.nombrepresent),
    perTech,
    operators,
  };

  if (operator) {
    const op = String(operator).toUpperCase();
    if (!OPS.includes(op)) return { ...base, operator: null };
    return {
      ...base,
      operator: op,
      opPop: num(s[`pop${op}`]),
      opPerPop: num(s[`perPop${op}`]),
      opByTech: TECHS.map((t) => ({
        tech: t,
        pop: num(s[`pop${op}${t}`]),
        perPop: num(s[`perPop${op}${t}`]),
        present: num(s[`present${op}${t}`]),
      })),
    };
  }
  return base;
}
