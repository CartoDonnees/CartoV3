"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend, ReferenceLine,
} from "recharts";
import {
  Users, MapPinned, RadioTower, TrendingUp, History,
  BarChart3, Shapes, Search, CalendarClock, SignalZero, AlertTriangle,
} from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { getStats, getWhiteLocalities, ADMIN_LOADERS } from "@/lib/geodata";
import { computeRate } from "@/lib/coverage";
import { OPERATORS, TECHNOLOGIES, ADMIN_LIMITS } from "@/config/artci";
import { formatNumber, formatCompact, formatPercent } from "@/lib/utils";
import { Card as Panel, Tile as Kpi, Loading, Note, SortHeader, Tabs, useTableSort, tooltipStyle } from "@/components/ui/kit";
import { NationalStatistics } from "@/components/dashboards/NationalStatistics";
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
  { key: "entities", label: "Par entité administrative", icon: Shapes },
];


/**
 * Corps du tableau de bord de couverture — partagé par la page publique et les
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
        <Kpi icon={Users} value={formatPercent(first.Global)} label={`Couverture — ${first.label}`} hint={first.rgph} color="#94a3b8" />
        <Kpi icon={Users} value={formatPercent(last.Global)} label={`Couverture — ${last.label}`} hint={last.rgph} />
        <Kpi
          icon={TrendingUp}
          value={`${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pt`}
          label={sameRef.length > 1 ? `Évolution depuis ${refStart.label}` : "Évolution"}
          hint={`à référentiel constant (${last.rgph})`}
          color={delta >= 0 ? "var(--artci-green)" : "var(--uncovered)"}
        />
      </div>

      <Panel title="Couverture population — global et par technologie">
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
function WhiteTab({ date, stats }) {
  const [white, setWhite] = useState(null);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    setWhite(null);
    getWhiteLocalities(date).then((d) => alive && setWhite(d.features || [])).catch(() => alive && setWhite([]));
    return () => { alive = false; };
  }, [date]);

  const byDistrict = useMemo(() => {
    if (!white?.length) return [];
    const map = new Map();
    for (const f of white) {
      const k = f.properties?.ADM0_FR || "—";
      const cur = map.get(k) || { name: k, count: 0, pop: 0 };
      cur.count += 1;
      cur.pop += Number(f.properties?.pop) || 0;
      map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [white]);

  const whitePop = useMemo(() => byDistrict.reduce((s, d) => s + d.pop, 0), [byDistrict]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={SignalZero} value={white ? formatNumber(white.length) : "…"} label="Localités sans couverture" color="var(--uncovered)" />
        <Kpi icon={Users} value={white ? formatCompact(whitePop) : "…"} label="Population concernée" color="#f47b20" />
        <Kpi icon={MapPinned} value={formatNumber(stats.locNoCov)} label="Non couvertes (national)" />
        <Kpi icon={Users} value={formatPercent(stats.perPopNoCov)} label="Part de population non couverte" />
      </div>

      {!white ? (
        <Loading label="Chargement des zones blanches…" />
      ) : white.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">Aucune zone blanche pour cette période.</p>
      ) : (
        <Panel title="Zones blanches par district" hint="Nombre de localités sans aucune couverture et population concernée">
          <ResponsiveContainer width="100%" height={Math.max(240, byDistrict.length * 26)}>
            <BarChart data={byDistrict} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: "var(--muted)" }} />
              <Tooltip formatter={(v, n) => [formatNumber(v), n === "count" ? "Localités" : "Population"]} contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--uncovered)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}
    </div>
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
                          {c.fmt ? c.fmt(r[c.key]) : r[c.key] || "—"}
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
