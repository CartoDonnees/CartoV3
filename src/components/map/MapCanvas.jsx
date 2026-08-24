"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapStore } from "@/stores/map-store";
import { computeRate, COVERAGE_COLOR } from "@/lib/coverage";
import { getDistricts, getRegions, getDepartments, getSubPrefectures, getStateBoundary } from "@/lib/geodata";
import { STYLE_URLS, CI_CENTER, CI_BOUNDS, CI_ZOOM, CI_MIN_ZOOM } from "@/config/mapStyles";

/**
 * Niveaux administratifs du choroplèthe de couverture (du plus large au plus fin).
 * UN seul niveau est affiché à la fois (choisi dans le sidebar), visible à TOUS les
 * zooms. `drillZoom` = zoom appliqué au clic sur une entité (focus). `nameProp` =
 * champ du nom dans le GeoJSON.
 */
const LEVELS = [
  { key: "district", loader: getDistricts, nameProp: "ADM0_FR", label: "District", drillZoom: 7.4, textSize: 11 },
  { key: "region", loader: getRegions, nameProp: "ADM1_FR", label: "Région", drillZoom: 8.6, textSize: 11 },
  { key: "department", loader: getDepartments, nameProp: "ADM2_FR", label: "Département", drillZoom: 10, textSize: 10.5 },
  { key: "subPrefecture", loader: getSubPrefectures, nameProp: "ADM3_FR", label: "Sous-préfecture", drillZoom: 11.5, textSize: 10 },
];
const srcId = (key) => `cov-${key}`;
const fillId = (key) => `cov-${key}-fill`;
const labelId = (key) => `cov-${key}-label`;

