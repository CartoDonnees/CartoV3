import {
  ACTIVITY_ACTIONS,
  ACTIVITY_RESOURCES,
  ACTIVITY_MODULES,
  moduleResourceTypes,
} from "@/lib/activity-format";

/**
 * Lecture du journal d'activité : filtres, recherche et pagination.
 *
 * Module pur (aucun accès à la base) : il traduit les paramètres de l'URL en
 * clause `where` Prisma, pour que la logique de filtrage soit vérifiable hors
 * serveur.
 */

/** Rôles autorisés à consulter le journal. */
export const ACTIVITY_READERS = ["ADMIN"];

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(["SUCCESS", "FAILURE"]);

function clampInt(raw, min, max, fallback) {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Minuscules sans accents : « Localité » et « localite » se retrouvent. */
export const fold = (s) =>
  String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/**
 * Bornes d'une journée. La Côte d'Ivoire vit à l'heure UTC toute l'année : les
 * bornes UTC coïncident avec les journées vécues par les utilisateurs.
 */
export const dayStart = (day) => new Date(`${day}T00:00:00.000Z`);
export const dayEnd = (day) => new Date(`${day}T23:59:59.999Z`);

/**
 * Identifiant d'auteur transmis par le filtre :
 *  - `u:<id>` : un compte existant (même s'il a changé de nom depuis) ;
 *  - `n:<nom>` : un auteur sans compte rattaché (compte supprimé, visiteur…).
 */
export function actorFilter(raw) {
  const s = String(raw ?? "");
  if (s.startsWith("u:")) {
    const id = Number.parseInt(s.slice(2), 10);
    return Number.isFinite(id) ? { userId: id } : null;
  }
  if (s.startsWith("n:") && s.length > 2) return { userId: null, actorName: s.slice(2, 202) };
  return null;
}

/**
 * Traduit les paramètres de recherche en requête Prisma.
 * @returns { page, pageSize, skip, take, where }
 */
export function parseActivityQuery(searchParams) {
  const sp = searchParams;
  const page = clampInt(sp.get("page"), 1, 100000, 1);
  const pageSize = clampInt(sp.get("pageSize"), 5, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  const and = [];

  /* Recherche libre : auteur, phrase, élément - et, pour qu'on puisse chercher
     « suppression » ou « localité », les libellés d'action et de ressource. */
  const q = String(sp.get("q") ?? "").trim().slice(0, 120);
  if (q) {
    const needle = fold(q);
    const or = [
      { actorName: { contains: q, mode: "insensitive" } },
      { actorEmail: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { resourceLabel: { contains: q, mode: "insensitive" } },
    ];
    const actions = Object.entries(ACTIVITY_ACTIONS)
      .filter(([, a]) => fold(a.label).includes(needle))
      .map(([key]) => key);
    if (actions.length) or.push({ action: { in: actions } });
    const resources = Object.entries(ACTIVITY_RESOURCES)
      .filter(([, r]) => fold(r.label).includes(needle))
      .map(([key]) => key);
    if (resources.length) or.push({ resourceType: { in: resources } });
    and.push({ OR: or });
  }

  const actor = actorFilter(sp.get("actor"));
  if (actor) and.push(actor);

  const action = String(sp.get("action") ?? "").trim();
  if (action && action.length <= 40) and.push({ action });

  const moduleKey = String(sp.get("module") ?? "");
  if (ACTIVITY_MODULES.some((m) => m.key === moduleKey)) {
    and.push({ resourceType: { in: moduleResourceTypes(moduleKey) } });
  }

  const resourceType = String(sp.get("resourceType") ?? "").trim();
  if (resourceType && resourceType.length <= 40) and.push({ resourceType });

  const status = String(sp.get("status") ?? "").toUpperCase();
  if (STATUSES.has(status)) and.push({ status });

  const from = String(sp.get("from") ?? "");
  const to = String(sp.get("to") ?? "");
  const createdAt = {};
  if (DAY.test(from)) createdAt.gte = dayStart(from);
  if (DAY.test(to)) createdAt.lte = dayEnd(to);
  if (createdAt.gte || createdAt.lte) and.push({ createdAt });

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    where: and.length ? { AND: and } : {},
  };
}

/** Nombre de champs portés par une valeur avant / après. */
const countKeys = (v) => (v && typeof v === "object" ? Object.keys(v).length : 0);

/**
 * Activité telle que renvoyée à l'interface. L'identifiant interne n'est jamais
 * exposé ; le lien vers le compte est réduit à la clé du filtre d'auteur.
 * `withDetails` ajoute valeurs avant / après, adresse IP et navigateur.
 */
export function serializeActivity(row, { withDetails = false } = {}) {
  const base = {
    code: row.code,
    actorKey: row.userId != null ? `u:${row.userId}` : `n:${row.actorName}`,
    actorName: row.actorName,
    actorRole: row.actorRole,
    // Un e-mail sans compte rattaché signale un compte supprimé depuis.
    accountDeleted: row.userId == null && !!row.actorEmail,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    resourceLabel: row.resourceLabel,
    description: row.description,
    status: row.status,
    changes: Math.max(countKeys(row.oldValue), countKeys(row.newValue)),
    createdAt: row.createdAt,
  };
  if (!withDetails) return base;
  return {
    ...base,
    actorEmail: row.actorEmail,
    oldValue: row.oldValue ?? null,
    newValue: row.newValue ?? null,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
  };
}
