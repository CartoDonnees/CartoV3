"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { PublicDashboard } from "@/components/dashboards/PublicDashboard";
import { CoverageDashboardBody } from "@/components/dashboards/CoverageTabs";

export default function CoverageDashboardPage() {
  const periods = useMapStore((s) => s.periods);
  const loadRefData = useMapStore((s) => s.loadRefData);
  const [date, setDate] = useState(null);

  useEffect(() => { loadRefData(); }, [loadRefData]);
  useEffect(() => { if (!date && periods?.length) setDate(periods[0].date); }, [periods, date]);

  // Le semestre se choisit dans la barre de filtres du tableau de bord.
  return (
    <PublicDashboard
      title="Couverture des réseaux de télécommunications"
      subtitle="Vue d'ensemble des indicateurs clés de couverture - Observatoire ARTCI"
      icon={Radio}
    >
      <CoverageDashboardBody date={date} onDateChange={setDate} />
    </PublicDashboard>
  );
}
