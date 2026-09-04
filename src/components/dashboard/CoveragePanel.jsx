"use client";

import { useEffect, useState } from "react";
import { Users, MapPinned, RadioTower, SignalHigh } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, StatCard, Meter, Spinner } from "./ui";
import s from "./dashboard.module.css";

const TECH_COLOR = { "2G": "#4eda03", "3G": "#E21273", "4G": "#8b5cf6" };
const OP_COLOR = { ORANGE: "#f47b20", MTN: "#ffcc00", MOOV: "#0aa0dd" };
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const nf = (n) => (Number(n) || 0).toLocaleString("fr-FR");
function frDate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || "");
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : d;
}

export default function CoveragePanel({ showOperators = true }) {
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api(`/api/v1/stats/national${date ? `?date=${date}` : ""}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        if (!date && d.dates?.length) setDate(d.dates[0]);
      })
      .catch(() => alive && setData({ stats: null, dates: [] }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [date]);

  if (loading && !data) return <Spinner />;
  const st = data?.stats;
  if (!st) return <Card>Statistiques indisponibles.</Card>;

  const isOperator = !!st.operator;

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Sélecteur de période */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <span className={s.pageSub} style={{ margin: 0 }}>Période :</span>
        <select className={s.select} style={{ maxWidth: 220 }} value={date} onChange={(e) => setDate(e.target.value)}>
          {(data.dates || []).map((d) => (
            <option key={d} value={d}>
              {frDate(d)}
            </option>
          ))}
        </select>
        {isOperator && <span className={s.badge + " " + s.badgeAmber}>{st.operator}</span>}
      </div>

      {/* KPI nationaux */}
      <div className={`${s.grid} ${s.gridStats}`}>
        <StatCard icon={Users} value={`${st.perPopCovered.toFixed(1)}%`} label="Population couverte" hint={`${nf(st.popCovered)} habitants`} color="var(--artci-green)" />
        <StatCard icon={MapPinned} value={nf(st.localitiesCovered)} label="Localités couvertes" hint={`sur ${nf(st.localities)} localités`} color="#3b82f6" />
        <StatCard icon={RadioTower} value={nf(st.stations)} label="Stations présentes" color="#f47b20" />
        <StatCard icon={SignalHigh} value={`${st.perLocCovered.toFixed(1)}%`} label="Taux de couverture" hint="localités couvertes" color="#8b5cf6" />
      </div>

      {/* Couverture par technologie */}
      <Card title="Couverture population par technologie">
        {st.perTech.map((t) => (
          <Meter key={t.tech} label={t.tech} value={t.perPop} color={TECH_COLOR[t.tech]} />
        ))}
      </Card>

      {/* Vue opérateur unique */}
      {isOperator && (
        <Card title={`Couverture population - ${st.operator}`}>
          <div className={`${s.grid} ${s.gridStats}`} style={{ marginBottom: "1rem" }}>
            <StatCard value={`${st.opPerPop.toFixed(1)}%`} label="Population couverte" hint={`${nf(st.opPop)} habitants`} color={OP_COLOR[st.operator] || "var(--artci-green)"} />
          </div>
          {st.opByTech.map((t) => (
            <Meter key={t.tech} label={t.tech} value={t.perPop} color={TECH_COLOR[t.tech]} />
          ))}
        </Card>
      )}

      {/* Comparatif opérateurs (admin/superviseur) */}
      {showOperators && !isOperator && (
        <Card title="Couverture population par opérateur">
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Opérateur</th>
                  <th>Global</th>
                  <th>2G</th>
                  <th>3G</th>
                  <th>4G</th>
                </tr>
              </thead>
              <tbody>
                {st.operators.map((op) => (
                  <tr key={op.operator}>
                    <td className={s.cellStrong}>
                      <span className={s.swatch} style={{ background: OP_COLOR[op.operator] || "#94a3b8" }} />
                      {op.operator}
                    </td>
                    <td className={s.cellStrong}>{op.perPop.toFixed(1)}%</td>
                    {op.byTech.map((t) => (
                      <td key={t.tech}>{t.perPop.toFixed(1)}%</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
