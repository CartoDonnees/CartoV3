/**
 * Signalements d'activité émis par le navigateur.
 *
 * Seuls les exports sont concernés : ils sont produits côté client et le
 * serveur ne peut pas les observer. L'appel ne bloque jamais l'utilisateur -
 * un journal indisponible ne doit pas empêcher un téléchargement.
 */

/** « localites_non_couvertes_2024-12-31 » → « localites non couvertes 2024-12-31 ». */
const readable = (label) => String(label ?? "").replace(/[_]+/g, " ").trim();

/** Signale un export au journal (sans effet pour un visiteur non connecté). */
export function reportExport(format, label) {
  try {
    fetch("/api/v1/activity/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, label: readable(label) }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* hors navigateur ou fetch indisponible : rien à signaler */
  }
}
