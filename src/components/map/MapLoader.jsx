"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMapStore } from "@/stores/map-store";
import styles from "./MapLoader.module.css";

/**
 * Loader moderne affiché pendant le chargement des données/marqueurs.
 * Recouvre la carte et bloque toute interaction (pointer-events).
 */
export function MapLoader() {
  const loading = useMapStore((s) => s.mapLoading);
  const activeTool = useMapStore((s) => s.activeTool);
  // Pendant le time-lapse, on n'affiche pas le loader (lecture fluide des périodes).
  const show = loading && activeTool !== "timelapse";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="map-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={styles.overlay}
          aria-busy="true"
          aria-live="polite"
        >
          <motion.div
            initial={{ scale: 0.92, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 10, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={`glass ${styles.card}`}
          >
            <Spinner />
            <div>
              <div className={styles.title}>Chargement des données…</div>
              <div className={styles.subtitle}>Préparation de la couverture cartographique</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Anneau bicolore moderne (gradient ARTCI). */
function Spinner() {
  return (
    <span className={styles.spinner}>
      <span className={styles.ringBase} />
      <span className={styles.ringSpin} />
      <span className={`brand-gradient ${styles.dot}`} />
    </span>
  );
}
