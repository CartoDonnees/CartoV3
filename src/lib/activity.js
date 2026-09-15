import { prisma } from "@/lib/prisma";
import { describeActivity, actorNameOf } from "@/lib/activity-format";

/**
 * Enregistrement du journal d'activité (côté serveur).
 *
 * Les activités sont écrites par le code, au moment où l'action a lieu - jamais
 * saisies par un utilisateur. La rédaction (phrase, libellés) vit dans
 * `lib/activity-format`, partagé avec l'interface.
 *
 * Deux régimes d'écriture :
 *  - `strict` : l'écriture participe à la transaction de l'action elle-même.
 *    Si le journal ne peut être écrit, l'action est annulée : aucune
 *    modification de données ne peut exister sans sa trace. C'est le régime de
 *    la fabrique CRUD.
 *  - par défaut : écriture « au mieux ». Une panne du journal est signalée dans
 *    les journaux du serveur mais n'empêche pas, par exemple, de se connecter.
 */

const MAX_UA = 300;

/** Adresse IP et navigateur de la requête, quand ils sont connus. */
export function requestMeta(request) {
  const h = request?.headers;
  if (!h?.get) return { ipAddress: null, userAgent: null };
  const forwarded = h.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : h.get("x-real-ip"))?.trim() || null;
  const ua = h.get("user-agent");
  return { ipAddress: ip, userAgent: ua ? ua.slice(0, MAX_UA) : null };
}

/**
 * Instantané de l'auteur. Il est COPIÉ dans l'activité : renommer, désactiver
 * ou supprimer le compte ensuite ne réécrit pas l'histoire.
 */
export function actorSnapshot(user, fallbackName = null) {
  if (user) {
    return {
      userId: user.id ?? null,
      actorName: actorNameOf(user) ?? fallbackName ?? "Compte sans nom",
      actorEmail: user.email ?? null,
      actorRole: user.role ?? null,
    };
  }
  return { userId: null, actorName: fallbackName ?? "Une personne non connectée", actorEmail: null, actorRole: null };
}

/** Données Prisma d'une activité. */
export function buildActivity({
  actor = null,
  actorName = null,
  action,
  resourceType,
  resourceId = null,
  resourceLabel = null,
  oldValue = null,
  newValue = null,
  status = "SUCCESS",
  reason = null,
  detail = null,
  description = null,
  request = null,
}) {
  const snap = actorSnapshot(actor, actorName);
  const hasValues = (v) => v && typeof v === "object" && Object.keys(v).length > 0;
  return {
    ...snap,
    action,
    resourceType,
    resourceId: resourceId ? String(resourceId) : null,
    resourceLabel: resourceLabel ? String(resourceLabel).slice(0, 300) : null,
    description:
      description ??
      describeActivity({ actorName: snap.actorName, action, resourceType, resourceLabel, status, reason, detail }),
    // `undefined` laisse la colonne JSON à NULL (Prisma refuse `null` brut).
    oldValue: hasValues(oldValue) ? oldValue : undefined,
    newValue: hasValues(newValue) ? newValue : undefined,
    status,
    ...requestMeta(request),
  };
}

/**
 * Enregistre une activité.
 * @param entry  voir `buildActivity`
 * @param client client Prisma ou transaction en cours
 * @param strict l'erreur éventuelle remonte (écriture transactionnelle)
 */
export async function recordActivity(entry, { client = prisma, strict = false } = {}) {
  const data = buildActivity(entry);
  if (strict) return client.activityLog.create({ data });
  try {
    return await client.activityLog.create({ data });
  } catch (err) {
    console.error("[journal] Activité non enregistrée :", data.description, "-", err?.message);
    return null;
  }
}
