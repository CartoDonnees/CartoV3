/** Logique de couverture réutilisable (client & serveur). */

/** Taux de couverture d'un district selon opérateurs & technologies sélectionnés. */
export function computeRate(props, operators, technologies) {
  if (!operators.length || !technologies.length) return 0;
  const techRates = technologies.map((t) => {
    const opVals = operators.map((o) => Number(props[`perCov${o}${t}`] ?? 0));
    return Math.max(0, ...opVals);
  });
  return techRates.reduce((a, b) => a + b, 0) / techRates.length;
}

/** Échelle de couleur choroplèthe (feature-state `rate`). */
export const COVERAGE_COLOR = [
  "interpolate",
  ["linear"],
  ["coalesce", ["feature-state", "rate"], 0],
  0, "#e2e8e5",
  40, "#e11d48",
  60, "#f47b20",
  80, "#86e0a8",
  100, "#0b6d37",
];
