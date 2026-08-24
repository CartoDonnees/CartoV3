"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, Link2, Check, X, Loader2, AlertTriangle } from "lucide-react";
import { useMapStore, periodLabel } from "@/stores/map-store";
import { buildLegend, legendItemCount } from "@/lib/map-legend";
import { rgphFor } from "@/lib/rgph";
import {
  EXPORT_FORMATS, PAGE_SIZES, DPI_VALUES,
  exportFileName, exportMapImage, renderSize, estimateMegapixels,
} from "@/lib/map-export";

const ORIENTATIONS = [
  { key: "landscape", label: "Paysage" },
  { key: "portrait", label: "Portrait" },
];

export function ShareMenu() {
  const {
    shareOpen, setShareOpen, map,
    operators, technologies, periodDate, mapStyle, showDistricts, showWhiteZones,
  } = useMapStore();

  // Réglages par défaut de la version 2 : A4, portrait, PDF, 96 ppp.
  const [format, setFormat] = useState("pdf");
  const [size, setSize] = useState("A4");
  const [orientation, setOrientation] = useState("portrait");
  const [dpi, setDpi] = useState(96);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const dims = renderSize(size, orientation, dpi);
  const megapixels = estimateMegapixels(size, orientation, dpi);
  // Légende des couches réellement affichées — jointe au PDF.
  const legend = buildLegend(useMapStore.getState());
  const legendCount = legendItemCount(legend);

  const runExport = async () => {
    setBusy(true);
    setError("");
    try {
      await exportMapImage(map, {
        format, size, orientation, dpi,
        fileName: exportFileName(periodDate, format, size),
        legend: buildLegend(useMapStore.getState()),
        featureStates: useMapStore.getState().choroplethStates,
        title: "CARTODONNEES — Observatoire de la couverture, ARTCI",
        subtitle: `Période : ${periodLabel(periodDate)} · Référentiel : ${rgphFor(periodDate).label}`,
      });
    } catch (e) {
      setError(e?.message || "Export impossible.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const params = new URLSearchParams({
      op: operators.join(","),
      tech: technologies.join(","),
      date: periodDate,
      style: mapStyle,
      d: showDistricts ? "1" : "0",
      w: showWhiteZones ? "1" : "0",
    });
    const url = `${window.location.origin}${window.location.pathname}?${params}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copie impossible — le presse-papiers est refusé par le navigateur.");
    }
  };

  useEffect(() => {
    if (!shareOpen) { setCopied(false); setError(""); }
  }, [shareOpen]);

  return (
    <>
      <PrintableArea open={shareOpen} size={size} orientation={orientation} />
      <AnimatePresence>
        {shareOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="pointer-events-auto absolute right-3 top-[72px] z-40 w-[286px]"
          >
            <div className="glass rounded-2xl p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Partager &amp; exporter
                </span>
                <button onClick={() => setShareOpen(false)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-surface-2">
                  <X size={13} />
                </button>
              </div>

              <Field label="Format">
                <Segmented options={EXPORT_FORMATS.map((f) => ({ key: f.key, label: f.label }))} value={format} onChange={setFormat} />
              </Field>

              <Field label="Format de page">
                <Segmented options={Object.keys(PAGE_SIZES).map((k) => ({ key: k, label: k }))} value={size} onChange={setSize} />
              </Field>

              <Field label="Orientation">
                <Segmented options={ORIENTATIONS} value={orientation} onChange={setOrientation} />
              </Field>

              <Field label="Résolution">
                <Segmented
                  options={DPI_VALUES.map((d) => ({ key: d, label: `${d}` }))}
                  value={dpi}
                  onChange={setDpi}
                />
              </Field>

              <p className="mb-2 text-[10px] leading-relaxed text-muted">
                {dims.widthMm} × {dims.heightMm} mm · {dims.width} × {dims.height} px · {dpi} ppp
                {dims.clamped && " (réduit à la limite du navigateur)"}
              </p>

              {format === "pdf" && (
                <p className="mb-2 text-[10px] leading-relaxed text-muted">
                  {legendCount
                    ? `Le PDF porte un titre et la légende des ${legendCount} éléments affichés.`
                    : "Aucune couche affichée : le PDF ne portera pas de légende."}
                </p>
              )}

              {megapixels > 15 && !dims.clamped && (
                <p className="mb-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-artci-orange">
                  <AlertTriangle size={12} className="mt-px shrink-0" />
                  Rendu volumineux ({megapixels.toFixed(0)} Mpx) — le calcul peut prendre plusieurs secondes.
                </p>
              )}

              {error && (
                <p className="mb-2 rounded-lg border border-uncovered/30 bg-uncovered/10 px-2 py-1.5 text-[10.5px] font-semibold text-uncovered">
                  {error}
                </p>
              )}

              <button
                onClick={runExport}
                disabled={busy || !map}
                className="mb-1.5 flex w-full items-center justify-center gap-2 rounded-xl brand-gradient px-3 py-2.5 text-[12.5px] font-bold text-white shadow-sm transition-[filter] hover:brightness-105 disabled:opacity-60"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {busy ? "Rendu en cours…" : "Exporter la carte"}
              </button>

              <button
                onClick={copyLink}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] font-semibold transition-colors hover:bg-surface-2"
              >
                <span className="text-artci-green-700">
                  {copied ? <Check size={15} /> : <Link2 size={15} />}
                </span>
                {copied ? "Lien copié !" : "Copier le permalien"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-2">
      <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </div>
  );
}

/** Sélecteur compact à choix unique. */
function Segmented({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`flex-1 rounded-lg px-1.5 py-1.5 text-[11px] font-bold transition-colors ${
            value === o.key ? "brand-gradient text-white shadow-sm" : "border border-border text-muted hover:bg-surface-2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Zone imprimable (option `PrintableArea` de la version 2) : matérialise le
 * cadrage exact de l'export, avec un viseur au centre, tant que le panneau
 * est ouvert.
 */
function PrintableArea({ open, size, orientation }) {
  const { widthMm, heightMm } = renderSize(size, orientation, 96);
  const ratio = widthMm / heightMm;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-30 grid place-items-center"
        >
          <div
            className="relative border-2 border-dashed border-artci-orange/80"
            style={{
              aspectRatio: `${ratio}`,
              // Reste dans l'écran quelle que soit l'orientation choisie.
              width: ratio >= 1 ? "min(74vw, 74vh * " + ratio + ")" : "auto",
              height: ratio >= 1 ? "auto" : "min(74vh, 74vw / " + ratio + ")",
            }}
          >
            <span className="absolute -top-5 left-0 rounded bg-artci-orange px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white">
              Zone exportée · {size} {orientation === "portrait" ? "portrait" : "paysage"}
            </span>
            {/* Viseur central (option `Crosshair` de la version 2) */}
            <span className="absolute left-1/2 top-1/2 h-5 w-px -translate-x-1/2 -translate-y-1/2 bg-artci-orange/70" />
            <span className="absolute left-1/2 top-1/2 h-px w-5 -translate-x-1/2 -translate-y-1/2 bg-artci-orange/70" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
