/** Logique de couverture réutilisable (client & serveur). */

/**
 * Deux lectures complémentaires d'un même territoire :
 * la part de ses LOCALITÉS couvertes, et la part de sa POPULATION couverte.
 * Les fichiers cartographiques portent les deux séries pour chaque entité.
 */
export const COVERAGE_METRICS = [
  {
    key: "locality",
    label: "Localités",
    legend: "localités couvertes",
    tooltip: "Couverture des localités",
    // `perCov{OPÉRATEUR}{TECHNO}` est fiable : contrôlé égal à
    // `cov{…} / locs` sur les quatre découpages, sans un seul écart.
    value: (p, op, tech) => Number(p[`perCov${op}${tech}`] ?? 0),
  },
  {
    key: "population",
    label: "Population",
    legend: "population couverte",
    tooltip: "Couverture de la population",
    /*
     * Le taux est RECALCULÉ depuis les effectifs, et non lu dans
     * `perPop{OPÉRATEUR}{TECHNO}`.
     *
     * Ces champs sont incohérents dans les fichiers cartographiques : au
     * niveau sous-préfecture ils recopient purement le taux des localités
     * (508 entités sur 508), et aux autres niveaux ils s'écartent jusqu'à
     * 72 points du rapport population couverte / population totale. Le
     * fichier de statistiques nationales, lui, applique bien ce rapport :
     * c'est cette définition que l'on reprend ici.
     */
    value: (p, op, tech) => {
      const total = Number(p.pop) || 0;
      return total ? (Number(p[`pop${op}${tech}`] ?? 0) / total) * 100 : 0;
    },
  },
];

/** Indicateur par défaut : celui historiquement affiché. */
export const DEFAULT_METRIC = "locality";

/** Descripteur complet d'un indicateur (libellés et lecture de la valeur). */
export const metricInfo = (metric) =>
  COVERAGE_METRICS.find((m) => m.key === metric) ?? COVERAGE_METRICS[0];

/**
 * Taux de couverture d'une entité selon les opérateurs et technologies
 * sélectionnés : on retient le meilleur opérateur par technologie, puis on
 * moyenne sur les technologies.
 *
 * `metric` choisit la série lue — localités (défaut) ou population — sans
 * changer la formule : les deux se calculent à l'identique.
 */
export function computeRate(props, operators, technologies, metric = DEFAULT_METRIC) {
  if (!operators.length || !technologies.length) return 0;
  const read = metricInfo(metric).value;
  const techRates = technologies.map((t) => {
    const opVals = operators.map((o) => read(props, o, t));
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
