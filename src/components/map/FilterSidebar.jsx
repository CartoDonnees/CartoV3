"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Radio,
  Network,
  Gauge,
  Smile,
  ChevronRight,
  ChevronDown,
  SatelliteDish,
  TowerControl,
  Cable,
  Waypoints,
  Shapes,
  Store,
  Headphones,
  Clock,
  BarChart3,
  MapPin,
  Signal,
  Wifi,
  MessageSquare,
  Route as RouteIcon,
} from "lucide-react";
import Link from "next/link";
import { useMapStore, periodLabel } from "@/stores/map-store";
import { getQosLocalities, getWhiteLocalities } from "@/lib/geodata";
import { rgphFor } from "@/lib/rgph";
import {
  OPERATORS,
  TECHNOLOGIES,
  TECH_COLORS,
  FIBER_PROVIDERS,
  ROAD_LAYERS,
  ADMIN_LIMITS,
} from "@/config/artci";
import { getStats } from "@/lib/geodata";
import { iconDataUri } from "@/lib/mapIcons";
import { formatNumber, formatPercent, cn } from "@/lib/utils";

export function FilterSidebar() {
  const {
    sidebarOpen,
    technologies,
    toggleTechnology,
    showWhiteZones,
    setFlag,
    controls,
    setControl,
    toggleControl,
    setDomain,
    qosOperators,
    toggleQosOperator,
    qosCampaigns,
    qosCampaign,
    setQosCampaign,
    adminLimits,
    setAdminLimit: setAdminLimitState,
    coverageLevel,
    setCoverageLevel,
    periodDate,
    setPeriod,
    periods,
  } = useMapStore();

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <motion.aside
          initial={{ x: -348, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -348, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto absolute bottom-3 left-3 top-[80px] z-20 flex w-[328px] flex-col"
        >
          <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-border/60 px-2 pb-1 pt-2">
              <div>
                <h2 className="text-[15px] font-bold uppercase tracking-wider text-muted">
                  Couches & filtres
                </h2>
                <div className="mt-0.5 text-[10px] text-muted">
                  <small>Référentiel de population de la période affichée</small>
                </div>
              </div>

                {/* Référentiel de population : déterminé par la période choisie
                    (RGPH 2014 jusqu'en 2025, RGPH 2021 à partir de 2026). */}
                <span
                  className="shrink-0 rounded-lg bg-artci-green/10 px-2.5 py-1.5 text-[12px] font-bold text-artci-green-700"
                  title={`Les statistiques du ${periodLabel(periodDate)} reposent sur le ${rgphFor(periodDate).label}`}
                >
                  {rgphFor(periodDate).label}
                </span>
              {/* <span className="rounded-full bg-artci-green/10 px-2 py-0.5 text-[10px] font-bold text-artci-green-700">
                {periodLabel(periodDate).split(" ").slice(-2).join(" ")}
              </span> */}
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-2">
              {/* ============ 1. COUVERTURE RÉSEAU ============ */}
              <MainSection
                icon={<Radio size={17} />}
                title="Couverture réseau"
                open={controls.network}
                onToggle={() => (controls.network ? toggleControl("network") : setDomain("coverage"))}
              >

                {/* Couverture globale */}
                <SubSection
                  icon={<SatelliteDish size={14} />}
                  title="Couverture globale"
                  open={controls.globalCov}
                  onToggle={() => toggleControl("globalCov")}
                >
                  <CheckRow
                    label="Localités"
                    checked={controls.showLocality}
                    onChange={(v) => setControl("showLocality", v)}
                    dot="#334155"
                  />
                  <CheckRow
                    label="Localités couvertes"
                    checked={controls.showCovLocalities}
                    onChange={(v) => setControl("showCovLocalities", v)}
                    dot="var(--covered)"
                  />
                  {controls.showCovLocalities && (
                    <TechChips
                      selected={technologies}
                      onToggle={toggleTechnology}
                      tone="green"
                    />
                  )}
                  <CheckRow
                    label="Localités non couvertes"
                    checked={controls.showNoCovLocalities}
                    onChange={(v) => setControl("showNoCovLocalities", v)}
                    dot="var(--uncovered)"
                  />
                  {controls.showNoCovLocalities && (
                    <TechChips
                      selected={technologies}
                      onToggle={toggleTechnology}
                      tone="red"
                    />
                  )}
                  <CheckRow
                    label="Zones blanches"
                    checked={showWhiteZones}
                    onChange={(v) => setFlag("showWhiteZones", v)}
                    dot="var(--white-zone)"
                    ring
                  />
                  {showWhiteZones && <WhiteZoneCount />}
                </SubSection>

                {/* Choroplèthe de couverture par découpage administratif */}
                <SubSection
                  icon={<Shapes size={14} />}
                  title="Choroplèthe de couverture"
                  open={controls.covLevels}
                  onToggle={() => toggleControl("covLevels")}
                >
                  <div className="px-1 p-0 text-[10px] leading-relaxed text-muted">
                    Carte thématique par découpage administratif.
                  </div>
                  <RadioRow
                    label="Aucun"
                    checked={coverageLevel == null}
                    onSelect={() => setCoverageLevel(null)}
                  />
                  {ADMIN_LIMITS.map((l) => (
                    <RadioRow
                      key={l.key}
                      label={l.label}
                      checked={coverageLevel === l.key}
                      onSelect={() => setCoverageLevel(l.key)}
                      dot={l.color}
                    />
                  ))}
                </SubSection>

                {/* Couverture par opérateur */}
                <SubSection
                  icon={<SatelliteDish size={14} />}
                  title="Couverture par opérateur"
                  open={controls.operatorCov}
                  onToggle={() => toggleControl("operatorCov")}
                >
                  <OperatorCoverage />
                </SubSection>

                {/* Statistiques nationales */}
                <SubSection
                  icon={<BarChart3 size={14} />}
                  title="Statistiques nationales"
                  open={controls.statCountry}
                  onToggle={() => toggleControl("statCountry")}
                >
                  <StatsBlock />
                </SubSection>
              </MainSection>

              {/* ============ 2. INFRASTRUCTURES ============ */}
              <MainSection
                icon={<TowerControl size={17} />}
                title="Infrastructures"
                open={controls.showInfra}
                onToggle={() => toggleControl("showInfra")}
              >
                {/* Fibres optiques */}
                <SubSection
                  icon={<Cable size={14} />}
                  title="Fibres optiques"
                  open={controls.showInfraRNHD}
                  onToggle={() => toggleControl("showInfraRNHD")}
                >
                  <div className="grid grid-cols-3 gap-2">
                    {OPERATORS.map((op) => (
                      <FiberCard
                        key={op.code}
                        name={op.name}
                        color={op.color}
                        km={op.fiberKm}
                        checked={controls[`showFiber${op.code}`]}
                        onChange={() => toggleControl(`showFiber${op.code}`)}
                      />
                    ))}
                    {FIBER_PROVIDERS.map((fp) => (
                      <FiberCard
                        key={fp.code}
                        name={fp.name}
                        color={fp.color}
                        km={fp.km}
                        checked={
                          controls[
                            `showFiber${fp.code === "ANSUT" ? "Ansut" : "Awale"}`
                          ]
                        }
                        onChange={() =>
                          toggleControl(
                            `showFiber${fp.code === "ANSUT" ? "Ansut" : "Awale"}`,
                          )
                        }
                      />
                    ))}
                  </div>
                </SubSection>

                {/* Stations radioélectriques */}
                <div className="px-1">
                  <CheckRow
                    label="Stations radioélectriques"
                    checked={controls.present}
                    onChange={(v) => setControl("present", v)}
                    icon={<Signal size={13} />}
                  />
                </div>

                {/* Réseau routier & ferroviaire */}
                <div className="space-y-0.5 rounded-xl bg-surface/40 p-1">
                  {ROAD_LAYERS.map((r) => (
                    <div key={r.key} className="flex items-center gap-2 px-1">
                      <CheckRow
                        label={r.label}
                        checked={controls[r.key]}
                        onChange={(v) => setControl(r.key, v)}
                        className="flex-1"
                      />
                      <span
                        className="h-0.5 w-6 rounded-full"
                        style={{
                          backgroundColor: r.color,
                          opacity: controls[r.key] ? 1 : 0.3,
                          borderTop: r.dashed
                            ? `2px dashed ${r.color}`
                            : undefined,
                          background: r.dashed ? "transparent" : r.color,
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Limites administratives */}
                <SubSection
                  icon={<Shapes size={14} />}
                  title="Limites administratives"
                  open={controls.adminLimit}
                  onToggle={() => toggleControl("adminLimit")}
                >
                  {ADMIN_LIMITS.map((l) => (
                    <div key={l.key} className="flex items-center gap-2">
                      <CheckRow
                        label={l.label}
                        checked={adminLimits[l.key]}
                        onChange={(v) => setAdminLimitState(l.key, v)}
                        className="flex-1"
                      />
                      <span
                        className="h-0.5 w-6 rounded-full"
                        style={{
                          backgroundColor: l.color,
                          opacity: adminLimits[l.key] ? 1 : 0.3,
                        }}
                      />
                    </div>
                  ))}
                </SubSection>

                {/* Points de commercialisation */}
                <SubSection
                  icon={<Store size={14} />}
                  title="Points de commercialisation"
                  badge="Bientôt"
                  open={controls.showInfraPtsCom}
                  onToggle={() => toggleControl("showInfraPtsCom")}
                >
                  <select
                    disabled
                    className="mb-2 w-full rounded-lg border border-border bg-surface/50 px-2.5 py-1.5 text-sm text-muted"
                  >
                    <option>Sélectionner un mois</option>
                  </select>
                  <div className="grid grid-cols-3 gap-2 opacity-50">
                    {OPERATORS.map((op) => (
                      <div
                        key={op.code}
                        className="rounded-xl border border-border p-2 text-center"
                      >
                        <span
                          className="grid h-8 w-8 place-items-center rounded-full text-[10px] font-bold text-white mx-auto"
                          style={{ backgroundColor: op.color }}
                        >
                          {op.code[0]}
                        </span>
                        <IosSwitch checked={false} disabled />
                      </div>
                    ))}
                  </div>
                </SubSection>
              </MainSection>

              {/* ============ 3. QUALITÉ DE SERVICE ============ */}
              <MainSection
                icon={<Gauge size={17} />}
                title="Qualité de service"
                open={controls.showQoS}
                onToggle={() => (controls.showQoS ? toggleControl("showQoS") : setDomain("qos"))}
              >
                <Field label="Audit règlementaire">
                  <select
                    value={qosCampaign ?? ""}
                    onChange={(e) => setQosCampaign(e.target.value)}
                    disabled={!qosCampaigns.length}
                    className="w-full rounded-lg border border-border bg-surface/70 px-2.5 py-1.5 text-sm outline-none focus:border-artci-green disabled:opacity-60"
                  >
                    {qosCampaigns.length ? (
                      qosCampaigns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))
                    ) : (
                      <option value="">Chargement des campagnes…</option>
                    )}
                  </select>
                </Field>

                <SubSection
                  icon={<MapPin size={14} />}
                  title="Localités auditées"
                  open={controls.qosOperator}
                  onToggle={() => toggleControl("qosOperator")}
                >
                  <CheckRow
                    label="Localités auditées"
                    checked={controls.showFieldLevel}
                    onChange={(v) => setControl("showFieldLevel", v)}
                    dot="maroon"
                  />
                  <AuditedCount campaign={qosCampaign} />
                </SubSection>

                <SubSection
                  icon={<SatelliteDish size={14} />}
                  title="Opérateurs"
                  open={controls.showQosOperator}
                  onToggle={() => toggleControl("showQosOperator")}
                >
                  <div className="grid grid-cols-3 gap-2">
                    {OPERATORS.map((op) => (
                      <div
                        key={op.code}
                        className="rounded-xl border border-border p-2 text-center"
                      >
                        <span
                          className="grid h-8 w-8 place-items-center rounded-full text-[10px] font-bold text-white mx-auto"
                          style={{ backgroundColor: op.color }}
                        >
                          {op.code[0]}
                        </span>
                        <button
                          onClick={() => toggleQosOperator(op.code)}
                          className="mt-1 flex w-full justify-center"
                        >
                          <IosSwitch
                            checked={qosOperators.includes(op.code)}
                            color={op.color}
                          />
                        </button>
                      </div>
                    ))}
                  </div>

                  {qosOperators.length > 0 && (
                    <>
                      <SubSection
                        nested
                        icon={<Waypoints size={13} />}
                        title="Services de base"
                        open={controls.showServiceBase}
                        onToggle={() => toggleControl("showServiceBase")}
                      >
                        <CheckRow
                          label="Voix"
                          checked={controls.showVoiceService}
                          onChange={(v) => setControl("showVoiceService", v)}
                          icon={<Signal size={12} />}
                        />
                        <CheckRow
                          label="SMS"
                          checked={controls.showSmsService}
                          onChange={(v) => setControl("showSmsService", v)}
                          icon={<MessageSquare size={12} />}
                        />
                        <CheckRow
                          label="Internet"
                          checked={controls.showDataService}
                          onChange={(v) => setControl("showDataService", v)}
                          icon={<Wifi size={12} />}
                        />
                      </SubSection>

                      <SubSection
                        nested
                        icon={<RouteIcon size={13} />}
                        title="Services connexes"
                        open={controls.qosConnexService}
                        onToggle={() => toggleControl("qosConnexService")}
                      >
                        <CheckRow
                          label="Voix - Axes routiers"
                          checked={false}
                          onChange={() => {}}
                          disabled
                        />
                        <button
                          disabled
                          className="mt-1 flex w-full items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted opacity-60"
                        >
                          <Headphones size={13} /> Voix - Centres d'appels
                        </button>
                      </SubSection>

                      <SubSection
                        nested
                        icon={<Gauge size={13} />}
                        title="Niveaux de champs"
                        badge="Bientôt"
                        open={controls.qosFieldLevel}
                        onToggle={() => toggleControl("qosFieldLevel")}
                      >
                        <p className="px-1 text-[11px] italic text-muted">
                          Données de niveaux de champs à venir.
                        </p>
                      </SubSection>
                    </>
                  )}
                </SubSection>

                <SubSection
                  icon={<BarChart3 size={14} />}
                  title="Statistiques audits"
                  open={controls.statAudit}
                  onToggle={() => toggleControl("statAudit")}
                >
                  <Link
                    href="/tableau-de-bord/qos?tab=historique"
                    className="flex w-full items-center gap-2 rounded-lg bg-surface/70 px-2.5 py-2 text-xs font-semibold hover:bg-surface-2"
                  >
                    <Clock size={13} className="text-artci-green-700" /> Historiques
                  </Link>
                  <Link
                    href="/tableau-de-bord/qos"
                    className="mt-1.5 flex w-full items-center gap-2 rounded-lg bg-surface/70 px-2.5 py-2 text-xs font-semibold hover:bg-surface-2"
                  >
                    <BarChart3 size={13} className="text-artci-green-700" /> Bilan d'audit
                  </Link>
                </SubSection>
              </MainSection>

              {/* ============ 4. QUALITÉ D'EXPÉRIENCE ============ */}
              <MainSection
                icon={<Smile size={17} />}
                title="Qualité d'expérience"
                badge="Bientôt"
                disabled
              />
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ---------- Primitives ---------- */

function MainSection({
  icon,
  title,
  open,
  onToggle,
  badge,
  disabled, 
  children,
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-surface/50">
      <button
        onClick={() => !disabled && onToggle?.()}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-3 text-left",
          disabled && "cursor-default",
        )}
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl brand-gradient text-white shadow-sm">
          {icon}
        </span>
        <span className="flex-1 text-sm font-extrabold tracking-tight">
          {title}
        </span>
        {badge && (
          <span className="rounded-full bg-artci-orange/12 px-2 py-0.5 text-[10px] font-bold text-artci-orange-600">
            {badge}
          </span>
        )}
        {!disabled &&
          (open ? (
            <ChevronDown size={16} className="text-muted" />
          ) : (
            <ChevronRight size={16} className="text-muted" />
          ))}
      </button>
      <AnimatePresence initial={false}>
        {open && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="space-y-2.5 px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SubSection({ icon, title, open, onToggle, badge, nested, children }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl",
        nested ? "bg-surface/40" : "bg-surface/70 ring-1 ring-border/60",
      )}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-artci-green/10 text-artci-green-700">
          {icon}
        </span>
        <span className="flex-1 text-[13px] font-bold">{title}</span>
        {badge && (
          <span className="rounded-full bg-artci-orange/12 px-1.5 py-0.5 text-[9px] font-bold text-artci-orange-600">
            {badge}
          </span>
        )}
        {open ? (
          <ChevronDown size={14} className="text-muted" />
        ) : (
          <ChevronRight size={14} className="text-muted" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="space-y-1.5 px-2.5 pb-2.5 pt-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block px-1">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Nombre de zones blanches et population privée de réseau, pour la période. */
function WhiteZoneCount() {
  const periodDate = useMapStore((st) => st.periodDate);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let alive = true;
    setInfo(null);
    getWhiteLocalities(periodDate)
      .then((d) => {
        const f = d?.features ?? [];
        alive && setInfo({ n: f.length, pop: f.reduce((a, x) => a + (Number(x.properties?.pop) || 0), 0) });
      })
      .catch(() => alive && setInfo({ n: 0, pop: 0 }));
    return () => { alive = false; };
  }, [periodDate]);

  return (
    <p className="px-1 text-[11px] italic text-muted">
      {info === null
        ? "Chargement…"
        : `${formatNumber(info.n)} localités · ${formatNumber(info.pop)} habitants sans réseau`}
    </p>
  );
}

/** Taille de l'échantillon audité pour la campagne choisie. */
function AuditedCount({ campaign }) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!campaign) return;
    let alive = true;
    setCount(null);
    getQosLocalities(campaign)
      .then((d) => alive && setCount(d?.features?.length ?? 0))
      .catch(() => alive && setCount(0));
    return () => { alive = false; };
  }, [campaign]);

  return (
    <p className="px-1 text-[11px] italic text-muted">
      {count === null ? "Chargement de l'échantillon…" : `Total : ${count} localités auditées`}
    </p>
  );
}

