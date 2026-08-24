"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Target, X, MousePointerClick } from "lucide-react";
import * as turf from "@turf/turf";
import { useMapStore } from "@/stores/map-store";
import { getWhiteLocalities } from "@/lib/geodata";
import { formatNumber, formatCompact } from "@/lib/utils";

const SRC = "influence";

export function InfluenceTool() {
  const { map, setActiveTool } = useMapStore();
  const [radius, setRadius] = useState(20);
  const [center, setCenter] = useState(null);
  const [result, setResult] = useState(null);
  const whiteRef = useRef(null);

  useEffect(() => {
    getWhiteLocalities().then((d) => (whiteRef.current = d));
  }, []);

  // Ajoute les couches + gère le clic
  useEffect(() => {
    if (!map) return;
    map.getCanvas().style.cursor = "crosshair";
    if (!map.getSource(SRC)) {
      map.addSource(SRC, { type: "geojson", data: turf.featureCollection([]) });
      map.addLayer({ id: `${SRC}-fill`, type: "fill", source: SRC, filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#391ffa", "fill-opacity": 0.15 } });
      map.addLayer({ id: `${SRC}-line`, type: "line", source: SRC, filter: ["==", "$type", "Polygon"], paint: { "line-color": "#391ffa", "line-width": 2 } });
      map.addLayer({ id: `${SRC}-pt`, type: "circle", source: SRC, filter: ["==", "$type", "Point"], paint: { "circle-radius": 6, "circle-color": "#391ffa", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
    }
    const onClick = (e) => setCenter([e.lngLat.lng, e.lngLat.lat]);
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
      map.getCanvas().style.cursor = "";
      [`${SRC}-fill`, `${SRC}-line`, `${SRC}-pt`].forEach((id) => map.getLayer(id) && map.removeLayer(id));
      if (map.getSource(SRC)) map.removeSource(SRC);
    };
  }, [map]);

  // Recalcule le cercle & la population impactée
  useEffect(() => {
    if (!map || !center || !whiteRef.current) return;
    const pt = turf.point(center);
    const circle = turf.circle(center, radius, { units: "kilometers", steps: 64 });
    const src = map.getSource(SRC);
    if (src) src.setData(turf.featureCollection([circle, pt]));

    let pop = 0;
    let count = 0;
    for (const f of whiteRef.current.features) {
      if (turf.booleanPointInPolygon(f, circle)) {
        count += 1;
        pop += Number(f.properties.pop || 0);
      }
    }
    setResult({ count, pop });
  }, [map, center, radius]);

  return (
    <motion.div
      initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 30, opacity: 0 }}
      className="pointer-events-auto absolute right-3 top-[76px] z-30 w-[300px]"
    >
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <Target size={16} className="text-artci-orange" />
          <span className="text-sm font-bold">Zone d'influence</span>
          <button onClick={() => setActiveTool(null)} className="ml-auto grid h-7 w-7 place-items-center rounded-lg hover:bg-surface-2"><X size={14} /></button>
        </div>

        {!center ? (
          <div className="flex items-center gap-2 rounded-xl bg-surface/60 p-3 text-xs text-muted">
            <MousePointerClick size={16} className="shrink-0 text-artci-orange" />
            Cliquez sur la carte pour définir le centre de la zone.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-xs font-medium">
                <span className="text-muted">Rayon</span>
                <span className="font-bold text-foreground">{radius} km</span>
              </div>
              <input type="range" min={2} max={100} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-[var(--artci-orange)]" />
            </div>
            {result && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-surface/60 p-3">
                  <div className="text-xl font-extrabold text-artci-orange">{formatNumber(result.count)}</div>
                  <div className="text-[10px] text-muted">Localités blanches</div>
                </div>
                <div className="rounded-xl bg-surface/60 p-3">
                  <div className="text-xl font-extrabold text-foreground">{formatCompact(result.pop)}</div>
                  <div className="text-[10px] text-muted">Population polarisée</div>
                </div>
              </div>
            )}
            <button onClick={() => { setCenter(null); setResult(null); }} className="w-full rounded-xl border border-border py-2 text-xs font-semibold text-muted hover:bg-surface-2">
              Réinitialiser
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
