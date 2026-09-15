/**
 * Couche cartographique des localités non couvertes (« zones blanches »).
 *
 * Module pur : aucune dépendance à React ni à Mapbox, pour que la définition
 * de la couche soit vérifiable par le validateur de style hors navigateur.
 *
 * Principe repris de la version 2 : un cercle par localité privée de réseau,
 * dont la taille et la couleur traduisent la PRIORITÉ d'intervention, mesurée
 * par la population concernée (propriété `score`). La rampe vert → mauve →
 * rouge de la version 2 est remplacée par une rampe séquentielle jaune →
 * rouge sombre : dans le reste de l'application le vert signale toujours une
 * situation favorable, et une zone blanche n'en est jamais une.
 */

export const WHITE_SOURCE = "white-localities";
export const WHITE_LAYER = "white-localities-circles";

/** Paliers de priorité (population privée de réseau) et couleurs associées. */
export const PRIORITY_STOPS = [
  { at: 0, color: "#facc15" },
  { at: 500, color: "#fb923c" },
  { at: 1500, color: "#ef4444" },
  { at: 3000, color: "#7f1d1d" },
];

/** Valeur du dernier palier : au-delà, la couleur ne change plus. */
export const PRIORITY_MAX = PRIORITY_STOPS[PRIORITY_STOPS.length - 1].at;

/**
 * Rayon du cercle. Le zoom pilote l'interpolation de tête - Mapbox impose que
 * `["zoom"]` n'apparaisse qu'au premier niveau - et la taille dérivée de la
 * population s'imbrique dans chacune de ses sorties.
 */
const RADIUS = [
  "interpolate", ["linear"], ["zoom"],
  5, ["interpolate", ["linear"], ["get", "score"], 0, 3, 500, 5, 1500, 8, 3000, 12],
  12, ["interpolate", ["linear"], ["get", "score"], 0, 7, 500, 12, 1500, 19, 3000, 28],
];

/**
 * Peinture de la couche. `feature-state` n'est licite que dans les propriétés
 * de peinture : la mise en évidence de la localité sélectionnée passe donc par
 * l'épaisseur et la couleur du contour, jamais par une propriété de mise en page.
 */
export const WHITE_PAINT = {
  "circle-radius": RADIUS,
  "circle-color": [
    "interpolate", ["linear"], ["get", "score"],
    ...PRIORITY_STOPS.flatMap((s) => [s.at, s.color]),
  ],
  "circle-opacity": 0.82,
  "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1],
  "circle-stroke-color": ["case", ["boolean", ["feature-state", "selected"], false], "#0f172a", "#ffffff"],
  "circle-stroke-opacity": 0.9,
};

/** Définition complète de la couche, telle qu'ajoutée au style. */
export const whiteLayerSpec = () => ({
  id: WHITE_LAYER,
  type: "circle",
  source: WHITE_SOURCE,
  paint: WHITE_PAINT,
});

/**
 * Dégradé CSS de la légende. Les positions reprennent l'échelle des VALEURS
 * (et non un partage égal des couleurs), afin que la bande corresponde
 * exactement à ce que Mapbox peint.
 */
export const priorityGradient = () =>
  `linear-gradient(to right, ${PRIORITY_STOPS.map(
    (s) => `${s.color} ${((s.at / PRIORITY_MAX) * 100).toFixed(1)}%`,
  ).join(", ")})`;

/** Collection vide - source de repli tant que les données ne sont pas chargées. */
export const emptyFeatureCollection = () => ({ type: "FeatureCollection", features: [] });

/* ---------------- Choroplèthe des zones blanches par entité -------------- */

/**
 * Deux lectures du poids des zones blanches dans une entité administrative :
 * la part de ses LOCALITÉS sans réseau, et la part de sa POPULATION sans réseau.
 *
 * Les taux sont RECALCULÉS depuis les effectifs (`whiteLoc… / locs`,
 * `whitePop… / pop`) plutôt que lus dans `perWhiteLoc` / `perWhitePop` : les
 * champs dérivés n'existent pas pour toutes les combinaisons d'opérateurs, et
 * l'on se souvient de ce que valaient les `perPop*` de la couverture. Le
 * rapport, lui, retombe au chiffre près sur les totaux nationaux.
 */

