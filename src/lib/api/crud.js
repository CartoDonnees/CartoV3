import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { guard } from "@/lib/auth-server";
import { recordActivity } from "@/lib/activity";
import { resourceLabelOf, sanitizeValues, diffValues } from "@/lib/activity-format";

/** Erreur de validation exploitable dans les parseurs (create/update). */
export class ApiError extends Error {
  constructor(message, code = "BAD_REQUEST", status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Erreurs attendues d'une écriture, traduites en réponse lisible (sinon null). */
function knownFailure(err) {
  if (err instanceof ApiError) return { code: err.code, message: err.message, status: err.status };
  if (err?.code === "P2002") return { code: "DUPLICATE", message: "Une entrée avec ces valeurs existe déjà.", status: 409 };
  if (err?.code === "P2025") return { code: "NOT_FOUND", message: "Élément introuvable.", status: 404 };
  if (err?.code === "P2003") {
    return { code: "IN_USE", message: "Impossible : cet élément est référencé par d'autres données.", status: 409 };
  }
  return null;
}

/**
 * Fabrique un jeu de handlers CRUD REST autour d'un modèle Prisma.
 *
 * config = {
 *   model,            // nom du délégué prisma, ex "user"
 *   writeRoles,       // rôles autorisés en écriture (def ["ADMIN"])
 *   readRoles,        // rôles autorisés en lecture (def writeRoles)
 *   findMany,         // args prisma pour la liste (where/orderBy/include/select)
 *   itemArgs,         // args prisma (include/select) pour un item
 *   serialize,        // (row) => objet renvoyé au client
 *   search,           // (q) => where partiel de recherche
 *   parseCreate,      // async (body) => data prisma  (peut throw ApiError)
 *   parseUpdate,      // async (body, existing) => data prisma
 *   beforeDelete,     // async (existing) => void|throw ApiError
 *   activityType,     // type de ressource au journal (def : `model`)
 * }
 *
 * Renvoie { collection: { GET, POST }, item: { GET, PATCH, DELETE } }.
 *
 * JOURNAL D'ACTIVITÉ - toute création, modification ou suppression passant
 * par cette fabrique est consignée automatiquement, sans code dans les routes :
 *  - l'écriture du journal appartient à la MÊME transaction que l'écriture des
 *    données. Aucune modification ne peut donc exister sans sa trace ;
 *  - une tentative refusée (validation, doublon, élément référencé…) est
 *    consignée elle aussi, au mieux : elle n'a rien modifié.
 */
export function createCrud(config) {
  const {
    model,
    writeRoles = ["ADMIN"],
    readRoles = writeRoles,
    findMany = {},
    itemArgs = {},
    serialize = (r) => r,
    search,
    parseCreate,
    parseUpdate,
    beforeDelete,
    activityType,
  } = config;

  const delegate = () => prisma[model];
  const resourceType = activityType ?? model;

  /**
   * Exécute une écriture et traduit les erreurs attendues en réponse. `trace`
   * (auteur, action, élément) est complété au fil de l'action : en cas d'échec,
   * il sert à consigner la tentative.
   */
  const runValidated = async (fn, trace = null) => {
    try {
      return await fn();
    } catch (err) {
      const known = knownFailure(err);
      if (!known) throw err;
      if (trace) {
        await recordActivity({ ...trace, resourceType, status: "FAILURE", reason: known.message });
      }
      return fail(known.code, known.message, known.status);
    }
  };

  const GET_LIST = withErrorHandling(async (request) => {
    const g = await guard(readRoles);
    if (g.response) return g.response;
    const q = new URL(request.url).searchParams.get("q")?.trim();
    const where = { ...(findMany.where || {}), ...(q && search ? search(q) : {}) };
    const rows = await delegate().findMany({ ...findMany, where });
    return ok(rows.map(serialize));
  });

  const POST = withErrorHandling(async (request) => {
    const g = await guard(writeRoles);
    if (g.response) return g.response;
    const trace = { actor: g.user, action: "CREATE", request };
    return runValidated(async () => {
      const body = await request.json().catch(() => ({}));
      trace.resourceLabel = resourceLabelOf(resourceType, body);
      const data = await parseCreate(body, g.user);
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx[model].create({ data, ...itemArgs });
        await recordActivity(
          {
            ...trace,
            resourceType,
            resourceId: created.code,
            resourceLabel: resourceLabelOf(resourceType, created),
            newValue: sanitizeValues(created),
          },
          { client: tx, strict: true },
        );
        return created;
      });
      return ok(serialize(row), { status: 201 });
    }, trace);
  });

