"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { Play, Pause, X, Clapperboard } from "lucide-react";
import { useMapStore, PERIODS, periodLabel } from "@/stores/map-store";
import { cn } from "@/lib/utils";

// Ordre chronologique (ancien → récent)
const CHRONO = [...PERIODS].reverse();

export function TimelapseTool() {
  const { periodDate, setPeriod, isPlaying, setPlaying, setActiveTool } = useMapStore();
  const idx = CHRONO.findIndex((p) => p.date === periodDate);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const st = useMapStore.getState();
      const i = CHRONO.findIndex((p) => p.date === st.periodDate);
      const next = (i + 1) % CHRONO.length;
      setPeriod(CHRONO[next].date);
    }, 1500);
    return () => clearInterval(id);
  }, [isPlaying, setPeriod]);

  const close = () => {
    setPlaying(false);
    setActiveTool(null);
  };

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 30, opacity: 0 }}
      className="pointer-events-auto absolute bottom-16 left-1/2 z-30 w-[min(640px,92vw)] -translate-x-1/2"
    >
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <Clapperboard size={16} className="text-artci-green-700" />
          <span className="text-sm font-bold">Time-lapse - évolution de la couverture</span>
          <span className="ml-auto text-sm font-semibold text-artci-green-700">{periodLabel(periodDate)}</span>
          <button onClick={close} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-surface-2"><X size={14} /></button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setPlaying(!isPlaying)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full brand-gradient text-white shadow-md"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>

          <div className="relative flex-1">
            <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-2" />
            <div
              className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full brand-gradient transition-all"
              style={{ width: `${(idx / (CHRONO.length - 1)) * 100}%` }}
            />
            <div className="relative flex justify-between">
              {CHRONO.map((p, i) => (
                <button
                  key={p.date}
                  onClick={() => setPeriod(p.date)}
                  title={p.label}
                  className={cn(
                    "z-10 h-3.5 w-3.5 rounded-full border-2 transition-all",
                    i <= idx ? "border-artci-green bg-artci-green" : "border-border bg-surface",
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2 flex justify-between px-1 text-[10px] font-medium text-muted">
          <span>{CHRONO[0].label.split(" ").slice(-1)}</span>
          <span>{CHRONO[CHRONO.length - 1].label.split(" ").slice(-1)}</span>
        </div>
      </div>
    </motion.div>
  );
}
