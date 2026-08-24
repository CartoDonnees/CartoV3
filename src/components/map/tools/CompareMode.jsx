"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import mapboxgl from "mapbox-gl";
import { X, Check, Plus, GripVertical, GitCompareArrows, CalendarRange, Shapes } from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { ADMIN_LOADERS } from "@/lib/geodata";
import { ADMIN_LIMITS } from "@/config/artci";
import { computeRate, COVERAGE_COLOR } from "@/lib/coverage";
import { STYLE_URLS, CI_CENTER, CI_BOUNDS, CI_ZOOM, CI_MIN_ZOOM, CI_EXTENT } from "@/config/mapStyles";

const MIN_GAP = 8; // écart minimal entre deux poignées (%)
const compact = (n) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(n) || 0);

/** Couverture population (%) d'un opérateur pour un jeu de technologies. */
function coveragePct(data, op, techs) {
  if (!data || !techs.length) return 0;
  let pop = 0;
  let cov = 0;
  for (const f of data.features) {
    const p = Number(f.properties.pop) || 0;
    pop += p;
    cov += (p * computeRate(f.properties, [op], techs)) / 100;
  }
  return pop ? (cov / pop) * 100 : 0;
}

/** Statistiques de couverture d'un opérateur (pondérées population) par techno. */
function opStats(data, op, techs) {
  if (!data || !techs.length) return { pop: 0, cov: 0, pct: 0, perTech: [] };
  let pop = 0;
  let cov = 0;
  const per = Object.fromEntries(techs.map((t) => [t, 0]));
  for (const f of data.features) {
    const p = Number(f.properties.pop) || 0;
    pop += p;
    cov += (p * computeRate(f.properties, [op], techs)) / 100;
    for (const t of techs) per[t] += (p * (Number(f.properties[`perCov${op}${t}`]) || 0)) / 100;
  }
  return {
    pop,
    cov,
    pct: pop ? (cov / pop) * 100 : 0,
    perTech: techs.map((t) => ({ tech: t, pct: pop ? (per[t] / pop) * 100 : 0 })),
  };
}

