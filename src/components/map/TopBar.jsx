"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Menu, Search, Download, Bell, LogIn, LogOut, ChevronDown, Sun, Moon, MapPin, Check, LayoutDashboard, Loader2, Database, ChevronRight } from "lucide-react";
import { ROLE_META } from "@/lib/nav";
import { BrandMark } from "./BrandMark";
import { useMapStore, periodLabel } from "@/stores/map-store";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// Zoom appliqué selon le niveau administratif sélectionné dans la recherche.
const LEVEL_ZOOM = { national: 5.6, district: 6.8, region: 7.6, department: 9, subPrefecture: 10.5, locality: 12 };

export function TopBar() {
  const { toggleSidebar, periodDate, setPeriod, theme, toggleTheme, search, setSearch, flyTo, setActiveDistrict, setStatsPopup, setDataHubOpen, shareOpen, setShareOpen, periods, user, setAuthOpen, logout } = useMapStore();
  const [periodOpen, setPeriodOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Recherche d'entités (5 niveaux) via l'API, avec anti-rebond.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const data = await api(`/api/v1/search?q=${encodeURIComponent(q)}&date=${periodDate}`);
        if (alive) setResults(data || []);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search, periodDate]);

  const pick = (e) => {
    setSearch(e.name);
    setFocus(false);
    flyTo({ lng: e.lng, lat: e.lat, zoom: LEVEL_ZOOM[e.level] ?? 8 });
    setStatsPopup({ name: e.name, levelLabel: e.levelLabel, stats: e.stats, lng: e.lng, lat: e.lat });
  };

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto absolute inset-x-3 top-3 z-30 flex items-center gap-2"
    >
      <div className="glass flex items-center gap-1 rounded-2xl p-1.5 w-[328px]">
        <button
          onClick={toggleSidebar}
          className="grid h-10 w-10 place-items-center rounded-xl text-foreground/80 transition-colors hover:bg-surface-2"
          aria-label="Basculer le panneau"
        >
          <Menu size={18} />
        </button>
        <div className="px-2">
          <BrandMark />
        </div>
      </div>
      <div className="relative hidden lg:block">
        <button
          onClick={() => setPeriodOpen((o) => !o)}
          className="glass flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold"
        >
          <span className="h-2 w-2 rounded-full bg-artci-green pulse-ring" />
          {periodLabel(periodDate)}
          <ChevronDown size={14} className={cn("text-muted transition-transform", periodOpen && "rotate-180")} />
        </button>
        <AnimatePresence>
          {periodOpen && (
            <motion.ul
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="glass absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-2xl p-1.5"
            >
              {periods.map((p) => (
                <li key={p.date}>
                  <button
                    onClick={() => { setPeriod(p.date); setPeriodOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2"
                  >
                    <span className="flex-1">{p.label}</span>
                    {p.date === periodDate && <Check size={15} className="text-artci-green-700" />}
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Recherche entité administrative */}
      <div className="relative hidden flex-1 md:block">
        <div className="glass flex items-center gap-2 rounded-2xl px-4 py-2.5">
          <Search size={16} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder="Rechercher une localité, région, département…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {searching && <Loader2 size={15} className="shrink-0 animate-spin text-muted" />}
          {search && (
            <button onClick={() => { setSearch(""); setResults([]); setActiveDistrict(null); }} className="text-xs font-semibold text-muted hover:text-foreground">
              Effacer
            </button>
          )}
        </div>
        <AnimatePresence>
          {focus && (results.length > 0 || (search.trim().length >= 2 && !searching)) && (
            <motion.ul
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="glass absolute left-0 right-0 top-full z-40 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl p-1.5"
            >
              {results.length === 0 ? (
                <li className="px-3 py-2 text-center text-xs text-muted">Aucune entité trouvée.</li>
              ) : (
                results.map((e) => (
                  <li key={`${e.level}-${e.name}-${e.lng}`}>
                    <button
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => pick(e)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2"
                    >
                      <MapPin size={15} className="shrink-0 text-artci-green-700" />
                      <span className="flex-1 truncate font-medium">{e.name}</span>
                      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-muted">{e.levelLabel}</span>
                    </button>
                  </li>
                ))
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Accès aux données & services */}
      <div className="glass ml-auto flex shrink-0 items-center rounded-2xl p-1">
        <button
          onClick={() => setDataHubOpen(true)}
          title="Données & services"
          className="flex items-center gap-1.5 rounded-xl brand-gradient px-3 py-2 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.02]"
        >
          <Database size={15} />
          <span className="hidden xl:inline">Données &amp; services</span>
          <ChevronRight size={14} className="opacity-80" />
        </button>
      </div>

      <div className="glass flex shrink-0 items-center gap-1 rounded-2xl p-1">
        <IconBtn icon={theme === "light" ? <Moon size={17} /> : <Sun size={17} />} label="Thème" onClick={toggleTheme} />
        <IconBtn icon={<Download size={17} />} label="Exporter / Partager" onClick={() => setShareOpen(!shareOpen)} active={shareOpen} />
        <IconBtn icon={<Bell size={17} />} label="Notifications" />
        {user ? (
          <div className="flex items-center gap-1">
            {ROLE_META[user.role]?.home && ROLE_META[user.role].home !== "/carte" && (
              <Link
                href={ROLE_META[user.role].home}
                title={ROLE_META[user.role].space}
                className="grid h-9 w-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <LayoutDashboard size={17} />
              </Link>
            )}
            <span className="grid h-9 w-9 place-items-center rounded-full brand-gradient text-sm font-bold text-white" title={`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()}>
              {(user.firstName?.[0] || user.lastName?.[0] || user.email?.[0] || "?").toUpperCase()}
            </span>
            <IconBtn icon={<LogOut size={17} />} label="Se déconnecter" onClick={logout} />
          </div>
        ) : (
          <button
            onClick={() => setAuthOpen(true)}
            className="flex items-center gap-1.5 rounded brand-gradient px-3 py-2 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.02]"
          >
            <LogIn size={15} /> Connexion
          </button>
        )}
      </div>
    </motion.header>
  );
}

function IconBtn({ icon, label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-xl transition-colors hover:bg-surface-2",
        active ? "text-artci-green-700" : "text-foreground/70",
      )}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
