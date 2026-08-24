import { cn } from "@/lib/utils";
import styles from "./BrandMark.module.css";

/** Logo/marque CARTODONNEES - arc "signal" façon ARTCI. */
export function BrandMark({ className, compact = false }) {
  return (
    <div className={cn(styles.root, className)}>
      {!compact && (
        <div>
          <div className={styles.title}>
            <img src={"/images/logo/logo-artci.png"} alt="Logo ARTCI" />
            <div>
              CARTO<span className={styles.accent}>DONNEES</span>
            </div>
          </div>
          <div className={styles.subtitle}>
            Observatoire cartographique des réseaux de télécommunications/TIC de Côte d’Ivoire
          </div>
        </div>
      )}
    </div>
  );
}
