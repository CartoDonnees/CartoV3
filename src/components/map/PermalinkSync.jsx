"use client";

import { useEffect } from "react";
import { useMapStore, PERIODS } from "@/stores/map-store";

/** Restaure l'état de la carte depuis les paramètres d'URL (permalien). */
export function PermalinkSync() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (![...p.keys()].length) return;
    const patch = {};
    const op = p.get("op");
    const tech = p.get("tech");
    const date = p.get("date");
    const style = p.get("style");
    if (op) patch.operators = op.split(",").filter(Boolean);
    if (tech) patch.technologies = tech.split(",").filter(Boolean);
    if (date && PERIODS.some((x) => x.date === date)) patch.periodDate = date;
    if (["streets", "light", "satellite", "dark"].includes(style)) patch.mapStyle = style;
    if (p.get("d") != null) patch.showDistricts = p.get("d") === "1";
    if (p.get("w") != null) patch.showWhiteZones = p.get("w") === "1";
    useMapStore.getState().applyState(patch);
  }, []);
  return null;
}
