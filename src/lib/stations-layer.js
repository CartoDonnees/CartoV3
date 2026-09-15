/**
 * Couches cartographiques de la section « Stations mobiles & concentration ».
 *
 * Module pur, sans React ni Mapbox : la définition des couches est ainsi
 * soumise au validateur de style de Mapbox hors navigateur, ce qui attrape les
 * fautes qui ne se voient qu'au rendu (`feature-state` posé dans une propriété
 * de mise en page, interpolation de zoom imbriquée, couche sans peinture
 * dépendante d'un état sur une source porteuse d'états).
 */

import { TECHNOLOGIES } from "@/config/artci";
import { concentrationColor, concentrationInfo, TECH_CODES } from "@/lib/stations";
import { pylonIconId, iconDataUri } from "@/lib/mapIcons";

export const TECH_COLOR = Object.fromEntries(TECHNOLOGIES.map((t) => [t.code, t.color]));

/* Identifiants de sources et de couches. */
export const SITE_SOURCE = "stations-sites";
export const SITE_CLUSTERS = "stations-clusters";
export const SITE_CLUSTER_COUNT = "stations-cluster-count";
export const SITE_POINTS = "stations-points";
export const SITE_HALO = "stations-halo";
export const CONC_SOURCE = "stations-concentration";
export const CONC_FILL = "stations-concentration-fill";
export const CONC_LINE = "stations-concentration-line";

export const emptyFeatureCollection = () => ({ type: "FeatureCollection", features: [] });

/**
 * Regroupement automatique. Au-delà du zoom 11, chaque site reprend sa place :
 * en deçà, 3 933 points se chevauchent et n'apprennent rien.
 */
export const CLUSTER_OPTIONS = { cluster: true, clusterRadius: 44, clusterMaxZoom: 11 };

/** Disque des amas, dimensionné et coloré par le nombre de sites regroupés. */
export const clusterLayerSpec = () => ({
  id: SITE_CLUSTERS,
  type: "circle",
  source: SITE_SOURCE,
  filter: ["has", "point_count"],
  paint: {
    "circle-color": [
      "interpolate", ["linear"], ["get", "point_count"],
      2, "#93c5fd", 25, "#3b82f6", 100, "#1d4ed8", 400, "#172554",
    ],
    "circle-radius": [
      "interpolate", ["linear"], ["get", "point_count"],
      2, 13, 25, 19, 100, 26, 400, 34,
    ],
    "circle-opacity": 0.9,
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
  },
});

/** Nombre de sites inscrit dans l'amas. */
export const clusterCountLayerSpec = () => ({
  id: SITE_CLUSTER_COUNT,
  type: "symbol",
  source: SITE_SOURCE,
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"],
    "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
    "text-size": 12,
    "text-allow-overlap": true,
  },
  /*
   * `text-opacity` dépend d'un état d'entité SANS raison esthétique : c'est une
   * nécessité technique. Une couche symbole posée sur une source porteuse
   * d'états dont AUCUNE propriété de peinture ne dépend d'un état fait lire à
   * Mapbox `stateDependentLayers[0].paint` sur un tableau vide, et plante au
   * rendu. Le défaut a déjà été rencontré sur la couche d'étiquettes de la
   * carte publique.
   */
  paint: {
    "text-color": "#ffffff",
    "text-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.97],
  },
});

/**
 * Pictogramme de pylône selon la technologie. Une technologie inattendue
 * retombe sur l'icône générique de station plutôt que sur une image absente
 * (Mapbox n'afficherait alors rien, sans le signaler).
 */
export const siteIconExpression = [
  "match", ["get", "tech"],
  ...TECH_CODES.flatMap((t) => [t, pylonIconId(t)]),
  "ic-station",
];

/** Icônes que la couche des sites peut demander - toutes doivent être enregistrées. */
export const SITE_ICON_IDS = [...TECH_CODES.map(pylonIconId), "ic-station"];

/**
 * Halo de sélection, sous le pylône. Une couche symbole ne sait pas cerner son
 * icône : c'est ce disque, posé au pied du pylône, qui marque le site retenu
 * dans le tableau. Invisible pour tous les autres sites.
 */
export const siteHaloLayerSpec = () => ({
  id: SITE_HALO,
  type: "circle",
  source: SITE_SOURCE,
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 9, 14, 17],
    "circle-color": "#0f172a",
    "circle-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.18, 0],
    "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 0],
    "circle-stroke-color": "#0f172a",
  },
});

/**
 * Stations radioélectriques : un pylône par site, à la couleur de sa
 * technologie. La taille suit le zoom (interpolation de tête, comme l'impose
 * Mapbox) et, à l'intérieur, le nombre de cellules du site.
 */
export const siteLayerSpec = () => ({
  id: SITE_POINTS,
  type: "symbol",
  source: SITE_SOURCE,
  filter: ["!", ["has", "point_count"]],
  layout: {
    "icon-image": siteIconExpression,
    "icon-size": [
      "interpolate", ["linear"], ["zoom"],
      6, ["interpolate", ["linear"], ["get", "cells"], 1, 0.5, 9, 0.72],
      14, ["interpolate", ["linear"], ["get", "cells"], 1, 1, 9, 1.35],
    ],
    // Le pied du pylône désigne l'emplacement exact du site.
    "icon-anchor": "bottom",
    // Deux sites voisins restent visibles tous les deux : le regroupement en
    // amas, pas le masquage, se charge de la densité.
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  },
  /*
   * `icon-opacity` dépend d'un état d'entité aussi par nécessité technique :
   * une couche symbole posée sur une source porteuse d'états dont aucune
   * propriété de peinture ne dépend d'un état fait planter Mapbox au rendu
   * (`stateDependentLayers[0].paint` lu sur un tableau vide).
   */
  paint: {
    "icon-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 1, 0.95],
  },
});

