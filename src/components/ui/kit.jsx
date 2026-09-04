"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, ChevronsUpDown, Loader2 } from "lucide-react";
import { nextSort, sortRows } from "@/lib/sort";

/**
 * Primitives d'interface CARTODONNEES - source unique du design de
 * l'application (carte, tableaux de bord publics et back-office).
 * Toute nouvelle vue doit composer ces briques plutôt que redéfinir ses
 * propres cartes, onglets ou indicateurs.
 */

/* ------------------------------- Conteneurs ------------------------------ */

/** Carte de contenu titrée. */
export function Card({ title, hint, actions, className = "", children, ...rest }) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-4 shadow-sm ${className}`} {...rest}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-sm font-bold tracking-tight">{title}</h2>}
            {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Bloc à bandeau inversé - regroupe des vignettes de même nature. */
export function SectionCard({ title, cols = 2, className = "", children }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ${className}`}>
      <h2 className="bg-foreground px-3 py-2 text-center text-[11.5px] font-extrabold uppercase tracking-wide text-background">
        {title}
      </h2>
      <div className="grid gap-2 p-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {children}
      </div>
    </section>
  );
}

/** Légende d'un graphique ou d'une illustration. */
export function Caption({ children }) {
  return <p className="mt-1 text-center text-[11.5px] font-semibold italic text-muted">{children}</p>;
}

/* ------------------------------ Indicateurs ------------------------------ */

/**
 * Indicateur clé : pictogramme coloré, libellé en capitales et valeur
 * chiffrée, avec variation ou mention optionnelle.
 */
export function Tile({ icon: Icon, label, tag, value, hint, delta, badge, color = "var(--artci-green)" }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm">
      {Icon && (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: color }}>
          <Icon size={18} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {tag && <span className="text-[12px] font-extrabold" style={{ color }}>{tag}</span>}
          <span className="truncate text-[10.5px] font-semibold uppercase tracking-wide text-muted">{label}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xl font-extrabold leading-tight tracking-tight tabular-nums">{value}</span>
          {badge && <span className="shrink-0 text-[9.5px] font-bold uppercase text-muted">{badge}</span>}
          {delta !== undefined && <Delta value={delta} />}
        </div>
        {hint && <div className="truncate text-[11px] text-muted">{hint}</div>}
      </div>
    </div>
  );
}

/**
 * Indicateur compact - même typographie que `Tile`, taillé pour les
 * panneaux étroits de la carte (fiche d'entité, outils, bandeau).
 */