/**
 * Opérateurs, dans l'ORDRE employé par les fichiers de couverture pour nommer
 * leurs combinaisons : `whiteLocMOOV_MTN`, `whiteLocMTN_ORANGE`… Les trois
 * ensemble n'ont pas de suffixe : `whiteLoc` tout court.
 */
export const WHITE_OP_ORDER = ["MOOV", "MTN", "ORANGE"];

/** Bit de chaque opérateur dans le masque de couverture d'une localité. */
export const OPERATOR_BITS = { MOOV: 1, MTN: 2, ORANGE: 4 };

/** Masque des opérateurs retenus. */
export const operatorMask = (operators = WHITE_OP_ORDER) =>
  operators.reduce((m, op) => m | (OPERATOR_BITS[op] ?? 0), 0);

/**
 * Une localité est « zone blanche » pour une sélection si AUCUN des opérateurs
 * retenus ne la dessert. Définition contrôlée exactement égale aux agrégats
 * `whiteLoc{COMBINAISON}` publiés, sur les sept combinaisons et les deux
 * référentiels.
 */
export const isWhiteFor = (covMask, operators) =>
  (Number(covMask) & operatorMask(operators)) === 0;

/**
 * Suffixe des champs agrégés pour une sélection d'opérateurs.
 * Aucun opérateur retenu : rien à mesurer, l'appelant retombe sur zéro.
 */
export function whiteOperatorSuffix(operators = WHITE_OP_ORDER) {
  const kept = WHITE_OP_ORDER.filter((op) => operators.includes(op));
  return kept.length === WHITE_OP_ORDER.length ? "" : kept.join("_");
}

export const WHITE_METRICS = [
  {
    key: "locality",
    label: "Localités",
    legend: "localités non couvertes",
    tooltip: "Localités sans réseau",
    unit: "localités",
    field: "whiteLoc",
    total: (p) => Number(p.locs) || 0,
  },
  {
    key: "population",
    label: "Population",
    legend: "population non couverte",
    tooltip: "Population sans réseau",
    unit: "habitants",
    field: "whitePop",
    total: (p) => Number(p.pop) || 0,
  },
];

export const DEFAULT_WHITE_METRIC = "locality";

/** Descripteur complet d'un indicateur de zone blanche. */
export const whiteMetricInfo = (metric) =>
  WHITE_METRICS.find((m) => m.key === metric) ?? WHITE_METRICS[0];

/**
 * Effectif non couvert d'une entité, pour la sélection d'opérateurs.
 * Les fichiers publient déjà chaque combinaison : on les lit plutôt que de
 * recalculer, et l'on retombe donc au chiffre près sur les totaux nationaux.
 */
export function whiteCount(props, metric = DEFAULT_WHITE_METRIC, operators = WHITE_OP_ORDER) {
  const kept = WHITE_OP_ORDER.filter((op) => operators.includes(op));
  if (!kept.length) return 0;
  return Number(props[`${whiteMetricInfo(metric).field}${whiteOperatorSuffix(kept)}`]) || 0;
}

/** Part (%) de l'entité privée de réseau, selon l'indicateur et les opérateurs. */
export function whiteRate(props, metric = DEFAULT_WHITE_METRIC, operators = WHITE_OP_ORDER) {
  const total = whiteMetricInfo(metric).total(props);
  return total ? (whiteCount(props, metric, operators) / total) * 100 : 0;
}

/**
 * Échelle du choroplèthe. Volontairement dans une famille de teintes (violets)
 * distincte de celle des cercles (jaune → rouge) : les deux couches se
 * superposent, elles ne doivent pas se confondre. Les paliers suivent la
 * distribution réelle - médiane sous 8 %, 95e centile vers 25 %, maximum 71 %.
 */
