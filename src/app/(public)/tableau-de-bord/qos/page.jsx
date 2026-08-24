"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line, ReferenceLine,
} from "recharts";
import {
  Gauge, MapPinned, Users, Loader2, Phone, MessageSquare, Wifi, ClipboardList, History,
  CheckCircle2, XCircle, Search,
} from "lucide-react";
import { OPERATORS } from "@/config/artci";
import { QOS_INDICATORS, meetsThreshold } from "@/lib/export-data";
import { formatNumber, formatCompact } from "@/lib/utils";
import { PublicDashboard } from "@/components/dashboards/PublicDashboard";
import { Card as Panel, Tile as Kpi, SortHeader, Tabs, useTableSort, tooltipStyle } from "@/components/ui/kit";

const TH = "border-b border-border bg-surface px-2 py-1.5 font-bold text-muted";
const OPS = OPERATORS.map((o) => o.code);
const OP_COLOR = Object.fromEntries(OPERATORS.map((o) => [o.code, o.color]));
const OP_SHORT = Object.fromEntries(OPERATORS.map((o) => [o.code, o.name.split(" ")[0]]));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

const SERVICES = [
  { key: "VOIX", label: "Voix", icon: Phone },
  { key: "SMS", label: "SMS", icon: MessageSquare },
  { key: "DATA", label: "Data", icon: Wifi },
];

const TABS = [
  { key: "bilan", label: "Bilan de la campagne", icon: ClipboardList },
  { key: "history", label: "Historique des campagnes", icon: History },
];

/** Étiquette courte d'une campagne : « Campagne-1 2024 » → « C1 2024 ». */
const shortCampaign = (c) => String(c || "").replace(/^Campagne-?(\d)?\s*/, (_, n) => (n ? `C${n} ` : ""));

