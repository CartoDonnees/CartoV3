import { prisma } from "@/lib/prisma";
import { ok, withErrorHandling } from "@/lib/api/response";
import { guard } from "@/lib/auth-server";
import { ACTIVITY_READERS, parseActivityQuery, serializeActivity } from "@/lib/api/activity-query";

/**
 * GET /api/v1/admin/activity - journal d'activité, du plus récent au plus ancien.
 *
 * Paramètres : page, pageSize, q, actor, action, module, resourceType, status,
 * from, to (AAAA-MM-JJ). Réservé aux administrateurs.
 *
 * Aucune route d'écriture n'est exposée : le journal se lit, il ne se modifie
 * pas. La base refuse d'ailleurs toute modification ou suppression.
 */
export const GET = withErrorHandling(async (request) => {
  const g = await guard(ACTIVITY_READERS);
  if (g.response) return g.response;

  const { page, pageSize, skip, take, where } = parseActivityQuery(new URL(request.url).searchParams);

  const [total, rows] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      // `id` départage deux activités de la même milliseconde : l'ordre reste stable
      // d'une page à l'autre.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
    }),
  ]);

  return ok(rows.map((r) => serializeActivity(r)), {
    meta: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
  });
});