export const WHITE_CHORO_SCALE = [
  { at: 0, color: "#f1f5f9", label: "0" },
  { at: 2, color: "#e9d5ff", label: "2" },
  { at: 5, color: "#c084fc", label: "5" },
  { at: 10, color: "#9333ea", label: "10" },
  { at: 20, color: "#6b21a8", label: "20" },
  { at: 40, color: "#3b0764", label: "40 +" },
];

/** Couleur de remplissage, pilotée par le `feature-state` `rate`. */
export const WHITE_CHORO_COLOR = [
  "interpolate", ["linear"], ["coalesce", ["feature-state", "rate"], 0],
  ...WHITE_CHORO_SCALE.flatMap((s) => [s.at, s.color]),
];

export const WHITE_CHORO_SOURCE = "white-choro";
export const WHITE_CHORO_FILL = "white-choro-fill";
export const WHITE_CHORO_LINE = "white-choro-line";

/**
 * Remplissage du choroplèthe. Assez transparent pour laisser lire les cercles
 * de priorité posés au-dessus, et opacifié au survol de l'entité.
 */
export const whiteChoroFillSpec = () => ({
  id: WHITE_CHORO_FILL,
  type: "fill",
  source: WHITE_CHORO_SOURCE,
  paint: {
    "fill-color": WHITE_CHORO_COLOR,
    "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.82, 0.6],
  },
});

/** Contour des entités - épaissi au survol. */
export const whiteChoroLineSpec = () => ({
  id: WHITE_CHORO_LINE,
  type: "line",
  source: WHITE_CHORO_SOURCE,
  paint: {
    "line-color": "#334155",
    "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 1.8, 0.5],
    "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.9, 0.4],
  },
});

/* --------------------- Installation sur une carte ------------------------ */

/**
 * Applique les taux au choroplèthe. Les états d'entités ne font pas partie du
 * style : ils sont effacés par `setData` comme par un rechargement de style,
 * et doivent être reposés à chaque fois.
 * @returns le nombre d'entités peintes
 */
export function paintWhiteChoro(map, choro, metric = DEFAULT_WHITE_METRIC, operators = WHITE_OP_ORDER) {
  if (!choro || !map.getSource(WHITE_CHORO_SOURCE)) return 0;
  let n = 0;
  for (const f of choro.features) {
    map.setFeatureState(
      { source: WHITE_CHORO_SOURCE, id: f.id },
      { rate: whiteRate(f.properties, metric, operators) },
    );
    n += 1;
  }
  return n;
}

/**
 * (Ré)installe sources et couches sur le style courant, dans l'ordre de rendu
 * voulu : choroplèthe dessous, points de localité au-dessus.
 *
 * Idempotente, elle est appelée à chaque `style.load` - un rechargement de
 * style emporte les couches ajoutées à l'exécution, ainsi que la visibilité et
 * les états d'entités, qui sont donc tous réappliqués ici.
 */
export function installWhiteLayers(map, {
  data = null,
  choro = null,
  selectedId = null,
  showPoints = true,
  metric = DEFAULT_WHITE_METRIC,
  operators = WHITE_OP_ORDER,
} = {}) {
  if (!map.getSource(WHITE_SOURCE)) {
    map.addSource(WHITE_SOURCE, { type: "geojson", data: data ?? emptyFeatureCollection() });
  }
  if (!map.getLayer(WHITE_LAYER)) map.addLayer(whiteLayerSpec());
  map.setLayoutProperty(WHITE_LAYER, "visibility", showPoints ? "visible" : "none");

  if (!map.getSource(WHITE_CHORO_SOURCE)) {
    map.addSource(WHITE_CHORO_SOURCE, { type: "geojson", data: choro ?? emptyFeatureCollection() });
  }
  // `beforeId` : le remplissage et le contour passent SOUS les points.
  if (!map.getLayer(WHITE_CHORO_FILL)) map.addLayer(whiteChoroFillSpec(), WHITE_LAYER);
  if (!map.getLayer(WHITE_CHORO_LINE)) map.addLayer(whiteChoroLineSpec(), WHITE_LAYER);

  if (selectedId != null) {
    map.setFeatureState({ source: WHITE_SOURCE, id: selectedId }, { selected: true });
  }
  paintWhiteChoro(map, choro, metric, operators);
}

