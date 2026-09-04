"use client";

import { AnimatePresence, motion } from "motion/react";
import { X, MapPinned, Radio, Network, Shapes, Gauge } from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { iconDataUri, qosIconId } from "@/lib/mapIcons";
import { FIBER_LAYERS, ROAD_LAYERS } from "@/config/artci";

/* Couverture des localités par technologie (meilleure techno disponible) */
const COVERAGE = [
  { icon: "ic-tech-4G", label: "Couverte en 4G", desc: "Internet mobile très haut débit - meilleure technologie disponible." },
  { icon: "ic-tech-3G", label: "Couverte en 3G", desc: "Internet mobile (haut débit)." },
  { icon: "ic-tech-2G", label: "Couverte en 2G", desc: "Voix et SMS (réseau de base)." },
  { icon: "ic-uncovered", label: "Localité non couverte", desc: "Aucun réseau mobile pour les technologies sélectionnées." },
  { icon: "ic-white", label: "Zone blanche", desc: "Non couverte et sans prévision de couverture à court/moyen terme. Signalée par un halo sombre, d'autant plus large que la population privée de réseau est nombreuse." },
];

/* Couverture par opérateur */
const OPS = [
  { icon: "ic-op-MOOV", label: "Couverture Moov Africa", desc: "Localités couvertes par le réseau Moov Africa.", color: "#0aa0dd" },
  { icon: "ic-op-MTN", label: "Couverture MTN", desc: "Localités couvertes par le réseau MTN.", color: "#ffcc00" },
  { icon: "ic-op-ORANGE", label: "Couverture Orange", desc: "Localités couvertes par le réseau Orange.", color: "#f47b20" },
];

/* Qualité de service : marqueurs d'audit (les anneaux suivent les opérateurs cochés) */
const QOS = [
  { icon: "ic-qos-audited", label: "Localité auditée", desc: "Localité retenue dans l'échantillon de la campagne d'audit." },
  { icon: qosIconId("VOIX", ["MOOV", "MTN", "ORANGE"]), label: "Audit Voix", desc: "Taux d'échec, de bonne desserte, de coupure et de mauvaise qualité." },
  { icon: qosIconId("SMS", ["MOOV", "MTN", "ORANGE"]), label: "Audit SMS", desc: "Taux d'échec, d'émission et de réception dans les délais." },
  { icon: qosIconId("DATA", ["MOOV", "MTN", "ORANGE"]), label: "Audit Internet", desc: "Taux de connexion et débits moyens montant / descendant." },
];

/* Infrastructures : mêmes couleurs que les couches de la carte. */
const FIBER_DESC = {
  showFiberORANGE: "Tracé du réseau de fibre optique d'Orange (~12 296 km).",
  showFiberMTN: "Tracé du réseau de fibre optique de MTN (~5 800 km).",
  showFiberAwale: "Tracé du réseau de fibre optique d'Awalé (~2 388 km).",
  showFiberAnsut: "Réseau national haut débit de l'ANSUT.",
};
const INFRA = [
  ...FIBER_LAYERS.map((f) => ({ color: f.color, label: f.label, desc: FIBER_DESC[f.ctrl], dashed: false })),
  ...ROAD_LAYERS.map((r) => ({
    color: r.color,
    label: r.label,
    desc: r.classes
      ? "Tracé issu du réseau routier du fond de carte."
      : "Réseau ferroviaire national.",
    dashed: r.dashed,
  })),
];

/* Limites administratives (lignes) */
const ADMIN = [
  { color: "#7c3aed", label: "Districts", desc: "Limites des 14 districts." },
  { color: "#2563eb", label: "Régions", desc: "Limites des 33 régions." },
  { color: "#0891b2", label: "Départements", desc: "Limites des départements." },
  { color: "#94a3b8", label: "Sous-préfectures", desc: "Limites des sous-préfectures." },
];

export function LegendModal() {
  const { legendOpen, setLegendOpen } = useMapStore();

  return (
    <AnimatePresence>
      {legendOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/25 p-4"
          onClick={() => setLegendOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.94, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 12, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex max-h-[82vh] w-full max-w-3xl flex-col rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Légende de la carte</h2>
                <p className="text-xs text-muted">Signification des éléments et niveaux de couverture affichés.</p>
              </div>
              <button onClick={() => setLegendOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-surface-2">
                <X size={17} />
              </button>
            </div>

            <div className="grid gap-6 overflow-y-auto p-6 sm:grid-cols-2">
              <Group icon={<MapPinned size={15} />} title="Couverture des localités">
                {COVERAGE.map((it) => <PinRow key={it.icon} {...it} />)}
                <p className="pt-1 text-[11px] leading-relaxed text-muted">
                  Chaque technologie sélectionnée s'affiche <strong className="font-semibold text-foreground">distinctement</strong> : sur une localité couverte par plusieurs technologies, les icônes 2G / 3G / 4G apparaissent côte à côte.
                </p>
              </Group>

              <Group icon={<Radio size={15} />} title="Couverture par opérateur">
                {OPS.map((it) => <PinRow key={it.icon} {...it} />)}
                <p className="pt-1 text-[11px] leading-relaxed text-muted">
                  Sur la carte, chaque opérateur est un <strong className="font-semibold text-foreground">triangle</strong> (Orange en bas, MTN en haut à gauche, Moov en haut à droite). Sur une localité couverte par plusieurs opérateurs, ils forment un <strong className="font-semibold text-foreground">trèfle</strong> ; seuls les opérateurs sélectionnés s'affichent.
                </p>
              </Group>

              <Group icon={<Gauge size={15} />} title="Qualité de service">
                {QOS.map((it) => <PinRow key={it.icon} {...it} />)}
                <p className="pt-1 text-[11px] leading-relaxed text-muted">
                  L'<strong className="font-semibold text-foreground">anneau</strong> du marqueur se découpe en un arc par opérateur audité - bleu Moov, jaune MTN, orange Orange. Cliquez un marqueur pour lire les indicateurs et leur conformité aux seuils réglementaires.
                </p>
              </Group>

              <Group icon={<Network size={15} />} title="Infrastructures">
                {INFRA.map((it) => <LineRow key={it.label} {...it} />)}
              </Group>

              <Group icon={<Shapes size={15} />} title="Limites administratives">
                {ADMIN.map((it) => <LineRow key={it.label} {...it} />)}
              </Group>
            </div>

            <div className="border-t border-border/60 px-6 py-3 text-[11px] text-muted">
              Données déclaratives des opérateurs · Effectif de la population : RGPH 2021, INS.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Group({ icon, title, children }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg brand-gradient text-white">{icon}</span>
        <h3 className="text-sm font-bold">{title}</h3>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function PinRow({ icon, label, desc }) {
  return (
    <div className="flex items-start gap-3">
      <img src={iconDataUri(icon)} alt="" className="mt-0.5 h-8 w-auto shrink-0 drop-shadow-sm" />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{label}</div>
        <div className="text-[11px] leading-snug text-muted">{desc}</div>
      </div>
    </div>
  );
}

function LineRow({ color, label, desc, dashed }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-2 h-0 w-7 shrink-0" style={{ borderTop: `${dashed ? "3px dashed" : "3px solid"} ${color}`, borderRadius: 3 }} />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{label}</div>
        <div className="text-[11px] leading-snug text-muted">{desc}</div>
      </div>
    </div>
  );
}
