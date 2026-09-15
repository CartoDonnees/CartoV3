"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend, ReferenceLine,
} from "recharts";
import {
  Users, MapPinned, RadioTower, TrendingUp, History,
  BarChart3, Shapes, Search, CalendarClock, SignalZero, AlertTriangle,
  FileSpreadsheet, FileText, FileDown, Loader2,
  SlidersHorizontal, ChevronUp, RotateCcw, X,
} from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { getStats, getWhiteLocalityOps, ADMIN_LOADERS } from "@/lib/geodata";
import { computeRate } from "@/lib/coverage";
import { OPERATORS, TECHNOLOGIES, ADMIN_LIMITS } from "@/config/artci";
import { formatNumber, formatCompact, formatPercent, cn } from "@/lib/utils";
import { Card as Panel, Tile as Kpi, Loading, Note, SortHeader, Tabs, useTableSort, tooltipStyle } from "@/components/ui/kit";
import { NationalStatistics } from "@/components/dashboards/NationalStatistics";
import { WhiteAreaMap } from "@/components/dashboards/WhiteAreaMap";
import { StationsTab } from "@/components/dashboards/StationsTab";
import {
  WHITE_METRICS, DEFAULT_WHITE_METRIC, WHITE_OP_ORDER,
  isWhiteFor, whiteCount, whiteOperatorScope,
} from "@/lib/white-area-layer";
import { OperatorLogo } from "@/components/ui/OperatorLogo";
import { operatorFallback } from "@/lib/operators";
import { exportExcel, exportCsv, exportPdf } from "@/lib/export-data";
import { rgphFor, breakPoint, RGPH_NOTE } from "@/lib/rgph";

const TECH_COLOR = Object.fromEntries(TECHNOLOGIES.map((t) => [t.code, t.color]));
const OP_COLOR = Object.fromEntries(OPERATORS.map((o) => [o.code, o.color]));
const OP_SHORT = Object.fromEntries(OPERATORS.map((o) => [o.code, o.name.split(" ")[0]]));
const OPS = OPERATORS.map((o) => o.code);
const TECHS = TECHNOLOGIES.map((t) => t.code);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const NAME_PROP = { district: "ADM0_FR", region: "ADM1_FR", department: "ADM2_FR", subPrefecture: "ADM3_FR" };
const LEVEL_ORDER = ["district", "region", "department", "subPrefecture"];
/** Champ portant l'entité parente d'un niveau (vide pour le district). */
const parentProp = (level) => NAME_PROP[LEVEL_ORDER[LEVEL_ORDER.indexOf(level) - 1]] ?? null;

const shortPeriod = (d) => {
  const m = /^(\d{4})-(\d{2})/.exec(d || "");
  return m ? `${m[2] === "12" ? "S2" : "S1"} ${m[1].slice(2)}` : d;
};

const TABS = [
  { key: "national", label: "Statistiques nationales", icon: BarChart3 },
  { key: "history", label: "Historique des statistiques", icon: History },
  { key: "white", label: "Localités non couvertes", icon: SignalZero },
  { key: "stations", label: "Stations radioélectriques", icon: RadioTower },
  { key: "entities", label: "Par entité administrative", icon: Shapes },
];


/**
 * Corps du tableau de bord de couverture - partagé par la page publique et les
 * espaces admin / superviseur / opérateur (la version 2 déclinait les mêmes
 * vues par rôle). `operator` restreint l'affichage à un seul opérateur.
 */
