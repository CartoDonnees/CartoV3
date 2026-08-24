"use client";

import { useEffect, useState } from "react";
import { Users, Radio, SignalHigh, MessageSquareWarning } from "lucide-react";
import { api } from "@/lib/api-client";
import { PageHead, StatCard, Card, Spinner, RoleBadge, StatusBadge } from "@/components/dashboard/ui";
import { RoleCoverage } from "@/components/dashboards/RoleCoverage";
import s from "@/components/dashboard/dashboard.module.css";

const CAT_LABEL = {
  NO_NETWORK: "Pas de réseau",
  SLOW_NETWORK: "Réseau lent",
  FREQUENT_DROPS: "Coupures fréquentes",
  APP_ISSUE: "Problème appli",
  OTHER: "Autre",
};

export default function AdminDashboard() {
  const [sum, setSum] = useState(null);

  useEffect(() => {
    api("/api/v1/admin/summary").then(setSum).catch(() => setSum(false));
  }, []);

  return (
    <div>
      <PageHead
        title="Couverture des réseaux de télécommunications"
        subtitle="Vue d'ensemble des indicateurs clés de couverture et de qualité de service."
      />

      <RoleCoverage />

      <h2 className={s.cardTitle} style={{ fontSize: "1.15rem", margin: "1.6rem 0 0.8rem" }}>
        Activité de la plateforme
      </h2>

      {sum === null ? (
        <Spinner />
      ) : sum === false ? (
        <div className={s.formError}>Impossible de charger le résumé.</div>
      ) : (
        <div style={{ display: "grid", gap: "1.2rem", marginBottom: "1.2rem" }}>
          <div className={`${s.grid} ${s.gridStats}`}>
            <StatCard icon={Users} value={sum.counts.users} label="Utilisateurs" color="var(--artci-green)" />
            <StatCard icon={Radio} value={sum.counts.operators} label="Opérateurs" color="#f47b20" />
            <StatCard icon={SignalHigh} value={sum.counts.technologies} label="Technologies" color="#8b5cf6" />
            <StatCard icon={MessageSquareWarning} value={sum.counts.reportsPending} label="Signalements en attente" hint={`${sum.counts.reportsTotal} au total`} color="#e11d48" />
          </div>

          <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            <Card title="Derniers signalements">
              {sum.recentReports.length === 0 ? (
                <p className={s.cellMuted}>Aucun signalement.</p>
              ) : (
                <div className={s.tableScroll}>
                  <table className={s.table}>
                    <tbody>
                      {sum.recentReports.map((r) => (
                        <tr key={r.code}>
                          <td className={s.cellStrong}>{CAT_LABEL[r.category] || "Autre"}</td>
                          <td className={s.cellMuted} style={{ maxWidth: 160 }}>{r.comment || "—"}</td>
                          <td style={{ textAlign: "right" }}><StatusBadge status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Derniers inscrits">
              {sum.recentUsers.length === 0 ? (
                <p className={s.cellMuted}>Aucun utilisateur.</p>
              ) : (
                <div className={s.tableScroll}>
                  <table className={s.table}>
                    <tbody>
                      {sum.recentUsers.map((u) => (
                        <tr key={u.code}>
                          <td className={s.cellStrong}>{`${u.firstName || ""} ${u.lastName}`.trim()}</td>
                          <td className={s.cellMuted}>{u.email}</td>
                          <td style={{ textAlign: "right" }}><RoleBadge role={u.role} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
