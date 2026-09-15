"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Layers, Crosshair, Download, Loader2, X, Eye, EyeOff } from "lucide-react";
import { STYLE_URLS, CI_CENTER, CI_BOUNDS, CI_ZOOM, CI_MIN_ZOOM, CI_EXTENT } from "@/config/mapStyles";
import {
  SITE_SOURCE, SITE_POINTS, SITE_CLUSTERS,
  CONC_SOURCE, CONC_FILL,
  installStationLayers, applySiteVisibility, paintConcentration,
  concentrationFillSpec, buildStationLegend, TECH_COLOR,
  emptyFeatureCollection as emptyFc,
} from "@/lib/stations-layer";
import {
  concentration, concentrationInfo, concentrationGradient, formatConcentration,
  countByTech, stationCount, isChoroplethMode, OPERATOR_CODES, TECH_CODES,
} from "@/lib/stations";
import { exportMapImage } from "@/lib/map-export";
import { registerMapIcons, iconDataUri, pylonIconId } from "@/lib/mapIcons";
import { formatNumber, formatCompact, cn } from "@/lib/utils";

/**
 * Carte du module « Stations mobiles & concentration ».
 *
 * Superpose deux lectures qui ne proviennent pas de la même source, et le dit :
 *  - les SITES géolocalisés, extraits des jeux de tuiles ARTCI (position exacte,
 *    technologie, nombre de cellules ; aucun opérateur) ;
 *  - le CHOROPLÈTHE de concentration, calculé sur les décomptes déclarés par
 *    période, opérateur et technologie (`present{OP}{TECH}`).
 */

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const STYLES = [
  { key: "light", label: "Plan" },
  { key: "satellite", label: "Satellite" },
];
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

const LEVEL_NAME = {
  district: "ADM0_FR",
  region: "ADM1_FR",
  department: "ADM2_FR",
  subPrefecture: "ADM3_FR",
};
const LEVEL_LABEL = {
  district: "District",
  region: "Région",
  department: "Département",
  subPrefecture: "Sous-préfecture",
};
const levelLabel = (k) => LEVEL_LABEL[k] ?? k;

/** Infobulle d'un site géolocalisé. */
function siteHtml(p) {
  return (
    `<div class="lh__name">${p.name || "Site sans nom"}</div>` +
    `<div class="lh__path">${p.tech} · ${p.ADM3_FR || "-"}${p.ADM2_FR ? ` · ${p.ADM2_FR}` : ""}</div>` +
    `<div class="lh__pop">Code : <b>${p.code || "-"}</b> · Cellules : <b>${formatNumber(p.cells)}</b></div>` +
    `<div class="lh__pop">${p.ADM1_FR || ""}${p.ADM0_FR ? ` · ${p.ADM0_FR}` : ""}</div>`
  );
}

/** Infobulle d'une entité administrative : le détail demandé par la régulation. */
function areaHtml(props, { level, mode, operators, technologies }) {
  const total = stationCount(props, operators, technologies);
  const byTech = countByTech(props, operators);
  const perPop = Number(props.pop) ? (total / Number(props.pop)) * 10000 : 0;
  const techLine = TECH_CODES.map(
    (t) => `<span style="color:${TECH_COLOR[t]}">■</span> ${t} : <b>${formatNumber(byTech[t])}</b>`,
  ).join(" &nbsp; ");
  return (
    `<div class="lh__name">${props[LEVEL_NAME[level]] ?? "-"}</div>` +
    `<div class="lh__path">${levelLabel(level)}</div>` +
    `<div class="lh__pop">Population : <b>${formatNumber(props.pop)}</b> hab. · Localités : <b>${formatNumber(props.locs)}</b></div>` +
    `<div class="lh__pop">Stations : <b>${formatNumber(total)}</b></div>` +
    `<div class="lh__pop">${techLine}</div>` +
    `<div class="lh__pop">${concentrationInfo(mode).title} : <b>${formatConcentration(
      concentration(props, mode, operators, technologies), mode,
    )}</b></div>` +
    (mode === "perLocality"
      ? `<div class="lh__pop">Stations / 10 000 hab. : <b>${perPop.toFixed(1).replace(".", ",")}</b></div>`
      : "")
  );
}