export function MapCanvas() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const dataRef = useRef({}); // { levelKey: geojson }
  const addedRef = useRef(new Set()); // niveaux actuellement ajoutés au style courant
  const handlersRef = useRef(new Set()); // couches déjà pourvues d'écouteurs
  const hoverRef = useRef({}); // { levelKey: idSurvolé } pour la mise en évidence
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const mapStyle = useMapStore((s) => s.mapStyle);
  const operators = useMapStore((s) => s.operators);
  const technologies = useMapStore((s) => s.technologies);
  const showDistricts = useMapStore((s) => s.showDistricts);
  const coverageLevel = useMapStore((s) => s.coverageLevel);
  const periodDate = useMapStore((s) => s.periodDate);
  const setMap = useMapStore((s) => s.setMap);
  const setActiveDistrict = useMapStore((s) => s.setActiveDistrict);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError("Token Mapbox manquant (NEXT_PUBLIC_MAPBOX_TOKEN).");
      return;
    }
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URLS[useMapStore.getState().mapStyle],
      center: CI_CENTER,
      zoom: CI_ZOOM,
      minZoom: CI_MIN_ZOOM, // reste centré sur la Côte d'Ivoire
      maxBounds: CI_BOUNDS,
      attributionControl: false,
      logoPosition: "bottom-right",
      preserveDrawingBuffer: true, // requis pour l'export PNG/PDF
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-right");

    /** Applique la couleur (feature-state `rate`) + visibilité à un niveau donné. */
    const applyLevelState = (cfg) => {
      const st = useMapStore.getState();
      const data = dataRef.current[cfg.key];
      if (!map.getSource(srcId(cfg.key)) || !data) return;
      const rates = {};
      data.features.forEach((f) => {
        const rate = computeRate(f.properties, st.operators, st.technologies);
        rates[f.id] = rate;
        map.setFeatureState({ source: srcId(cfg.key), id: f.id }, { rate });
      });
      // Mémorisé pour l'export : `getStyle()` ne transporte pas les états.
      st.setChoroplethStates(srcId(cfg.key), rates);
      // Visible seulement si le master (showDistricts) est actif ET c'est le niveau sélectionné.
      const dv = st.showDistricts && st.coverageLevel === cfg.key ? "visible" : "none";
      [fillId(cfg.key), labelId(cfg.key)].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", dv);
      });
    };

    /** Attache survol + clic (drill-down) une seule fois par couche. */
    const attachHandlers = (cfg) => {
      if (handlersRef.current.has(cfg.key)) return;
      handlersRef.current.add(cfg.key);
      const fill = fillId(cfg.key);
      const src = srcId(cfg.key);
      const clearHover = () => {
        const prev = hoverRef.current[cfg.key];
        if (prev !== undefined && prev !== null) {
          map.setFeatureState({ source: src, id: prev }, { hover: false });
          hoverRef.current[cfg.key] = null;
        }
      };
      map.on("mousemove", fill, (e) => {
        if (!e.features?.length) return;
        map.getCanvas().style.cursor = "pointer";
        const f = e.features[0];
        // Met en évidence le fill survolé (et retire l'ancien).
        if (hoverRef.current[cfg.key] !== f.id) {
          clearHover();
          hoverRef.current[cfg.key] = f.id;
          map.setFeatureState({ source: src, id: f.id }, { hover: true });
        }
        const st = useMapStore.getState();
        setActiveDistrict({
          name: f.properties[cfg.nameProp],
          level: cfg.label,
          pop: Number(f.properties.pop),
          locs: Number(f.properties.locs),
          rate: computeRate(f.properties, st.operators, st.technologies),
        });
      });
      map.on("mouseleave", fill, () => {
        map.getCanvas().style.cursor = "";
        clearHover();
        setActiveDistrict(null);
      });
      map.on("click", fill, (e) => {
        if (!e.features?.length || useMapStore.getState().activeTool) return;
        const f = e.features[0];
        // Charge les statistiques de l'entité cliquée dans StatsPanel (+ ouvre le panneau).
        useMapStore.getState().setSelectedEntity({
          name: f.properties[cfg.nameProp],
          level: cfg.label,
          props: { ...f.properties },
        });
        // Drill-down : recentre et zoome au niveau suivant.
        map.easeTo({
          center: [Number(f.properties.centerLng), Number(f.properties.centerLat)],
          zoom: cfg.drillZoom,
          duration: 900,
        });
      });
    };

    /** Garantit qu'un niveau est chargé et ajouté au style courant. */
    const ensureLevel = async (cfg) => {
      if (!map.getStyle() || addedRef.current.has(cfg.key)) return;
      let data = dataRef.current[cfg.key];
      if (!data) {
        data = await cfg.loader(useMapStore.getState().periodDate);
        if (cancelled) return;
        dataRef.current[cfg.key] = data;
      }
      if (addedRef.current.has(cfg.key)) return; // ré-entrance pendant l'await
      if (!map.getSource(srcId(cfg.key))) {
        map.addSource(srcId(cfg.key), { type: "geojson", data });
      }
      if (!map.getLayer(fillId(cfg.key))) {
        // Insère le choroplèthe SOUS la bordure de l'État (toujours visible au-dessus).
        const before = map.getLayer("state-border") ? "state-border" : undefined;
        map.addLayer({
          id: fillId(cfg.key),
          type: "fill",
          source: srcId(cfg.key),
          paint: {
            "fill-color": COVERAGE_COLOR,
            // Survol : opacité renforcée → le fill concerné apparaît plus sombre.
            "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.68, 0.38],
          },
        }, before);
        map.addLayer({
          id: labelId(cfg.key),
          type: "symbol",
          source: srcId(cfg.key),
          layout: {
            "text-field": ["get", cfg.nameProp],
            "text-size": cfg.textSize,
            "text-transform": "uppercase",
            "text-letter-spacing": 0.05,
          },
          paint: {
            "text-color": "#0e1512",
            "text-halo-color": "rgba(255,255,255,.85)",
            "text-halo-width": 1.4,
          },
        }, before);
      }
      addedRef.current.add(cfg.key);
      attachHandlers(cfg);
      applyLevelState(cfg);
    };

    // Bordure de l'État de Côte d'Ivoire — TOUJOURS visible, à tous les zooms, noire et large.
    const ensureStateBorder = async () => {
      if (!map.getStyle() || map.getLayer("state-border")) return;
      let data = dataRef.current.state;
      if (!data) {
        data = await getStateBoundary();
        if (cancelled) return;
        dataRef.current.state = data;
      }
      if (map.getLayer("state-border")) return; // ré-entrance pendant l'await
      if (!map.getSource("state")) map.addSource("state", { type: "geojson", data });
      map.addLayer({
        id: "state-border",
        type: "line",
        source: "state",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#000000",
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 2.5, 7, 4, 12, 6.5],
          "line-opacity": 1,
        },
      });
    };

    // Niveau administratif sélectionné (un seul actif, ou null = aucun choroplèthe).
    const selectedLevel = () => LEVELS.find((l) => l.key === useMapStore.getState().coverageLevel) || null;

    // Charge la bordure de l'État (permanente) + le niveau sélectionné (si un niveau est choisi).
    const setupLayers = async () => {
      if (!map.getStyle()) return;
      await ensureStateBorder();
      const sel = selectedLevel();
      if (sel) await ensureLevel(sel);
      setReady(true);
    };

    // Applique l'état (couleurs/visibilité) à tous les niveaux chargés.
    const applyState = () => {
      for (const key of addedRef.current) {
        const cfg = LEVELS.find((l) => l.key === key);
        if (cfg) applyLevelState(cfg);
      }
    };
    map.applyState = applyState;

    // Synchronise après changement de niveau sélectionné : charge le niveau choisi puis applique l'affichage.
    map.syncLevels = () => {
      const sel = selectedLevel();
      if (sel) ensureLevel(sel);
      applyState();
    };

    map.on("load", () => {
      setMap(map);
      setupLayers();
    });
    // Après un changement de style, toutes les couches custom sont purgées mais
    // le zoom (donc le niveau de champ) est conservé : on ré-injecte les niveaux
    // déjà chargés + on garantit celui correspondant au zoom courant.
    map.on("style.load", () => {
      const keys = addedRef.current.size ? [...addedRef.current] : null;
      addedRef.current.clear();
      hoverRef.current = {};
      (async () => {
        await ensureStateBorder(); // bordure de l'État réinjectée en premier (reste au-dessus)
        if (keys) {
          for (const key of keys) {
            const cfg = LEVELS.find((l) => l.key === key);
            if (cfg) await ensureLevel(cfg);
          }
        } else {
          await setupLayers();
        }
        // Restaure le niveau sélectionné (si un niveau est choisi).
        const sel = selectedLevel();
        if (sel) await ensureLevel(sel);
      })();
    });

    return () => {
      cancelled = true;
      map.remove();
      mapRef.current = null;
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changement de style (ignore l'application initiale du style déjà chargé)
  const appliedStyle = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (appliedStyle.current === null) {
      appliedStyle.current = mapStyle;
      return;
    }
    if (appliedStyle.current === mapStyle) return;
    appliedStyle.current = mapStyle;
    map.setStyle(STYLE_URLS[mapStyle]);
  }, [mapStyle, ready]);

  // Changement de période : recharge les données de chaque niveau chargé.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let active = true;
    (async () => {
      for (const key of [...addedRef.current]) {
        const cfg = LEVELS.find((l) => l.key === key);
        if (!cfg) continue;
        const data = await cfg.loader(periodDate);
        if (!active) return;
        dataRef.current[key] = data;
        const src = map.getSource(srcId(key));
        if (src) src.setData(data);
      }
      if (active && map.applyState) map.applyState();
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodDate, ready]);

  // Réaction aux filtres (couleurs + affichage des niveaux de choroplèthe)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (map.syncLevels) map.syncLevels();
    else if (map.applyState) map.applyState();
  }, [operators, technologies, showDistricts, coverageLevel, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />{" "}
      {/* Échelle de couverture (verticale, bord droit) */}
      <div className="pointer-events-none absolute right-0 top-56 hidden rotate-[-90deg] lg:block">
        <div className="flex h-7 w-[200px] items-center justify-between rounded-sm bg-[linear-gradient(to_right,#008900,#63e663,#f4c073,#ff9100,#ff0000)] px-1.5 shadow-sm">
          <span className="text-[10px] font-bold tracking-tight text-white drop-shadow">Zone couverte</span>
          <span className="text-[10px] font-bold tracking-tight text-white drop-shadow">Zone non-couverte</span>
        </div>
      </div>
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-surface-2">
          <div className="glass max-w-sm rounded-xl p-6 text-center text-sm text-muted">
            {error}
          </div>
        </div>
      )}
      {!ready && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-artci-green border-t-transparent" />
        </div>
      )}
    </div>
  );
}
