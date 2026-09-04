"use client";

import { useEffect, useRef } from "react";
import { useMapStore } from "@/stores/map-store";
import {
  getLocalities, getWhiteLocalities, getFiber, getRailways, ADMIN_LOADERS,
} from "@/lib/geodata";
import { registerMapIcons } from "@/lib/mapIcons";
import { ADMIN_LINE_STYLE, FIBER_LAYERS, ROAD_LAYERS } from "@/config/artci";

/* Expressions de filtre sur les points de localité (flags cov{TECH} = 0/1). */
const uncoveredExpr = (techs) => ["all", ...techs.map((t) => ["==", ["get", `cov${t}`], 0])];
const opCoveredExpr = (op, techs) => ["any", ...techs.map((t) => ["==", ["get", `cov${op}${t}`], 1])];

/* Taille d'icône : visible dès le plus petit zoom, grandit en zoomant. */
const ICON_SIZE = ["interpolate", ["linear"], ["zoom"], 4.5, 0.4, 8, 1.55, 13, 1.85];
/* >>> Opacité de toutes les icônes-marqueurs (badges, triangles, stations…).
   Modifier cette seule valeur entre 0 (transparent) et 1 (opaque).
   On peut aussi mettre une expression Mapbox (ex. interpolation par zoom). */
const ICON_OPACITY = ["interpolate", ["linear"], ["zoom"],5,0.2, 6, 0.3, 7,0.4, 8,0.5,9,0.6,10,0.7,11,0.8,12,0.9 ];
const symbolPaint = { "icon-opacity": ICON_OPACITY };
/* allow-overlap + ignore-placement = true : toutes les icônes s'affichent, aucun regroupement/masquage selon le zoom. */
const symbolLayout = (image) => ({
  "icon-image": image,
  "icon-size": ICON_SIZE,
  "icon-allow-overlap": true,
  "icon-ignore-placement": true,
  "icon-anchor": "center",
});

/* Badges centrés sur la localité. Positions horizontales dans une rangée
   (gauche | centre | droite). La rangée verticale n'est décalée que si
   technologies ET opérateurs sont affichés simultanément (sinon centré). */
const OP_CODES = ["MOOV", "MTN", "ORANGE"];
const TECH_CODES = ["2G", "3G", "4G"];
const COL_X = { "2G": -14, "3G": 0, "4G": 14 }; // technologies côte à côte (opérateurs = trèfle superposé)
const ROW_SPLIT = 12; // décalage vertical d'une rangée quand les 2 vues coexistent
const covByTech = (t) => ["==", ["get", `cov${t}`], 1];

/* « Localités » : points nets à tous les zooms - opacité CONSTANTE (aucune
   dégradation au zoom), seul le rayon grandit légèrement pour rester lisible. */
const LOCALITY_PAINT = {
  "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2.2, 8, 3.4, 12, 5],
  "circle-color": "#334155",
  "circle-opacity": 1,
  "circle-stroke-color": "#ffffff",
  "circle-stroke-width": 1,
  "circle-stroke-opacity": 1,
};
/* Libellés des localités : affichés dès le plus petit zoom (Mapbox gère les
   collisions, donc davantage de noms apparaissent au fur et à mesure du zoom). */
const LOCALITY_LABEL_LAYOUT = {
  "text-field": ["coalesce", ["get", "ADM4_FR"], ""],
  "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 9, 11.5, 13, 13],
  "text-offset": [0, 0.9],
  "text-anchor": "top",
  "text-optional": true,
};
const LOCALITY_LABEL_PAINT = {
  "text-color": "#0e1512",
  "text-halo-color": "rgba(255,255,255,.9)",
  "text-halo-width": 1.4,
};

/* ------------------------------ Zones blanches ---------------------------- */
/* Localités sans couverture NI prévision : l'indicateur le plus critique de la
   carte. Il reste PLEINEMENT visible à tous les niveaux de zoom - aucune
   opacité n'est interpolée, ni sur le halo ni sur le marqueur. Seule la
   TAILLE varie, selon le zoom et la population privée de réseau : plus une
   zone blanche pèse, plus elle se voit, du niveau national au niveau rue. */