export function StationsMap({
  sites,
  areas,
  level = "district",
  mode = "sites",
  operators = OPERATOR_CODES,
  technologies = TECH_CODES,
  date,
  selectedSiteId = null,
  onSelectSite,
  onSelectArea,
  loading = false,
  /** Panneau de filtres posé sur la carte (fourni par la section). */
  controls = null,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const paintRef = useRef(null);
  const installRef = useRef(null);
  const viewRef = useRef({ level, mode, operators, technologies });
  const sitesRef = useRef(sites);
  const areasRef = useRef(areas);
  const selectedRef = useRef(null);
  const hoverRef = useRef(null);
  const onSelectSiteRef = useRef(onSelectSite);
  const onSelectAreaRef = useRef(onSelectArea);
  const showSitesRef = useRef(true);

  const [ready, setReady] = useState(false);
  const [style, setStyle] = useState("light");
  const [showSites, setShowSites] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [exportDpi, setExportDpi] = useState(200);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const choropleth = isChoroplethMode(mode);

  /* Les écouteurs Mapbox vivent hors de React : ils lisent par référence. */
  useEffect(() => {
    viewRef.current = { level, mode, operators, technologies };
    sitesRef.current = sites;
    areasRef.current = areas;
    onSelectSiteRef.current = onSelectSite;
    onSelectAreaRef.current = onSelectArea;
    showSitesRef.current = showSites;
  }, [level, mode, operators, technologies, sites, areas, onSelectSite, onSelectArea, showSites]);

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
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left");

    const popup = new mapboxgl.Popup({ className: "lh-popup", closeButton: false, closeOnClick: false, offset: 12 });
    popupRef.current = popup;

    /** Valeur de concentration d'une entité, selon la sélection courante. */
    const compute = (props) => {
      const v = viewRef.current;
      return concentration(props, v.mode, v.operators, v.technologies);
    };

    /*
     * Les pylônes sont des images ajoutées à l'exécution : elles disparaissent
     * avec le style, comme nos couches. On les enregistre AVANT de poser la
     * couche qui les demande - sinon Mapbox, ne trouvant pas l'image, n'affiche
     * rien pour ces sites, sans le signaler.
     */
    const install = async () => {
      await registerMapIcons(map);
      if (mapRef.current !== map) return; // carte démontée pendant le chargement
      installStationLayers(map, {
        sites: sitesRef.current,
        areas: areasRef.current,
        metric: viewRef.current.mode,
        technologies: viewRef.current.technologies,
        showSites: showSitesRef.current,
        selectedId: selectedRef.current,
        compute,
      });
    };
    installRef.current = install;
    paintRef.current = () => paintConcentration(map, areasRef.current, compute);

    map.on("style.load", () => { install(); });
    map.on("load", async () => {
      await install();
      if (mapRef.current === map) setReady(true);
    });

    /* --------------------------- Sites ---------------------------------- */
    map.on("mousemove", SITE_POINTS, (e) => {
      map.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      // Décalée au-dessus du pylône, pour ne pas masquer l'icône survolée.
      if (f) popup.setOffset(30).setLngLat(f.geometry.coordinates).setHTML(siteHtml(f.properties)).addTo(map);
    });
    map.on("mouseleave", SITE_POINTS, () => { map.getCanvas().style.cursor = ""; popup.remove(); });
    map.on("click", SITE_POINTS, (e) => {
      const f = e.features?.[0];
      if (f) onSelectSiteRef.current?.(f.id);
    });

    /* Amas : le clic descend d'un cran de zoom sur le groupe. */
    map.on("mouseenter", SITE_CLUSTERS, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", SITE_CLUSTERS, () => { map.getCanvas().style.cursor = ""; });
    map.on("click", SITE_CLUSTERS, (e) => {
      const f = e.features?.[0];
      const src = map.getSource(SITE_SOURCE);
      if (!f || !src?.getClusterExpansionZoom) return;
      src.getClusterExpansionZoom(f.properties.cluster_id, (err, zoom) => {
        if (err) return;
        map.easeTo({ center: f.geometry.coordinates, zoom: Math.min(zoom + 0.4, 16), duration: 700 });
      });
    });

    /* ------------------------ Entités administratives -------------------- */
    const clearHover = () => {
      if (hoverRef.current != null) {
        map.setFeatureState({ source: CONC_SOURCE, id: hoverRef.current }, { hover: false });
        hoverRef.current = null;
      }
    };
    map.on("mousemove", CONC_FILL, (e) => {
      // Un site sous le curseur l'emporte : son infobulle est plus précise.
      if (map.getLayer(SITE_POINTS) && map.queryRenderedFeatures(e.point, { layers: [SITE_POINTS] }).length) return;
      const f = e.features?.[0];
      if (!f) return;
      if (hoverRef.current !== f.id) {
        clearHover();
        hoverRef.current = f.id;
        map.setFeatureState({ source: CONC_SOURCE, id: f.id }, { hover: true });
      }
      popup.setOffset(12).setLngLat(e.lngLat).setHTML(areaHtml(f.properties, viewRef.current)).addTo(map);
    });
    map.on("mouseleave", CONC_FILL, () => { clearHover(); popup.remove(); });
    map.on("click", CONC_FILL, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      if (map.getLayer(SITE_POINTS) && map.queryRenderedFeatures(e.point, { layers: [SITE_POINTS] }).length) return;
      onSelectAreaRef.current?.(f.properties);
      const b = new mapboxgl.LngLatBounds();
      const walk = (c) => (typeof c[0] === "number" ? b.extend(c) : c.forEach(walk));
      walk(f.geometry.coordinates);
      if (!b.isEmpty()) map.fitBounds(b, { padding: 48, duration: 900 });
    });

    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
      popupRef.current = null;
    };
  }, []);

  /* Données : sites et découpage, sans recréer la carte. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.getSource(SITE_SOURCE)?.setData(sites ?? emptyFc());
    if (selectedRef.current != null) {
      map.setFeatureState({ source: SITE_SOURCE, id: selectedRef.current }, { selected: true });
    }
  }, [sites, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.getSource(CONC_SOURCE)?.setData(areas ?? emptyFc());
    // `setData` efface les états : les valeurs doivent être reposées.
    paintRef.current?.();
  }, [areas, ready]);

  /* Filtres et indicateur : repeinture, sans retoucher aux sources. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    paintRef.current?.();
    if (map.getLayer(CONC_FILL)) {
      map.setPaintProperty(CONC_FILL, "fill-color", concentrationFillSpec(mode).paint["fill-color"]);
    }
  }, [mode, operators, technologies, ready]);

  /* Visibilité et filtre technologique des sites. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applySiteVisibility(map, { showSites, technologies });
    if (!showSites) popupRef.current?.remove();
  }, [showSites, technologies, ready]);

  /* Site sélectionné dans le tableau : mise en évidence et recentrage. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource(SITE_SOURCE)) return;
    if (selectedRef.current === selectedSiteId) return;
    if (selectedRef.current != null) {
      map.setFeatureState({ source: SITE_SOURCE, id: selectedRef.current }, { selected: false });
    }
    selectedRef.current = selectedSiteId;
    if (selectedSiteId == null) return;
    map.setFeatureState({ source: SITE_SOURCE, id: selectedSiteId }, { selected: true });
    const f = sitesRef.current?.features?.find((x) => x.id === selectedSiteId);
    const c = f?.geometry?.coordinates;
    if (c) map.flyTo({ center: c, zoom: 13, duration: 1200, essential: true });
  }, [selectedSiteId, ready]);

  /* Changement de fond de carte. Le style initial est déjà chargé : le
     réappliquer ferait supprimer nos couches par la mise à jour différentielle,
     sans réémettre `style.load` pour les réinstaller. */
  const appliedStyle = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (appliedStyle.current === null) { appliedStyle.current = style; return; }
    if (appliedStyle.current === style) return;
    appliedStyle.current = style;
    map.setStyle(STYLE_URLS[style], { diff: false });
  }, [style, ready]);

  const resetView = () => {
    onSelectSite?.(null);
    mapRef.current?.fitBounds(CI_EXTENT, { padding: 24, duration: 900 });
  };

  /** Exporte la vue courante avec sa légende. */
  const runExport = async () => {
    const map = mapRef.current;
    if (!map) return;
    setExportError(null);
    setExporting(true);
    try {
      const rates = {};
      for (const f of areas?.features ?? []) {
        rates[f.id] = concentration(f.properties, mode, operators, technologies);
      }
      const ext = EXPORT_FORMATS.find((f) => f.key === exportFormat)?.ext ?? "png";
      const m = concentrationInfo(mode);
      await exportMapImage(map, {
        format: exportFormat,
        size: "A4",
        orientation: "landscape",
        dpi: exportDpi,
        fileName: `artci_stations_${date || "carte"}.${ext}`,
        legend: buildStationLegend({ mode, technologies, showSites, level, levelLabel: levelLabel(level) }),
        legendOnRaster: true,
        title: "Stations mobiles & concentration - CARTODONNEES",
        subtitle:
          `Période du ${date || "-"} · ${operators.join(", ") || "aucun opérateur"} · ${technologies.join(", ") || "aucune technologie"}` +
          (choropleth ? ` · ${m.title} par ${levelLabel(level).toLowerCase()}` : ""),
        featureStates: choropleth && Object.keys(rates).length ? { [CONC_SOURCE]: rates } : {},
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

      {loading && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface/95 px-2.5 py-1 text-[10px] font-bold text-muted shadow-sm">
          Chargement des données…
        </div>
      )}

      <div className="pointer-events-auto absolute right-2 top-2 z-10 flex flex-col items-end gap-1.5">
        {/* Réglages d'affichage de la carte elle-même */}
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
          <button
            type="button"
            onClick={() => setShowSites((v) => !v)}
            aria-pressed={showSites}
            title={showSites ? "Masquer les sites" : "Afficher les sites"}
            className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10.5px] font-bold text-foreground transition-colors hover:bg-surface-2"
          >
            {showSites ? <Eye size={13} /> : <EyeOff size={13} />}
            Sites
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

      <MapLegend
        mode={mode}
        level={level}
        technologies={technologies}
        showSites={showSites}
        choropleth={choropleth}
      />
    </div>
  );
}

