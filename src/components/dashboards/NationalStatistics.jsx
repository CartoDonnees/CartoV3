"use client";

import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  CalendarRange, MapPin, MapPinned, RadioTower, TowerControl, Users, UsersRound,
} from "lucide-react";
import { OPERATORS, TECHNOLOGIES } from "@/config/artci";
import { formatNumber } from "@/lib/utils";
import { rgphFor } from "@/lib/rgph";
import { OperatorLogo } from "@/components/ui/OperatorLogo";
import { Caption, Check, FilterBox, SectionCard, Tile, tooltipStyle } from "@/components/ui/kit";

const OPS = OPERATORS.map((o) => o.code);
const TECHS = TECHNOLOGIES.map((t) => t.code);
const OP_COLOR = Object.fromEntries(OPERATORS.map((o) => [o.code, o.color]));
const TECH_COLOR = Object.fromEntries(TECHNOLOGIES.map((t) => [t.code, t.color]));

const COVERED = "var(--artci-green)";
const UNCOVERED = "var(--uncovered)";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Fragment de clé des fichiers `statsnationales_*.json` : vide lorsque la
 * sélection est complète (on lit alors les totaux `locCov`, `popCov`, …),
 * sinon les éléments retenus joints par « _ ». Convention reprise de la
 * version 2 (`covMOOV_MTN2G_3G`, `presentORANGE4G`, …).
 */
const keyPart = (selected, all) => (selected.length === all.length ? "" : selected.join("_"));

/**
 * Vue « Statistiques nationales » - reproduction de `AdminNationalStatistics`
 * de la version 2 : filtres semestre / opérateurs / technologies, indicateurs
 * clés, anneaux de synthèse et graphiques croisés opérateur × technologie.
 * `operator` verrouille la vue sur un seul réseau (espace opérateur).
 */