export function CoverageDashboardBody({ date, onDateChange, operator = null }) {
  const [tab, setTab] = useState("national");
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState(null);
  const periods = useMapStore((s) => s.periods);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    setStats(null);
    getStats(date).then((d) => alive && setStats(d)).catch(() => alive && setStats(false));
    return () => { alive = false; };
  }, [date]);

  useEffect(() => {
    if (tab !== "history" || !periods?.length || history) return;
    let alive = true;
    Promise.all(
      periods.map((p) =>
        getStats(p.date)
          .then((d) => ({
            date: p.date, label: shortPeriod(p.date), rgph: rgphFor(p.date).label,
            Global: num(d.perPopCov), "2G": num(d.perPop2G), "3G": num(d.perPop3G), "4G": num(d.perPop4G),
            locCov: num(d.locCov), locNoCov: num(d.locNoCov), stations: num(d.nombrepresent),
            ...Object.fromEntries(OPS.map((o) => [OP_SHORT[o], num(d[`perPop${o}`])])),
          }))
          .catch(() => null),
      ),
    ).then((r) => alive && setHistory(r.filter(Boolean).sort((a, b) => (a.date < b.date ? -1 : 1))));
    return () => { alive = false; };
  }, [tab, periods, history]);

  return (
    <>
      <Tabs items={TABS} value={tab} onChange={setTab} className="mb-4" />

      {!stats ? (
        <Loading label="Chargement des indicateurs…" />
      ) : tab === "national" ? (
        <NationalStatistics
          stats={stats}
          date={date}
          periods={periods}
          onDateChange={onDateChange}
          operator={operator}
        />
      ) : tab === "history" ? (
        <HistoryTab history={history} operator={operator} />
      ) : tab === "white" ? (
        <WhiteTab date={date} stats={stats} />
      ) : tab === "stations" ? (
        <StationsTab date={date} />
      ) : (
        <EntitiesTab date={date} />
      )}
    </>
  );
}

