"use client";

import { useEffect, useState } from "react";
import { useMapStore } from "@/stores/map-store";
import { CoverageDashboardBody } from "@/components/dashboards/CoverageTabs";

/**
 * Bloc « couverture » des espaces admin / superviseur / opérateur.
 * Reprend les vues de la version 2 (statistiques nationales, historique,
 * localités non couvertes, détail par entité) avec le sélecteur de période.
 * `operator` restreint l'affichage au réseau de l'opérateur connecté.
 */
export function RoleCoverage({ operator = null }) {
  const periods = useMapStore((st) => st.periods);
  const loadRefData = useMapStore((st) => st.loadRefData);
  const [date, setDate] = useState(null);

  useEffect(() => { loadRefData(); }, [loadRefData]);
  useEffect(() => { if (!date && periods?.length) setDate(periods[0].date); }, [periods, date]);

  // Le sélecteur de semestre est intégré à la barre de filtres des onglets.
  return <CoverageDashboardBody date={date} onDateChange={setDate} operator={operator} />;
}
