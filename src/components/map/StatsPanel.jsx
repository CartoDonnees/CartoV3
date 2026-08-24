"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, X, Users, MapPinned, RadioTower, TrendingUp, Signal, CalendarClock, ChevronLeft } from "lucide-react";
import {
  Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import { useMapStore, periodLabel } from "@/stores/map-store";
import { formatNumber, formatCompact, formatPercent } from "@/lib/utils";
import { getStats } from "@/lib/geodata";
import { OPERATORS, TECHNOLOGIES } from "@/config/artci";
import { rgphFor, breakPoint, RGPH_NOTE } from "@/lib/rgph";
import { Tabs } from "@/components/ui/kit";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const TECHS = TECHNOLOGIES.map((t) => ({ code: t.code, color: t.color }));
const OPS = ["ORANGE", "MTN", "MOOV"].map((c) => OPERATORS.find((o) => o.code === c)).filter(Boolean);

/** Étiquette courte de période pour l'axe historique : 2025-06-30 → "S1 25". */
function shortPeriod(date) {
  const m = /^(\d{4})-(\d{2})/.exec(date || "");
  if (!m) return date;
  return `${m[2] === "12" ? "S2" : "S1"} ${m[1].slice(2)}`;
}

const TABS = [
  { key: "overview", label: "Aperçu" },
  { key: "tech", label: "Technologies" },
  { key: "operators", label: "Opérateurs" },
  { key: "history", label: "Historique" },
];

/** Normalise les propriétés d'une entité cliquée en objet de stats (champs manquants dérivés). */
function entityStats(props) {
  const p = { ...props };
  const pop = num(p.pop);
  const perPopCov = num(p.perPopCov);
  const locs = num(p.locs);
  const locCov = num(p.locCov);
  return {
    ...p,
    pop,
    locs,
    locCov,
    nombrepresent: num(p.nombrepresent),
    locForecast: num(p.locForecast),
    perPopCov,
    perLocCov: num(p.perLocCov),
    locNoCov: p.locNoCov != null ? num(p.locNoCov) : Math.max(0, locs - locCov),
    perPopNoCov: p.perPopNoCov != null ? num(p.perPopNoCov) : Math.max(0, 100 - perPopCov),
    popNoCov: p.popNoCov != null ? num(p.popNoCov) : Math.round((pop * (100 - perPopCov)) / 100),
  };
}

export function StatsPanel() {
  const { statsOpen, toggleStats, periodDate, periods, selectedEntity, setSelectedEntity } = useMapStore();
  const period = periodLabel(periodDate);
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(null);

  // Statistiques affichées : entité cliquée (si sélectionnée) sinon national.
  const isEntity = !!selectedEntity;
  const entity = useMemo(() => (selectedEntity ? entityStats(selectedEntity.props) : null), [selectedEntity]);
  const shown = isEntity ? entity : stats;
  const tabsList = isEntity ? TABS.filter((t) => t.key !== "history") : TABS; // historique = national uniquement
  const curTab = isEntity && tab === "history" ? "overview" : tab;

  // Statistiques de la période courante (synchronisées).
  useEffect(() => {
    if (!statsOpen) return;
    let alive = true;
    setLoading(true);
    getStats(periodDate)
      .then((d) => alive && setStats(d))
      .catch(() => alive && setStats(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [periodDate, statsOpen]);

  // Historique multi-périodes (chargé à l'ouverture de l'onglet).
  useEffect(() => {
    if (!statsOpen || tab !== "history" || history || !periods?.length) return;
    let alive = true;
    Promise.all(
      periods.map((p) =>
        getStats(p.date)
          .then((d) => ({ date: p.date, label: shortPeriod(p.date), rgph: rgphFor(p.date).label, cov: num(d.perPopCov), "2G": num(d.perPop2G), "3G": num(d.perPop3G), "4G": num(d.perPop4G) }))
          .catch(() => null),
      ),
    ).then((rows) => {
      if (!alive) return;
      setHistory(rows.filter(Boolean).sort((a, b) => (a.date < b.date ? -1 : 1)));
    });
    return () => { alive = false; };
  }, [statsOpen, tab, history, periods]);

  return (
    <AnimatePresence>
      {statsOpen && (
        <motion.aside
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto absolute bottom-3 right-3 top-[76px] z-20 flex w-[348px] max-w-[calc(100vw-1.5rem)] flex-col"
        >
          <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
            {/* En-tête */}
            <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3.5">
              {isEntity ? (
                <button onClick={() => setSelectedEntity(null)} title="Revenir aux statistiques nationales" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-2">
                  <ChevronLeft size={17} className="text-artci-green-700" />
                </button>
              ) : (
                <BarChart3 size={16} className="text-artci-green-700" />
              )}
              <div className="min-w-0 flex-1">
                <h5 className="truncate text-sm font-bold leading-tight">{isEntity ? selectedEntity.name : "Statistiques nationales"}</h5>
                <p className="text-[11px] text-muted">{isEntity ? `${selectedEntity.level} · ${period}` : `Données au ${period}`}</p>
              </div>
              <button onClick={toggleStats} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-2" aria-label="Fermer">
                <X size={15} />
              </button>
            </div>

            {/* Onglets */}
            <Tabs
              items={tabsList}
              value={curTab}
              onChange={setTab}
              variant="segment"
              className="border-b border-border/60 px-3 py-2"
            />

            {/* Contenu */}
            <div className="flex-1 overflow-y-auto p-4">
              {!isEntity && loading && !stats ? (
                <Skeleton />
              ) : !shown ? (
                <p className="py-10 text-center text-sm text-muted">Statistiques indisponibles pour cette période.</p>
              ) : curTab === "overview" ? (
                <Overview s={shown} />
              ) : curTab === "tech" ? (
                <TechTab s={shown} />
              ) : curTab === "operators" ? (
                <OperatorsTab s={shown} />
              ) : (
                <HistoryTab history={history} />
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------- Aperçu -------------------------------- */
function Overview({ s }) {
  const kpis = [
    { icon: Users, label: "Population", value: formatCompact(s.pop) },
    { icon: MapPinned, label: "Localités", value: formatNumber(s.locs) },
    { icon: MapPinned, label: "Couvertes", value: formatNumber(s.locCov), tone: "green" },
    { icon: MapPinned, label: "Non couvertes", value: formatNumber(s.locNoCov), tone: "red" },
    { icon: RadioTower, label: "Stations", value: formatNumber(s.nombrepresent) },
    { icon: CalendarClock, label: "Prévisionnel", value: formatNumber(s.locForecast) },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl bg-surface/60 p-2.5">
            <k.icon size={13} className={k.tone === "green" ? "text-artci-green-700" : k.tone === "red" ? "text-uncovered" : "text-muted"} />
            <div className="mt-1 text-base font-extrabold leading-none tracking-tight">{k.value}</div>
            <div className="mt-1 text-[10px] font-medium leading-tight text-muted">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl brand-gradient p-4 text-white">
        <div className="flex items-center gap-1.5 text-xs font-medium opacity-90">
          <Users size={13} /> Taux de couverture population
        </div>
        <div className="mt-1 text-3xl font-extrabold tracking-tight">{formatPercent(s.perPopCov)}</div>
        <div className="mt-1 text-[11px] opacity-90">
          {formatCompact(s.popNoCov)} personnes non couvertes ({formatPercent(s.perPopNoCov)})
        </div>
      </div>

      <div className="rounded-xl bg-surface/60 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted">Couverture des localités</span>
          <span className="text-sm font-extrabold text-artci-green-700">{formatPercent(s.perLocCov)}</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-artci-green" style={{ width: `${Math.min(100, num(s.perLocCov))}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Technologies ---------------------------- */
function TechTab({ s }) {
  const popData = TECHS.map((t) => ({ tech: t.code, value: num(s[`perPop${t.code}`]), color: t.color }));
  const locData = TECHS.map((t) => ({ tech: t.code, value: num(s[`perCov${t.code}`]), color: t.color }));
  const stationData = TECHS.map((t) => ({ tech: t.code, value: num(s[`present${t.code}`]), color: t.color }));

  return (
    <div className="space-y-4">
      <PercentBars title="Population couverte par technologie" icon={TrendingUp} data={popData} />
      <PercentBars title="Localités couvertes par technologie" icon={MapPinned} data={locData} />
      <CountBars title="Stations par technologie" icon={Signal} data={stationData} />
      <div className="rounded-xl bg-surface/60 p-3">
        <div className="mb-2 text-xs font-semibold text-muted">Prévisionnel (localités) par technologie</div>
        <div className="grid grid-cols-3 gap-2">
          {TECHS.map((t) => (
            <div key={t.code} className="rounded-lg bg-surface/70 p-2 text-center">
              <div className="text-sm font-extrabold" style={{ color: t.color }}>{formatNumber(num(s[`forecast${t.code}`]))}</div>
              <div className="text-[10px] font-bold text-muted">{t.code}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Opérateurs ----------------------------- */
function OperatorsTab({ s }) {
  const popData = OPS.map((o) => ({ op: o.name.split(" ")[0], value: num(s[`perPop${o.code}`]), color: o.color }));
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface/60 p-4">
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted">
          <Users size={13} /> Couverture population par opérateur
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={popData} barCategoryGap={22}>
            <XAxis dataKey="op" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: "var(--muted)" }} />
            <Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} formatter={(v) => [formatPercent(v), "Couverture"]} contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {popData.map((d) => <Cell key={d.op} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Détail opérateur × technologie */}
      <div className="overflow-hidden rounded-xl bg-surface/60">
        <div className="px-3 pt-3 text-xs font-semibold text-muted">Couverture population (%) par opérateur et technologie</div>
        <table className="mt-2 w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted">
              <th className="px-3 py-1.5 text-left font-bold">Opérateur</th>
              {TECHS.map((t) => <th key={t.code} className="px-1 py-1.5 text-right font-bold">{t.code}</th>)}
            </tr>
          </thead>
          <tbody>
            {OPS.map((o) => (
              <tr key={o.code} className="border-t border-border/50">
                <td className="px-3 py-1.5 font-bold">
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: o.color }} />
                  {o.name.split(" ")[0]}
                </td>
                {TECHS.map((t) => (
                  <td key={t.code} className="px-1 py-1.5 text-right font-semibold tabular-nums">
                    {formatPercent(num(s[`perPop${o.code}${t.code}`]))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------ Historique ----------------------------- */
function HistoryTab({ history }) {
  if (!history) return <Skeleton />;
  if (!history.length) return <p className="py-10 text-center text-sm text-muted">Historique indisponible.</p>;
  const brk = breakPoint(history.map((h) => h.date));
  const brkLabel = brk ? history.find((h) => h.date === brk)?.label : null;
  return (
    <div className="space-y-4">
      {brkLabel && (
        <p className="rounded-xl border border-artci-orange/35 bg-artci-orange/10 px-3 py-2 text-[10.5px] leading-relaxed text-foreground/85">
          {RGPH_NOTE}
        </p>
      )}
      <div className="rounded-xl bg-surface/60 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
          <TrendingUp size={13} /> Évolution de la couverture population
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={history} margin={{ top: 5, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted)" }} />
            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted)" }} width={30} />
            <Tooltip formatter={(v, n) => [formatPercent(v), n === "cov" ? "Global" : n]} contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "cov" ? "Global" : v)} />
            {brkLabel && (
              <ReferenceLine x={brkLabel} stroke="var(--artci-orange)" strokeDasharray="4 3" />
            )}
            <Line type="monotone" dataKey="cov" stroke="var(--artci-green)" strokeWidth={2.5} dot={{ r: 2 }} />
            {TECHS.map((t) => (
              <Line key={t.code} type="monotone" dataKey={t.code} stroke={t.color} strokeWidth={1.6} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="px-1 text-[11px] text-muted">
        Taux de couverture population (global et par technologie) sur les {history.length} dernières périodes semestrielles.
      </p>
    </div>
  );
}

/* ------------------------------- Communs ------------------------------- */
const tooltipStyle = { borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, background: "var(--surface)" };

function PercentBars({ title, icon: Icon, data }) {
  return (
    <div className="rounded-xl bg-surface/60 p-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon size={13} /> {title}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barCategoryGap={26}>
          <XAxis dataKey="tech" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: "var(--muted)" }} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} formatter={(v) => [formatPercent(v), "Couverture"]} contentStyle={tooltipStyle} />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((d) => <Cell key={d.tech} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CountBars({ title, icon: Icon, data }) {
  return (
    <div className="rounded-xl bg-surface/60 p-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon size={13} /> {title}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barCategoryGap={26}>
          <XAxis dataKey="tech" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: "var(--muted)" }} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} formatter={(v) => [formatNumber(v), "Stations"]} contentStyle={tooltipStyle} />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((d) => <Cell key={d.tech} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-2" />)}
      </div>
      <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
      <div className="h-36 animate-pulse rounded-xl bg-surface-2" />
    </div>
  );
}
