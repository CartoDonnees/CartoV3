"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  X, Search, FileJson, FileSpreadsheet, FileText, Loader2, SlidersHorizontal, Table2, Filter,
  ChevronRight, Home, CornerDownRight, CalendarRange,
} from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { buildRows, buildQosRows, exportExcel, exportPdf, QOS_INDICATORS } from "@/lib/export-data";
import { SortHeader } from "@/components/ui/kit";

const PAGE_SIZE = 25;
const OPS = ["ORANGE", "MTN", "MOOV"];
const TECHS = ["2G", "3G", "4G"];

/**
 * Chaîne administrative parcourue pas à pas en extraction personnalisée :
 * district → régions → départements → sous-préfectures → localités.
 * Chaque niveau porte les noms de tous ses parents (ADM0_FR … ADM4_FR),
 * ce qui permet de filtrer directement sur la sélection en cours.
 */
const CHAIN = [
  { key: "district", kind: "district", nameProp: "ADM0_FR", label: "District", plural: "Districts", col: "DISTRICT" },
  { key: "region", kind: "region", nameProp: "ADM1_FR", label: "Région", plural: "Régions", col: "REGION" },
  { key: "department", kind: "department", nameProp: "ADM2_FR", label: "Département", plural: "Départements", col: "DEPARTEMENT" },
  { key: "subPrefecture", kind: "subPrefecture", nameProp: "ADM3_FR", label: "Sous-préfecture", plural: "Sous-préfectures", col: "SOUS-PREFECTURE" },
  { key: "locality", kind: "locality", nameProp: "ADM4_FR", label: "Localité", plural: "Localités", col: "LOCALITE" },
];

/** Colonnes descriptives (toujours conservées) vs colonnes de mesure (filtrables). */
const isMeasureColumn = (c) => /^COUVERTURE |^(Te|Tbd|Tc|Tq|TeS|TedS|Tr3|TeRd|Ts|Ted|Tcd|Tddu|Tddd|Dmd|Dmu) /.test(c);

/**
 * Aperçu des données avant téléchargement (comme en version 2) : tableau paginé,
 * recherche, filtres de colonnes et — en mode personnalisé — descente pas à pas
 * dans le découpage administratif, avec extraction possible à chaque étape.
 */