const avg = (values) => {
  const v = values.filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export default function QosDashboardPage() {
  const [tab, setTab] = useState("bilan");
  const [service, setService] = useState("VOIX");
  const [campaigns, setCampaigns] = useState([]);
  const [campaign, setCampaign] = useState("");
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const indicators = QOS_INDICATORS[service] || [];

  useEffect(() => {
    let alive = true;
    fetch("/api/v1/geo?kind=qosCampaigns")
      .then((r) => r.json())
      .then((list) => {
        if (!alive || !Array.isArray(list)) return;
        setCampaigns(list);
        setCampaign((c) => c || list[0] || "");
      })
      .catch(() => alive && setError("Campagnes indisponibles."));
    return () => { alive = false; };
  }, []);

  // Audit de la campagne courante.
  useEffect(() => {
    if (!campaign) return;
    let alive = true;
    setData(null); setError("");
    fetch(`/api/v1/geo?kind=qos&service=${service}&campaign=${encodeURIComponent(campaign)}`)
      .then((r) => { if (!r.ok) throw new Error("Audit indisponible pour cette campagne."); return r.json(); })
      .then((d) => alive && setData(d.features || []))
      .catch((e) => alive && (setError(e.message), setData([])));
    return () => { alive = false; };
  }, [service, campaign]);

  // Historique : moyenne de chaque indicateur sur toutes les campagnes.
  useEffect(() => {
    if (tab !== "history" || !campaigns.length) return;
    let alive = true;
    setHistory(null);
    Promise.all(
      [...campaigns].reverse().map((c) =>
        fetch(`/api/v1/geo?kind=qos&service=${service}&campaign=${encodeURIComponent(c)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (!d?.features?.length) return null;
            const row = { campagne: shortCampaign(c) };
            for (const ind of QOS_INDICATORS[service]) {
              for (const op of OPS) {
                row[`${ind.label}|${OP_SHORT[op]}`] = round2(
                  avg(d.features.map((f) => num(f.properties?.[`${ind.key}_${op}`]))),
                );
              }
            }
            return row;
          })
          .catch(() => null),
      ),
    ).then((rows) => alive && setHistory(rows.filter(Boolean)));
    return () => { alive = false; };
  }, [tab, service, campaigns]);

  // Moyennes de la campagne courante, par indicateur et opérateur.
  const summary = useMemo(() => {
    if (!data?.length) return [];
    return indicators.map((ind) => {
      const row = { ind, values: {} };
      for (const op of OPS) {
        row.values[op] = round2(avg(data.map((f) => num(f.properties?.[`${ind.key}_${op}`]))));
      }
      return row;
    });
  }, [data, indicators]);

  const chartData = useMemo(
    () => summary.map((r) => ({ indicateur: r.ind.label, ...Object.fromEntries(OPS.map((o) => [OP_SHORT[o], r.values[o]])) })),
    [summary],
  );

  const population = useMemo(() => (data || []).reduce((s, f) => s + (Number(f.properties?.pop) || 0), 0), [data]);

  // Taux de conformité aux seuils (toutes mesures moyennes confondues).
  const compliance = useMemo(() => {
    let ok = 0, total = 0;
    for (const r of summary) {
      for (const op of OPS) {
        const m = meetsThreshold(r.values[op], r.ind);
        if (m !== null) { total += 1; if (m) ok += 1; }
      }
    }
    return { ok, total, pct: total ? (ok / total) * 100 : null };
  }, [summary]);

  // Détail par localité (onglet bilan).
  const localities = useMemo(() => {
    if (!data?.length) return [];
    const q = query.trim().toLowerCase();
    const rows = data.map((f) => {
      const p = f.properties || {};
      const row = { name: p.ADM4_FR, sub: p.ADM3_FR, region: p.ADM1_FR, pop: Number(p.pop) || 0, cells: {} };
      for (const ind of indicators) for (const op of OPS) row.cells[`${ind.key}_${op}`] = round2(num(p[`${ind.key}_${op}`]));
      return row;
    });
    return q
      ? rows.filter((r) => [r.name, r.sub, r.region].some((v) => String(v ?? "").toLowerCase().includes(q)))
      : rows;
  }, [data, indicators, query]);

  // Colonnes triables : les mesures sont indexées « {indicateur}_{opérateur} ».
  const { rows: sortedLocalities, sort, toggleSort } = useTableSort(localities, {
    accessor: (r, key) => (key in r ? r[key] : r.cells[key]),
  });

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs
        items={SERVICES}
        value={service}
        onChange={setService}
        variant="compact"
        className="rounded-xl border border-border bg-surface p-1"
      />
      {tab === "bilan" && (
        <select
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-bold outline-none"
        >
          {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </div>
  );

  return (
    <PublicDashboard
      title="Qualité de service"
      subtitle="Bilan et historique des campagnes d'audit — Observatoire ARTCI"
      icon={Gauge}
      toolbar={toolbar}
    >
      {/* Onglets */}
      <Tabs items={TABS} value={tab} onChange={setTab} className="mb-4" />

      {tab === "bilan" ? (
        data === null ? (
          <Loading label="Chargement de l'audit…" />
        ) : error ? (
          <p className="py-20 text-center text-sm font-semibold text-uncovered">{error}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi icon={MapPinned} value={formatNumber(data.length)} label="Localités auditées" hint={campaign} />
              <Kpi icon={Users} value={formatCompact(population)} label="Population concernée" color="#3b82f6" />
              <Kpi icon={Gauge} value={indicators.length} label="Indicateurs mesurés" color="#8b5cf6" />
              <Kpi
                icon={compliance.pct >= 50 ? CheckCircle2 : XCircle}
                value={compliance.pct == null ? "—" : `${compliance.pct.toFixed(0)} %`}
                label="Conformité aux seuils"
                hint={`${compliance.ok}/${compliance.total} mesures conformes`}
                color={compliance.pct >= 75 ? "var(--artci-green)" : compliance.pct >= 50 ? "#f47b20" : "var(--uncovered)"}
              />
            </div>

            <Panel title="Moyennes par indicateur et opérateur" hint={`Moyenne sur ${formatNumber(data.length)} localités · ${campaign}`}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="indicateur" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: "var(--muted)" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted)" }} width={44} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {OPS.map((op) => <Bar key={op} dataKey={OP_SHORT[op]} fill={OP_COLOR[op]} radius={[5, 5, 0, 0]} />)}
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            {/* Conformité aux seuils réglementaires */}
            <Panel title="Respect des seuils réglementaires" hint="Vert = seuil respecté, rouge = seuil non atteint">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-muted">
                      <th className="px-2 py-1.5 text-left font-bold">Indicateur</th>
                      <th className="px-2 py-1.5 text-left font-bold">Seuil</th>
                      {OPS.map((op) => (
                        <th key={op} className="px-2 py-1.5 text-right font-bold">
                          <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: OP_COLOR[op] }} />
                          {OP_SHORT[op]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((r) => (
                      <tr key={r.ind.key} className="border-t border-border">
                        <td className="px-2 py-2">
                          <span className="font-bold">{r.ind.label}</span>
                          <span className="ml-1.5 text-[11px] text-muted">{r.ind.name}</span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-[11.5px] text-muted">
                          {r.ind.threshold == null ? "—" : `${r.ind.dir === "max" ? "≤" : "≥"} ${r.ind.threshold} ${r.ind.unit}`}
                        </td>
                        {OPS.map((op) => {
                          const v = r.values[op];
                          const ok = meetsThreshold(v, r.ind);
                          return (
                            <td key={op} className="px-2 py-2 text-right tabular-nums">
                              <span
                                className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 font-bold ${
                                  ok === null ? "" : ok ? "bg-artci-green/12 text-artci-green-700" : "bg-uncovered/12 text-uncovered"
                                }`}
                              >
                                {ok !== null && (ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />)}
                                {v ?? "—"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            {/* Détail par localité auditée */}
            <Panel title="Détail par localité auditée">
              <label className="mb-2 flex max-w-sm items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2 focus-within:border-artci-green">
                <Search size={14} className="text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher une localité, sous-préfecture, région…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                />
              </label>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-[11.5px]">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <SortHeader label="Localité" sortKey="name" sort={sort} onSort={toggleSort} className={TH} />
                      <SortHeader label="Sous-préfecture" sortKey="sub" sort={sort} onSort={toggleSort} className={TH} />
                      <SortHeader label="Population" sortKey="pop" sort={sort} onSort={toggleSort} align="right" className={TH} />
                      {indicators.map((ind) =>
                        OPS.map((op) => (
                          <SortHeader
                            key={`${ind.key}-${op}`}
                            label={`${ind.label} ${OP_SHORT[op]}`}
                            sortKey={`${ind.key}_${op}`}
                            sort={sort}
                            onSort={toggleSort}
                            align="right"
                            className={`whitespace-nowrap ${TH}`}
                          >
                            {ind.label} <span style={{ color: OP_COLOR[op] }}>{OP_SHORT[op]}</span>
                          </SortHeader>
                        )),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLocalities.slice(0, 200).map((r, i) => (
                      <tr key={i} className="odd:bg-surface-2/40">
                        <td className="whitespace-nowrap px-2 py-1.5 font-semibold">{r.name}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-muted">{r.sub}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(r.pop)}</td>
                        {indicators.map((ind) =>
                          OPS.map((op) => {
                            const v = r.cells[`${ind.key}_${op}`];
                            const ok = meetsThreshold(v, ind);
                            return (
                              <td
                                key={`${ind.key}-${op}`}
                                className={`px-2 py-1.5 text-right tabular-nums ${
                                  ok === null ? "" : ok ? "text-artci-green-700" : "text-uncovered font-semibold"
                                }`}
                              >
                                {v ?? "—"}
                              </td>
                            );
                          }),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-muted">
                {formatNumber(localities.length)} localité(s){localities.length > 200 && " — 200 premières affichées"}
              </p>
            </Panel>
          </div>
        )
      ) : /* ---------------- Historique ---------------- */ history === null ? (
        <Loading label="Chargement de l'historique des campagnes…" />
      ) : history.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted">Aucun historique disponible.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {indicators.map((ind) => (
            <Panel
              key={ind.key}
              title={`${ind.label} — ${ind.name}`}
              hint={ind.threshold == null ? "Évolution par campagne" : `Seuil réglementaire : ${ind.dir === "max" ? "≤" : "≥"} ${ind.threshold} ${ind.unit}`}
            >
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="campagne" axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: "var(--muted)" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted)" }} width={44} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10.5 }} />
                  {ind.threshold != null && (
                    <ReferenceLine
                      y={ind.threshold}
                      stroke="var(--uncovered)"
                      strokeDasharray="5 4"
                      label={{ value: `Seuil ${ind.threshold}`, position: "insideTopRight", fontSize: 9, fill: "var(--uncovered)" }}
                    />
                  )}
                  {OPS.map((op) => (
                    <Line
                      key={op}
                      type="monotone"
                      dataKey={`${ind.label}|${OP_SHORT[op]}`}
                      name={OP_SHORT[op]}
                      stroke={OP_COLOR[op]}
                      strokeWidth={2}
                      dot={{ r: 2.5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          ))}
        </div>
      )}
    </PublicDashboard>
  );
}

function Loading({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
      <Loader2 size={16} className="animate-spin text-artci-green-700" /> {label}
    </div>
  );
}
