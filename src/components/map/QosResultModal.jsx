"use client";

import { AnimatePresence, motion } from "motion/react";
import { X, Gauge, Trophy, Check, AlertTriangle, Minus } from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { OPERATORS } from "@/config/artci";
import { QOS_INDICATORS, meetsThreshold } from "@/lib/export-data";
import { formatNumber } from "@/lib/utils";
import { MiniStat } from "@/components/ui/kit";

const OPS = OPERATORS.map((o) => o.code);
const OP_COLOR = Object.fromEntries(OPERATORS.map((o) => [o.code, o.color]));

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
/** Formatte une mesure selon son unité (les débits sont en kbit/s). */
const fmt = (v, ind) =>
  v == null ? "-" : ind.unit === "kbit/s" ? `${formatNumber(Math.round(v))} kbit/s` : `${v.toFixed(2)}${ind.unit}`;

/** Énoncé du seuil réglementaire d'un indicateur. */
const thresholdLabel = (ind) =>
  ind.threshold == null ? "-" : `${ind.dir === "max" ? "≤" : "≥"} ${ind.threshold}${ind.unit || ""}`;

/**
 * Fiche des résultats d'audit d'une localité - ouverte en cliquant sur un
 * marqueur de qualité de service. Reprend le tableau de la version 2 :
 * un indicateur par ligne, un opérateur par colonne, avec le rang mesuré
 * et le respect du seuil réglementaire.
 */
export function QosResultModal() {
  const selected = useMapStore((s) => s.selectedQos);
  const close = () => useMapStore.getState().setSelectedQos(null);

  const p = selected?.properties ?? {};
  const indicators = selected ? QOS_INDICATORS[selected.service] || [] : [];
  // Seuls les opérateurs réellement mesurés dans ce fichier sont affichés.
  const opsShown = indicators.length
    ? OPS.filter((o) => indicators.some((ind) => p[`${ind.key}_${o}`] !== undefined))
    : [];

  return (
    <AnimatePresence>
      {selected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[65] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          >
            {/* En-tête */}
            <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl brand-gradient text-white shadow-md">
                <Gauge size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-artci-green-700">
                  Audit {selected.serviceLabel} · {selected.campaign}
                </div>
                <h2 className="truncate text-[17px] font-extrabold leading-tight tracking-tight">
                  {p.ADM4_FR || "Localité auditée"}
                </h2>
                <p className="truncate text-[11.5px] text-muted">
                  {[p.ADM3_FR, p.ADM2_FR, p.ADM1_FR].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button onClick={close} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-surface-2" aria-label="Fermer">
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="Population" value={formatNumber(num(p.pop) ?? 0)} />
                <MiniStat label="Service" value={selected.serviceLabel} />
                <MiniStat label="Campagne" value={selected.campaign} />
                <MiniStat label="Indicateurs" value={indicators.length} />
              </div>

              {opsShown.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">
                  Aucune mesure disponible pour cette localité.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-surface-2">
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted">
                          Indicateur
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-muted">
                          Seuil
                        </th>
                        {opsShown.map((o) => (
                          <th key={o} className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: OP_COLOR[o] }} />
                              {o}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {indicators.map((ind) => (
                        <tr key={ind.key} className="border-t border-border">
                          <td className="px-3 py-2">
                            <span className="font-bold">{ind.label}</span>
                            <span className="block text-[11px] text-muted">{ind.name}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-[11px] tabular-nums text-muted">
                            {thresholdLabel(ind)}
                          </td>
                          {opsShown.map((o) => {
                            const v = num(p[`${ind.key}_${o}`]);
                            const ok = meetsThreshold(v, ind);
                            const rank = num(p[`rang_${ind.key}_${o}`]);
                            return (
                              <td key={o} className="px-3 py-2 text-right">
                                <span className="flex items-center justify-end gap-1.5">
                                  <Flag ok={ok} />
                                  <span className="font-bold tabular-nums">{fmt(v, ind)}</span>
                                </span>
                                {rank != null && (
                                  <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted">
                                    {rank === 1 && <Trophy size={9} className="text-artci-orange" />}
                                    rang {rank}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-muted">
                <Check size={11} className="mb-0.5 inline text-artci-green-700" /> seuil respecté ·{" "}
                <AlertTriangle size={11} className="mb-0.5 inline text-uncovered" /> seuil non atteint ·{" "}
                <Minus size={11} className="mb-0.5 inline" /> pas de seuil réglementaire. Le rang compare
                les trois opérateurs sur cette localité.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Conformité d'une mesure à son seuil. */
function Flag({ ok }) {
  if (ok === null) return <Minus size={12} className="shrink-0 text-muted" />;
  return ok ? (
    <Check size={12} className="shrink-0 text-artci-green-700" strokeWidth={3} />
  ) : (
    <AlertTriangle size={12} className="shrink-0 text-uncovered" />
  );
}
