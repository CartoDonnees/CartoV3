"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Flag, X, Loader2, CheckCircle2, ChevronLeft, Smartphone, RadioTower, MapPin,
  Phone, Mail, MessageSquare, Crosshair,
} from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { api } from "@/lib/api-client";
import { EntityPicker } from "./EntityPicker";

const SRC = "report";

/** Groupes de problèmes réseau, par service (comme en version 2). */
const LEVEL_GROUPS = [
  { level: "VOICE", label: "Appels (voix)" },
  { level: "SMS", label: "SMS" },
  { level: "DATA", label: "Internet mobile" },
];

const toFC = (reports) => ({
  type: "FeatureCollection",
  features: (reports || [])
    .filter((r) => Number.isFinite(r.lng) && Number.isFinite(r.lat))
    .map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: { type: r.type },
    })),
});

export function ReportTool() {
  const { map, setActiveTool, reports, submitReport, loadReports, operatorList } = useMapStore();

  // Parcours : 0 = choix du type, 1 = plateforme, 2 = opérateur mobile
  const [step, setStep] = useState(0);
  const [problems, setProblems] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [operators, setOperators] = useState(new Set());
  const [locality, setLocality] = useState(null);
  const [pin, setPin] = useState(null); // point cliqué sur la carte
  const [picking, setPicking] = useState(false);
  const [form, setForm] = useState({ phone: "", email: "", comment: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");

  /* ------------------------- Carte de chaleur --------------------------- */
  useEffect(() => {
    if (!map) return;
    loadReports?.();
    if (!map.getSource(SRC)) {
      map.addSource(SRC, { type: "geojson", data: toFC(reports) });
      map.addLayer({
        id: `${SRC}-heat`, type: "heatmap", source: SRC,
        paint: {
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 5, 14, 12, 40],
          "heatmap-opacity": 0.55,
        },
      });
      map.addLayer({
        id: `${SRC}-pt`, type: "circle", source: SRC,
        paint: {
          "circle-radius": 4.5, "circle-color": "#e11d48",
          "circle-stroke-color": "#fff", "circle-stroke-width": 1.4,
        },
      });
    }
    return () => {
      [`${SRC}-heat`, `${SRC}-pt`].forEach((id) => map.getLayer(id) && map.removeLayer(id));
      if (map.getSource(SRC)) map.removeSource(SRC);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    map?.getSource(SRC)?.setData(toFC(reports));
  }, [map, reports]);

  // Sélection d'un point précis sur la carte (facultatif).
  useEffect(() => {
    if (!map || !picking) return;
    const onClick = (e) => {
      setPin([e.lngLat.lng, e.lngLat.lat]);
      setPicking(false);
    };
    map.getCanvas().style.cursor = "crosshair";
    map.once("click", onClick);
    return () => {
      map.getCanvas().style.cursor = "";
      map.off("click", onClick);
    };
  }, [map, picking]);

  /* --------------------------- Taxonomie -------------------------------- */
  useEffect(() => {
    if (step === 0 || problems) return;
    const type = step === 1 ? "APPLICATION" : "NETWORK";
    api(`/api/v1/problems?type=${type}`).then(setProblems).catch(() => setProblems([]));
  }, [step, problems]);

  const goto = (s) => {
    setStep(s);
    setProblems(null);
    setSelected(new Set());
    setError("");
  };

  const toggle = (set, setter, v) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    setter(next);
  };

  const grouped = useMemo(() => {
    if (!problems) return [];
    if (step === 1) return [{ level: "APP", label: "Problèmes rencontrés", items: problems }];
    return LEVEL_GROUPS.map((g) => ({ ...g, items: problems.filter((p) => p.level === g.level) })).filter(
      (g) => g.items.length,
    );
  }, [problems, step]);

  const submit = async () => {
    setSending(true);
    setError("");
    const payload = {
      kind: step === 1 ? "app" : "network",
      problems: [...selected],
      phone: form.phone,
      email: form.email,
      comment: form.comment,
    };
    if (step === 2) {
      payload.operators = [...operators];
      payload.locality = locality?.name;
      payload.lng = pin ? pin[0] : locality?.lng;
      payload.lat = pin ? pin[1] : locality?.lat;
    }
    const res = await submitReport(payload);
    setSending(false);
    if (res.ok) {
      setDone(payload.kind);
      loadReports?.();
    } else {
      setError(res.error || "Envoi impossible.");
    }
  };

  /* ------------------------------- Rendu -------------------------------- */
  // Pendant la sélection d'un point, le modal s'efface pour laisser accéder à la carte.
  if (picking) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="pointer-events-auto absolute left-1/2 top-24 z-[60] -translate-x-1/2"
      >
        <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg">
          <Crosshair size={16} className="animate-pulse text-artci-orange" />
          <span className="text-sm font-bold">Cliquez sur la carte pour situer le problème</span>
          <button
            onClick={() => setPicking(false)}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2"
          >
            Annuler
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="pointer-events-auto absolute inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={() => setActiveTool(null)}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 16, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="glass flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl"
      >
        {/* En-tête */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-5 py-4">
          {step !== 0 && !done ? (
            <button onClick={() => goto(0)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-foreground" title="Retour">
              <ChevronLeft size={18} />
            </button>
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl brand-gradient text-white shadow-md">
              <Flag size={18} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-extrabold leading-tight tracking-tight">Signaler un problème</h2>
            <p className="text-[11px] text-muted">
              {step === 0 ? "Votre déclaration est transmise à l'ARTCI"
                : step === 1 ? "Problème sur la plateforme CARTODONNEES"
                : "Problème avec un opérateur mobile"}
            </p>
          </div>
          <button onClick={() => setActiveTool(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-foreground" aria-label="Fermer">
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {done ? (
            <div className="py-8 text-center">
              <CheckCircle2 size={40} className="mx-auto mb-3 text-artci-green" />
              <p className="text-sm font-bold">Signalement enregistré</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                Merci, votre déclaration a bien été transmise à l'ARTCI. Elle sera examinée par nos services.
              </p>
              <button
                onClick={() => { setDone(null); goto(0); setForm({ phone: "", email: "", comment: "" }); setOperators(new Set()); setLocality(null); setPin(null); }}
                className="mt-4 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted hover:bg-surface-2"
              >
                Faire un autre signalement
              </button>
            </div>
          ) : step === 0 ? (
            /* -------- Choix de la nature du problème (comme en V2) -------- */
            <>
              <p className="mb-3 text-[12px] leading-relaxed text-muted">
                Quel type de problème souhaitez-vous signaler&nbsp;?
              </p>
              <div className="space-y-2">
                <ChoiceCard
                  icon={RadioTower}
                  title="Problème avec un opérateur mobile"
                  desc="Pas de réseau, appels coupés, internet lent… à un endroit précis."
                  onClick={() => goto(2)}
                />
                <ChoiceCard
                  icon={Smartphone}
                  title="Problème sur la plateforme"
                  desc="Anomalie de la carte, donnée erronée, difficulté d'utilisation."
                  onClick={() => goto(1)}
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className={step === 2 ? "grid gap-4 md:grid-cols-2" : ""}>
              {/* -------- Opérateurs + localité (réseau uniquement) -------- */}
              {step === 2 && (
                <div className="space-y-3">
                  <Field label="Opérateur(s) concerné(s)">
                    <div className="flex flex-wrap gap-1.5">
                      {operatorList.map((o) => {
                        const on = operators.has(o.code);
                        return (
                          <button
                            key={o.code}
                            onClick={() => toggle(operators, setOperators, o.code)}
                            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-bold transition-colors"
                            style={on
                              ? { borderColor: "transparent", background: `color-mix(in oklab, ${o.color} 16%, transparent)`, color: o.color }
                              : { borderColor: "var(--border)", color: "var(--muted)" }}
                          >
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />
                            {o.name.split(" ")[0]}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <EntityPicker label="Localité concernée" value={locality} onSelect={setLocality} placeholder="Rechercher une localité…" />

                  <button
                    onClick={() => setPicking((v) => !v)}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors ${
                      picking ? "border-artci-orange bg-artci-orange/10 text-artci-orange" : "border-border text-muted hover:bg-surface-2"
                    }`}
                  >
                    <Crosshair size={13} />
                    {pin ? "Point précis sélectionné ✓" : "Préciser un point sur la carte (facultatif)"}
                  </button>
                </div>
              )}

              {/* ------------------ Problèmes rencontrés ------------------- */}
              <div className="space-y-3">
              {!problems ? (
                <div className="flex items-center gap-2 py-4 text-xs text-muted">
                  <Loader2 size={13} className="animate-spin" /> Chargement…
                </div>
              ) : (
                grouped.map((g) => (
                  <Field key={g.level} label={g.label}>
                    <div className="space-y-1">
                      {g.items.map((p) => (
                        <label key={p.code} className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 hover:bg-surface-2">
                          <input
                            type="checkbox"
                            checked={selected.has(p.code)}
                            onChange={() => toggle(selected, setSelected, p.code)}
                            className="mt-0.5 h-3.5 w-3.5 accent-[var(--artci-green)]"
                          />
                          <span className="text-[12.5px] leading-snug">{p.title}</span>
                        </label>
                      ))}
                    </div>
                  </Field>
                ))
              )}
              </div>
              </div>

              {/* ------------------------ Coordonnées ---------------------- */}
              <div className="grid gap-4 md:grid-cols-2">
              <Field label="Vos coordonnées (facultatif)">
                <div className="space-y-1.5">
                  <IconInput icon={Phone} type="tel" placeholder="Téléphone - ex. 07 00 00 00 00"
                    value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
                  <IconInput icon={Mail} type="email" placeholder="Adresse e-mail"
                    value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
                </div>
              </Field>

              <Field label="Commentaire">
                <div className="flex items-start gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2 focus-within:border-artci-green">
                  <MessageSquare size={13} className="mt-1 shrink-0 text-muted" />
                  <textarea
                    rows={3}
                    value={form.comment}
                    onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                    placeholder="Décrivez le problème rencontré…"
                    className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted"
                  />
                </div>
              </Field>
              </div>

              {error && <p className="rounded-lg bg-uncovered/10 px-3 py-2 text-[11.5px] font-semibold text-uncovered">{error}</p>}

              <button
                onClick={submit}
                disabled={sending}
                className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-60"
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Flag size={15} />}
                Envoyer le signalement
              </button>
              <p className="text-center text-[10.5px] leading-relaxed text-muted">
                Les signalements alimentent la carte de chaleur et sont transmis à l'ARTCI.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ChoiceCard({ icon: Icon, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-surface/60 px-3 py-3 text-left transition-all hover:border-artci-green hover:bg-artci-green/8"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-artci-green/12 text-artci-green-700">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold leading-snug">{title}</span>
        <span className="block text-[11px] leading-snug text-muted">{desc}</span>
      </span>
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </div>
  );
}

function IconInput({ icon: Icon, value, onChange, ...props }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2 focus-within:border-artci-green">
      <Icon size={13} className="shrink-0 text-muted" />
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
      />
    </div>
  );
}
