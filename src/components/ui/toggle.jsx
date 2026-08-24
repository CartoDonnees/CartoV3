"use client";

import { cn } from "@/lib/utils";
import styles from "./Toggle.module.css";

/** Interrupteur (switch) accessible, animé, aux couleurs ARTCI. */
export function Toggle({ checked, onChange, label, color, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(styles.toggle, className)}
    >
      {label && <span className={styles.label}>{label}</span>}
      <span
        className={styles.track}
        style={{
          backgroundColor: checked ? color ?? "var(--artci-green)" : "var(--surface-2)",
          boxShadow: checked ? "inset 0 0 0 1px rgba(0,0,0,.05)" : undefined,
        }}
      >
        <span className={cn(styles.knob, checked && styles.knobOn)} />
      </span>
    </button>
  );
}