/** Légende dynamique : elle suit le mode et les couches réellement affichées. */
function MapLegend({ mode, level, technologies, showSites, choropleth }) {
  const m = concentrationInfo(mode);
  const scale = m.scale;
  if (!choropleth && (!showSites || !technologies.length)) return null;
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 w-[min(340px,88%)] -translate-x-1/2 space-y-2 rounded-xl border border-border bg-surface/95 px-2.5 py-2 shadow-sm backdrop-blur">
      {choropleth && (
        <div>
          <div className="mb-1 text-center text-[9.5px] font-bold uppercase tracking-wide text-muted">
            {m.title} · par {levelLabel(level).toLowerCase()}
          </div>
          <div className="h-2 rounded-full" style={{ background: concentrationGradient(mode) }} />
          <div className="mt-1 flex justify-between text-[9px] font-semibold text-muted">
            <span className="tabular-nums">0</span>
            <span className="tabular-nums">{scale[Math.floor(scale.length / 2)].at}</span>
            <span className="tabular-nums">{scale[scale.length - 1].at} + · {m.short}</span>
          </div>
        </div>
      )}

      {showSites && technologies.length > 0 && (
        <div>
          <div className="mb-1 text-center text-[9.5px] font-bold uppercase tracking-wide text-muted">
            Stations radioélectriques
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {technologies.map((t) => (
              <span key={t} className="flex items-center gap-1 text-[9.5px] font-semibold text-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconDataUri(pylonIconId(t))} alt="" className="h-5 w-auto" />
                {t}
              </span>
            ))}
            <span className="flex items-center gap-1 text-[9.5px] font-semibold text-muted">
              <span className="h-3 w-3 rounded-full border-2 border-white bg-[#3b82f6]" />
              amas
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