/** Remplissage du choroplèthe de concentration. */
export const concentrationFillSpec = (metric) => ({
  id: CONC_FILL,
  type: "fill",
  source: CONC_SOURCE,
  paint: {
    "fill-color": concentrationColor(metric),
    "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.92, 0.75],
  },
});

/** Contour des entités, épaissi au survol. */
export const concentrationLineSpec = () => ({
  id: CONC_LINE,
  type: "line",
  source: CONC_SOURCE,
  paint: {
    "line-color": "#334155",
    "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2, 0.6],
    "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.9, 0.45],
  },
});

/** Filtre Mapbox appliqué aux sites : technologies retenues. */
export const siteFilter = (technologies = TECH_CODES) => [
  "all",
  ["!", ["has", "point_count"]],
  ["in", ["get", "tech"], ["literal", [...technologies]]],
];

/* --------------------- Installation sur une carte ------------------------ */

/**
 * Applique la valeur de concentration à chaque entité du découpage.
 * Les états d'entités ne font pas partie du style : `setData` comme un
 * rechargement de style les efface, ils doivent être reposés à chaque fois.
 * @returns le nombre d'entités peintes
 */
export function paintConcentration(map, fc, compute) {
  if (!fc || !map.getSource(CONC_SOURCE)) return 0;
  let n = 0;
  for (const f of fc.features) {
    map.setFeatureState({ source: CONC_SOURCE, id: f.id }, { rate: compute(f.properties) });
    n += 1;
  }
  return n;
}

/**
 * (Ré)installe sources et couches sur le style courant, dans l'ordre de rendu
 * voulu : choroplèthe dessous, amas et sites au-dessus.
 *
 * Idempotente : elle est rappelée à chaque `style.load`, un rechargement de
 * style emportant les couches ajoutées à l'exécution ainsi que la visibilité
 * et les états d'entités, tous réappliqués ici.
 */
export function installStationLayers(map, {
  sites = null,
  areas = null,
  metric = "perLocality",
  technologies = TECH_CODES,
  showSites = true,
  selectedId = null,
  compute = null,
} = {}) {
  if (!map.getSource(CONC_SOURCE)) {
    map.addSource(CONC_SOURCE, { type: "geojson", data: areas ?? emptyFeatureCollection() });
  }
  if (!map.getLayer(CONC_FILL)) map.addLayer(concentrationFillSpec(metric));
  if (!map.getLayer(CONC_LINE)) map.addLayer(concentrationLineSpec());

  if (!map.getSource(SITE_SOURCE)) {
    map.addSource(SITE_SOURCE, {
      type: "geojson",
      data: sites ?? emptyFeatureCollection(),
      ...CLUSTER_OPTIONS,
    });
  }
  if (!map.getLayer(SITE_CLUSTERS)) map.addLayer(clusterLayerSpec());
  if (!map.getLayer(SITE_CLUSTER_COUNT)) map.addLayer(clusterCountLayerSpec());
  // Halo de sélection d'abord : il se dessine SOUS le pylône.
  if (!map.getLayer(SITE_HALO)) map.addLayer(siteHaloLayerSpec());
  if (!map.getLayer(SITE_POINTS)) map.addLayer(siteLayerSpec());

  applySiteVisibility(map, { showSites, technologies });
  if (selectedId != null) {
    map.setFeatureState({ source: SITE_SOURCE, id: selectedId }, { selected: true });
  }
  if (compute) paintConcentration(map, areas, compute);
}

/** Visibilité et filtre des couches de sites (propriétés de mise en page). */
export function applySiteVisibility(map, { showSites = true, technologies = TECH_CODES } = {}) {
  const visibility = showSites && technologies.length ? "visible" : "none";
  for (const id of [SITE_CLUSTERS, SITE_CLUSTER_COUNT, SITE_HALO, SITE_POINTS]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
  }
  // Le halo suit le même filtre que les pylônes : jamais de halo orphelin.
  for (const id of [SITE_HALO, SITE_POINTS]) {
    if (map.getLayer(id)) map.setFilter(id, siteFilter(technologies));
  }
}

/* ------------------------------- Légende --------------------------------- */

/**
 * Légende du mode affiché, au format attendu par l'export
 * (`{ title, items: [{ label, color, shape }] }`).
 */
export function buildStationLegend({
  mode = "sites",
  technologies = TECH_CODES,
  showSites = true,
  level = null,
  levelLabel = "",
} = {}) {
  const groups = [];

  if (mode !== "sites" && level) {
    const m = concentrationInfo(mode);
    const scale = m.scale;
    groups.push({
      title: `${m.title} — par ${levelLabel.toLowerCase()}`,
      items: scale.map((s, i) => ({
        label:
          i === scale.length - 1
            ? `${s.at} ${m.short} et plus`
            : `${s.at} à ${scale[i + 1].at} ${m.short}`,
        color: s.color,
        shape: "swatch",
      })),
    });
  }

  if (showSites && technologies.length) {
    groups.push({
      title: "Stations radioélectriques par technologie",
      items: technologies.map((t) => ({
        label: `Station ${t}`,
        color: TECH_COLOR[t] ?? "#64748b",
        // Le pylône de la carte figure tel quel dans la légende exportée ;
        // `shape` reste le repli si l'image ne peut pas être rastérisée.
        shape: "point",
        icon: iconDataUri(pylonIconId(t)),
      })),
    });
  }

  return groups;
}
