"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search, Loader2, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { useMapStore } from "@/stores/map-store";

/**
 * Champ de recherche d'entité (localités par défaut) avec autocomplétion.
 * Renvoie l'entité choisie via `onSelect({ name, lng, lat, level, levelLabel })`.
 */
export function EntityPicker({ label, value, onSelect, placeholder = "Rechercher une localité…", level = "locality" }) {
  const periodDate = useMapStore((s) => s.periodDate);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  // Recherche avec anti-rebond.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await api(`/api/v1/search?q=${encodeURIComponent(q)}&date=${periodDate}&limit=8&level=${level}`);
        if (alive) setResults(data || []);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 280);
    return () => { alive = false; clearTimeout(t); };
  }, [query, periodDate, level]);

  // Ferme la liste au clic extérieur.
  useEffect(() => {
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const choose = (e) => {
    onSelect(e);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="relative" ref={boxRef}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>

      {value ? (
        // Entité choisie : puce compacte avec possibilité de changer.
        <div className="flex items-center gap-2 rounded-xl border border-artci-green/40 bg-artci-green/8 px-3 py-2">
          <MapPin size={14} className="shrink-0 text-artci-green-700" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{value.name}</span>
            <span className="text-[10px] text-muted">{value.levelLabel}</span>
          </span>
          <button
            onClick={() => onSelect(null)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label={`Changer ${label.toLowerCase()}`}
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2 focus-within:border-artci-green">
          <Search size={14} className="shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {loading && <Loader2 size={13} className="shrink-0 animate-spin text-muted" />}
        </div>
      )}

      {open && !value && query.trim().length >= 2 && (
        <ul className="glass absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-xl p-1 shadow-lg">
          {results.length === 0 && !loading ? (
            <li className="px-3 py-2 text-center text-[11px] text-muted">Aucune localité trouvée.</li>
          ) : (
            results.map((e) => (
              <li key={`${e.level}-${e.name}-${e.lng}`}>
                <button
                  onClick={() => choose(e)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-surface-2"
                >
                  <MapPin size={13} className="shrink-0 text-artci-green-700" />
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  <span className="shrink-0 text-[10px] text-muted">{e.levelLabel}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
