"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Route, X, Loader2, Shapes } from "lucide-react";
import * as turf from "@turf/turf";
import { useMapStore } from "@/stores/map-store";
import { ADMIN_LOADERS } from "@/lib/geodata";
import { computeRate } from "@/lib/coverage";
import { ADMIN_LIMITS } from "@/config/artci";
import { EntityPicker } from "./EntityPicker";
import { cn } from "@/lib/utils";
import { MiniStat } from "@/components/ui/kit";

const SRC = "route";

export function RouteTool() {
  const { map, setActiveTool, periodDate, operators, technologies, coverageLevel } = useMapStore();
  // Découpage utilisé pour évaluer la couverture : celui sélectionné sur la carte
  // (« Aucun » → district, le niveau le plus large).
  const level = coverageLevel || "district";
  const levelLabel = ADMIN_LIMITS.find((l) => l.key === level)?.label ?? "Districts";
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!map) return;
    if (!map.getSource(SRC)) {
      const before = map.getLayer("white-localities") ? "white-localities" : undefined;
      map.addSource(SRC, { type: "geojson", data: turf.featureCollection([]) });
      map.addLayer({ id: `${SRC}-line`, type: "line", source: SRC, filter: ["==", "$type", "LineString"], paint: { "line-color": "#159a4e", "line-width": 4, "line-opacity": 0.9 } }, before);
      map.addLayer({ id: `${SRC}-gap`, type: "circle", source: SRC, filter: ["==", "$type", "Point"], paint: { "circle-radius": 5, "circle-color": "#e11d48", "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
    }
    return () => {
      [`${SRC}-line`, `${SRC}-gap`].forEach((id) => map.getLayer(id) && map.removeLayer(id));
      if (map.getSource(SRC)) map.removeSource(SRC);
    };
  }, [map]);

  const compute = async () => {
    setErr(null);
    const a = from;
    const b = to;
    if (!a || !b) return;
    setLoading(true);
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${a.lng},${a.lat};${b.lng},${b.lat}?geometries=geojson&overview=full&access_token=${token}`;
      const json = await fetch(url).then((r) => r.json());
      const route = json.routes?.[0];
      if (!route) throw new Error("no route");
      const line = turf.feature(route.geometry);
      // Découpage sélectionné sur la carte (district → sous-préfecture).
      const areas = await (ADMIN_LOADERS[level] || ADMIN_LOADERS.district)(periodDate);

      const lengthKm = turf.length(line, { units: "kilometers" });
      const step = Math.max(2, lengthKm / 60);
      const gaps = [];
      let covered = 0;
      let total = 0;
      for (let d = 0; d <= lengthKm; d += step) {
        const pt = turf.along(line, d, { units: "kilometers" });
        total += 1;
        const area = areas.features.find((f) => turf.booleanPointInPolygon(pt, f));
        const rate = area ? computeRate(area.properties, operators, technologies) : 0;
        if (rate >= 50) covered += 1;
        else gaps.push(pt);
      }
      const pct = total ? Math.round((covered / total) * 100) : 0;
      map.getSource(SRC)?.setData(turf.featureCollection([line, ...gaps]));
      map.fitBounds(turf.bbox(line), { padding: 80, duration: 900 });
      setResult({ km: Math.round(route.distance / 1000), min: Math.round(route.duration / 60), pct, gaps: gaps.length });
    } catch {
      setErr("Itinéraire indisponible. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  // Le découpage (ou la période) change : le taux affiché deviendrait obsolète → recalcul.
  useEffect(() => {
    if (result && from && to) compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, periodDate]);

  return (
    <motion.div
      initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 30, opacity: 0 }}
      className="pointer-events-auto absolute right-3 top-[76px] z-30 w-[300px]"
    >
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <Route size={16} className="text-artci-green-700" />
          <span className="text-sm font-bold">Couverture d'un itinéraire</span>
          <button onClick={() => setActiveTool(null)} className="ml-auto grid h-7 w-7 place-items-center rounded-lg hover:bg-surface-2"><X size={14} /></button>
        </div>

        <div className="space-y-2">
          <EntityPicker label="Départ" value={from} onSelect={setFrom} placeholder="Localité de départ…" />
          <EntityPicker label="Arrivée" value={to} onSelect={setTo} placeholder="Localité d'arrivée…" />
          <button
            onClick={compute}
            disabled={loading || !from || !to}
            className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Route size={15} />} Analyser le trajet
          </button>
          <p className="flex items-center gap-1 px-0.5 text-[10px] text-muted">
            <Shapes size={11} className="shrink-0" /> Couverture évaluée par&nbsp;<strong className="font-bold">{levelLabel.toLowerCase()}</strong>
          </p>
        </div>

        {err && <p className="mt-2 text-xs text-uncovered">{err}</p>}
        {result && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <MiniStat value={`${result.km} km`} label="Distance" />
              <MiniStat value={`${result.min} min`} label="Durée" />
            </div>
            <div className={cn("rounded-xl p-3 text-white", result.pct >= 80 ? "bg-artci-green" : result.pct >= 50 ? "bg-artci-orange" : "bg-uncovered")}>
              <div className="text-2xl font-extrabold">{result.pct}%</div>
              <div className="text-[11px] opacity-90">du trajet couvert · {result.gaps} zones sans réseau (points rouges)</div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
