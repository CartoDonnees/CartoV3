import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { guard } from "@/lib/auth-server";

/** Erreur de validation exploitable dans les parseurs (create/update). */
export class ApiError extends Error {
  constructor(message, code = "BAD_REQUEST", status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
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
 * }
 *
 * Renvoie { collection: { GET, POST }, item: { GET, PATCH, DELETE } }.
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
  } = config;

  const delegate = () => prisma[model];

  const runValidated = async (fn) => {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiError) return fail(err.code, err.message, err.status);
      if (err?.code === "P2002") {
        return fail("DUPLICATE", "Une entrée avec ces valeurs existe déjà.", 409);
      }
      if (err?.code === "P2025") return fail("NOT_FOUND", "Élément introuvable.", 404);
      if (err?.code === "P2003") {
        return fail("IN_USE", "Impossible : cet élément est référencé par d'autres données.", 409);
      }
      throw err;
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
    return runValidated(async () => {
      const body = await request.json().catch(() => ({}));
      const data = await parseCreate(body, g.user);
      const row = await delegate().create({ data, ...itemArgs });
      return ok(serialize(row), { status: 201 });
    });
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
    return runValidated(async () => {
      const { code } = await ctx.params;
      const existing = await delegate().findUnique({ where: { code } });
      if (!existing) return fail("NOT_FOUND", "Élément introuvable.", 404);
      const body = await request.json().catch(() => ({}));
      const data = await parseUpdate(body, existing, g.user);
      const row = await delegate().update({ where: { code }, data, ...itemArgs });
      return ok(serialize(row));
    });
  });

  const DELETE = withErrorHandling(async (request, ctx) => {
    const g = await guard(writeRoles);
    if (g.response) return g.response;
    return runValidated(async () => {
      const { code } = await ctx.params;
      const existing = await delegate().findUnique({ where: { code } });
      if (!existing) return fail("NOT_FOUND", "Élément introuvable.", 404);
      if (beforeDelete) await beforeDelete(existing, g.user);
      await delegate().delete({ where: { code } });
      return ok({ code });
    });
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
