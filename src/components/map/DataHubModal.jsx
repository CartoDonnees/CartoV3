"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  X, Flag, Download, BarChart3, Newspaper, ChevronRight, ChevronDown, Loader2,
  LayoutDashboard, LogIn, Info, Database, Network, Gauge, Radio, BookOpen, ExternalLink, Phone, MapPin,
  FileJson, FileSpreadsheet, Image as ImageIcon, SlidersHorizontal, Table2,
  Paperclip, PlayCircle, Calendar,
} from "lucide-react";
import Link from "next/link";
import { useMapStore } from "@/stores/map-store";
import { api } from "@/lib/api-client";
import { ROLE_META } from "@/lib/nav";
import { describeMedia } from "@/lib/media";
import { Tabs } from "@/components/ui/kit";

/** Sections du menu, reprises de l'en-tête de la version 2. */
const SECTIONS = [
  { key: "data", label: "Données et exportations", icon: Database },
  { key: "dash", label: "Tableaux de bord", icon: BarChart3 },
  { key: "reports", label: "Signalements", icon: Flag },
  { key: "news", label: "Actualités", icon: Newspaper },
  { key: "info", label: "Informations", icon: Info },
];

export function DataHubModal() {
  const open = useMapStore((s) => s.dataHubOpen);
  const setOpen = useMapStore((s) => s.setDataHubOpen);
  const setActiveTool = useMapStore((s) => s.setActiveTool);
  const setShareOpen = useMapStore((s) => s.setShareOpen);
  const setLegendOpen = useMapStore((s) => s.setLegendOpen);
  const toggleStats = useMapStore((s) => s.toggleStats);
  const statsOpen = useMapStore((s) => s.statsOpen);
  const setAuthOpen = useMapStore((s) => s.setAuthOpen);
  const periodDate = useMapStore((s) => s.periodDate);
  const user = useMapStore((s) => s.user);
  const setNewsItem = useMapStore((s) => s.setNewsItem);

  const [section, setSection] = useState("data");
  const [news, setNews] = useState(null);

  useEffect(() => {
    if (!open || section !== "news" || news) return;
    let alive = true;
    api("/api/v1/newsletters")
      .then((d) => alive && setNews(d || []))
      .catch(() => alive && setNews([]));
    return () => { alive = false; };
  }, [open, section, news]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const close = () => setOpen(false);
  const run = (fn) => () => { fn(); close(); };
  const geo = (kind) => `/api/v1/geo?kind=${kind}&date=${periodDate}`;
  const home = ROLE_META[user?.role]?.home;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="pointer-events-auto absolute inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.95, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 16, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl"
          >
            {/* En-tête */}
            <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl brand-gradient text-white shadow-md">
                <Database size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-extrabold leading-tight tracking-tight">Données & services</h2>
                <p className="text-[11px] text-muted">Exportations, tableaux de bord, signalements et actualités</p>
              </div>
              <button onClick={close} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-foreground" aria-label="Fermer">
                <X size={17} />
              </button>
            </div>

            {/* Onglets de section */}
            <Tabs
              items={SECTIONS}
              value={section}
              onChange={setSection}
              variant="compact"
              className="shrink-0 border-b border-border/60 px-3 py-2"
            />

            {/* Contenu */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {section === "data" && (
                <div className="grid gap-x-5 lg:grid-cols-2">
                  <Group icon={Network} title="Couverture réseau">
                    <Row icon={ImageIcon} title="Vue actuelle de la carte" desc="Image, PDF ou lien permanent de la vue affichée." onClick={run(() => setShareOpen(true))} />
                    <ExportRow kind="locality" title="Toutes les localités" desc="Couverture par opérateur et technologie." />
                    <ExportRow kind="whiteLocality" title="Zones blanches" desc="Localités sans aucune couverture." />
                    <RowLink icon={FileJson} title="Statistiques nationales" desc="Indicateurs agrégés du pays (JSON)." href={geo("stats")} />
                  </Group>
                  <Group icon={Gauge} title="Découpage administratif">
                    <ExportRow kind="district" title="Districts" desc="Agrégats et taux de couverture." />
                    <ExportRow kind="region" title="Régions" desc="Agrégats et taux de couverture." />
                    <ExportRow kind="department" title="Départements" desc="Agrégats et taux de couverture." />
                    <ExportRow kind="subPrefecture" title="Sous-préfectures" desc="Agrégats et taux de couverture." />
                  </Group>
                  <Group icon={Gauge} title="Qualité de service">
                    <ExportRow domain="qos" title="Audits de qualité de service" desc="Voix, SMS et Data par campagne de mesure." />
                  </Group>
                  <Group icon={SlidersHorizontal} title="Exportation personnalisée">
                    <ExportRow title="Extraction pas à pas" desc="District → région → département → sous-préfecture → localité, avec export à chaque étape." custom />
                  </Group>
                </div>
              )}

              {section === "dash" && (
                <Group icon={BarChart3} title="Graphiques et analyses">
                  <RowLink internal icon={Radio} title="Couverture réseau" desc="Indicateurs nationaux, évolution et classements par découpage." href="/tableau-de-bord/couverture" onNavigate={close} />
                  <RowLink internal icon={Gauge} title="Qualité de service" desc="Résultats des campagnes d'audit Voix, SMS et Data." href="/tableau-de-bord/qos" onNavigate={close} />
                  <Row icon={BarChart3} title="Statistiques nationales (carte)" desc="Panneau d'indicateurs directement sur la carte." onClick={run(() => { if (!statsOpen) toggleStats(); })} />
                  {user && home && home !== "/carte" ? (
                    <RowLink internal icon={LayoutDashboard} title={ROLE_META[user.role].space} desc="Tableau de bord et administration." href={home} onNavigate={close} />
                  ) : !user ? (
                    <Row icon={LogIn} title="Se connecter" desc="Accédez à votre espace et à vos tableaux de bord." onClick={run(() => setAuthOpen(true))} />
                  ) : null}
                </Group>
              )}

              {section === "reports" && (
                <Group icon={Flag} title="Signalements citoyens">
                  <Row icon={Flag} title="Signaler un problème" desc="Pas de réseau, coupures, lenteurs… à l'endroit de votre choix." onClick={run(() => setActiveTool("report"))} />
                  <Row icon={MapPin} title="Voir les signalements" desc="Afficher les déclarations sur la carte." onClick={run(() => setActiveTool("report"))} />
                </Group>
              )}

              {section === "news" && (
                  <Group icon={Newspaper} title="Bulletins d'informations">
                    {news === null ? (
                      <div className="flex items-center gap-2 px-1 py-3 text-xs text-muted"><Loader2 size={13} className="animate-spin" /> Chargement…</div>
                    ) : news.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-muted">Aucun bulletin publié pour le moment.</p>
                    ) : (
                      <ul className="grid gap-1.5 lg:grid-cols-2">
                        {news.map((n) => <NewsCard key={n.code} item={n} onOpen={() => setNewsItem(n)} />)}
                      </ul>
                    )}
                  </Group>
              )}

              {section === "info" && (
                <div className="grid gap-x-5 lg:grid-cols-2">
                  <Group icon={BookOpen} title="À propos">
                    <Row icon={BookOpen} title="Guide de lecture de la carte" desc="Légende complète : icônes, couleurs et couches." onClick={run(() => setLegendOpen(true))} />
                    <div className="rounded-2xl border border-border bg-surface/60 px-3.5 py-3">
                      <p className="text-sm font-bold">Plateforme CARTODONNEES</p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                        Observatoire cartographique des réseaux de télécommunications/TIC de Côte d'Ivoire,
                        édité par l'ARTCI. Les données de couverture sont déclarées par les opérateurs et
                        publiées par période semestrielle.
                      </p>
                    </div>
                  </Group>
                  <Group icon={ExternalLink} title="Contact & liens">
                    <RowLink external icon={ExternalLink} title="Site de l'ARTCI" desc="artci.ci - missions et publications." href="https://www.artci.ci" />
                    <RowLink external icon={Phone} title="+225 27 20 34 43 73" desc="Standard de l'ARTCI." href="tel:+2252720344373" />
                  </Group>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ----------------------------- Actualités ------------------------------ */

const frDate = (d) => {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch { return ""; }
};

/** Vignette d'un bulletin dans la liste. */
function NewsCard({ item, onOpen }) {
  const cover = describeMedia(item.imagePath);
  const doc = describeMedia(item.filePath);
  const video = describeMedia(item.videoPath);

  return (
    <li>
      <button
        onClick={onOpen}
        className="group flex w-full items-start gap-3 rounded-2xl border border-border bg-surface/60 p-2.5 text-left transition-all hover:border-artci-green hover:bg-artci-green/8"
      >
        {cover ? (
          <img src={cover.url} alt="" className="h-16 w-24 shrink-0 rounded-xl object-cover" loading="lazy" />
        ) : (
          <span className="grid h-16 w-24 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
            <Newspaper size={20} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-snug">{item.title}</span>
          {item.description && (
            <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-muted">{item.description}</span>
          )}
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {item.category && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-bold text-muted">{item.category}</span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-muted"><Calendar size={9} /> {frDate(item.createdAt)}</span>
            {doc && <span className="flex items-center gap-1 text-[10px] font-semibold text-artci-green-700"><Paperclip size={9} /> {doc.ext.toUpperCase()}</span>}
            {video && <span className="flex items-center gap-1 text-[10px] font-semibold text-artci-green-700"><PlayCircle size={9} /> Vidéo</span>}
          </span>
        </span>
        <ChevronRight size={16} className="mt-1 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </button>
    </li>
  );
}

/* ------------------------------ Éléments ------------------------------- */

/** Jeu de données : ouvre l'aperçu (tableau + filtres) avant téléchargement. */
function ExportRow({ kind, domain, title, desc, custom }) {
  const setExportRequest = useMapStore((s) => s.setExportRequest);
  const setOpen = useMapStore((s) => s.setDataHubOpen);
  return (
    <button
      onClick={() => { setExportRequest({ kind, domain, title, custom }); setOpen(false); }}
      className={rowClass}
    >
      <RowInner
        icon={custom ? SlidersHorizontal : domain === "qos" ? Gauge : Database}
        title={title}
        desc={desc}
        trailing={<Table2 size={15} className="shrink-0 text-muted" />}
      />
    </button>
  );
}

function Group({ icon: Icon, title, badge, children }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex items-center gap-1.5 px-0.5">
        <Icon size={13} className="text-artci-green-700" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{title}</span>
        {badge && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold text-muted">{badge}</span>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

const rowClass =
  "group flex w-full items-center gap-3 rounded-2xl border border-border bg-surface/60 px-3.5 py-2.5 text-left transition-all hover:border-artci-green hover:bg-artci-green/8";

function RowInner({ icon: Icon, title, desc, trailing }) {
  return (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-artci-green/12 text-artci-green-700">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-snug">{title}</span>
        {desc && <span className="block text-[11px] leading-snug text-muted">{desc}</span>}
      </span>
      {trailing ?? <ChevronRight size={16} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />}
    </>
  );
}

function Row({ onClick, ...props }) {
  return (
    <button onClick={onClick} className={rowClass}>
      <RowInner {...props} />
    </button>
  );
}

/** Lien : interne (navigation), externe (nouvel onglet) ou téléchargement de fichier. */
function RowLink({ href, internal, external, onNavigate, ...props }) {
  const trailing = external ? (
    <ExternalLink size={15} className="shrink-0 text-muted" />
  ) : internal ? undefined : (
    <Download size={15} className="shrink-0 text-muted" />
  );

  if (internal) {
    return (
      <Link href={href} onClick={onNavigate} className={rowClass}>
        <RowInner {...props} trailing={trailing} />
      </Link>
    );
  }
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : { download: "" })}
      className={rowClass}
    >
      <RowInner {...props} trailing={trailing} />
    </a>
  );
}