/** Population de la localité, ramenée à un nombre exploitable en expression. */
const WHITE_POP = ["to-number", ["coalesce", ["get", "pop"], 0]];
/** Interpole une valeur selon le zoom PUIS, à chaque palier, selon la population. */
const byZoomAndPop = (stops) => [
  "interpolate", ["linear"], ["zoom"],
  ...stops.flatMap(([zoom, small, large]) => [
    zoom,
    ["interpolate", ["linear"], WHITE_POP, 0, small, 3000, large],
  ]),
];

/* Halo diffus : donne du poids aux grappes vues de loin, cerne le marqueur de près. */
const WHITE_HALO_PAINT = {
  "circle-radius": byZoomAndPop([
    [4, 6, 11],
    [8, 14, 26],
    [12, 24, 44],
    [16, 32, 58],
  ]),
  "circle-color": "#0f172a",
  "circle-opacity": 0.24, // constante : aucune dégradation au zoom
  "circle-blur": 0.75,
};

/* Marqueur : cœur blanc cerné de noir, lisible sur n'importe quel fond. */
const WHITE_SYMBOL_LAYOUT = {
  "icon-image": "ic-white",
  "icon-size": byZoomAndPop([
    [4, 0.5, 0.8],
    [8, 0.95, 1.5],
    [12, 1.25, 1.95],
    [16, 1.45, 2.2],
  ]),
  "icon-allow-overlap": true,
  "icon-ignore-placement": true,
  "icon-anchor": "center",
};
const WHITE_SYMBOL_PAINT = { "icon-opacity": 1 };

/* Couches de zones blanches, dans l'ordre d'empilement. */
const WHITE_LAYERS = ["white-halo", "sym-white"];

/**
 * Couches assises sur un point de localité : toutes peuvent renseigner
 * l'infobulle de survol (voir `LocalityHover`).
 */
export const LOCALITY_LAYERS = [
  ...WHITE_LAYERS,
  "sym-nocov",
  ...TECH_CODES.map((t) => `sym-tech-${t}`),
  ...OP_CODES.map((o) => `sym-op-${o}`),
  "loc-all",
];

/* Couleurs partagées avec la légende des exports (voir `config/artci`). */
const FIBERS = FIBER_LAYERS;
const ADMIN = ADMIN_LINE_STYLE;

/* --------------------------- Réseau routier ------------------------------- */
/* Autoroutes, routes nationales et pistes ne figurent dans aucun fichier du
   projet : elles sont tracées depuis la couche vectorielle « road » du fond
   Mapbox, filtrée sur la classe de voie. */
const ROADS = ROAD_LAYERS.filter((r) => r.classes);

/** Identifiant de la source vectorielle Mapbox Streets du style courant. */
function streetsSource(map) {
  const sources = map.getStyle()?.sources ?? {};
  for (const [id, src] of Object.entries(sources)) {
    if (src?.type === "vector" && String(src.url || "").includes("mapbox-streets")) return id;
  }
  return sources.composite?.type === "vector" ? "composite" : null;
}

/** Épaisseur : discrète à l'échelle du pays, franche une fois zoomé. */
const roadWidth = (w) => [
  "interpolate", ["linear"], ["zoom"],
  5, w * 0.35,
  8, w * 0.7,
  12, w * 1.6,
  16, w * 3,
];

/** Première couche de marqueurs présente — les routes se glissent dessous. */
function firstMarkerLayer(map) {
  return LOCALITY_LAYERS.find((id) => map.getLayer(id));
}

