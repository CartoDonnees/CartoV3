"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  X, Newspaper, Calendar, Paperclip, PlayCircle, FileText, Download, ExternalLink,
} from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { describeMedia } from "@/lib/media";

const frDate = (d) => {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
};

/**
 * Consultation d'un bulletin d'information, dans son propre modal
 * (superposé au hub « Données & services ») : image, texte, document et vidéo.
 */
export function NewsModal() {
  const item = useMapStore((s) => s.newsItem);
  const setItem = useMapStore((s) => s.setNewsItem);

  // Échap ferme uniquement ce modal (il est au-dessus du hub).
  useEffect(() => {
    if (!item) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setItem(null);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [item, setItem]);

  const cover = describeMedia(item?.imagePath);
  const doc = describeMedia(item?.filePath);
  const video = describeMedia(item?.videoPath);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="pointer-events-auto absolute inset-0 z-[70] grid place-items-center bg-black/50 p-4 backdrop-blur-[3px]"
          onClick={() => setItem(null)}
        >
          <motion.article
            initial={{ scale: 0.95, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 16, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl"
          >
            {/* En-tête */}
            <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl brand-gradient text-white shadow-md">
                <Newspaper size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-extrabold leading-tight tracking-tight">Bulletin d'information</h2>
                <p className="flex items-center gap-1.5 text-[11px] text-muted">
                  {item.category && <span className="font-bold text-artci-green-700">{item.category}</span>}
                  <Calendar size={10} /> {frDate(item.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setItem(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                aria-label="Fermer"
              >
                <X size={17} />
              </button>
            </div>

            {/* Contenu */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {cover && <img src={cover.url} alt="" className="mb-5 max-h-80 w-full rounded-2xl object-cover" />}

              {/* Texte dans une colonne de lecture : pleine largeur, il serait pénible à lire. */}
              <div className="mx-auto max-w-3xl">
                <h3 className="text-2xl font-extrabold leading-tight tracking-tight">{item.title}</h3>
                {item.description && (
                  <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-foreground/85">
                    {item.description}
                  </p>
                )}
              </div>

              {video && (
                <div className="mt-5">
                  <SectionLabel icon={PlayCircle} text="Vidéo" />
                  <video src={video.url} controls className="w-full rounded-2xl border border-border" />
                </div>
              )}

              {doc && (
                <div className="mt-5">
                  <SectionLabel icon={Paperclip} text="Document joint" />
                  {doc.kind === "pdf" ? (
                    <>
                      <iframe src={doc.url} title={doc.name} className="h-[min(70vh,720px)] w-full rounded-2xl border border-border bg-surface" />
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12px] font-bold text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                      >
                        <ExternalLink size={13} /> Ouvrir dans un nouvel onglet
                      </a>
                    </>
                  ) : doc.kind === "image" ? (
                    <img src={doc.url} alt={doc.name} className="w-full rounded-2xl border border-border" />
                  ) : (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-2xl border border-border bg-surface/60 px-3.5 py-3 transition-colors hover:border-artci-green hover:bg-artci-green/8"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-artci-green/12 text-artci-green-700">
                        <FileText size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{doc.name}</span>
                        <span className="block text-[11px] text-muted">{doc.label}</span>
                      </span>
                      <Download size={15} className="shrink-0 text-muted" />
                    </a>
                  )}
                </div>
              )}

              {!cover && !doc && !video && (
                <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2 text-[11px] italic text-muted">
                  Aucun média n'est associé à ce bulletin.
                </p>
              )}
            </div>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SectionLabel({ icon: Icon, text }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
      <Icon size={11} className="text-artci-green-700" /> {text}
    </div>
  );
}
