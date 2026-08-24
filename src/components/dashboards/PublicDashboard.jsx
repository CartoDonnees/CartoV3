"use client";

import Link from "next/link";
import { ArrowLeft, Map as MapIcon } from "lucide-react";
import { Card, Tile, tooltipStyle } from "@/components/ui/kit";

/** Coque commune aux tableaux de bord publics (couverture, qualité de service). */
export function PublicDashboard({ title, subtitle, icon: Icon, toolbar, children }) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link
            href="/carte"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            title="Retour à la carte"
          >
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl brand-gradient text-white shadow-md">
            <Icon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-extrabold leading-tight tracking-tight">{title}</h1>
            <p className="text-[11.5px] text-muted">{subtitle}</p>
          </div>
          {toolbar}
          <Link
            href="/carte"
            className="hidden items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12px] font-bold text-muted transition-colors hover:bg-surface-2 hover:text-foreground sm:flex"
          >
            <MapIcon size={14} /> Carte
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </main>
  );
}

/* Les tableaux de bord publics partagent les briques communes du kit. */
export { tooltipStyle };
/** Indicateur clé. */
export const Kpi = Tile;
/** Carte de contenu titrée. */
export const Panel = Card;