/* ----------------------------- 2. Historique ---------------------------- */
function HistoryTab({ history, operator = null }) {
  const opsShown = operator ? OPS.filter((o) => o === operator) : OPS;
  if (!history) return <Loading label="Chargement de l'historique…" />;
  if (!history.length) return <p className="py-20 text-center text-sm text-muted">Historique indisponible.</p>;
  const first = history[0];
  const last = history[history.length - 1];
  // Comparaison honnête : on ne calcule l'évolution qu'à référentiel constant.
  const sameRef = history.filter((h) => h.rgph === last.rgph);
  const refStart = sameRef[0];
  const delta = num(last.Global) - num(refStart.Global);
  const brk = breakPoint(history.map((h) => h.date));
  const brkLabel = brk ? history.find((h) => h.date === brk)?.label : null;

  return (
    <div className="space-y-4">
      {brkLabel && (
        <Note icon={AlertTriangle}>{RGPH_NOTE}</Note>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={CalendarClock} value={history.length} label="Périodes publiées" hint={brkLabel ? `Rupture en ${brkLabel}` : null} />
        <Kpi icon={Users} value={formatPercent(first.Global)} label={`Couverture - ${first.label}`} hint={first.rgph} color="#94a3b8" />
        <Kpi icon={Users} value={formatPercent(last.Global)} label={`Couverture - ${last.label}`} hint={last.rgph} />
        <Kpi
          icon={TrendingUp}
          value={`${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pt`}
          label={sameRef.length > 1 ? `Évolution depuis ${refStart.label}` : "Évolution"}
          hint={`à référentiel constant (${last.rgph})`}
          color={delta >= 0 ? "var(--artci-green)" : "var(--uncovered)"}
        />
      </div>

      <Panel title="Couverture population - global et par technologie">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted)" }} width={40} />
            <Tooltip formatter={(v, n) => [formatPercent(v), n]} contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {brkLabel && (
              <ReferenceLine x={brkLabel} stroke="var(--artci-orange)" strokeDasharray="5 4"
                label={{ value: "Changement de référentiel", position: "top", fontSize: 9, fill: "var(--artci-orange)" }} />
            )}
            <Line type="monotone" dataKey="Global" stroke="var(--artci-green)" strokeWidth={2.5} dot={{ r: 2.5 }} />
            {TECHS.map((t) => <Line key={t} type="monotone" dataKey={t} stroke={TECH_COLOR[t]} strokeWidth={1.6} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Couverture population par opérateur">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted)" }} width={40} />
              <Tooltip formatter={(v, n) => [formatPercent(v), n]} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
                  {brkLabel && (
                    <ReferenceLine x={brkLabel} stroke="var(--artci-orange)" strokeDasharray="5 4"
                      label={{ value: "Changement de référentiel", position: "top", fontSize: 9, fill: "var(--artci-orange)" }} />
                  )}
              {opsShown.map((o) => <Line key={o} type="monotone" dataKey={OP_SHORT[o]} stroke={OP_COLOR[o]} strokeWidth={2} dot={{ r: 2 }} />)}
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Localités couvertes / non couvertes et stations">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={history} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted)" }} width={48} />
              <Tooltip formatter={(v, n) => [formatNumber(v), n === "locCov" ? "Couvertes" : n === "locNoCov" ? "Non couvertes" : "Stations"]} contentStyle={tooltipStyle} />
              <Legend formatter={(v) => (v === "locCov" ? "Couvertes" : v === "locNoCov" ? "Non couvertes" : "Stations")} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="locCov" fill="var(--artci-green)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="locNoCov" fill="var(--uncovered)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="stations" fill="#f47b20" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------- 3. Localités non couvertes (zones blanches) -------- */

/** Colonnes du tableau des localités non couvertes. */
const WHITE_COLS = [
  { key: "name", label: "Localité", align: "left" },
  { key: "subPrefecture", label: "Sous-préfecture", align: "left" },
  { key: "department", label: "Département", align: "left" },
  { key: "district", label: "District", align: "left" },
  { key: "pop", label: "Population", fmt: formatNumber },
];

/** Lignes d'export (mêmes intitulés que les autres exports de l'application). */
const whiteExportRows = (rows) =>
  rows.map((r) => ({
    LOCALITE: r.name,
    "SOUS-PREFECTURE": r.subPrefecture,
    DEPARTEMENT: r.department,
    REGION: r.region,
    DISTRICT: r.district,
    POPULATION: r.pop,
    LATITUDE: r.lat,
    LONGITUDE: r.lng,
  }));

function WhiteTab({ date, stats }) {
  const [white, setWhite] = useState(null);
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  // Choroplèthe des zones blanches : district par défaut, lecture par localités.
  const [choroLevel, setChoroLevel] = useState("district");
  const [choroMetric, setChoroMetric] = useState(DEFAULT_WHITE_METRIC);
  /* Opérateurs retenus : une localité est « zone blanche » quand AUCUN d'eux
     ne la dessert. Les trois cochés donnent la zone blanche au sens usuel. */
  const [operators, setOperators] = useState(WHITE_OP_ORDER);
  const [busy, setBusy] = useState(null);
  const [exportError, setExportError] = useState(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    setWhite(null);
    getWhiteLocalityOps(date)
      .then((d) => alive && setWhite(d.features || []))
      .catch(() => alive && setWhite([]));
    return () => { alive = false; };
  }, [date]);

  /** Localités mises à plat, prêtes pour le tri, la recherche et l'export. */
  const localities = useMemo(
    () =>
      (white ?? [])
        .filter((f) => isWhiteFor(f.properties?.covMask, operators))
        .map((f) => {
        const p = f.properties || {};
        return {
          id: f.id,
          name: p.ADM4_FR ?? "-",
          subPrefecture: p.ADM3_FR ?? "",
          department: p.ADM2_FR ?? "",
          region: p.ADM1_FR ?? "",
          district: p.ADM0_FR ?? "",
          pop: num(p.pop ?? p.score),
          lat: num(p.centerLat),
          lng: num(p.centerLng),
        };
      }),
    [white, operators],
  );

  const districts = useMemo(
    () => [...new Set(localities.map((r) => r.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [localities],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return localities.filter(
      (r) =>
        (!district || r.district === district) &&
        (!q || [r.name, r.subPrefecture, r.department].some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [localities, query, district]);

  const { rows, sort, toggleSort } = useTableSort(filtered, { initial: { key: "pop", dir: "desc" } });

  /** La carte ne montre que les localités retenues par les filtres. */
  const mapData = useMemo(() => {
    if (!white) return null;
    const keep = new Set(filtered.map((r) => r.id));
    return { type: "FeatureCollection", features: white.filter((f) => keep.has(f.id)) };
  }, [white, filtered]);

  const toggleOperator = (op) =>
    setOperators((cur) => (cur.includes(op) ? cur.filter((o) => o !== op) : [...cur, op]));

  const filtersTouched =
    operators.length !== WHITE_OP_ORDER.length ||
    district !== "" || query !== "" ||
    choroLevel !== "district" || choroMetric !== DEFAULT_WHITE_METRIC;

  const resetFilters = () => {
    setOperators(WHITE_OP_ORDER);
    setDistrict("");
    setQuery("");
    setChoroLevel("district");
    setChoroMetric(DEFAULT_WHITE_METRIC);
    setSelectedId(null);
  };

  /* Une sélection écartée par un filtre (ou par un changement de période)
     cesse d'exister : la validité se déduit, elle n'est pas mémorisée. */
  const activeId = selectedId != null && filtered.some((r) => r.id === selectedId) ? selectedId : null;

  // Sélection venue de la carte : on amène la ligne correspondante à l'écran.
  useEffect(() => {
    if (activeId == null || !bodyRef.current) return;
    bodyRef.current
      .querySelector(`[data-row-id="${activeId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  const filteredPop = useMemo(() => filtered.reduce((s, r) => s + r.pop, 0), [filtered]);

  const byDistrict = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const k = r.district || "-";
      const cur = map.get(k) || { name: k, count: 0, pop: 0 };
      cur.count += 1;
      cur.pop += r.pop;
      map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [filtered]);

  /** Exports du tableau filtré et trié (Excel, CSV, PDF). */
  const runExport = async (kind) => {
    setExportError(null);
    setBusy(kind);
    try {
      const data = whiteExportRows(rows);
      const columns = Object.keys(data[0] ?? {});
      const base = `localites_non_couvertes_${date}`;
      if (kind === "xlsx") await exportExcel(data, columns, base, "Localités non couvertes");
      else if (kind === "csv") exportCsv(data, columns, base);
      else
        await exportPdf(
          data, columns, base,
          "Localités non couvertes",
          `Période du ${date}${whiteOperatorScope(operators)}${district ? ` · district de ${district}` : ""} · ${formatNumber(rows.length)} localités`,
        );
    } catch (e) {
      setExportError(e?.message || "Export impossible.");
    } finally {
      setBusy(null);
    }
  };

  const whiteLoc = white ? filtered.length : null;
  const allOperators = operators.length === WHITE_OP_ORDER.length;
  /* Les parts nationales sont lues dans l'agrégat correspondant à la sélection :
     avec un seul opérateur, « non couvert » ne désigne plus le même ensemble.
     La variation d'un semestre à l'autre, elle, n'est publiée que pour la zone
     blanche absolue - on ne l'affiche donc pas sur une sélection partielle. */
  const natLoc = whiteCount(stats, "locality", operators);
  const natPop = whiteCount(stats, "population", operators);
  const partLoc = stats.locs ? (natLoc / stats.locs) * 100 : 0;
  const partPop = stats.pop ? (natPop / stats.pop) * 100 : 0;

  /* Les filtres sont posés SUR la carte : ils agissent sur elle, ils doivent
     être là où le regard se trouve déjà. */
  const filterPanel = (
    <WhiteFilters
      operators={operators}
      onToggleOperator={toggleOperator}
      onAllOperators={() => setOperators(WHITE_OP_ORDER)}
      choroLevel={choroLevel}
      setChoroLevel={setChoroLevel}
      choroMetric={choroMetric}
      setChoroMetric={setChoroMetric}
      district={district}
      setDistrict={setDistrict}
      districts={districts}
      query={query}
      setQuery={setQuery}
      onReset={resetFilters}
      touched={filtersTouched}
      counts={{ shown: rows.length, pop: filteredPop }}
    />
  );

  return (
    <div className="space-y-4">
      {/* Indicateurs de la version 2 : localités et population, totales et non couvertes. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={MapPinned} value={formatNumber(stats.locs)} label="Total localités" color="#3b82f6" />
        <Kpi
          icon={SignalZero}
          value={whiteLoc == null ? "…" : formatNumber(whiteLoc)}
          label="Localités non couvertes"
          hint={`${formatPercent(partLoc)} du parc${allOperators ? ` · ${trendLabel(stats.varWhiteLoc)}` : whiteOperatorScope(operators)}`}
          color="var(--uncovered)"
        />
        <Kpi icon={Users} value={formatCompact(stats.pop)} label="Total population" color="#8b5cf6" />
        <Kpi
          icon={Users}
          value={white ? formatCompact(filteredPop) : "…"}
          label="Population non couverte"
          hint={`${formatPercent(partPop)} de la population${allOperators ? ` · ${trendLabel(stats.varWhitePop)}` : whiteOperatorScope(operators)}`}
          color="#f47b20"
        />
      </div>

      {!white ? (
        <Loading label="Chargement des zones blanches…" />
      ) : (
        <>
          {/* La carte est la pièce maîtresse de la section : pleine largeur,
              haute, et portant ses propres filtres. Le tableau la suit,
              synchronisé dans les deux sens - sélectionner une ligne cible la
              carte, cliquer un cercle met la ligne en évidence. */}
          <Panel
            title="Localités non couvertes"
            hint={
              allOperators
                ? "Cercles : population privée de réseau · choroplèthe : poids des zones blanches dans l'entité"
                : `Localités que ${operators.join(", ") || "—"} ne dessert${operators.length > 1 ? "ent" : ""} pas`
            }
            className="flex flex-col"
          >
            <div className="h-[clamp(520px,70vh,860px)]">
              <WhiteAreaMap
                data={mapData}
                selectedId={activeId}
                onSelect={setSelectedId}
                date={date}
                choroLevel={choroLevel}
                choroMetric={choroMetric}
                operators={operators}
                controls={filterPanel}
              />
            </div>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              title="Localités sans aucune couverture"
              hint={`${formatNumber(rows.length)} localité(s) · ${formatCompact(filteredPop)} habitants · cliquez une ligne pour la localiser`}
              actions={
                <div className="flex flex-wrap items-center gap-1.5">
                  <ExportButton icon={FileSpreadsheet} label="Excel" busy={busy === "xlsx"} onClick={() => runExport("xlsx")} />
                  <ExportButton icon={FileText} label="CSV" busy={busy === "csv"} onClick={() => runExport("csv")} />
                  <ExportButton icon={FileDown} label="PDF" busy={busy === "pdf"} onClick={() => runExport("pdf")} />
                </div>
              }
            >
              {exportError && <p className="mb-2 text-[11px] font-semibold text-uncovered">{exportError}</p>}

              <div ref={bodyRef} className="max-h-[430px] overflow-auto rounded-xl border border-border/60">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {WHITE_COLS.map((c) => (
                        <SortHeader
                          key={c.key}
                          label={c.label}
                          sortKey={c.key}
                          sort={sort}
                          onSort={toggleSort}
                          align={c.align === "left" ? "left" : "right"}
                          className="whitespace-nowrap border-b border-border bg-surface px-2 py-2 font-bold text-muted"
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        data-row-id={r.id}
                        onClick={() => setSelectedId((cur) => (cur === r.id ? null : r.id))}
                        className={`cursor-pointer transition-colors ${
                          r.id === activeId ? "bg-artci-green/15" : "odd:bg-surface-2/40 hover:bg-surface-2"
                        }`}
                      >
                        {WHITE_COLS.map((c) => (
                          <td
                            key={c.key}
                            className={`whitespace-nowrap border-b border-border/40 px-2 py-1.5 ${
                              c.align === "left" ? "font-semibold" : "text-right tabular-nums"
                            } ${c.key !== "name" && c.align === "left" ? "font-normal text-muted" : ""}`}
                          >
                            {c.fmt ? c.fmt(r[c.key]) : r[c.key] || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={WHITE_COLS.length} className="px-2 py-10 text-center text-muted">
                          {!operators.length
                            ? "Cochez au moins un opérateur."
                            : `Aucune localité ne correspond à ces filtres${whiteOperatorScope(operators)}.`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Par district" hint="Localités sans aucune couverture">
              {byDistrict.length === 0 ? (
                <p className="py-10 text-center text-[12px] text-muted">Rien à représenter.</p>
              ) : (
              <ResponsiveContainer width="100%" height={Math.max(240, byDistrict.length * 26)}>
                <BarChart data={byDistrict} layout="vertical" margin={{ left: 4, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                  <YAxis type="category" dataKey="name" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                  <Tooltip formatter={(v, n) => [formatNumber(v), n === "count" ? "Localités" : "Population"]} contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="var(--uncovered)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Évolution d'un semestre à l'autre. Pour une zone blanche, un recul est un
 * progrès : le sens est donc explicité par les mots, jamais par la seule flèche.
 */
function trendLabel(variation) {
  const v = Number(variation);
  if (!Number.isFinite(v) || v === 0) return "stable";
  return `${v < 0 ? "recul" : "hausse"} de ${Math.abs(v).toFixed(1)} %`;
}

/**
 * Panneau de filtres posé sur la carte des zones blanches.
 *
 * Repliable : sur un écran étroit, ou pour lire la carte sans obstacle, il se
 * réduit à un bouton portant une pastille quand des filtres sont actifs.
 */
function WhiteFilters({
  operators, onToggleOperator, onAllOperators,
  choroLevel, setChoroLevel, choroMetric, setChoroMetric,
  district, setDistrict, districts, query, setQuery,
  onReset, touched, counts,
}) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-border bg-surface/95 px-2.5 py-1.5 text-[11px] font-bold shadow-sm backdrop-blur transition-colors hover:bg-surface-2"
      >
        <SlidersHorizontal size={13} className="text-muted" />
        Filtres
        {touched && <span className="h-1.5 w-1.5 rounded-full bg-artci-green" />}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface/97 p-2.5 shadow-md backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
          <SlidersHorizontal size={12} />
          Filtres
        </span>
        <div className="flex items-center gap-1">
          {touched && (
            <button
              type="button"
              onClick={onReset}
              title="Réinitialiser les filtres"
              className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-bold text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <RotateCcw size={11} />
              Réinitialiser
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Replier les filtres"
            className="grid h-5 w-5 place-items-center rounded-md text-muted hover:bg-surface-2"
          >
            <ChevronUp size={12} />
          </button>
        </div>
      </div>

      {/* Opérateurs : ils définissent ce qu'est une zone blanche. */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[9.5px] font-bold uppercase tracking-wide text-muted">
            Non couvertes par
          </span>
          {operators.length !== WHITE_OP_ORDER.length && (
            <button
              type="button"
              onClick={onAllOperators}
              className="text-[9.5px] font-bold text-artci-green-700 hover:underline"
            >
              tous
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {WHITE_OP_ORDER.map((op) => (
            <OperatorCheck
              key={op}
              op={op}
              checked={operators.includes(op)}
              onChange={() => onToggleOperator(op)}
            />
          ))}
        </div>
        {!operators.length && (
          <p className="mt-1.5 text-[10px] font-semibold text-uncovered">
            Sans opérateur de référence, il n&apos;y a pas de zone blanche à mesurer.
          </p>
        )}
      </div>

      {/* Choroplèthe : découpage puis lecture. */}
      <div className="mb-2">
        <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wide text-muted">
          Choroplèthe
        </span>
        <select
          value={choroLevel ?? ""}
          onChange={(e) => setChoroLevel(e.target.value || null)}
          className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-[11.5px] font-bold text-foreground outline-none focus:border-artci-green"
        >
          <option value="">Aucun</option>
          {ADMIN_LIMITS.map((l) => (
            <option key={l.key} value={l.key}>{l.label}</option>
          ))}
        </select>
        <div
          className={cn(
            "mt-1 flex gap-1 rounded-lg bg-surface-2/70 p-1 transition-opacity",
            !choroLevel && "pointer-events-none opacity-40",
          )}
        >
          {WHITE_METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setChoroMetric(m.key)}
              aria-pressed={choroMetric === m.key}
              title={`Part de ${m.legend}`}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-[11px] font-bold transition-colors",
                choroMetric === m.key ? "brand-gradient text-white shadow-sm" : "text-muted hover:bg-surface-2",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2">
        <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wide text-muted">District</span>
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-[11.5px] font-bold outline-none focus:border-artci-green"
        >
          <option value="">Tous les districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 focus-within:border-artci-green">
        <Search size={13} className="shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une localité…"
          className="w-full bg-transparent text-[11.5px] outline-none placeholder:text-muted"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Effacer" className="shrink-0 text-muted hover:text-foreground">
            <X size={12} />
          </button>
        )}
      </label>

      <div className="mt-2 border-t border-border/60 pt-1.5 text-[10px] font-semibold text-muted">
        {formatNumber(counts.shown)} localité(s) · {formatCompact(counts.pop)} habitants
      </div>
    </div>
  );
}

/** Case à cocher d'un opérateur, logo compris. */
function OperatorCheck({ op, checked, onChange }) {
  const info = operatorFallback(op) ?? { code: op, name: op };
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-bold">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 accent-artci-green"
      />
      <OperatorLogo operator={info} size={18} dim={!checked} />
      <span className={cn(!checked && "text-muted")}>{info.name}</span>
    </label>
  );
}

/** Bouton d'export du tableau (état occupé pendant la génération du fichier). */
function ExportButton({ icon: Icon, label, busy, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-[11px] font-bold transition-colors hover:bg-surface-2 disabled:opacity-60"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} className="text-muted" />}
      {label}
    </button>
  );
}

/* ------------------- 4. Statistiques par entité administrative ---------- */
function EntitiesTab({ date }) {
  const [level, setLevel] = useState("district");
  const [areas, setAreas] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!date) return;
    let alive = true;
    setAreas(null);
    (ADMIN_LOADERS[level] || ADMIN_LOADERS.district)(date)
      .then((d) => alive && setAreas(d.features || []))
      .catch(() => alive && setAreas([]));
    return () => { alive = false; };
  }, [date, level]);

  const filtered = useMemo(() => {
    if (!areas?.length) return [];
    const nameProp = NAME_PROP[level];
    const q = query.trim().toLowerCase();
    const list = areas.map((f) => {
      const p = f.properties;
      return {
        name: p[nameProp],
        parent: parentProp(level) ? p[parentProp(level)] : "",
        pop: num(p.pop),
        locs: num(p.locs),
        locCov: num(p.locCov),
        perLocCov: num(p.perLocCov),
        perPopCov: num(p.perPopCov),
        stations: num(p.nombrepresent),
        rate: computeRate(p, OPS, TECHS),
      };
    });
    return q ? list.filter((r) => [r.name, r.parent].some((v) => String(v ?? "").toLowerCase().includes(q))) : list;
  }, [areas, level, query]);

  const { rows, sort, toggleSort } = useTableSort(filtered, { initial: { key: "rate", dir: "desc" } });

  const totals = useMemo(
    () => rows.reduce((a, r) => ({ pop: a.pop + r.pop, locs: a.locs + r.locs, locCov: a.locCov + r.locCov, stations: a.stations + r.stations }), { pop: 0, locs: 0, locCov: 0, stations: 0 }),
    [rows],
  );

  const COLS = [
    { key: "name", label: "Nom", align: "left" },
    ...(level !== "district" ? [{ key: "parent", label: "Rattachement", align: "left" }] : []),
    { key: "pop", label: "Population", fmt: formatNumber },
    { key: "locs", label: "Localités", fmt: formatNumber },
    { key: "locCov", label: "Couvertes", fmt: formatNumber },
    { key: "perLocCov", label: "% localités", fmt: formatPercent },
    { key: "perPopCov", label: "% population", fmt: formatPercent },
    { key: "stations", label: "Stations", fmt: formatNumber },
    { key: "rate", label: "Taux global", fmt: formatPercent },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs items={ADMIN_LIMITS} value={level} onChange={setLevel} />
        <label className="ml-auto flex min-w-[220px] items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 focus-within:border-artci-green">
          <Search size={14} className="text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" className="w-full bg-transparent text-sm outline-none placeholder:text-muted" />
        </label>
      </div>

      {!areas ? (
        <Loading label="Chargement des entités…" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={Shapes} value={formatNumber(rows.length)} label={ADMIN_LIMITS.find((l) => l.key === level)?.label} />
            <Kpi icon={Users} value={formatCompact(totals.pop)} label="Population cumulée" color="#3b82f6" />
            <Kpi icon={MapPinned} value={`${formatNumber(totals.locCov)} / ${formatNumber(totals.locs)}`} label="Localités couvertes" />
            <Kpi icon={RadioTower} value={formatNumber(totals.stations)} label="Stations" color="#f47b20" />
          </div>

          <Panel title="Détail par entité" hint="Cliquez sur un en-tête pour trier">
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {COLS.map((c) => (
                      <SortHeader
                        key={c.key}
                        label={c.label}
                        sortKey={c.key}
                        sort={sort}
                        onSort={toggleSort}
                        align={c.align === "left" ? "left" : "right"}
                        className="whitespace-nowrap border-b border-border bg-surface px-2 py-2 font-bold text-muted"
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.name}-${i}`} className="odd:bg-surface-2/40">
                      {COLS.map((c) => (
                        <td
                          key={c.key}
                          className={`whitespace-nowrap border-b border-border/40 px-2 py-1.5 ${
                            c.align === "left" ? "font-semibold" : "text-right tabular-nums"
                          } ${c.key === "parent" ? "font-normal text-muted" : ""}`}
                        >
                          {c.fmt ? c.fmt(r[c.key]) : r[c.key] || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

/* ------------------------------- Communs -------------------------------- */