export function ExportPreviewModal() {
  const req = useMapStore((s) => s.exportRequest);
  const setReq = useMapStore((s) => s.setExportRequest);
  const mapPeriod = useMapStore((s) => s.periodDate);
  const periods = useMapStore((s) => s.periods);

  // Semestre de l'extraction — indépendant de la carte, initialisé sur celui affiché.
  const [periodDate, setPeriodDate] = useState(mapPeriod);

  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  const [query, setQuery] = useState("");
  const [ops, setOps] = useState([...OPS]);
  const [techs, setTechs] = useState([...TECHS]);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Sélection en cascade : à chaque étape, la LISTE des entités retenues.
  // ex. [["BAS-SASSANDRA","COMOE"], ["GBOKLE"]]
  const [path, setPath] = useState([]);
  // Entités cochées à l'étape courante (noms).
  const [selected, setSelected] = useState(() => new Set());

  const [campaigns, setCampaigns] = useState([]);
  const [service, setService] = useState("VOIX");
  const [campaign, setCampaign] = useState("");

  const isQos = req?.domain === "qos";
  const isCustom = !!req?.custom;
  // Niveau courant : autant de crans que d'éléments déjà choisis.
  const levelIndex = Math.min(path.length, CHAIN.length - 1);
  const level = CHAIN[levelIndex];

  useEffect(() => {
    if (!req) return;
    setQuery(""); setPage(0); setError(""); setRaw(null); setPath([]); setSelected(new Set());
    setPeriodDate(mapPeriod);
    setOps([...OPS]); setTechs([...TECHS]);
    setShowFilters(false);
    if (req.domain === "qos") {
      setService(req.service || "VOIX");
      setCampaign(req.campaign || "");
    }
  }, [req]);

  useEffect(() => {
    if (!isQos || campaigns.length) return;
    let alive = true;
    fetch("/api/v1/geo?kind=qosCampaigns")
      .then((r) => r.json())
      .then((list) => {
        if (!alive || !Array.isArray(list)) return;
        setCampaigns(list);
        setCampaign((c) => c || list[0] || "");
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [isQos, campaigns.length]);

  // Source à charger selon le mode.
  const url = useMemo(() => {
    if (!req) return null;
    if (isQos) {
      return campaign ? `/api/v1/geo?kind=qos&service=${service}&campaign=${encodeURIComponent(campaign)}` : null;
    }
    const kind = isCustom ? level.kind : req.kind;
    return `/api/v1/geo?kind=${kind}&date=${periodDate}`;
  }, [req, isQos, isCustom, level, periodDate, service, campaign]);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    setError("");
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error("Données indisponibles."); return r.json(); })
      .then((d) => alive && setRaw(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [url]);

  // Restreint aux entités descendant de la sélection en cours.
  const scoped = useMemo(() => {
    if (!raw) return null;
    if (!isCustom || !path.length) return raw;
    const features = (raw.features || []).filter((f) =>
      path.every((names, i) => names.includes(f.properties?.[CHAIN[i].nameProp])),
    );
    return { type: "FeatureCollection", features };
  }, [raw, isCustom, path]);

  const table = useMemo(() => {
    if (!scoped) return { rows: [], columns: [] };
    return isQos ? buildQosRows(scoped, service) : buildRows(scoped);
  }, [scoped, isQos, service]);

  const columns = useMemo(
    () =>
      table.columns.filter((c) => {
        if (!isMeasureColumn(c)) return true;
        const okOp = OPS.some((o) => c.endsWith(` ${o}`)) ? ops.some((o) => c.endsWith(` ${o}`)) : true;
        const okTech = isQos ? true : TECHS.some((t) => c.includes(` ${t} `)) ? techs.some((t) => c.includes(` ${t} `)) : true;
        return okOp && okTech;
      }),
    [table.columns, ops, techs, isQos],
  );

  // Colonne portant l'entité parente (regroupement) — absente à la racine.
  const parentCol = isCustom && levelIndex > 0 ? CHAIN[levelIndex - 1].col : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? table.rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)))
      : table.rows;
  }, [table.rows, query]);

  const [sort, setSort] = useState(null);
  const toggleSort = (key) =>
    setSort((c) => (c?.key !== key ? { key, dir: "asc" } : c.dir === "asc" ? { key, dir: "desc" } : null));

  const rows = useMemo(() => {
    // Le regroupement prime : le parent reste la clé primaire, le tri demandé
    // s'applique À L'INTÉRIEUR de chaque groupe pour ne pas les disloquer.
    if (!parentCol && !sort) return filtered;
    const byName = (a, b) =>
      String(a.LOCALITE ?? a.NOM ?? "").localeCompare(String(b.LOCALITE ?? b.NOM ?? ""), "fr");
    const bySort = (a, b) => {
      if (!sort) return 0;
      const va = a[sort.key];
      const vb = b[sort.key];
      const eA = va == null || va === "";
      const eB = vb == null || vb === "";
      if (eA || eB) return eA && eB ? 0 : eA ? 1 : -1;
      const c =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "fr", { numeric: true });
      return sort.dir === "asc" ? c : -c;
    };
    return [...filtered].sort(
      (a, b) =>
        (parentCol ? String(a[parentCol] ?? "").localeCompare(String(b[parentCol] ?? ""), "fr") : 0) ||
        bySort(a, b) ||
        byName(a, b),
    );
  }, [filtered, parentCol, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  useEffect(() => { setPage(0); }, [query, rows.length, path.length]);

  const close = () => setReq(null);
  const rowName = (r) => r.LOCALITE ?? r.NOM ?? "";
  const canDrill = isCustom && levelIndex < CHAIN.length - 1;

  /** Descend d'un cran avec les entités cochées (ou celle cliquée). */
  const drill = (names) => {
    const list = (Array.isArray(names) ? names : [names]).filter(Boolean);
    if (!canDrill || !list.length) return;
    setPath((p) => [...p, list]);
    setSelected(new Set());
    setQuery("");
  };
  /** Remonte à une étape donnée (-1 = racine). */
  const goTo = (i) => { setPath((p) => p.slice(0, i + 1)); setSelected(new Set()); setQuery(""); };

  /** Coche / décoche une entité de l'étape courante. */
  const toggleSelected = (name) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  const allShownSelected = rows.length > 0 && rows.every((r) => selected.has(rowName(r)));
  const toggleAll = () =>
    setSelected(allShownSelected ? new Set() : new Set(rows.map((r) => rowName(r))));

  // L'export porte sur les entités cochées, ou sur tout le tableau si rien n'est coché.
  const exportRows = selected.size ? rows.filter((r) => selected.has(rowName(r))) : rows;

  const lastStep = path.length ? path[path.length - 1] : null;
  const scopeLabel = !lastStep
    ? "Côte d'Ivoire"
    : lastStep.length === 1
      ? lastStep[0]
      : `${lastStep.length} ${CHAIN[path.length - 1].plural.toLowerCase()}`;
  const base = isQos
    ? `qos_${service}_${(campaign || "").replace(/\s+/g, "-")}`
    : isCustom
      ? `${level.key}_${(scopeLabel || "").replace(/\s+/g, "-")}_${periodDate}`
      : `${req?.kind}_${periodDate}`;
  const title = isQos
    ? `${req?.title} — ${service} · ${campaign}`
    : isCustom
      ? `${level.plural} — ${scopeLabel} (${periodDate})`
      : `${req?.title} — ${periodDate}`;

  const doExport = async (format) => {
    setBusy(format);
    setError("");
    try {
      if (format === "geojson") {
        const keep = new Set(exportRows.map((r) => `${rowName(r)}|${r.LATITUDE ?? ""}`));
        const feats = (scoped?.features || []).filter((f) => {
          const p = f.properties || {};
          const name = p.ADM4_FR ?? p.ADM3_FR ?? p.ADM2_FR ?? p.ADM1_FR ?? p.ADM0_FR;
          return keep.has(`${name}|${p.centerLat ?? ""}`);
        });
        const blob = new Blob([JSON.stringify({ type: "FeatureCollection", features: feats })], {
          type: "application/geo+json",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `artci_cartodonnees_${base}_${Date.now()}.geojson`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } else {
        const data = exportRows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c]])));
        if (format === "xlsx") await exportExcel(data, columns, base, level?.plural || req.title);
        else await exportPdf(data, columns, base, title, "Observatoire CARTODONNEES · ARTCI");
      }
    } catch (e) {
      setError(e.message || "Export impossible.");
    } finally {
      setBusy(null);
    }
  };

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <AnimatePresence>
      {req && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="pointer-events-auto absolute inset-0 z-[70] grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.96, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 16, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl"
          >
            {/* En-tête */}
            <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl brand-gradient text-white shadow-md">
                <Table2 size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-extrabold leading-tight tracking-tight">
                  {isCustom ? `Extraction personnalisée — ${level.plural}` : req.title}
                </h2>
                <p className="text-[11px] text-muted">
                  Aperçu avant téléchargement · {isQos ? `${service} · ${campaign || "—"}` : periodDate}
                </p>
              </div>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${
                  showFilters ? "brand-gradient text-white" : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
                title="Filtrer les colonnes"
              >
                <SlidersHorizontal size={16} />
              </button>
              <button onClick={close} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-foreground" aria-label="Fermer">
                <X size={17} />
              </button>
            </div>

            {/* Fil d'Ariane de la sélection en cascade */}
            {isCustom && (
              <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 bg-surface/40 px-5 py-2.5 text-[11.5px]">
                <button
                  onClick={() => goTo(-1)}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 font-bold transition-colors ${
                    path.length === 0 ? "bg-artci-green/12 text-artci-green-700" : "text-muted hover:bg-surface-2"
                  }`}
                >
                  <Home size={12} /> Côte d'Ivoire
                </button>
                {path.map((name, i) => (
                  <span key={`${i}-${name}`} className="flex items-center gap-1">
                    <ChevronRight size={12} className="text-muted" />
                    <button
                      onClick={() => goTo(i)}
                      className={`rounded-lg px-2 py-1 font-bold transition-colors ${
                        i === path.length - 1 ? "bg-artci-green/12 text-artci-green-700" : "text-muted hover:bg-surface-2"
                      }`}
                      title={CHAIN[i].label}
                    >
                      {name}
                    </button>
                  </span>
                ))}
                <span className="ml-auto flex items-center gap-1 text-[10.5px] text-muted">
                  <CornerDownRight size={11} />
                  Étape {levelIndex + 1}/{CHAIN.length} · {level.plural}
                  {canDrill && " — cochez une ou plusieurs entités"}
                </span>
              </div>
            )}

            {/* Filtres */}
            <div className="shrink-0 space-y-2 border-b border-border/60 px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2 focus-within:border-artci-green">
                  <Search size={14} className="shrink-0 text-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={isCustom ? `Filtrer les ${level.plural.toLowerCase()}…` : "Filtrer (localité, région, département…)"}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                  />
                </label>
                {!isQos && (
                  <label className="flex items-center gap-1.5 rounded-xl border border-border bg-surface/60 px-3 py-2" title="Semestre des données exportées">
                    <CalendarRange size={14} className="shrink-0 text-muted" />
                    <select
                      value={periodDate}
                      onChange={(e) => { setPeriodDate(e.target.value); setSelected(new Set()); }}
                      className="bg-transparent text-sm font-semibold outline-none"
                    >
                      {periods.map((p) => (
                        <option key={p.date} value={p.date}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                )}
                {isQos && (
                  <>
                    <select value={service} onChange={(e) => setService(e.target.value)} className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm font-semibold outline-none focus:border-artci-green">
                      {Object.keys(QOS_INDICATORS).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm font-semibold outline-none focus:border-artci-green">
                      {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </>
                )}
              </div>

              {showFilters && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/50 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                    <Filter size={11} /> Colonnes
                  </span>
                  <Chips label="Opérateurs" items={OPS} selected={ops} onToggle={(v) => toggle(ops, setOps, v)} />
                  {!isQos && <Chips label="Technologies" items={TECHS} selected={techs} onToggle={(v) => toggle(techs, setTechs, v)} />}
                </div>
              )}
            </div>

            {/* Aperçu */}
            <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted">
                  <Loader2 size={16} className="animate-spin text-artci-green-700" /> Chargement des données…
                </div>
              ) : error ? (
                <p className="py-10 text-center text-sm font-semibold text-uncovered">{error}</p>
              ) : rows.length === 0 ? (
                <p className="py-14 text-center text-sm text-muted">Aucune donnée ne correspond à cette sélection.</p>
              ) : (
                <table className="w-full border-collapse text-[11.5px]">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {isCustom && (
                        <th className="border-b border-border bg-surface px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={allShownSelected}
                            onChange={toggleAll}
                            className="h-3.5 w-3.5 accent-[var(--artci-green)]"
                            title="Tout sélectionner"
                          />
                        </th>
                      )}
                      {columns.map((c) => (
                        <SortHeader
                          key={c}
                          label={c}
                          sortKey={c}
                          sort={sort}
                          onSort={toggleSort}
                          className="whitespace-nowrap border-b border-border bg-surface px-2 py-1.5 font-bold text-muted"
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r, i) => {
                      const parent = parentCol ? r[parentCol] : null;
                      const prev = i > 0 ? shown[i - 1][parentCol] : page > 0 ? rows[page * PAGE_SIZE - 1]?.[parentCol] : undefined;
                      const newGroup = parentCol && parent !== prev;
                      const groupSize = newGroup ? rows.filter((x) => x[parentCol] === parent).length : 0;
                      const continued = newGroup && i === 0 && page > 0 && rows[page * PAGE_SIZE - 1]?.[parentCol] === parent;
                      return (
                      <Fragment key={`${page}-${i}`}>
                      {newGroup && (
                        <tr className="bg-artci-green/8">
                          <td colSpan={columns.length + (isCustom ? 1 : 0)} className="border-b border-artci-green/25 px-2 py-1.5">
                            <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-artci-green-700">
                              <CornerDownRight size={11} />
                              {CHAIN[levelIndex - 1].label} : {parent || "—"}
                              <span className="font-semibold text-muted">
                                ({groupSize} {level.plural.toLowerCase()}{continued ? ", suite" : ""})
                              </span>
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr
                        onClick={isCustom ? () => toggleSelected(rowName(r)) : undefined}
                        className={`odd:bg-surface/40 ${isCustom ? "cursor-pointer hover:bg-artci-green/8" : ""} ${
                          isCustom && selected.has(rowName(r)) ? "bg-artci-green/10" : ""
                        }`}
                      >
                        {isCustom && (
                          <td className="border-b border-border/50 px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={selected.has(rowName(r))}
                              onChange={() => toggleSelected(rowName(r))}
                              onClick={(e) => e.stopPropagation()}
                              className="h-3.5 w-3.5 accent-[var(--artci-green)]"
                            />
                          </td>
                        )}
                        {columns.map((c) => (
                          <td key={c} className="whitespace-nowrap border-b border-border/50 px-2 py-1.5">
                            {r[c] ?? "—"}
                          </td>
                        ))}
                      </tr>
                      </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination + extraction (disponible à chaque étape) */}
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border/60 bg-surface/40 px-5 py-3">
              <span className="text-[11px] text-muted">
                <strong className="font-bold text-foreground">{rows.length.toLocaleString("fr-FR")}</strong>{" "}
                {isCustom ? level.plural.toLowerCase() : "ligne(s)"} · {columns.length} colonnes
                {selected.size > 0 && (
                  <span className="ml-1 font-bold text-artci-green-700">· {selected.size} sélectionné(s)</span>
                )}
              </span>
              {canDrill && (
                <button
                  onClick={() => drill([...selected])}
                  disabled={!selected.size}
                  className="flex items-center gap-1.5 rounded-xl border border-artci-green/40 bg-artci-green/10 px-3 py-2 text-[12px] font-bold text-artci-green-700 transition-colors hover:bg-artci-green/16 disabled:opacity-40"
                  title={`Voir les ${CHAIN[levelIndex + 1].plural.toLowerCase()} des entités cochées`}
                >
                  Voir les {CHAIN[levelIndex + 1].plural.toLowerCase()} <ChevronRight size={13} />
                </button>
              )}
              {pageCount > 1 && (
                <span className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                    className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold disabled:opacity-40">‹</button>
                  <span className="text-[11px] text-muted">{page + 1} / {pageCount}</span>
                  <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}
                    className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold disabled:opacity-40">›</button>
                </span>
              )}
              <div className="flex-1" />
              {[
                { key: "geojson", label: "GeoJSON", icon: FileJson },
                { key: "xlsx", label: "Excel", icon: FileSpreadsheet },
                { key: "pdf", label: "PDF", icon: FileText },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => doExport(f.key)}
                  disabled={!!busy || !exportRows.length}
                  className="flex items-center gap-1.5 rounded-xl brand-gradient px-3 py-2 text-[12px] font-bold text-white shadow-md transition-transform hover:scale-[1.02] disabled:opacity-50"
                >
                  {busy === f.key ? <Loader2 size={13} className="animate-spin" /> : <f.icon size={13} />}
                  {f.label}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Chips({ label, items, selected, onToggle }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold text-muted">{label}</span>
      {items.map((it) => (
        <button
          key={it}
          onClick={() => onToggle(it)}
          className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold transition-colors ${
            selected.includes(it)
              ? "border-transparent bg-artci-green/15 text-artci-green-700"
              : "border-border text-muted"
          }`}
        >
          {it}
        </button>
      ))}
    </span>
  );
}