export function NationalStatistics({ stats, date, periods, onDateChange, operator = null }) {
  const [ops, setOps] = useState(operator ? [operator] : OPS);
  const [techs, setTechs] = useState(TECHS);

  const toggle = (list, setList, value, all) =>
    setList(all.filter((v) => (v === value ? !list.includes(v) : list.includes(v))));

  const v = useMemo(() => derive(stats, ops, techs), [stats, ops, techs]);
  const empty = !ops.length || !techs.length;

  return (
    <div className="space-y-4">
      {/* ------------------------------- Filtres ------------------------------ */}
      <div className="grid gap-3 lg:grid-cols-3">
        <FilterBox label="Semestres" icon={CalendarRange}>
          <select
            value={date ?? ""}
            onChange={(e) => onDateChange?.(e.target.value)}
            disabled={!onDateChange}
            className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-[13px] font-bold outline-none focus:border-artci-green disabled:opacity-60"
          >
            {(periods || []).map((p) => <option key={p.date} value={p.date}>{p.label}</option>)}
          </select>
        </FilterBox>

        <FilterBox label="Opérateurs" icon={RadioTower}>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {OPERATORS.map((o) => (
              <Check
                key={o.code}
                checked={ops.includes(o.code)}
                disabled={!!operator && o.code !== operator}
                color={o.color}
                onChange={() => toggle(ops, setOps, o.code, OPS)}
              >
                <OperatorLogo operator={o} size={18} dim={!ops.includes(o.code)} />
                {o.code}
              </Check>
            ))}
          </div>
        </FilterBox>

        <FilterBox label="Technologies" icon={MapPin}>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {TECHNOLOGIES.map((t) => (
              <Check
                key={t.code}
                checked={techs.includes(t.code)}
                color={t.color}
                onChange={() => toggle(techs, setTechs, t.code, TECHS)}
              >
                <span style={{ color: t.color }}>{t.code}</span>
              </Check>
            ))}
          </div>
        </FilterBox>
      </div>

      {empty ? (
        <p className="rounded-2xl border border-border bg-surface px-4 py-16 text-center text-sm text-muted">
          Sélectionnez au moins un opérateur et une technologie.
        </p>
      ) : (
        <>
          {/* --------------------------- Indicateurs --------------------------- */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile icon={MapPinned} label="Total localités" value={formatNumber(v.locs)} color="#0aa0dd" />
            <Tile icon={MapPinned} label="Localités couvertes" value={formatNumber(v.locCov)} delta={v.varLocCov} color={COVERED} />
            <Tile icon={Users} label="Total population" value={formatNumber(v.pop)} badge={rgphFor(date).label} color="#8b5cf6" />
            <Tile icon={UsersRound} label="Population couverte" value={formatNumber(v.popCov)} delta={v.varPopCov} color={COVERED} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile icon={TowerControl} label="Total localités avec stations radio" value={formatNumber(v.stations)} delta={v.varStations} color="#f47b20" />
            {techs.map((t) => (
              <Tile
                key={t}
                icon={TowerControl}
                tag={t}
                label="Localités avec stations radio"
                value={formatNumber(v.stationsByTech[t])}
                delta={v.varStationsByTech[t]}
                color={TECH_COLOR[t]}
              />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile icon={CalendarRange} label="Total prévisions" value={v.forecast ? formatNumber(v.forecast) : "-"} color="#647570" />
            {techs.map((t) => (
              <Tile
                key={t}
                icon={CalendarRange}
                tag={t}
                label="Prévisions"
                value={v.forecastByTech[t] ? formatNumber(v.forecastByTech[t]) : "-"}
                delta={v.varForecastByTech[t]}
                color={TECH_COLOR[t]}
              />
            ))}
          </div>

          {/* ------------------------ Anneaux de synthèse ---------------------- */}
          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard title="Générales">
              <Gauge value={v.perLocCov} caption="Couverture des localités" />
              <Gauge value={v.perPopCov} caption="Couverture des populations" />
            </SectionCard>

            <SectionCard title="Localités avec stations radio">
              <Share data={v.stationsTechShare} caption="Localité avec stations radioélectriques par technologie" />
              <Share data={v.stationsOpShare} caption="Localité avec stations radioélectriques par opérateur" />
            </SectionCard>

            <SectionCard title="Prévisions">
              <Share data={v.forecastTechShare} caption="Prévision par technologie" />
              <Share data={v.forecastOpShare} caption="Prévision par opérateur" />
            </SectionCard>
          </div>

          {/* ---------------------------- Graphiques --------------------------- */}
          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard caption="Couverture des localités par opérateur et par technologie">
              <ByOperator data={v.covByOp} series={techs} colorOf={(t) => TECH_COLOR[t]} label={(t) => `Localité couvertes ${t}`} />
            </ChartCard>
            <ChartCard caption="Localité couverte par technologie et par opérateur" className="lg:col-span-2">
              <ByTechnology data={v.locByTech} ops={ops} coveredLabel="Localités couvertes" uncoveredLabel="Localités non-couvertes" prefix="Couverture" />
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard caption="Couverture des populations par opérateur et par technologie">
              <ByOperator data={v.popByOp} series={techs} colorOf={(t) => TECH_COLOR[t]} label={(t) => `Population couverte ${t}`} />
            </ChartCard>
            <ChartCard caption="Population couverte par technologie et par opérateur" className="lg:col-span-2">
              <ByTechnology data={v.popByTech} ops={ops} coveredLabel="Population couverte" uncoveredLabel="Population non-couverte" prefix="Population" />
            </ChartCard>
          </div>

          <p className="rounded-2xl border border-artci-orange/35 bg-artci-orange/10 px-4 py-3 text-[12px] leading-relaxed">
            <span className="font-bold">Rappel :</span> nombre total de localités{" "}
            <b>{formatNumber(v.locs)}</b> - population totale (source {rgphFor(date).label}){" "}
            <b>{formatNumber(v.pop)}</b>.
          </p>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          Extraction des indicateurs                         */
/* -------------------------------------------------------------------------- */

/** Lit le fichier de statistiques nationales selon la sélection en cours. */
function derive(stats, ops, techs) {
  const opKey = keyPart(ops, OPS);
  const techKey = keyPart(techs, TECHS);
  const suffix = `${opKey}${techKey}`;
  const full = !opKey && !techKey;
  const g = (k) => num(stats?.[k]);

  const locs = g("locs");
  const pop = g("pop");

  const stationsByTech = Object.fromEntries(techs.map((t) => [t, g(`present${opKey}${t}`)]));
  const varStationsByTech = Object.fromEntries(techs.map((t) => [t, g(`varPresent${opKey}${t}`)]));
  const forecastByTech = Object.fromEntries(techs.map((t) => [t, g(`forecast${opKey}${t}`)]));
  const varForecastByTech = Object.fromEntries(techs.map((t) => [t, g(`varForecast${opKey}${t}`)]));

  return {
    locs,
    pop,
    locCov: full ? g("locCov") : g(`cov${suffix}`),
    popCov: full ? g("popCov") : g(`pop${suffix}`),
    perLocCov: full ? g("perLocCov") : g(`perCov${suffix}`),
    perPopCov: full ? g("perPopCov") : g(`perPop${suffix}`),
    varLocCov: full ? g("varLocCov") : g(`varCov${suffix}`),
    varPopCov: full ? g("varPopCov") : g(`varPop${suffix}`),
    stations: full ? g("nombrepresent") : g(`present${suffix}`),
    varStations: full ? g("varPresent") : g(`varPresent${suffix}`),
    forecast: full ? g("locForecast") : g(`forecast${suffix}`),

    stationsByTech,
    varStationsByTech,
    forecastByTech,
    varForecastByTech,

    stationsTechShare: techs.map((t) => ({ name: t, value: stationsByTech[t], color: TECH_COLOR[t] })),
    stationsOpShare: ops.map((o) => ({ name: o, value: g(`present${o}${techKey}`), color: OP_COLOR[o] })),
    forecastTechShare: techs.map((t) => ({ name: t, value: forecastByTech[t], color: TECH_COLOR[t] })),
    forecastOpShare: ops.map((o) => ({ name: o, value: g(`forecast${o}${techKey}`), color: OP_COLOR[o] })),

    // Localités / population couvertes, croisées opérateur × technologie.
    covByOp: ops.map((o) => ({ name: o, ...Object.fromEntries(techs.map((t) => [t, g(`cov${o}${t}`)])) })),
    popByOp: ops.map((o) => ({ name: o, ...Object.fromEntries(techs.map((t) => [t, g(`pop${o}${t}`)])) })),
    locByTech: techs.map((t) => {
      const covered = g(`cov${opKey}${t}`);
      return {
        name: t, covered, uncovered: Math.max(0, locs - covered),
        ...Object.fromEntries(ops.map((o) => [o, g(`cov${o}${t}`)])),
      };
    }),
    popByTech: techs.map((t) => {
      const covered = g(`pop${opKey}${t}`);
      return {
        name: t, covered, uncovered: Math.max(0, pop - covered),
        ...Object.fromEntries(ops.map((o) => [o, g(`pop${o}${t}`)])),
      };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Briques UI                                 */
/* -------------------------------------------------------------------------- */

/** Anneau simple avec le taux au centre. */
function Gauge({ value, caption }) {
  const v = Math.max(0, Math.min(100, num(value)));
  const data = [
    { name: "Couvert", value: v, color: COVERED },
    { name: "Reste", value: 100 - v, color: "var(--surface-2)" },
  ];
  return (
    <figure className="m-0">
      <div className="relative">
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius="66%" outerRadius="92%" startAngle={90} endAngle={-270} stroke="none">
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-xl font-extrabold tabular-nums">
          {v.toFixed(2)}%
        </span>
      </div>
      <Caption>{caption}</Caption>
    </figure>
  );
}

/** Anneau de répartition, avec la part de chaque segment inscrite dedans. */
function Share({ data, caption }) {
  const total = data.reduce((s, d) => s + num(d.value), 0);
  return (
    <figure className="m-0">
      {total === 0 ? (
        <div className="grid h-[150px] place-items-center text-[11px] text-muted">Aucune donnée</div>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Legend verticalAlign="top" height={18} iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="46%"
              outerRadius="86%"
              stroke="none"
              labelLine={false}
              label={SliceLabel}
            >
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(val, name) => [formatNumber(val), name]} contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      )}
      <Caption>{caption}</Caption>
    </figure>
  );
}

/** Étiquette de part, positionnée au milieu de l'anneau. */
function SliceLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.04) return null;
  const r = innerRadius + (outerRadius - innerRadius) / 2;
  const rad = -midAngle * (Math.PI / 180);
  return (
    <text
      x={cx + r * Math.cos(rad)}
      y={cy + r * Math.sin(rad)}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={9.5}
      fontWeight={800}
    >
      {(percent * 100).toFixed(2)}%
    </text>
  );
}

function ChartCard({ caption, className = "", children }) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-3 shadow-sm ${className}`}>
      {children}
      <Caption>{caption}</Caption>
    </section>
  );
}

/** Barres verticales groupées : un groupe par opérateur, une barre par technologie. */
function ByOperator({ data, series, colorOf, label }) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: "var(--muted)" }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9.5, fill: "var(--muted)" }} width={54} tickFormatter={formatNumber} />
        <Tooltip formatter={(v, n) => [formatNumber(v), n]} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 10.5 }} />
        {series.map((k) => (
          <Bar key={k} dataKey={k} name={label(k)} fill={colorOf(k)} radius={[4, 4, 0, 0]} maxBarSize={40}>
            <LabelList dataKey={k} position="top" fontSize={9} fill="var(--muted)" formatter={formatNumber} />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barres horizontales groupées : un groupe par technologie, une barre par opérateur. */
function ByTechnology({ data, ops, coveredLabel, uncoveredLabel, prefix }) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 56, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9.5, fill: "var(--muted)" }} tickFormatter={formatNumber} />
        <YAxis type="category" dataKey="name" width={36} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: "var(--muted)" }} />
        <Tooltip formatter={(v, n) => [formatNumber(v), n]} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 10.5 }} />
        {ops.map((o) => (
          <Bar key={o} dataKey={o} name={`${prefix} ${o}`} fill={OP_COLOR[o]} radius={[0, 3, 3, 0]} maxBarSize={16}>
            <LabelList dataKey={o} position="right" fontSize={9} fill="var(--muted)" formatter={formatNumber} />
          </Bar>
        ))}
        <Bar dataKey="covered" name={coveredLabel} fill={COVERED} radius={[0, 3, 3, 0]} maxBarSize={16}>
          <LabelList dataKey="covered" position="right" fontSize={9} fill="var(--muted)" formatter={formatNumber} />
        </Bar>
        <Bar dataKey="uncovered" name={uncoveredLabel} fill={UNCOVERED} radius={[0, 3, 3, 0]} maxBarSize={16}>
          <LabelList dataKey="uncovered" position="right" fontSize={9} fill="var(--muted)" formatter={formatNumber} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
