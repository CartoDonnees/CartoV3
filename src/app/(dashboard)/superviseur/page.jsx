"use client";

import { PageHead } from "@/components/dashboard/ui";
import { RoleCoverage } from "@/components/dashboards/RoleCoverage";

export default function SupervisorDashboard() {
  return (
    <div>
      <PageHead
        title="Supervision"
        subtitle="Statistiques nationales, historique et zones non couvertes."
      />
      <RoleCoverage />
    </div>
  );
}
