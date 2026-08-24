"use client";

import { motion } from "motion/react";
import {
  Columns2,
  Clapperboard,
  Target,
  Route,
  Sparkles,
  Flag,
  BarChart3,
} from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { cn } from "@/lib/utils";
import styles from "./ToolDock.module.css";
import { useState } from "react";

const TOOLS = [
  { key: "compare", icon: Columns2, label: "Comparateur d'opérateurs" },
  { key: "timelapse", icon: Clapperboard, label: "Time-lapse historique" },
  { key: "influence", icon: Target, label: "Zone d'influence" },
  { key: "route", icon: Route, label: "Couverture d'un itinéraire" },
  { key: "assistant", icon: Sparkles, label: "Assistant IA" },
  { key: "report", icon: Flag, label: "Signaler un problème" },
];

export function ToolDock({children}) {
  const { activeTool, toggleStats,statsOpen, setActiveTool, sidebarOpen } = useMapStore();


  return (
    <motion.div
      initial={{ x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1, left: sidebarOpen ? 344 : 12 }}
      transition={{ delay: 0.15, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={styles.dock}
    >
      <div className={`glass ${styles.inner} rounded`}>
        {children}
        <button
        key="stats"
          aria-label="Statistiques"
          onClick={toggleStats}
          title={"Statistiques"}
          className={cn(
            styles.btn,
            statsOpen && `brand-gradient ${styles.btnActive}`
          )}
        >
          <BarChart3 size={18} />
          <span className={styles.tip}>Statistiques</span>
        </button>

        {TOOLS.map(({ key, icon: Icon, label }) => {
          const active = activeTool === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTool(key)}
              title={label}
              aria-label={label}
              className={cn(
                styles.btn,
                active && `brand-gradient ${styles.btnActive}`,
              )}
            >
              <Icon size={18} />
              <span className={styles.tip}>{label}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