  const GET_ITEM = withErrorHandling(async (request, ctx) => {
    const g = await guard(readRoles);
    if (g.response) return g.response;
    const { code } = await ctx.params;
    const row = await delegate().findUnique({ where: { code }, ...itemArgs });
    if (!row) return fail("NOT_FOUND", "Élément introuvable.", 404);
    return ok(serialize(row));
  });

  const PATCH = withErrorHandling(async (request, ctx) => {
    const g = await guard(writeRoles);
    if (g.response) return g.response;
    const trace = { actor: g.user, action: "UPDATE", request };
    return runValidated(async () => {
      const { code } = await ctx.params;
      const existing = await delegate().findUnique({ where: { code } });
      if (!existing) return fail("NOT_FOUND", "Élément introuvable.", 404);
      // L'élément est désigné par son nom AVANT modification ; un changement
      // de nom se lit dans le détail avant / après.
      trace.resourceId = existing.code;
      trace.resourceLabel = resourceLabelOf(resourceType, existing);
      const body = await request.json().catch(() => ({}));
      const data = await parseUpdate(body, existing, g.user);
      const row = await prisma.$transaction(async (tx) => {
        const updated = await tx[model].update({ where: { code }, data, ...itemArgs });
        const { oldValue, newValue } = diffValues(existing, updated);
        await recordActivity({ ...trace, resourceType, oldValue, newValue }, { client: tx, strict: true });
        return updated;
      });
      return ok(serialize(row));
    }, trace);
  });

  const DELETE = withErrorHandling(async (request, ctx) => {
    const g = await guard(writeRoles);
    if (g.response) return g.response;
    const trace = { actor: g.user, action: "DELETE", request };
    return runValidated(async () => {
      const { code } = await ctx.params;
      const existing = await delegate().findUnique({ where: { code } });
      if (!existing) return fail("NOT_FOUND", "Élément introuvable.", 404);
      trace.resourceId = existing.code;
      trace.resourceLabel = resourceLabelOf(resourceType, existing);
      if (beforeDelete) await beforeDelete(existing, g.user);
      await prisma.$transaction(async (tx) => {
        // Trace écrite AVANT la suppression : si l'administrateur supprime son
        // propre compte, la clé étrangère est encore valide ; la suppression
        // la détache ensuite, et l'instantané de l'auteur demeure.
        await recordActivity(
          { ...trace, resourceType, oldValue: sanitizeValues(existing) },
          { client: tx, strict: true },
        );
        await tx[model].delete({ where: { code } });
      });
      return ok({ code });
    }, trace);
  });

  return {
    collection: { GET: GET_LIST, POST },
    item: { GET: GET_ITEM, PATCH, DELETE },
  };
}

/** Utilitaires de validation partagés. */
export const V = {
  str(v, field, { required = false, max = 5000, trim = true } = {}) {
    let s = v == null ? "" : String(v);
    if (trim) s = s.trim();
    if (!s) {
      if (required) throw new ApiError(`Le champ « ${field} » est requis.`);
      return null;
    }
    return s.slice(0, max);
  },
  enum(v, field, allowed, { required = false, def } = {}) {
    const s = v == null ? "" : String(v).toUpperCase();
    if (!s) {
      if (required) throw new ApiError(`Le champ « ${field} » est requis.`);
      return def ?? null;
    }
    if (!allowed.includes(s)) throw new ApiError(`Valeur invalide pour « ${field} ».`);
    return s;
  },
  int(v, field, { required = false, def = null } = {}) {
    if (v === "" || v == null) {
      if (required) throw new ApiError(`Le champ « ${field} » est requis.`);
      return def;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) throw new ApiError(`« ${field} » doit être un nombre.`);
    return Math.trunc(n);
  },
  bool(v, def = false) {
    if (v === true || v === "true" || v === 1 || v === "1") return true;
    if (v === false || v === "false" || v === 0 || v === "0") return false;
    return def;
  },
};
