"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Layers, Crosshair, Download, Loader2, X, Eye, EyeOff } from "lucide-react";
import { STYLE_URLS, CI_CENTER, CI_BOUNDS, CI_ZOOM, CI_MIN_ZOOM, CI_EXTENT } from "@/config/mapStyles";
import {
  WHITE_SOURCE as SRC,
  WHITE_LAYER as LAYER,
  WHITE_CHORO_SOURCE as CHORO_SRC,
  WHITE_CHORO_FILL as CHORO_FILL,
  installWhiteLayers,
  paintWhiteChoro,
  whiteRate,
  whiteCount,
  whiteMetricInfo,
  WHITE_OP_ORDER,
  whiteLevelLabel as levelLabel,
  buildWhiteLegend,
  whiteOperatorScope,
  priorityGradient,
  whiteChoroGradient,
  WHITE_CHORO_SCALE,
  emptyFeatureCollection as emptyFc,
} from "@/lib/white-area-layer";
import { exportMapImage } from "@/lib/map-export";
import { ADMIN_LOADERS } from "@/lib/geodata";
import { formatNumber, formatPercent, cn } from "@/lib/utils";

/**
 * Carte des localités non couvertes (« zones blanches »), reprise de la
 * version 2 : un cercle par localité sans réseau, dimensionné et coloré selon
 * la population privée de couverture. S'y ajoute un choroplèthe facultatif
 * montrant, par entité administrative, la part de localités ou de population
 * privée de réseau. La définition des couches vit dans `lib/white-area-layer`
 * (module pur, validé hors navigateur).
 */

const STYLES = [
  { key: "light", label: "Plan" },
  { key: "satellite", label: "Satellite" },
];

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** Champ portant le nom de l'entité, par découpage. */
const LEVEL_NAME = {
  district: "ADM0_FR",
  region: "ADM1_FR",
  department: "ADM2_FR",
  subPrefecture: "ADM3_FR",
};
/** Formats et résolutions proposés à l'export de la carte. */
const EXPORT_FORMATS = [
  { key: "png", label: "PNG", ext: "png" },
  { key: "jpg", label: "JPEG", ext: "jpg" },
  { key: "pdf", label: "PDF", ext: "pdf" },
];
const EXPORT_DPI = [
  { value: 96, label: "Écran" },
  { value: 200, label: "Impression" },
  { value: 300, label: "Haute définition" },
];

/** Contenu de l'infobulle de survol (mêmes informations qu'en version 2). */
function popupHtml(p) {
  return (
    `<div class="lh__name">${p.ADM4_FR ?? "-"}</div>` +
    `<div class="lh__path">${p.ADM3_FR ?? "-"}${p.ADM2_FR ? ` · ${p.ADM2_FR}` : ""}</div>` +
    `<div class="lh__pop">Population privée de réseau : <b>${formatNumber(p.pop ?? p.score)}</b></div>`
  );
}

/** Infobulle d'une entité administrative du choroplèthe. */
function choroPopupHtml(p, level, metric, operators) {
  const m = whiteMetricInfo(metric);
  return (
    `<div class="lh__name">${p[LEVEL_NAME[level]] ?? "-"}</div>` +
    `<div class="lh__path">${levelLabel(level)} · ${m.tooltip}${whiteOperatorScope(operators)}</div>` +
    `<div class="lh__pop"><b>${formatPercent(whiteRate(p, metric, operators))}</b> — ` +
    `${formatNumber(whiteCount(p, metric, operators))} / ${formatNumber(m.total(p))} ${m.unit}</div>`
  );
}

/**
 * @param {object|null} data   GeoJSON des localités non couvertes (null = en cours de chargement)
 * @param {number|null} selectedId  identifiant de la localité sélectionnée dans le tableau
 * @param {(id:number|null)=>void} onSelect  remonte la sélection faite sur la carte
 * @param {string} date        période affichée (AAAA-MM-JJ), pour le choroplèthe
 * @param {string|null} choroLevel  découpage du choroplèthe (null = aucun)
 * @param {string} choroMetric  indicateur du choroplèthe : localité ou population
 * @param {string[]} operators  opérateurs retenus - définissent ce qu'est une zone blanche
 */
