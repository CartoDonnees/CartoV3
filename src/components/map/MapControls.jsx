"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Plus, Minus, Locate, Layers, BarChart3, Info, Box,
  RotateCcw, RotateCw, Play, Pause, Compass,
} from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { cn } from "@/lib/utils";
import styles from "./MapControls.module.css";

const ROTATE_STEP = 45; // degrés par appui
const SPIN_DURATION = 24000; // durée d'un tour complet (ms)

const STYLES = [
  { key: "streets", label: "Plan" },
  { key: "light", label: "Clair" },
  { key: "satellite", label: "Satellite" },
  { key: "dark", label: "Sombre" },
];

export function MapControls() {
  const { map, mapStyle, setMapStyle, toggleStats, statsOpen, setLegendOpen, toggle3D, is3D } = useMapStore();

  const zoom = (dir) => {
    if (!map) return;
    dir > 0 ? map.zoomIn() : map.zoomOut();
  };

  const locate = () => {
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 11, duration: 1400 }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  /* ---------------- Rotation 360° (vue 3D) ---------------- */
  const [bearing, setBearing] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rafRef = useRef(null);

  // Suit l'orientation réelle de la carte (rotation à la souris incluse).
  useEffect(() => {
    if (!map) return;
    const onRotate = () => setBearing(map.getBearing());
    map.on("rotate", onRotate);
    onRotate();
    return () => map.off("rotate", onRotate);
  }, [map]);

  /** Pivote d'un cran, dans un sens ou dans l'autre. */
  const rotateBy = (delta) => {
    if (!map) return;
    stopSpin();
    map.easeTo({ bearing: map.getBearing() + delta, duration: 500 });
  };

  /** Réoriente vers le nord. */
  const resetNorth = () => {
    if (!map) return;
    stopSpin();
    map.easeTo({ bearing: 0, duration: 700 });
  };

  const stopSpin = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setSpinning(false);
  };

  /** Tour complet continu : la carte pivote sur 360° tant qu'on ne l'arrête pas. */
  const toggleSpin = () => {
    if (!map) return;
    if (rafRef.current) return stopSpin();
    setSpinning(true);
    let last = performance.now();
    const step = (now) => {
      const dt = now - last;
      last = now;
      map.setBearing(map.getBearing() + (360 * dt) / SPIN_DURATION);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  // Arrête la rotation en quittant la 3D ou au démontage.
  useEffect(() => {
    if (!is3D) stopSpin();
  }, [is3D]);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <>
      {/* Colonne de contrôles à droite */}
      <motion.div
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className={styles.column}
      > 
        <div className={`glass ${styles.group}`}>
          <Ctrl icon={<Plus size={18} />} label="Zoom avant" onClick={() => zoom(1)} />
          <span className={styles.sep} />
          <Ctrl icon={<Minus size={18} />} label="Zoom arrière" onClick={() => zoom(-1)} />
        </div>
        <div className={`glass ${styles.group}`}>
          <Ctrl icon={<Locate size={18} />} label="Ma position" onClick={locate} />
          <span className={styles.sep} />
          <Ctrl icon={<Box size={18} />} label="Vue 3D" onClick={toggle3D} active={is3D} />
        </div>
        {/* Rotation 360° - disponible en vue 3D */}
        <AnimatePresence>
          {is3D && (
            <motion.div
              initial={{ opacity: 0, x: 16, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, x: 16, height: 0 }}
              transition={{ duration: 0.25 }}
              className={`glass ${styles.group}`}
            >
              <Ctrl icon={<RotateCcw size={18} />} label={`Pivoter de ${ROTATE_STEP}° vers la gauche`} onClick={() => rotateBy(-ROTATE_STEP)} />
              <span className={styles.sep} />
              <Ctrl
                icon={spinning ? <Pause size={18} /> : <Play size={18} />}
                label={spinning ? "Arrêter la rotation" : "Rotation 360° continue"}
                onClick={toggleSpin}
                active={spinning}
              />
              <span className={styles.sep} />
              <Ctrl icon={<RotateCw size={18} />} label={`Pivoter de ${ROTATE_STEP}° vers la droite`} onClick={() => rotateBy(ROTATE_STEP)} />
              <span className={styles.sep} />
              {/* Boussole : l'aiguille suit l'orientation, un clic revient au nord. */}
              <Ctrl
                icon={
                  <span style={{ display: "grid", transform: `rotate(${-bearing}deg)` }}>
                    <Compass size={18} />
                  </span>
                }
                label={`Orientation ${Math.round(((bearing % 360) + 360) % 360)}° - revenir au nord`}
                onClick={resetNorth}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={toggleStats}
          className={cn("glass", styles.statsBtn, statsOpen && styles.statsBtnOn)}
          title="Statistiques"
        >
          <BarChart3 size={18} />
        </button>
      </motion.div>

      {/* Sélecteur de style (bas-droit) */}
      <div className={styles.styleBar}>
        <div className={`glass ${styles.styleInner}`}>
          <Layers size={15} className={styles.layersIcon} />
          {STYLES.map((s) => (
            <button
              key={s.key}
              onClick={() => setMapStyle(s.key)}
              className={cn(styles.styleBtn, mapStyle === s.key && `brand-gradient ${styles.styleBtnActive}`)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bouton légende (bas-gauche) */}
      {/* <button onClick={() => setLegendOpen(true)} className={`glass ${styles.legendBtn}`}>
        <Info size={16} className={styles.legendIcon} /> Légende
      </button> */}
    </>
  );
}

function Ctrl({ icon, label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={cn(styles.ctrl, active && styles.ctrlActive)}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
