import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { guard } from "@/lib/auth-server";
import { ACTIVITY_READERS, serializeActivity } from "@/lib/api/activity-query";

/** GET /api/v1/admin/activity/[code] - détail d'une activité (valeurs avant / après). */
export const GET = withErrorHandling(async (request, ctx) => {
  const g = await guard(ACTIVITY_READERS);
  if (g.response) return g.response;

  const { code } = await ctx.params;
  const row = await prisma.activityLog.findUnique({ where: { code: String(code) } });
  if (!row) return fail("NOT_FOUND", "Activité introuvable.", 404);
  return ok(serializeActivity(row, { withDetails: true }));
});