export function WhiteAreaMap({
  data,
  selectedId = null,
  onSelect,
  date,
  choroLevel = null,
  choroMetric = "locality",
  operators = WHITE_OP_ORDER,
  /** Panneau de filtres posé sur la carte (fourni par la section). */
  controls = null,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const dataRef = useRef(data);
  const selectedRef = useRef(null); // dernier identifiant peint comme sélectionné
  const onSelectRef = useRef(onSelect);
  const choroRef = useRef(null); // GeoJSON du découpage affiché
  const choroHoverRef = useRef(null); // entité survolée
  const choroViewRef = useRef({ level: null, metric: "locality", operators: WHITE_OP_ORDER });
  const paintRef = useRef(null); // repeint les taux du choroplèthe
  const showPointsRef = useRef(true);
  const [ready, setReady] = useState(false);
  const [style, setStyle] = useState("light");
  // Les points des localités peuvent être masqués pour ne lire que le choroplèthe.
  const [showPoints, setShowPoints] = useState(true);
  const [choroLoading, setChoroLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [exportDpi, setExportDpi] = useState(200);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  /* Les écouteurs Mapbox vivent hors de React : ils lisent les valeurs
     courantes par référence plutôt que par capture. */
  useEffect(() => {
    dataRef.current = data;
    onSelectRef.current = onSelect;
    choroViewRef.current = { level: choroLevel, metric: choroMetric, operators };
    showPointsRef.current = showPoints;
  }, [data, onSelect, choroLevel, choroMetric, showPoints, operators]);

  /* Création de la carte (une seule fois). */
  useEffect(() => {
    if (!TOKEN || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URLS.light,
      center: CI_CENTER,
      zoom: CI_ZOOM,
      minZoom: CI_MIN_ZOOM,
      maxBounds: CI_BOUNDS,
      attributionControl: false,
      logoPosition: "bottom-right",
    });
    mapRef.current = map;
    // Les coins hauts sont réservés aux contrôles applicatifs (fond de carte,
    // export) : les contrôles Mapbox descendent en bas de la carte.
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left");

    const popup = new mapboxgl.Popup({
      className: "lh-popup",
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    });
    popupRef.current = popup;

    /** (Ré)installe sources, couches, visibilité et états sur le style courant. */
    const install = () =>
      installWhiteLayers(map, {
        data: dataRef.current,
        choro: choroRef.current,
        selectedId: selectedRef.current,
        showPoints: showPointsRef.current,
        metric: choroViewRef.current.metric,
        operators: choroViewRef.current.operators,
      });

    /** Applique le taux de zone blanche à chaque entité du découpage affiché. */
    const paintChoroStates = () =>
      paintWhiteChoro(map, choroRef.current, choroViewRef.current.metric, choroViewRef.current.operators);
    paintRef.current = paintChoroStates;

    map.on("style.load", install);
    map.on("load", () => {
      install();
      setReady(true);
    });

    map.on("mousemove", LAYER, (e) => {
      map.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (f) popup.setLngLat(e.lngLat).setHTML(popupHtml(f.properties)).addTo(map);
    });
    map.on("mouseleave", LAYER, () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });
    // Sélection croisée : cliquer un cercle met la ligne en évidence dans le tableau.
    map.on("click", LAYER, (e) => {
      const f = e.features?.[0];
      if (f) onSelectRef.current?.(f.id);
    });

    /** Survol d'une entité du choroplèthe - le cercle garde la priorité. */
    const clearChoroHover = () => {
      if (choroHoverRef.current != null) {
        map.setFeatureState({ source: CHORO_SRC, id: choroHoverRef.current }, { hover: false });
        choroHoverRef.current = null;
      }
    };
    map.on("mousemove", CHORO_FILL, (e) => {
      // Une localité sous le curseur l'emporte : son infobulle est plus précise.
      if (map.getLayer(LAYER) && map.queryRenderedFeatures(e.point, { layers: [LAYER] }).length) return;
      const f = e.features?.[0];
      if (!f) return;
      if (choroHoverRef.current !== f.id) {
        clearChoroHover();
        choroHoverRef.current = f.id;
        map.setFeatureState({ source: CHORO_SRC, id: f.id }, { hover: true });
      }
      const { level, metric, operators: ops } = choroViewRef.current;
      popup.setLngLat(e.lngLat).setHTML(choroPopupHtml(f.properties, level, metric, ops)).addTo(map);
    });
    map.on("mouseleave", CHORO_FILL, () => {
      clearChoroHover();
      popup.remove();
    });

    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
      popupRef.current = null;
    };
  }, []);

  /* Mise à jour des données (période ou filtres) - sans recréer la carte. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(SRC);
    if (!src) return;
    src.setData(data ?? emptyFc());
    // `setData` réinitialise les états de rendu de la source : la mise en
    // évidence de la localité sélectionnée doit être réappliquée.
    if (selectedRef.current != null) {
      map.setFeatureState({ source: SRC, id: selectedRef.current }, { selected: true });
    }
  }, [data, ready]);

  /*
   * Changement de fond de carte.
   *
   * Deux pièges, tous deux vérifiés à nos dépens :
   *  - il ne faut PAS réappliquer le style déjà chargé au montage. Mapbox
   *    procède alors par différence entre le style courant (qui contient nos
   *    couches ajoutées à l'exécution) et le style demandé (qui ne les
   *    contient pas) : il les SUPPRIME, sans réémettre `style.load` pour les
   *    réinstaller. La carte se retrouve vide à l'initialisation ;
   *  - `diff: false` force un rechargement complet, donc un `style.load`, seule
   *    garantie que `install()` repose sources et couches.
   */
  const appliedStyle = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (appliedStyle.current === null) {
      appliedStyle.current = style; // style initial : déjà chargé, rien à faire
      return;
    }
    if (appliedStyle.current === style) return;
    appliedStyle.current = style;
    map.setStyle(STYLE_URLS[style], { diff: false });
  }, [style, ready]);

  /* Choroplèthe : chargement du découpage demandé pour la période affichée.
     « Aucun » vide simplement la source, sans démonter les couches. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const apply = (fc) => {
      choroRef.current = fc;
      choroHoverRef.current = null;
      map.getSource(CHORO_SRC)?.setData(fc ?? emptyFc());
      paintRef.current?.(); // `setData` efface les états : on repeint les taux
    };

    if (!choroLevel || !date || !ADMIN_LOADERS[choroLevel]) {
      apply(null);
      return;
    }

    let alive = true;
    setChoroLoading(true);
    ADMIN_LOADERS[choroLevel](date)
      .then((fc) => alive && apply(fc))
      .catch(() => alive && apply(null))
      .finally(() => alive && setChoroLoading(false));
    return () => { alive = false; };
  }, [choroLevel, date, ready]);

  /* Changement d'indicateur : les mêmes entités, un autre taux. */
  useEffect(() => {
    if (!ready) return;
    paintRef.current?.();
  }, [choroMetric, operators, ready]);

  /* Affichage des points de localité. `visibility` est une propriété de mise
     en page : elle ne peut pas dépendre d'un état d'entité, on la pose donc
     directement sur la couche. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer(LAYER)) return;
    map.setLayoutProperty(LAYER, "visibility", showPoints ? "visible" : "none");
    if (!showPoints) popupRef.current?.remove();
  }, [showPoints, ready]);

  /* Sélection venue du tableau : mise en évidence + recentrage.
     Ne dépend que de la sélection : un simple changement de filtres ne doit
     pas relancer un vol vers la localité déjà sélectionnée. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource(SRC)) return;
    if (selectedRef.current === selectedId) return;

    if (selectedRef.current != null) {
      map.setFeatureState({ source: SRC, id: selectedRef.current }, { selected: false });
    }
    selectedRef.current = selectedId;
    if (selectedId == null) return;

    map.setFeatureState({ source: SRC, id: selectedId }, { selected: true });
    const f = dataRef.current?.features?.find((x) => x.id === selectedId);
    const lng = Number(f?.properties?.centerLng ?? f?.geometry?.coordinates?.[0]);
    const lat = Number(f?.properties?.centerLat ?? f?.geometry?.coordinates?.[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      map.flyTo({ center: [lng, lat], zoom: 11.5, duration: 1200, essential: true });
    }
  }, [selectedId, ready]);

  /** Recadre sur l'ensemble du territoire. */
  const resetView = () => {
    onSelect?.(null);
    mapRef.current?.fitBounds(CI_EXTENT, { padding: 24, duration: 900 });
  };

  /**
   * Exporte la vue courante avec sa légende.
   *
   * Le rendu se fait hors écran à la résolution demandée. Les taux du
   * choroplèthe sont des états d'entités : ils ne voyagent pas avec le style
   * et doivent être rejoués sur la carte clonée, sinon les polygones sortent
   * en gris (défaut déjà rencontré sur l'export de la carte publique).
   */
  const runExport = async () => {
    const map = mapRef.current;
    if (!map) return;
    setExportError(null);
    setExporting(true);
    try {
      const rates = {};
      for (const f of choroRef.current?.features ?? []) {
        rates[f.id] = whiteRate(f.properties, choroMetric, operators);
      }
      const ext = EXPORT_FORMATS.find((f) => f.key === exportFormat)?.ext ?? "png";
      const count = data?.features?.length ?? 0;
      await exportMapImage(map, {
        format: exportFormat,
        size: "A4",
        orientation: "landscape",
        dpi: exportDpi,
        fileName: `artci_zones_blanches_${date || "carte"}.${ext}`,
        legend: buildWhiteLegend({ choroLevel, choroMetric, showPoints, operators }),
        legendOnRaster: true,
        title: "Localités non couvertes - CARTODONNEES",
        subtitle:
          `Période du ${date || "-"} · ${formatNumber(count)} localités sans réseau` +
          whiteOperatorScope(operators) +
          (choroLevel ? ` · choroplèthe : part de ${whiteMetricInfo(choroMetric).legend} par ${levelLabel(choroLevel).toLowerCase()}` : ""),
        featureStates: Object.keys(rates).length ? { [CHORO_SRC]: rates } : {},
      });
      setExportOpen(false);
    } catch (e) {
      setExportError(e?.message || "Export impossible.");
    } finally {
      setExporting(false);
    }
  };

  if (!TOKEN) {
    return (
      <div className="grid h-full min-h-[320px] place-items-center rounded-xl bg-surface-2 p-6 text-center text-[12px] text-muted">
        Token Mapbox manquant (NEXT_PUBLIC_MAPBOX_TOKEN).
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-xl border border-border">
      <div ref={containerRef} className="h-full w-full" />

      {/* Emplacement des filtres, fournis par la section : ils vivent SUR la
          carte, au plus près de ce qu'ils modifient. */}
      {controls && (
        <div className="pointer-events-auto absolute left-2 top-2 z-10 max-h-[calc(100%-1rem)] w-[min(300px,calc(100%-1rem))] overflow-y-auto">
          {controls}
        </div>
      )}

      {/* Export de la vue courante et réglages d'affichage de la carte */}
      <div className="pointer-events-auto absolute right-2 top-2 z-10 flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1 rounded-xl border border-border bg-surface/95 p-1 shadow-sm backdrop-blur">
        <Layers size={13} className="ml-1 text-muted" />
        {STYLES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStyle(s.key)}
            aria-pressed={style === s.key}
            className={cn(
              "rounded-lg px-2 py-1 text-[10.5px] font-bold transition-colors",
              style === s.key ? "bg-artci-green text-white" : "text-muted hover:bg-surface-2",
            )}
          >
            {s.label}
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px bg-border" />
        {/* Masquer les points laisse lire le choroplèthe seul. */}
        <button
          type="button"
          onClick={() => setShowPoints((v) => !v)}
          aria-pressed={showPoints}
          title={showPoints ? "Masquer les localités non couvertes" : "Afficher les localités non couvertes"}
          className={cn(
            "flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10.5px] font-bold transition-colors",
            showPoints ? "text-foreground hover:bg-surface-2" : "text-muted hover:bg-surface-2",
          )}
        >
          {showPoints ? <Eye size={13} /> : <EyeOff size={13} />}
          Localités
        </button>
        <span className="mx-0.5 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={resetView}
          title="Revoir tout le territoire"
          className="grid h-6 w-6 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2"
        >
          <Crosshair size={13} />
        </button>
      </div>

        <button
          type="button"
          onClick={() => setExportOpen((o) => !o)}
          aria-expanded={exportOpen}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-surface/95 px-2.5 py-1.5 text-[11px] font-bold shadow-sm backdrop-blur transition-colors hover:bg-surface-2"
        >
          <Download size={13} className="text-muted" />
          Exporter
        </button>

        {exportOpen && (
          <div className="w-[218px] rounded-xl border border-border bg-surface/98 p-2.5 shadow-md backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Carte + légende · A4 paysage
              </span>
              <button
                type="button"
                onClick={() => setExportOpen(false)}
                aria-label="Fermer"
                className="grid h-5 w-5 place-items-center rounded-md text-muted hover:bg-surface-2"
              >
                <X size={12} />
              </button>
            </div>

            <div className="mb-2 flex gap-1 rounded-lg bg-surface-2/70 p-1">
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setExportFormat(f.key)}
                  aria-pressed={exportFormat === f.key}
                  className={cn(
                    "flex-1 rounded-md py-1 text-[10.5px] font-bold transition-colors",
                    exportFormat === f.key ? "bg-artci-green text-white" : "text-muted hover:bg-surface-2",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-muted">
              Résolution
              <select
                value={exportDpi}
                onChange={(e) => setExportDpi(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-[11.5px] font-bold normal-case tracking-normal text-foreground outline-none focus:border-artci-green"
              >
                {EXPORT_DPI.map((d) => (
                  <option key={d.value} value={d.value}>{d.label} — {d.value} ppp</option>
                ))}
              </select>
            </label>

            {exportError && <p className="mb-1.5 text-[10px] font-semibold text-uncovered">{exportError}</p>}

            <button
              type="button"
              onClick={runExport}
              disabled={exporting}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg brand-gradient px-2 py-1.5 text-[11px] font-bold text-white shadow-sm disabled:opacity-70"
            >
              {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {exporting ? "Génération…" : "Télécharger"}
            </button>
          </div>
        )}
      </div>

      {choroLoading && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface/95 px-2.5 py-1 text-[10px] font-bold text-muted shadow-sm">
          Chargement du découpage…
        </div>
      )}

      <MapLegend choroLevel={choroLevel} choroMetric={choroMetric} showPoints={showPoints} operators={operators} />
    </div>
  );
}

/**
 * Légende de la carte : l'échelle du choroplèthe quand il est affiché, puis
 * l'échelle de priorité des cercles. La version 2 pivotait son dégradé à -90°,
 * illisible sur petit écran ; les deux sont ici horizontaux et gradués.
 */
function MapLegend({ choroLevel, choroMetric, showPoints, operators }) {
  const metric = whiteMetricInfo(choroMetric);
  const choroMax = WHITE_CHORO_SCALE[WHITE_CHORO_SCALE.length - 1];
  // Rien d'affiché sur la carte : pas de cartouche de légende non plus.
  if (!choroLevel && !showPoints) return null;
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 w-[min(320px,86%)] -translate-x-1/2 space-y-2 rounded-xl border border-border bg-surface/95 px-2.5 py-2 shadow-sm backdrop-blur">
      {choroLevel && (
        <div>
          <div className="mb-1 text-center text-[9.5px] font-bold uppercase tracking-wide text-muted">
            Part de {metric.legend} · par {levelLabel(choroLevel).toLowerCase()}
            {whiteOperatorScope(operators)}
          </div>
          <div className="h-2 rounded-full" style={{ background: whiteChoroGradient() }} />
          <div className="mt-1 flex justify-between text-[9px] font-semibold text-muted">
            {WHITE_CHORO_SCALE.filter((s, i) => i === 0 || i === 3 || s === choroMax).map((s) => (
              <span key={s.at} className="tabular-nums">{s.label} %</span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 text-center text-[9.5px] font-bold uppercase tracking-wide text-muted">
          Priorité d&apos;intervention · population privée de réseau
          {whiteOperatorScope(operators)}
        </div>
        <div className="h-2 rounded-full" style={{ background: priorityGradient() }} />
        <div className="mt-1 flex justify-between text-[9px] font-semibold text-muted">
          <span>Basse · 0</span>
          <span className="tabular-nums">1 500</span>
          <span className="tabular-nums">3 000 + · Élevée</span>
        </div>
      </div>
    </div>
  );
}