export function MiniStat({ icon: Icon, value, label, color }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-2.5">
      <div className="flex items-center gap-1">
        {Icon && <Icon size={12} className="shrink-0 text-muted" style={color ? { color } : undefined} />}
        <span className="truncate text-[9.5px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      </div>
      <div
        className="mt-1 text-[15px] font-extrabold leading-none tracking-tight tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

/** Variation d'un semestre à l'autre - « -- % » quand elle est inconnue. */
export function Delta({ value }) {
  if (!value) return <span className="shrink-0 text-[11px] text-muted">-- %</span>;
  const up = value > 0;
  return (
    <span className={`flex shrink-0 items-center gap-0.5 text-[11px] font-bold ${up ? "text-artci-green-700" : "text-uncovered"}`}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {Math.abs(value).toFixed(2)} %
    </span>
  );
}

/** Jauge horizontale (part d'un total). */
export function Meter({ label, value, color = "var(--artci-green)" }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="mb-2 flex items-center gap-3">
      <span className="w-14 shrink-0 text-[12px] font-bold">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="w-14 shrink-0 text-right text-[12px] font-bold tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

/* -------------------------------- Contrôles ------------------------------ */

/**
 * Onglets - l'onglet actif porte toujours le dégradé de marque.
 * `pill` pour une page, `segment` pour un panneau étroit (largeurs égales),
 * `compact` pour une barre défilante dans une fenêtre modale.
 */
const TAB_VARIANT = {
  pill: {
    wrap: "flex flex-wrap gap-1.5",
    base: "flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-bold transition-colors",
    off: "border border-border text-muted hover:bg-surface-2",
    icon: 14,
  },
  segment: {
    wrap: "flex gap-1",
    base: "flex-1 rounded-lg py-1.5 text-[11.5px] font-bold transition-colors",
    off: "text-muted hover:bg-surface-2",
    icon: 13,
  },
  compact: {
    wrap: "flex gap-1 overflow-x-auto",
    base: "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition-colors",
    off: "text-muted hover:bg-surface-2",
    icon: 13,
  },
};

export function Tabs({ items, value, onChange, variant = "pill", className = "" }) {
  const v = TAB_VARIANT[variant] || TAB_VARIANT.pill;
  return (
    <div className={`${v.wrap} ${className}`}>
      {items.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`${v.base} ${value === t.key ? "brand-gradient text-white shadow-sm" : v.off}`}
          >
            {Icon && <Icon size={v.icon} />} {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Encadré de filtre : intitulé en capitales et contenu libre. */
export function FilterBox({ label, icon: Icon, className = "", children }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-3 shadow-sm ${className}`}>
      <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted">
        {Icon && <Icon size={13} />} {label}
      </div>
      {children}
    </div>
  );
}

/** Case à cocher aux couleurs de l'élément filtré. */
export function Check({ checked, disabled, color, onChange, children }) {
  return (
    <label className={`flex items-center gap-1.5 text-[13px] font-bold ${disabled ? "opacity-40" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="h-4 w-4 cursor-pointer rounded border-border"
        style={{ accentColor: color }}
      />
      {children}
    </label>
  );
}

/* --------------------------------- Tableaux ------------------------------ */

/**
 * Tri d'un tableau par colonne. Un clic sur l'en-tête trie en croissant,
 * un deuxième en décroissant, un troisième rétablit l'ordre d'origine.
 * Les cellules vides restent en fin de liste dans les deux sens.
 *
 * `accessor(row, key)` permet de trier sur une valeur dérivée (par exemple
 * un nombre brut là où la colonne affiche un texte formaté).
 */
export function useTableSort(rows, { accessor, initial = null } = {}) {
  const [sort, setSort] = useState(initial);

  const toggleSort = (key) => setSort((s) => nextSort(s, key));
  const sorted = useMemo(() => sortRows(rows, sort, accessor), [rows, sort, accessor]);

  return { rows: sorted, sort, toggleSort };
}

/**
 * En-tête de colonne triable. Rend le `<th>` : la mise en forme du tableau
 * hôte s'applique donc telle quelle (back-office comme tableaux de bord).
 */
export function SortHeader({ label, sortKey, sort, onSort, align = "left", className = "", children }) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
  const title = !active
    ? `Trier par « ${label} » (croissant)`
    : sort.dir === "asc"
      ? `Trier par « ${label} » (décroissant)`
      : "Rétablir l'ordre d'origine";

  return (
    <th className={className} style={{ textAlign: align }} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={title}
        className={`inline-flex w-full items-center gap-1 font-inherit ${
          align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""
        } ${active ? "text-artci-green-700" : "hover:text-foreground"}`}
        style={{ font: "inherit", color: "inherit", background: "none", border: 0, cursor: "pointer", padding: 0 }}
      >
        {children ?? label}
        <Icon size={12} className={active ? "opacity-100" : "opacity-45"} />
      </button>
    </th>
  );
}

/* --------------------------------- États --------------------------------- */

const BADGE_TONE = {
  green: ["color-mix(in oklab, var(--artci-green) 15%, transparent)", "var(--artci-green-700)"],
  amber: ["color-mix(in oklab, #f59e0b 18%, transparent)", "#b45309"],
  red: ["color-mix(in oklab, var(--uncovered) 15%, transparent)", "#be123c"],
  blue: ["color-mix(in oklab, #3b82f6 16%, transparent)", "#1d4ed8"],
  gray: ["var(--surface-2)", "var(--muted)"],
};

/** Pastille d'état. */
export function Badge({ tone = "gray", children }) {
  const [bg, color] = BADGE_TONE[tone] || BADGE_TONE.gray;
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}

/** Attente de données. */
export function Loading({ label = "Chargement…" }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted">
      <Loader2 size={16} className="animate-spin text-artci-green-700" /> {label}
    </div>
  );
}

/** Absence de données. */
export function Empty({ icon: Icon, children }) {
  return (
    <div className="px-4 py-14 text-center text-sm text-muted">
      {Icon && <Icon size={38} className="mx-auto mb-2 opacity-40" />}
      <div>{children}</div>
    </div>
  );
}

/** Encart d'information (rappels réglementaires, ruptures de série…). */
export function Note({ icon: Icon, children, className = "" }) {
  return (
    <div className={`flex items-start gap-2 rounded-2xl border border-artci-orange/35 bg-artci-orange/10 px-4 py-3 ${className}`}>
      {Icon && <Icon size={16} className="mt-0.5 shrink-0 text-artci-orange" />}
      <p className="text-[12px] leading-relaxed text-foreground/85">{children}</p>
    </div>
  );
}

/** Titre de page. */
export function PageHead({ title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.45rem] font-extrabold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Style commun des infobulles Recharts. */
export const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  fontSize: 12,
  background: "var(--surface)",
};
