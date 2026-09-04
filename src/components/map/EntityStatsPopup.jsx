"use client";

import { AnimatePresence, motion } from "motion/react";
import { X, Users, MapPinned, RadioTower, SignalHigh, Check, Minus } from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { formatNumber, formatCompact, formatPercent } from "@/lib/utils";
import { OPERATORS, TECHNOLOGIES } from "@/config/artci";
import { MiniStat as Kpi } from "@/components/ui/kit";

const TECH_COLOR = Object.fromEntries(TECHNOLOGIES.map((t) => [t.code, t.color]));
const OP_COLOR = Object.fromEntries(OPERATORS.map((o) => [o.code, o.color]));
const OP_NAME = Object.fromEntries(OPERATORS.map((o) => [o.code, o.name.split(" ")[0]]));

function Meter({ label, value, color }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-[11px] font-bold" style={{ color }}>{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="w-12 text-right text-[11px] font-bold tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

/** Popup présentant les statistiques de couverture d'une entité recherchée. */
export function EntityStatsPopup() {
  const popup = useMapStore((s) => s.statsPopup);
  const close = () => useMapStore.getState().setStatsPopup(null);

  const s = popup?.stats;

  return (
    <AnimatePresence>
      {popup && s && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto absolute inset-0 z-[60] grid place-items-center bg-black/30 p-4"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.94, y: 14, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 14, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl"
          >
            {/* En-tête (fixe) */}
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-5 pb-3 pt-5">
              <div className="min-w-0">
                <span className="inline-block rounded-full bg-artci-green/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-artci-green-700">
                  {popup.levelLabel}
                </span>
                <h2 className="mt-1 truncate text-lg font-extrabold tracking-tight">{popup.name}</h2>
              </div>
              <button onClick={close} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-surface-2" aria-label="Fermer">
                <X size={16} />
              </button>
            </div>

            {/* Contenu défilant */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">

            {/* Taux de couverture population */}
            <div className="mb-3 rounded-xl brand-gradient p-4 text-white">
              <div className="flex items-center gap-1.5 text-xs font-medium opacity-90">
                <Users size={13} /> Taux de couverture population
              </div>
              <div className="mt-1 text-3xl font-extrabold tracking-tight">{formatPercent(s.perPopCov)}</div>
              <div className="mt-1 text-[11px] opacity-90">
                {formatCompact(s.pop)} habitants
                {s.perPopNoCov > 0 && ` · ${formatPercent(s.perPopNoCov)} non couverts`}
              </div>
            </div>

            {/* KPIs secondaires */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              {s.locs > 1 && (
                <Kpi icon={MapPinned} value={`${formatNumber(s.locCov)}/${formatNumber(s.locs)}`} label="Localités couvertes" />
              )}
              {s.locs > 1 && (
                <Kpi icon={SignalHigh} value={formatPercent(s.perLocCov)} label="Taux localités" />
              )}
              <Kpi icon={RadioTower} value={formatNumber(s.stations)} label="Stations" />
            </div>

            {/* Couverture par technologie */}
            <div className="mb-3 rounded-xl bg-surface/60 p-3">
              <div className="mb-2 text-xs font-semibold text-muted">Couverture population par technologie</div>
              <div className="space-y-1.5">
                {s.perTech.map((t) => (
                  <Meter key={t.tech} label={t.tech} value={t.perPop} color={TECH_COLOR[t.tech] || "#159a4e"} />
                ))}
              </div>
            </div>

            {/* Réponse directe à la combinaison demandée (ex. « couverture 2G Orange ») */}
            <FocusAnswer stats={s} focus={popup.focus} isLocality={s.isLocality} />

            {/* Matrice opérateur × technologie (reprise de la V2, modernisée) */}
            {s.matrix?.length > 0 && <CoverageMatrix matrix={s.matrix} isLocality={s.isLocality} focus={popup.focus} />}

            {/* Couverture par opérateur */}
            <div className="mt-3 rounded-xl bg-surface/60 p-3">
              <div className="mb-2 text-xs font-semibold text-muted">Couverture population par opérateur</div>
              <div className="space-y-1.5">
                {s.operators.map((op) => (
                  <Meter key={op.op} label={OP_NAME[op.op] || op.op} value={op.perPop} color={OP_COLOR[op.op] || "#159a4e"} />
                ))}
              </div>
            </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Tableau croisé opérateurs × technologies : couverture et stations radio.
 * Localité → ✓ / - (drapeaux binaires). Niveau admin → % de population couverte.
 */
/**
 * Réponse directe quand la demande cible un opérateur et/ou une technologie
 * (ex. « couverture 2G Orange » → 96,4 % de la population sur tout le territoire).
 */
function FocusAnswer({ stats, focus, isLocality }) {
  const ops = focus?.operators?.length ? focus.operators : null;
  const techs = focus?.technologies?.length ? focus.technologies : null;
  if (!ops && !techs) return null;

  const opList = ops || stats.operators.map((o) => o.op);
  const techList = techs || ["2G", "3G", "4G"];

  const cells = [];
  for (const op of opList) {
    const row = stats.matrix?.find((m) => m.op === op);
    const opPerPop = stats.operators?.find((o) => o.op === op)?.byTech;
    for (const t of techList) {
      const cell = row?.byTech?.find((c) => c.tech === t);
      const perPop = opPerPop?.find((c) => c.tech === t)?.perPop ?? cell?.perPop ?? 0;
      cells.push({ op, tech: t, covered: cell?.covered, perPop });
    }
  }

  return (
    <div className="mb-3 rounded-xl border border-artci-green/25 bg-artci-green/8 p-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-artci-green-700">
        {ops && techs ? `Couverture ${techs.join("/")} · ${ops.map((o) => OP_NAME[o] || o).join(", ")}`
          : techs ? `Couverture ${techs.join("/")}`
          : `Couverture ${ops.map((o) => OP_NAME[o] || o).join(", ")}`}
      </div>
      <div className="flex flex-wrap gap-2">
        {cells.map((c) => (
          <div key={`${c.op}-${c.tech}`} className="flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: OP_COLOR[c.op] }} />
            <span className="text-[11px] font-bold" style={{ color: TECH_COLOR[c.tech] }}>{c.tech}</span>
            {isLocality ? (
              <span className={`text-xs font-extrabold ${c.covered ? "text-artci-green-700" : "text-uncovered"}`}>
                {c.covered ? "Couvert" : "Non couvert"}
              </span>
            ) : (
              <span className="text-sm font-extrabold tabular-nums">{formatPercent(c.perPop)}</span>
            )}
          </div>
        ))}
      </div>
      {!isLocality && <p className="mt-1.5 text-[10px] text-muted">Part de la population couverte.</p>}
    </div>
  );
}

function CoverageMatrix({ matrix, isLocality, focus }) {
  const TECHS = matrix[0]?.byTech?.map((t) => t.tech) || [];
  const fOps = focus?.operators || [];
  const fTechs = focus?.technologies || [];
  const isFocused = (op, tech) =>
    (fOps.length || fTechs.length) &&
    (!fOps.length || fOps.includes(op)) &&
    (!fTechs.length || fTechs.includes(tech));
  return (
    <div className="overflow-hidden rounded-xl bg-surface/60 p-3">
      <div className="mb-2 text-xs font-semibold text-muted">
        {isLocality ? "Couverture et stations par opérateur" : "Couverture population (%) par opérateur"}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted">
              <th className="py-1 text-left font-bold">Opérateur</th>
              {TECHS.map((t) => (
                <th key={`c-${t}`} className="px-1 py-1 text-center font-bold" style={{ color: TECH_COLOR[t] }}>{t}</th>
              ))}
              {isLocality && <th className="w-2" />}
              {isLocality && TECHS.map((t) => (
                <th key={`s-${t}`} className="px-1 py-1 text-center font-bold text-muted">{t}</th>
              ))}
            </tr>
            {isLocality && (
              <tr className="text-[9px] uppercase tracking-wide text-muted">
                <th />
                <th colSpan={TECHS.length} className="pb-1 text-center font-semibold">Couverture</th>
                <th />
                <th colSpan={TECHS.length} className="pb-1 text-center font-semibold">Stations</th>
              </tr>
            )}
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.op} className="border-t border-border/50">
                <td className="py-1.5 font-bold">
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: OP_COLOR[row.op] }} />
                  {OP_NAME[row.op] || row.op}
                </td>
                {row.byTech.map((c) => (
                  <td
                    key={`c-${c.tech}`}
                    className={`px-1 py-1.5 text-center ${isFocused(row.op, c.tech) ? "rounded-md bg-artci-green/12 font-extrabold" : ""}`}
                  >
                    {isLocality ? <Flag on={c.covered} /> : <span className="font-semibold tabular-nums">{(c.perPop ?? 0).toFixed(0)}%</span>}
                  </td>
                ))}
                {isLocality && <td />}
                {isLocality && row.byTech.map((c) => (
                  <td key={`s-${c.tech}`} className="px-1 py-1.5 text-center">
                    <Flag on={c.station} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Pastille ✓ (couvert) / - (non couvert). */
function Flag({ on }) {
  return on ? (
    <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-artci-green text-white"><Check size={12} strokeWidth={3} /></span>
  ) : (
    <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-muted"><Minus size={12} strokeWidth={3} /></span>
  );
}