/** Couverture par opérateur : cartes modernes, technologies par opérateur, affichage carte. */
function OperatorCoverage() {
  const { mapOperators, toggleMapOperator, operatorTechs, toggleOperatorTech, operatorList } = useMapStore();

  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] leading-relaxed text-muted">
        Sélectionnez un opérateur et ses technologies. Sur une localité couverte
        par plusieurs opérateurs, leurs triangles forment un trèfle.
      </p>

      {operatorList.map((op) => {
        const active = mapOperators.includes(op.code);
        const opTechs = operatorTechs[op.code] ?? [];
        return (
          <div
            key={op.code}
            className={cn(
              "flex items-center gap-2 rounded-xl border p-2 transition-all",
              active ? "border-transparent shadow-sm" : "border-border",
            )}
            style={active ? { background: `color-mix(in oklab, ${op.color} 10%, transparent)` } : undefined}
          >
            {/* Sélection de l'opérateur (affichage carte) */}
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label={`Afficher ${op.name} sur la carte`}
              onClick={() => toggleMapOperator(op.code)}
              className="flex min-w-0 items-center gap-1.5"
            >
              <TinyCheck checked={active} color={op.color} />
              <img src={iconDataUri(`ic-op-${op.code}`)} alt="" className="h-5 w-5 shrink-0" />
              <span className="truncate text-[12.5px] font-bold">{op.name.split(" ")[0]}</span>
            </button>

            {/* Technologies associées (checkboxes, même ligne) */}
            <div className={cn("ml-auto flex items-center gap-2", !active && "opacity-55")}>
              {TECHNOLOGIES.map((t) => {
                const on = opTechs.includes(t.code);
                const c = 'black';
                return (
                  <button
                    key={t.code}
                    onClick={() => toggleOperatorTech(op.code, t.code)}
                    className="flex items-center gap-1"
                    aria-pressed={on}
                  >
                    <TinyCheck checked={on} color={c} />
                    <span className="text-[11px] font-bold" style={{ color: on ? c : "var(--muted)" }}>
                      {t.code}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Petite case à cocher colorée (opérateurs & technologies). */
function TinyCheck({ checked, color = "var(--artci-green)" }) {
  return (
    <span
      className={cn(
        "grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-colors",
        !checked && "border-border bg-surface",
      )}
      style={checked ? { borderColor: color, backgroundColor: color } : undefined}
    >
      {checked && <Check14 />}
    </span>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
  dot,
  ring,
  icon,
  disabled,
  className,
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors",
        disabled ? "opacity-50" : "hover:bg-surface-2",
        className,
      )}
    >
      <span
        className={cn(
          "grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-colors",
          checked
            ? "border-artci-green bg-artci-green"
            : "border-border bg-surface",
        )}
      >
        {checked && <Check14 />}
      </span>
      {dot && (
        <span
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full",
            ring && "ring-1 ring-border",
          )}
          style={{ backgroundColor: dot }}
        />
      )}
      {icon && <span className="text-muted">{icon}</span>}
      <span className="text-[13px] font-medium text-foreground/90">
        {label}
      </span>
    </button>
  );
}

/** Bouton radio (sélection unique) - utilisé pour le niveau de choroplèthe. */
function RadioRow({ label, checked, onSelect, dot }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      role="radio"
      aria-checked={checked}
      className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
    >
      <span
        className={cn(
          "grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors",
          checked ? "border-artci-green" : "border-border bg-surface",
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-artci-green" />}
      </span>
      {dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
      <span className="text-[13px] font-medium text-foreground/90">{label}</span>
    </button>
  );
}

function TechChips({ selected, onToggle, tone }) {
  return (
    <div className="flex items-center gap-4 pl-8">
      {TECHNOLOGIES.map((t) => {
        const active = selected.includes(t.code);
        const c = tone === "red" ? "var(--uncovered)" : TECH_COLORS[t.code];
        return (
          <button
            key={t.code}
            type="button"
            onClick={() => onToggle(t.code)}
            aria-pressed={active}
            className="flex items-center gap-1.5"
          >
            <TinyCheck checked={active} color={c} />
            <span
              className="text-[12px] font-bold"
              style={{ color: active ? c : "var(--muted)" }}
            >
              {t.code}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function IosSwitch({ checked, color, disabled }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        disabled && "opacity-50",
      )}
      style={{
        backgroundColor: checked
          ? (color ?? "var(--artci-green)")
          : "var(--surface-2)",
      }}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-[2px]",
        )}
      />
    </span>
  );
}

function FiberCard({ name, color, km, checked, onChange }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "rounded-xl border p-2 text-center transition-all",
        checked
          ? "border-transparent bg-surface/80 shadow-sm"
          : "border-border opacity-70",
      )}
    >
      <span
        className="mx-auto block h-1.5 w-8 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="mt-1 truncate text-[11px] font-bold">{name}</div>
      <div className="text-[9px] text-muted">{formatNumber(km)} km</div>
      <div className="mt-1 flex justify-center">
        <IosSwitch checked={checked} color={color} />
      </div>
    </button>
  );
}

function StatsBlock() {
  const periodDate = useMapStore((s) => s.periodDate);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    getStats(periodDate)
      .then((s) => active && setStats(s))
      .catch(() => active && setStats(null));
    return () => {
      active = false;
    };
  }, [periodDate]);

  if (!stats) {
    return (
      <div className="grid h-24 place-items-center text-xs text-muted">
        Chargement des statistiques…
      </div>
    );
  }

  const covPct = (stats.locCov * 100) / stats.locs;
  const noCovPct = (stats.locNoCov * 100) / stats.locs;
  const popCovPct = (stats.popCov * 100) / stats.pop;
  const popNoCovPct = (stats.popNoCov * 100) / stats.pop;

  return (
    <div className="space-y-2">
      <div className="rounded-xl bg-surface/70 p-2.5 text-[12px]">
        <Line label="Total localités" value={formatNumber(stats.locs)} strong />
        <Line
          label="Couvertes"
          value={`${formatNumber(stats.locCov)} · ${formatPercent(covPct)}`}
          accent="green"
        />
        <Line
          label="Non couvertes"
          value={`${formatNumber(stats.locNoCov)} · ${formatPercent(noCovPct)}`}
          accent="red"
        />
      </div>
      <div className="rounded-xl bg-surface/70 p-2.5 text-[12px]">
        <Line label="Total population" value={formatNumber(stats.pop)} strong />
        <Line
          label="Couverte"
          value={`${formatNumber(stats.popCov)} · ${formatPercent(popCovPct)}`}
          accent="green"
        />
        <Line
          label="Non couverte"
          value={`${formatNumber(stats.popNoCov)} · ${formatPercent(popNoCovPct)}`}
          accent="red"
        />
      </div>
      <div className="overflow-hidden rounded-xl bg-surface/70">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-surface-2/70 text-muted">
              <th className="px-2 py-1.5 text-left font-semibold">Tech.</th>
              <th className="px-1 py-1.5 text-center font-semibold">
                Localités
              </th>
              <th className="px-1 py-1.5 text-center font-semibold">
                Population
              </th>
            </tr>
          </thead>
          <tbody>
            {TECHNOLOGIES.map((t) => (
              <tr key={t.code} className="border-t border-border/50">
                <td className="px-2 py-1 font-bold">{t.code}</td>
                <td className="px-1 py-1 text-center">
                  <div className="font-semibold">
                    {formatNumber(stats[`cov${t.code}`])}
                  </div>
                  <div className="text-[10px] text-artci-green-700">
                    {formatPercent(stats[`perCov${t.code}`])}
                  </div>
                </td>
                <td className="px-1 py-1 text-center">
                  <div className="font-semibold">
                    {formatNumber(stats[`pop${t.code}`])}
                  </div>
                  <div className="text-[10px] text-artci-green-700">
                    {formatPercent(stats[`perPop${t.code}`])}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Line({ label, value, strong, accent }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted">{label}</span>
      <span
        className={cn(
          "font-bold",
          strong && "text-foreground",
          accent === "green" && "text-artci-green-700",
          accent === "red" && "text-uncovered",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Check14() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 13l4 4L19 7"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