/** Gère toutes les couches carto pilotées par les filtres (hors choroplèthe de base). */
export function LayerManager() {
  const map = useMapStore((s) => s.map);
  const periodDate = useMapStore((s) => s.periodDate);
  const technologies = useMapStore((s) => s.technologies);
  const operators = useMapStore((s) => s.operators);
  const mapOperators = useMapStore((s) => s.mapOperators);
  const operatorTechs = useMapStore((s) => s.operatorTechs);
  const controls = useMapStore((s) => s.controls);
  const showWhiteZones = useMapStore((s) => s.showWhiteZones);
  const adminLimits = useMapStore((s) => s.adminLimits);
  // Cache des sources déjà chargées, PERSISTANT entre les ré-exécutions de l'effet
  // (sinon chaque changement de filtre rechargerait les données et le loader).
  const loadedRef = useRef({});

  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const loaded = loadedRef.current; // { sourceId: periodKey } - vidé au changement de style

    const removeLayer = (id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    };
    /**
     * Ajoute la couche si elle doit être visible et absente, la retire si
     * elle ne doit plus l'être. `afterFn` (filtres/offsets) s'exécute tant
     * qu'elle est affichée. => déselection = suppression réelle de la carte.
     */
    const ensureLayer = (id, shouldShow, addFn, afterFn) => {
      const has = !!map.getLayer(id);
      if (shouldShow) {
        if (!has) addFn();
        if (afterFn) afterFn();
      } else if (has) {
        map.removeLayer(id);
      }
    };

    /** Garantit que la source existe et contient les données de `periodKey`. */
    const ensureSource = async (id, loader, periodKey = "static") => {
      if (loaded[id] === periodKey && map.getSource(id)) return true;
      // Chargement réel de données → active le loader bloquant.
      useMapStore.getState().beginLoading();
      try {
        const data = await loader();
        if (cancelled) return false;
        const src = map.getSource(id);
        if (src) src.setData(data);
        else map.addSource(id, { type: "geojson", data });
        loaded[id] = periodKey;
        return true;
      } finally {
        useMapStore.getState().endLoading();
      }
    };

    // Sérialisation : un seul sync à la fois, ré-exécution si demandé entre-temps
    let running = false;
    let queued = false;
    const runSync = async () => {
      if (running) { queued = true; return; }
      running = true;
      try {
        await sync();
      } catch (e) {
        console.error("[LayerManager]", e);
      } finally {
        running = false;
        if (queued && !cancelled) { queued = false; runSync(); }
      }
    };

    const sync = async () => {
      if (!map.getStyle()) return;
      const st = useMapStore.getState();
      const techs = st.technologies;

      // ---- Localités (badges circulaires modernes) ----
      // Chaque couche est ajoutée quand elle est cochée, retirée quand décochée.
      const mapOps = st.mapOperators;
      const techShown = st.controls.showCovLocalities && st.technologies.length > 0;
      const both = techShown && mapOps.length > 0;
      const techRowY = both ? -ROW_SPLIT : 0; // rangées séparées si techno ET opérateurs coexistent
      const opRowY = both ? ROW_SPLIT : 0;
      const needLoc = st.controls.showLocality || st.controls.showNoCovLocalities || techShown || mapOps.length > 0;

      if (needLoc) {
        if (!(await ensureSource("loc", () => getLocalities(st.periodDate), st.periodDate))) return;
        await registerMapIcons(map);
      }
      // « Localités » : points visibles à TOUS les zooms (couleur constante) + libellés
      ensureLayer("loc-all", st.controls.showLocality,
        () => map.addLayer({ id: "loc-all", type: "circle", source: "loc", paint: LOCALITY_PAINT }));
      ensureLayer("loc-all-label", st.controls.showLocality,
        () => map.addLayer({ id: "loc-all-label", type: "symbol", source: "loc", layout: LOCALITY_LABEL_LAYOUT, paint: LOCALITY_LABEL_PAINT }));
      // Localités non couvertes
      ensureLayer("sym-nocov", st.controls.showNoCovLocalities,
        () => map.addLayer({ id: "sym-nocov", type: "symbol", source: "loc", layout: symbolLayout("ic-uncovered"), paint: symbolPaint }),
        () => map.setFilter("sym-nocov", uncoveredExpr(techs)));
      // Couverture par technologie
      for (const t of TECH_CODES) {
        ensureLayer(`sym-tech-${t}`, techShown && st.technologies.includes(t),
          () => map.addLayer({ id: `sym-tech-${t}`, type: "symbol", source: "loc", layout: symbolLayout(`ic-tech-${t}`), paint: symbolPaint }),
          () => {
            map.setFilter(`sym-tech-${t}`, covByTech(t));
            map.setLayoutProperty(`sym-tech-${t}`, "icon-offset", [COL_X[t], techRowY]);
          });
      }
      // Couverture par opérateur (les 3 triangles se superposent pour former le trèfle)
      for (const op of OP_CODES) {
        const opTechs = st.operatorTechs?.[op] ?? techs; // chaque opérateur filtre selon SES technologies
        ensureLayer(`sym-op-${op}`, mapOps.includes(op),
          () => map.addLayer({ id: `sym-op-${op}`, type: "symbol", source: "loc", layout: symbolLayout(`ic-op-${op}`), paint: symbolPaint }),
          () => {
            map.setFilter(`sym-op-${op}`, opCoveredExpr(op, opTechs));
            map.setLayoutProperty(`sym-op-${op}`, "icon-offset", [0, opRowY]);
          });
      }

      // ---- Zones blanches ----
      if (st.showWhiteZones) {
        if (!(await ensureSource("white", () => getWhiteLocalities(st.periodDate), st.periodDate))) return;
        await registerMapIcons(map);
        ensureLayer("white-halo", true, () => map.addLayer({ id: "white-halo", type: "circle", source: "white", paint: WHITE_HALO_PAINT }));
        ensureLayer("sym-white", true, () => map.addLayer({ id: "sym-white", type: "symbol", source: "white", layout: WHITE_SYMBOL_LAYOUT, paint: WHITE_SYMBOL_PAINT }));
      } else {
        for (const id of WHITE_LAYERS) removeLayer(id);
      }

      // ---- Fibres optiques ----
      for (const f of FIBERS) {
        const src = `fib-${f.op}`;
        if (!st.controls[f.ctrl]) {
          removeLayer(src);
          continue;
        }
        if (!(await ensureSource(src, () => getFiber(f.op)))) return;
        ensureLayer(src, true, () =>
          map.addLayer({
            id: src,
            type: "line",
            source: src,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": f.color, "line-width": 2.5, "line-opacity": 0.95 },
          }),
        );
      }

      // ---- Réseau routier (issu du fond de carte) ----
      const streets = streetsSource(map);
      for (const r of ROADS) {
        const id = `road-${r.key}`;
        if (!streets || !st.controls[r.key]) {
          removeLayer(id);
          continue;
        }
        ensureLayer(id, true, () =>
          map.addLayer(
            {
              id,
              type: "line",
              source: streets,
              "source-layer": "road",
              filter: ["match", ["get", "class"], r.classes, true, false],
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": r.color,
                "line-width": roadWidth(r.width),
                "line-opacity": 0.9,
                ...(r.dashed ? { "line-dasharray": [2, 1.6] } : {}),
              },
            },
            // Sous les marqueurs de localité, au-dessus du fond et de la choroplèthe.
            firstMarkerLayer(map),
          ),
        );
      }

      // ---- Chemins de fer ----
      if (st.controls.railway) {
        if (!(await ensureSource("rail", () => getRailways()))) return;
        ensureLayer("rail", true, () => map.addLayer({ id: "rail", type: "line", source: "rail", paint: { "line-color": "#334155", "line-width": 1.5, "line-dasharray": [2, 2] } }));
      } else removeLayer("rail");

      // ---- Limites administratives ----
      for (const a of ADMIN) {
        const src = `lim-${a.level}`;
        if (st.adminLimits[a.level]) {
          if (!(await ensureSource(src, () => ADMIN_LOADERS[a.level](st.periodDate), st.periodDate))) return;
          ensureLayer(src, true, () => map.addLayer({ id: src, type: "line", source: src, paint: { "line-color": a.color, "line-width": a.width, "line-opacity": 0.85 } }));
        } else removeLayer(src);
      }

      // Les zones blanches repassent au-dessus de tout ce qui vient d'être ajouté.
      if (st.showWhiteZones) {
        for (const id of WHITE_LAYERS) if (map.getLayer(id)) map.moveLayer(id);
      }
    };

    runSync();
    // Ré-injecter après changement de style (setStyle purge les couches custom)
    const onStyle = () => {
      for (const k of Object.keys(loaded)) delete loaded[k];
      runSync();
    };
    map.on("style.load", onStyle);
    return () => {
      cancelled = true;
      map.off("style.load", onStyle);
    };
  }, [map, periodDate, technologies, operators, mapOperators, operatorTechs, controls, showWhiteZones, adminLimits]);

  return null;
}
