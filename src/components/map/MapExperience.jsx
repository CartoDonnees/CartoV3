"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mic } from "lucide-react";
import { MapCanvas } from "./MapCanvas";
import { LayerManager } from "./LayerManager";
import { QosLayers } from "./QosLayers";
import { LocalityHover } from "./LocalityHover";
import { MapLoader } from "./MapLoader";
import { TopBar } from "./TopBar";
import { FilterSidebar } from "./FilterSidebar";
import { StatsPanel } from "./StatsPanel";
import { MapControls } from "./MapControls";
import { LegendModal } from "./LegendModal";
import { ToolDock } from "./ToolDock";
import { ShareMenu } from "./ShareMenu";
import { AuthModal } from "./AuthModal";
import { VoiceModal } from "./VoiceModal";
import { DataHubModal } from "./DataHubModal";
import { NewsModal } from "./NewsModal";
import { ExportPreviewModal } from "./ExportPreviewModal";
import { EntityStatsPopup } from "./EntityStatsPopup";
import { QosResultModal } from "./QosResultModal";
import { SearchMarker } from "./SearchMarker";
import { PermalinkSync } from "./PermalinkSync";
import { InfluenceTool } from "./tools/InfluenceTool";
import { RouteTool } from "./tools/RouteTool";
import { AssistantTool } from "./tools/AssistantTool";
import { ReportTool } from "./tools/ReportTool";
import { TimelapseTool } from "./tools/TimelapseTool";
import { CompareMode } from "./tools/CompareMode";
import { useMapStore } from "@/stores/map-store";
import { iconDataUri } from "@/lib/mapIcons";
import { formatNumber, formatCompact, formatPercent, cn } from "@/lib/utils";

const COMPACT_LEGEND = [
  { icon: "ic-tech-4G", label: "4G" },
  { icon: "ic-tech-3G", label: "3G" },
  { icon: "ic-tech-2G", label: "2G" },
  { icon: "ic-uncovered", label: "Non couverte" },
  { icon: "ic-white", label: "Zone blanche" },
];

/** Compose l'ensemble de l'expérience carte publique (priorité 1). */
export function MapExperience() {
  const activeTool = useMapStore((s) => s.activeTool);

  // Charge les données de référence + la session utilisateur depuis la base.
  useEffect(() => {
    const s = useMapStore.getState();
    s.loadRefData();
    s.loadSession();
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-surface-2">
      <PermalinkSync />
      <MapCanvas />
      <LayerManager />
      <QosLayers />
      <LocalityHover />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/5" />

      <TopBar />
      <ShareMenu />
      <FilterSidebar />
      <StatsPanel />
      <MapControls />
      <LegendModal />
      <DistrictTooltip />
      <ToolDock><VoiceButton /></ToolDock>
      <MapLoader />
      <AuthModal />
      <VoiceModal />
      <DataHubModal />
      <NewsModal />
      <ExportPreviewModal />
      <EntityStatsPopup />
      <QosResultModal />
      <SearchMarker />

      {/* Outils */}
      <AnimatePresence>
        {activeTool === "influence" && <InfluenceTool key="influence" />}
        {activeTool === "route" && <RouteTool key="route" />}
        {activeTool === "assistant" && <AssistantTool key="assistant" />}
        {activeTool === "report" && <ReportTool key="report" />}
        {activeTool === "timelapse" && <TimelapseTool key="timelapse" />}
        {activeTool === "compare" && <CompareMode key="compare" />}
      </AnimatePresence>

      {/* Légende compacte (bas-centre) */}
      {activeTool !== "compare" && (
        <div className="pointer-events-auto absolute bottom-3 left-1/2 z-10 -translate-x-1/2 w-[528px]">
          <button
            onClick={() => useMapStore.getState().setLegendOpen(true)}
            className="glass hidden items-center gap-2.5 rounded px-4 py-2 text-xs font-medium transition-colors hover:bg-surface-2 xl:flex "
            title="Ouvrir la légende complète"
          >
            {COMPACT_LEGEND.map((it) => (
              <span key={it.icon} className="flex items-center gap-1.5 text-[11px]">
                <img src={iconDataUri(it.icon)} alt="" className="h-4 w-auto" />
                {it.label}
              </span>
            ))}
            <span className="text-[11px] font-semibold text-artci-green-700 flex align-center">Légende {'>'}</span>
          </button>
        </div>
      )}
    </main>
  );
}

/** Carte flottante d'infos sur le district survolé. */
function DistrictTooltip() {
  const d = useMapStore((s) => s.activeDistrict);
  return (
    <AnimatePresence>
      {d && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="pointer-events-none absolute left-1/2 top-[84px] z-20 -translate-x-1/2"
        >
          <div className="glass min-w-[220px] rounded-2xl px-4 py-3">
            {d.level && (
              <div className="text-[10px] font-bold uppercase tracking-wide text-artci-green-700">{d.level}</div>
            )}
            <div className="text-sm font-extrabold tracking-tight">{d.name}</div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-center">
              <Stat label="Couverture" value={formatPercent(d.rate)} accent />
              <Stat label="Population" value={formatCompact(d.pop)} />
              <Stat label="Localités" value={formatNumber(d.locs)} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Chiffre du bandeau de survol — typographie des indicateurs du kit. */
function Stat({ label, value, accent }) {
  return (
    <div>
      <div className={cn("text-[15px] font-extrabold leading-none tracking-tight tabular-nums", accent ? "text-artci-green-700" : "text-foreground")}>
        {value}
      </div>
      <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

/** Bouton micro : ouvre le modal de recherche vocale. */
function VoiceButton() {
  const setVoiceOpen = useMapStore((s) => s.setVoiceOpen);
  const activeTool = useMapStore((s) => s.activeTool);
  const voiceOpen = useMapStore((s) => s.voiceOpen);

  if (activeTool === "compare") return null;

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 20 }}
      onClick={() => setVoiceOpen(true)}
      className={cn(
        "pointer-events-auto grid h-11 w-11 place-items-center rounded-xl transition-colors",
        voiceOpen ? "brand-gradient text-white shadow-md" : "text-foreground/70 hover:bg-surface-2",
      )}
      title="Recherche vocale"
      aria-label="Recherche vocale"
    >
      <Mic size={18} />
    </motion.button>
  );
}