export function CompareMode() {
  const setActiveTool = useMapStore((s) => s.setActiveTool);
  const periodDate = useMapStore((s) => s.periodDate);
  const setPeriod = useMapStore((s) => s.setPeriod);
  const periods = useMapStore((s) => s.periods);
  const operatorList = useMapStore((s) => s.operatorList);
  const technologyList = useMapStore((s) => s.technologyList);
  const mapStyle = useMapStore((s) => s.mapStyle);

  // Données de référence dynamiques (synchronisées avec le projet).
  const ORDER = useMemo(() => operatorList.map((o) => o.code), [operatorList]);
  const OP = useMemo(() => Object.fromEntries(operatorList.map((o) => [o.code, o])), [operatorList]);
  const TECHS = technologyList;
  const TECH_COLOR = useMemo(() => Object.fromEntries(technologyList.map((t) => [t.code, t.color])), [technologyList]);

  const containers = useRef([]);
  const mapsRef = useRef([]);
  const dataRef = useRef(null);
  const techByOpRef = useRef({});
  const [dataV, setDataV] = useState(0);

  // Découpage administratif du choroplèthe comparé (par défaut : le même que la carte).
  const [level, setLevel] = useState(() => useMapStore.getState().coverageLevel || "district");
  const levelRef = useRef(level);
  levelRef.current = level;

  // Opérateurs inclus dans la comparaison (min. 2, max. tous).
  const [included, setIncluded] = useState(() =>
    Object.fromEntries(useMapStore.getState().operatorList.map((o) => [o.code, true])),
  );
  const activeOps = ORDER.filter((c) => included[c]);

  // Technologies sélectionnées INDÉPENDAMMENT par opérateur.
  const [techByOp, setTechByOp] = useState(() => {
    const s = useMapStore.getState();
    const base = s.technologies?.length ? s.technologies : s.technologyList.map((t) => t.code);
    return Object.fromEntries(s.operatorList.map((o) => [o.code, [...base]]));
  });
  techByOpRef.current = techByOp;

  // Poignées de swipe (longueur = activeOps - 1), réparties également.
  const [dividers, setDividers] = useState([]);
  useEffect(() => {
    const n = activeOps.length;
    setDividers(Array.from({ length: n - 1 }, (_, j) => Math.round(((j + 1) / n) * 100)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOps.length]);

  const dragRef = useRef(null);

  const toggleTech = (opCode, tech) =>
    setTechByOp((prev) => {
      const cur = prev[opCode] || [];
      const next = cur.includes(tech) ? cur.filter((t) => t !== tech) : [...cur, tech];
      return { ...prev, [opCode]: next };
    });
  const addOp = (code) => setIncluded((p) => ({ ...p, [code]: true }));
  const removeOp = (code) =>
    setIncluded((p) => (ORDER.filter((c) => p[c]).length <= 2 ? p : { ...p, [code]: false }));

  const paint = (map, op, techs) => {
    const data = dataRef.current;
    if (!map || !data || !map.getSource("d")) return;
    data.features.forEach((f) => {
      map.setFeatureState({ source: "d", id: f.id }, { rate: computeRate(f.properties, [op], techs) });
    });
  };

  // Création des cartes (persistantes), synchronisées, au style courant du projet.
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const store = useMapStore.getState();
    const order = store.operatorList.map((o) => o.code);
    if (!token || containers.current.slice(0, order.length).some((c) => !c)) return;
    mapboxgl.accessToken = token;

    // Même cadrage initial que la carte d'accueil (centre, zoom et bornes partagés).
    const opts = { style: STYLE_URLS[store.mapStyle], center: CI_CENTER, zoom: CI_ZOOM, minZoom: CI_MIN_ZOOM, maxBounds: CI_BOUNDS, attributionControl: false };
    const maps = order.map((_, i) => new mapboxgl.Map({ container: containers.current[i], ...opts }));
    mapsRef.current = maps;

    // Cadre la vue sur le territoire ivoirien (marge haute pour les cartes de contrôle).
    maps.forEach((m) =>
      m.fitBounds(CI_EXTENT, { padding: { top: 150, bottom: 60, left: 40, right: 40 }, animate: false }),
    );

    const addLayers = (map) => {
      if (!dataRef.current || map.getSource("d")) return;
      map.addSource("d", { type: "geojson", data: dataRef.current });
      map.addLayer({ id: "d-fill", type: "fill", source: "d", paint: { "fill-color": COVERAGE_COLOR, "fill-opacity": 0.72 } });
      map.addLayer({ id: "d-line", type: "line", source: "d", paint: { "line-color": "#0b6d37", "line-width": 0.7, "line-opacity": 0.35 } });
    };
    const repaint = (map, i) => paint(map, order[i], techByOpRef.current[order[i]]);
    // style.load : gère le style initial ET les changements de style (ré-injection).
    maps.forEach((m, i) => m.on("style.load", () => { addLayers(m); repaint(m, i); }));

    (ADMIN_LOADERS[levelRef.current] || ADMIN_LOADERS.district)(store.periodDate).then((d) => {
      dataRef.current = d;
      setDataV((v) => v + 1);
      maps.forEach((m, i) => m.isStyleLoaded() && (addLayers(m), repaint(m, i)));
    });

    // Synchronisation des mouvements.
    let syncing = false;
    const sync = (from) => () => {
      if (syncing) return;
      syncing = true;
      const center = from.getCenter();
      const zoom = from.getZoom();
      const bearing = from.getBearing();
      const pitch = from.getPitch();
      maps.forEach((m) => m !== from && m.jumpTo({ center, zoom, bearing, pitch }));
      syncing = false;
    };
    maps.forEach((m) => m.on("move", sync(m)));

    return () => {
      maps.forEach((m) => m.remove());
      mapsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repeint quand les technologies changent (ou au chargement des données).
  useEffect(() => {
    mapsRef.current.forEach((map, i) => paint(map, ORDER[i], techByOp[ORDER[i]]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [techByOp, dataV]);

  // Réagit au changement de PÉRIODE ou de DÉCOUPAGE administratif.
  useEffect(() => {
    if (!mapsRef.current.length) return;
    let active = true;
    (ADMIN_LOADERS[level] || ADMIN_LOADERS.district)(periodDate).then((d) => {
      if (!active) return;
      dataRef.current = d;
      mapsRef.current.forEach((m) => {
        const src = m.getSource("d");
        if (src) src.setData(d);
      });
      setDataV((v) => v + 1);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodDate, level]);

  // Réagit au changement de STYLE de carte du projet.
  const appliedStyle = useRef(null);
  useEffect(() => {
    const maps = mapsRef.current;
    if (!maps.length) return;
    if (appliedStyle.current === null) { appliedStyle.current = mapStyle; return; }
    if (appliedStyle.current === mapStyle) return;
    appliedStyle.current = mapStyle;
    maps.forEach((m) => m.setStyle(STYLE_URLS[mapStyle])); // style.load ré-injecte les couches
  }, [mapStyle]);

  // Redimensionne les cartes réaffichées après un changement d'inclusion.
  useEffect(() => {
    const id = setTimeout(() => mapsRef.current.forEach((m) => m && m.resize()), 60);
    return () => clearTimeout(id);
  }, [included]);

  // Glissement des poignées.
  useEffect(() => {
    const onMove = (e) => {
      const j = dragRef.current;
      if (j === null || j === undefined) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const pct = (x / window.innerWidth) * 100;
      setDividers((prev) => {
        const lo = (prev[j - 1] ?? 0) + MIN_GAP;
        const hi = (prev[j + 1] ?? 100) - MIN_GAP;
        return prev.map((d, idx) => (idx === j ? Math.min(hi, Math.max(lo, pct)) : d));
      });
    };
    const stop = () => (dragRef.current = null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };
  }, []);

  const excluded = ORDER.filter((c) => !included[c]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-surface-2">
      {/* Cartes empilées : chaque opérateur inclus est découpé à partir de sa poignée. */}
      {ORDER.map((code, i) => {
        const ai = activeOps.indexOf(code);
        const shown = ai !== -1;
        const clip = ai <= 0 ? "none" : `inset(0 0 0 ${dividers[ai - 1] ?? 0}%)`;
        return (
          <div
            key={code}
            className="absolute inset-0"
            style={{ display: shown ? "block" : "none", zIndex: ai < 0 ? 0 : ai, clipPath: clip }}
          >
            {/* Div interne = conteneur Mapbox (Mapbox lui impose position:relative,
                d'où la hauteur explicite h-full pour éviter l'effondrement). */}
            <div ref={(el) => (containers.current[i] = el)} className="h-full w-full" />
          </div>
        );
      })}

      {/* Barre supérieure : titre + sélecteur de période (synchronisé). */}
      <div className="pointer-events-auto absolute left-1/2 top-3 z-30 -translate-x-1/2">
        <div className="glass flex items-center gap-2.5 rounded-2xl px-3 py-2">
          <span className="flex items-center gap-1.5 text-sm font-extrabold tracking-tight">
            <GitCompareArrows size={16} className="text-artci-green-700" /> Comparateur
          </span>
          <span className="h-4 w-px bg-border" />
          <label className="flex items-center gap-1.5 text-sm">
            <CalendarRange size={14} className="text-muted" />
            <select
              value={periodDate}
              onChange={(e) => setPeriod(e.target.value)}
              className="max-w-[150px] bg-transparent font-bold outline-none"
            >
              {periods.map((p) => (
                <option key={p.date} value={p.date}>{p.label}</option>
              ))}
            </select>
          </label>
          <span className="h-4 w-px bg-border" />
          {/* Découpage administratif du choroplèthe comparé */}
          <label className="flex items-center gap-1.5 text-sm" title="Découpage du choroplèthe">
            <Shapes size={14} className="text-muted" />
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="max-w-[150px] bg-transparent font-bold outline-none"
            >
              {ADMIN_LIMITS.map((l) => (
                <option key={l.key} value={l.key}>{l.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Cartes de contrôle + données par opérateur, ancrées dans leur zone. */}
      {activeOps.map((code, ai) => {
        const op = OP[code];
        const left = ai === 0 ? 0 : dividers[ai - 1] ?? 0;
        const isLast = ai === activeOps.length - 1;
        const pos = isLast ? { right: "10px" } : { left: `calc(${left}% + 10px)` };
        return (
          <div key={code} className="pointer-events-auto absolute top-16 z-10 w-[214px] max-w-[46vw]" style={pos}>
            <div className="glass rounded-2xl px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: op?.color }} />
                  <span className="truncate text-sm font-extrabold tracking-tight">{op?.name || code}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CoverageStat data={dataRef.current} op={code} techs={techByOp[code]} dataV={dataV} />
                  {activeOps.length > 2 && (
                    <button onClick={() => removeOp(code)} title="Retirer" className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground">
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                {TECHS.map((t) => (
                  <TechCheck
                    key={t.code}
                    label={t.code}
                    color={t.color}
                    checked={(techByOp[code] || []).includes(t.code)}
                    onClick={() => toggleTech(code, t.code)}
                  />
                ))}
              </div>
            </div>
            <OpDataCard data={dataRef.current} op={code} techs={techByOp[code]} techColor={TECH_COLOR} dataV={dataV} />
            <ScaleLegend />
          </div>
        );
      })}

      {/* Poignées de swipe. */}
      {dividers.map((posPct, j) => (
        <div key={j} className="pointer-events-none absolute inset-y-0 z-20" style={{ left: `${posPct}%` }}>
          <div className="absolute inset-y-0 -ml-px w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.12)]" />
          <button
            onMouseDown={() => (dragRef.current = j)}
            onTouchStart={() => (dragRef.current = j)}
            className="pointer-events-auto absolute top-1/2 -ml-5 grid h-10 w-10 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full brand-gradient text-white shadow-lg"
          >
            <GripVertical size={18} />
          </button>
        </div>
      ))}

      {/* Ajouter un opérateur (si des opérateurs sont exclus). */}
      {excluded.length > 0 && (
        <div className="pointer-events-auto absolute bottom-4 left-4 z-30 flex items-center gap-2">
          {excluded.map((code) => (
            <button key={code} onClick={() => addOp(code)} className="glass flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-semibold">
              <Plus size={15} />
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: OP[code]?.color }} />
              {OP[code]?.name || code}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setActiveTool(null)}
        className="glass pointer-events-auto absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold"
      >
        <X size={16} /> Quitter le comparateur
      </button>
    </motion.div>
  );
}

function CoverageStat({ data, op, techs, dataV }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pct = useMemo(() => coveragePct(data, op, techs), [op, techs, dataV]);
  return (
    <span className="shrink-0 rounded-full bg-artci-green/12 px-2 py-0.5 text-xs font-bold text-artci-green-700">
      {techs.length ? `${pct.toFixed(1)}%` : "—"}
    </span>
  );
}

function OpDataCard({ data, op, techs, techColor, dataV }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const st = useMemo(() => opStats(data, op, techs), [op, techs, dataV]);
  return (
    <div className="glass mt-2 rounded-2xl px-3 py-2.5">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Données de couverture</div>
      {!techs.length ? (
        <p className="text-[11px] italic text-muted">Sélectionnez au moins une technologie.</p>
      ) : (
        <>
          <div className="mb-2 flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold leading-none text-artci-green-700">{st.pct.toFixed(1)}%</span>
            <span className="text-[11px] text-muted">population couverte · {compact(st.cov)}</span>
          </div>
          <div className="space-y-1.5">
            {st.perTech.map((r) => (
              <MiniMeter key={r.tech} label={r.tech} value={r.pct} color={techColor[r.tech]} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MiniMeter({ label, value, color }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-[11px] font-bold" style={{ color }}>{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="w-11 text-right text-[11px] font-bold tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

/** Carte d'échelle de couverture (gradient identique à la choroplèthe). */
function ScaleLegend() {
  return (
    <div className="glass mt-2 rounded-2xl px-3 py-2.5">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Échelle de couverture</div>
      <div
        className="h-2.5 w-full rounded-full"
        style={{ background: "linear-gradient(to right, #e2e8e5 0%, #e11d48 40%, #f47b20 60%, #86e0a8 80%, #0b6d37 100%)" }}
      />
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted">
        <span>Faible</span>
        <span>Élevée</span>
      </div>
    </div>
  );
}

function TechCheck({ label, color, checked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className="flex flex-1 items-center justify-center gap-1 rounded-lg border py-1 text-xs font-bold transition-colors"
      style={
        checked
          ? { borderColor: "transparent", background: `color-mix(in oklab, ${color} 16%, transparent)`, color }
          : { borderColor: "var(--border)", color: "var(--muted)" }
      }
    >
      <span
        className="grid h-3.5 w-3.5 place-items-center rounded-[4px] border"
        style={checked ? { backgroundColor: color, borderColor: color } : { borderColor: "var(--border)" }}
      >
        {checked && <Check size={10} strokeWidth={3.5} color="#fff" />}
      </span>
      {label}
    </button>
  );
}