/** Dégradé CSS de la légende du choroplèthe (positions à l'échelle des taux). */
export const whiteChoroGradient = () => {
  const max = WHITE_CHORO_SCALE[WHITE_CHORO_SCALE.length - 1].at;
  return `linear-gradient(to right, ${WHITE_CHORO_SCALE.map(
    (s) => `${s.color} ${((s.at / max) * 100).toFixed(1)}%`,
  ).join(", ")})`;
};

/**
 * `ADMIN_LIMITS` porte des libellés au pluriel ; la légende et les infobulles
 * désignent UNE entité. Défini ici pour que la légende exportée et la légende
 * affichée ne puissent pas diverger.
 */
export const WHITE_LEVEL_LABEL = {
  district: "District",
  region: "Région",
  department: "Département",
  subPrefecture: "Sous-préfecture",
};
export const whiteLevelLabel = (key) => WHITE_LEVEL_LABEL[key] ?? key;

/* -------------------------- Légende exportable --------------------------- */

/**
 * Mention du périmètre d'opérateurs, vide quand ils sont tous retenus : « zone
 * blanche » désigne alors son sens usuel, celui d'une localité que personne ne
 * dessert.
 */
export function whiteOperatorScope(operators = WHITE_OP_ORDER) {
  const kept = WHITE_OP_ORDER.filter((op) => operators.includes(op));
  if (!kept.length) return " (aucun opérateur retenu)";
  if (kept.length === WHITE_OP_ORDER.length) return "";
  return ` (${kept.join(", ")})`;
}

/** Bornes lisibles d'un palier de l'échelle du choroplèthe. */
const scaleLabel = (i) => {
  const s = WHITE_CHORO_SCALE[i];
  if (i === 0) return "0 % — entièrement couvert";
  if (i === WHITE_CHORO_SCALE.length - 1) return `${s.at} % et plus`;
  return `${WHITE_CHORO_SCALE[i - 1].at} à ${s.at} %`;
};

/** Bornes lisibles d'un palier de priorité (population privée de réseau). */
const priorityLabel = (i) => {
  const s = PRIORITY_STOPS[i];
  if (i === 0) return `moins de ${PRIORITY_STOPS[1].at} habitants`;
  if (i === PRIORITY_STOPS.length - 1) return `${s.at} habitants et plus`;
  return `${s.at} à ${PRIORITY_STOPS[i + 1].at} habitants`;
};

/**
 * Légende des couches réellement affichées, au format attendu par l'export
 * (`{ title, items: [{ label, color, shape }] }`). Module pur : la légende
 * exportée est construite à partir des mêmes échelles que le rendu, elle ne
 * peut donc pas le contredire.
 */
export function buildWhiteLegend({
  choroLevel = null,
  choroMetric = DEFAULT_WHITE_METRIC,
  showPoints = true,
  operators = WHITE_OP_ORDER,
} = {}) {
  const groups = [];
  // Une sélection partielle change le sens de « zone blanche » : la légende
  // doit dire de quels opérateurs il s'agit.
  const scope = whiteOperatorScope(operators);

  if (choroLevel) {
    groups.push({
      title: `Part de ${whiteMetricInfo(choroMetric).legend} par ${whiteLevelLabel(choroLevel).toLowerCase()}${scope}`,
      items: WHITE_CHORO_SCALE.map((s, i) => ({
        label: scaleLabel(i),
        color: s.color,
        shape: "swatch",
      })),
    });
  }

  // Une couche masquée ne doit pas figurer dans la légende de l'export.
  if (showPoints) {
    groups.push({
      title: `Localité non couverte${scope} - priorité d'intervention`,
      items: PRIORITY_STOPS.map((s, i) => ({
        label: priorityLabel(i),
        color: s.color,
        shape: "point",
      })),
    });
  }

  return groups;
}
