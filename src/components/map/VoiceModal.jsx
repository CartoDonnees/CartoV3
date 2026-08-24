"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Mic, X, Search, RotateCcw, MapPin, Sparkles, Loader2, Keyboard, Pause, CornerDownLeft, Globe2,
} from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { api } from "@/lib/api-client";

// Zoom appliqué selon le niveau administratif retenu.
const LEVEL_ZOOM = { national: 5.6, district: 6.8, region: 7.6, department: 9, subPrefecture: 10.5, locality: 12 };

// Exemples cliquables : montrent d'emblée ce que l'on peut demander.
const EXAMPLES = [
  "Couverture 2G Orange",
  "Couverture à Korhogo",
  "La 4G de MTN à Bouaké",
  "District des Montagnes",
];

// Délai de silence après lequel la recherche se lance toute seule.
const AUTO_SUBMIT_MS = 1800;

/**
 * Modal de requête vocale : écoute (Web Speech API), transcrit en direct,
 * laisse corriger au clavier, interprète la demande (IA + repli local) puis
 * propose les entités correspondantes avec leur couverture.
 */
export function VoiceModal() {
  const voiceOpen = useMapStore((s) => s.voiceOpen);
  const setVoiceOpen = useMapStore((s) => s.setVoiceOpen);
  const setSearch = useMapStore((s) => s.setSearch);
  const flyTo = useMapStore((s) => s.flyTo);
  const setStatsPopup = useMapStore((s) => s.setStatsPopup);
  const periodDate = useMapStore((s) => s.periodDate);

  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [edited, setEdited] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [interpreted, setInterpreted] = useState(null);
  const [error, setError] = useState("");
  const [autoIn, setAutoIn] = useState(false); // recherche auto imminente

  const recRef = useRef(null);
  const finalRef = useRef("");
  const silenceRef = useRef(null);
  const interpretRef = useRef(null);

  /** Envoie la transcription pour interprétation puis recherche d'entité. */
  const interpret = useCallback(
    async (raw) => {
      const text = (raw ?? transcript).trim();
      if (!text) return;
      clearTimeout(silenceRef.current);
      setAutoIn(false);
      try { recRef.current?.stop(); } catch { /* ignore */ }
      setListening(false);
      setInterpreting(true);
      setError("");
      try {
        const data = await api("/api/v1/voice-query", { method: "POST", body: { transcript: text, date: periodDate } });
        setInterpreted(data);
        if (!data.results?.length) setError("Aucune donnée trouvée pour cette demande.");
      } catch (e) {
        setError(e.message || "Interprétation impossible.");
      } finally {
        setInterpreting(false);
      }
    },
    [transcript, periodDate],
  );
  interpretRef.current = interpret;

  // Initialise et démarre la reconnaissance à l'ouverture.
  useEffect(() => {
    if (!voiceOpen) return;
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    finalRef.current = "";
    setTranscript("");
    setEdited(false);
    setInterpreted(null);
    setError("");
    setAutoIn(false);
    if (!SR) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const rec = new SR();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += t + " ";
        else interim += t;
      }
      const text = (finalRef.current + interim).replace(/\s+/g, " ").trim();
      setTranscript(text);

      // Fin de phrase : on lance la recherche après un court silence.
      clearTimeout(silenceRef.current);
      if (text) {
        setAutoIn(true);
        silenceRef.current = setTimeout(() => interpretRef.current?.(text), AUTO_SUBMIT_MS);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;

    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
    return () => {
      clearTimeout(silenceRef.current);
      try { rec.abort(); } catch { /* ignore */ }
      recRef.current = null;
    };
  }, [voiceOpen]);

  const toggleListen = () => {
    const rec = recRef.current;
    if (!rec) return;
    clearTimeout(silenceRef.current);
    setAutoIn(false);
    if (listening) {
      try { rec.stop(); } catch { /* ignore */ }
      setListening(false);
    } else {
      try { rec.start(); setListening(true); } catch { /* déjà démarré */ }
    }
  };

  /** Saisie manuelle : réaligne le tampon de dictée pour ne pas écraser la correction. */
  const editTranscript = (value) => {
    clearTimeout(silenceRef.current);
    setAutoIn(false);
    setTranscript(value);
    setEdited(true);
    finalRef.current = value ? `${value} ` : "";
  };

  const useExample = (text) => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
    editTranscript(text);
    interpret(text);
  };

  const reset = () => {
    clearTimeout(silenceRef.current);
    finalRef.current = "";
    setTranscript("");
    setEdited(false);
    setInterpreted(null);
    setError("");
    setAutoIn(false);
  };

  const close = () => setVoiceOpen(false);

  /** Ouvre les statistiques de l'entité choisie (avec la combinaison demandée). */
  const openEntity = (e) => {
    setSearch(e.name);
    flyTo({ lng: e.lng, lat: e.lat, zoom: LEVEL_ZOOM[e.level] ?? 8 });
    setStatsPopup({ name: e.name, levelLabel: e.levelLabel, stats: e.stats, lng: e.lng, lat: e.lat, focus: interpreted?.focus });
    close();
  };

  // Échap ferme le modal.
  useEffect(() => {
    if (!voiceOpen) return;
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOpen]);

  const hasText = transcript.trim().length > 0;

  return (
    <AnimatePresence>
      {voiceOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto absolute inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.95, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 16, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl"
          >
            {/* ---------------- En-tête ---------------- */}
            <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl brand-gradient text-white shadow-md">
                <Mic size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-extrabold leading-tight tracking-tight">Recherche vocale</h2>
                <p className="text-[11px] text-muted">Demandez la couverture d'un lieu, d'un opérateur ou d'une technologie</p>
              </div>
              <button onClick={close} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-foreground" aria-label="Fermer">
                <X size={17} />
              </button>
            </div>

            {/* ---------------- Corps défilant ---------------- */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {/* Zone micro + onde */}
              {supported ? (
                <div className="mb-4 flex flex-col items-center">
                  <button
                    onClick={toggleListen}
                    className={`relative grid h-[72px] w-[72px] place-items-center rounded-full text-white shadow-lg transition-all hover:scale-105 ${
                      listening ? "bg-artci-orange shadow-artci-orange/40" : "brand-gradient"
                    }`}
                    title={listening ? "Mettre en pause" : "Reprendre la dictée"}
                  >
                    {listening && <span className="absolute inset-0 rounded-full pulse-ring" />}
                    {listening ? <Pause size={26} /> : <Mic size={26} />}
                  </button>

                  <Waveform active={listening} />

                  <span className="mt-1 text-xs font-semibold text-muted">
                    {listening ? "Je vous écoute…" : hasText ? "En pause" : "Appuyez pour parler"}
                  </span>
                </div>
              ) : (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[11px] text-muted">
                  <Keyboard size={14} className="shrink-0" />
                  Dictée non prise en charge par ce navigateur — saisissez votre demande ci-dessous.
                </div>
              )}

              {/* Transcription éditable */}
              <div className="rounded-2xl border border-border bg-surface/60 transition-colors focus-within:border-artci-green">
                <textarea
                  value={transcript}
                  onChange={(e) => editTranscript(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      interpret();
                    }
                  }}
                  rows={2}
                  placeholder={supported ? "Votre demande apparaîtra ici — vous pouvez la corriger" : "Saisissez votre demande…"}
                  className="w-full resize-none bg-transparent px-3.5 py-3 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-[13px] placeholder:italic placeholder:text-muted"
                />
                <div className="flex items-center gap-2 border-t border-border/60 px-3.5 py-2">
                  <Keyboard size={12} className="shrink-0 text-muted" />
                  <span className="text-[10px] text-muted">
                    Modifiable au clavier · <CornerDownLeft size={9} className="inline" /> pour lancer
                  </span>
                  {edited && <span className="ml-auto text-[10px] font-bold text-artci-green-700">corrigé</span>}
                  {autoIn && !edited && (
                    <span className="ml-auto text-[10px] font-bold text-artci-orange">recherche auto…</span>
                  )}
                </div>
              </div>

              {/* Exemples (tant qu'aucune demande n'est formulée) */}
              {!hasText && !interpreted && (
                <div className="mt-3">
                  <p className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">Exemples</p>
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        onClick={() => useExample(ex)}
                        className="rounded-full border border-border bg-surface/70 px-3 py-1.5 text-[12px] font-medium text-foreground/80 transition-colors hover:border-artci-green hover:bg-artci-green/10 hover:text-artci-green-700"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Analyse en cours */}
              {interpreting && (
                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-surface/60 px-3.5 py-3 text-sm text-muted">
                  <Loader2 size={15} className="animate-spin text-artci-green-700" />
                  Analyse de votre demande…
                </div>
              )}

              {/* Requête comprise */}
              {interpreted?.query && !interpreting && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 rounded-2xl border border-artci-green/25 bg-artci-green/8 p-3.5"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-artci-green-700">
                    <Sparkles size={12} /> Requête comprise
                    {interpreted.query.source === "local" && (
                      <span className="ml-auto rounded-full bg-surface px-1.5 py-0.5 text-[9px] font-bold text-muted">hors ligne</span>
                    )}
                  </div>
                  <p className="mt-1 text-[15px] font-bold leading-snug">
                    {interpreted.query.normalized || interpreted.query.entity || "—"}
                  </p>
                  {(interpreted.query.operators?.length > 0 || interpreted.query.technologies?.length > 0 || interpreted.scope === "national") && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {interpreted.scope === "national" && (
                        <span className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-muted">
                          <Globe2 size={10} /> Tout le territoire
                        </span>
                      )}
                      {interpreted.query.operators?.map((o) => (
                        <span key={o} className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-muted">{o}</span>
                      ))}
                      {interpreted.query.technologies?.map((t) => (
                        <span key={t} className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-muted">{t}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Résultats */}
              {interpreted?.results?.length > 0 && !interpreting && (
                <div className="mt-3">
                  <p className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                    {interpreted.results.length > 1 ? `${interpreted.results.length} résultats` : "Résultat"}
                  </p>
                  <ul className="space-y-1.5">
                    {interpreted.results.map((e, i) => (
                      <motion.li
                        key={`${e.level}-${e.name}-${e.lng}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <button
                          onClick={() => openEntity(e)}
                          className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-surface/60 px-3.5 py-2.5 text-left transition-all hover:border-artci-green hover:bg-artci-green/8"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-artci-green/12 text-artci-green-700">
                            {e.level === "national" ? <Globe2 size={15} /> : <MapPin size={15} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">{e.name}</span>
                            <span className="text-[11px] text-muted">{e.levelLabel}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-extrabold text-artci-green-700">
                              {(e.stats?.perPopCov ?? 0).toFixed(1)}%
                            </span>
                            <span className="block text-[10px] text-muted">population</span>
                          </span>
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {error && !interpreting && (
                <p className="mt-3 rounded-xl bg-uncovered/10 px-3 py-2 text-xs font-semibold text-uncovered">{error}</p>
              )}
            </div>

            {/* ---------------- Actions ---------------- */}
            <div className="flex shrink-0 items-center gap-2 border-t border-border/60 bg-surface/40 px-5 py-3">
              <button
                onClick={reset}
                disabled={!hasText && !interpreted}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 disabled:opacity-40"
              >
                <RotateCcw size={14} /> Recommencer
              </button>
              <div className="flex-1" />
              <button
                onClick={() => interpret()}
                disabled={!hasText || interpreting}
                className="flex items-center gap-1.5 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02] disabled:opacity-50"
              >
                {interpreting ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                {interpreting ? "Analyse…" : "Rechercher"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Visualiseur d'onde : barres animées pendant l'écoute (retour visuel du micro). */
function Waveform({ active }) {
  const BARS = 20;
  return (
    <div className="mt-3 flex h-8 items-center justify-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: BARS }).map((_, i) => {
        // Amplitude en cloche : plus haut au centre, comme un vrai signal.
        const center = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
        const peak = 6 + center * 22;
        return (
          <motion.span
            key={i}
            className="w-[3px] rounded-full"
            style={{ background: active ? "var(--artci-orange)" : "var(--border)" }}
            animate={active ? { height: [6, peak, 10, peak * 0.7, 6] } : { height: 4 }}
            transition={
              active
                ? { duration: 0.9 + (i % 5) * 0.12, repeat: Infinity, ease: "easeInOut", delay: i * 0.035 }
                : { duration: 0.25 }
            }
          />
        );
      })}
    </div>
  );
}
