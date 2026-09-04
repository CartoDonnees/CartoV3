import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { guard } from "@/lib/auth-server";

const REPORT_STATUS = ["PENDING", "IN_REVIEW", "RESOLVED", "REJECTED"];

/** PATCH /api/v1/admin/reports/[code] - met à jour le statut d'un signalement. */
export const PATCH = withErrorHandling(async (request, ctx) => {
  const g = await guard(["ADMIN", "SUPERVISOR", "CONTROLLER"]);
  if (g.response) return g.response;

  const { code } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status || "").toUpperCase();
  if (!REPORT_STATUS.includes(status)) return fail("BAD_REQUEST", "Statut invalide.", 422);

  try {
    const r = await prisma.reportNetworkDeclaration.update({ where: { code }, data: { status } });
    return ok({ code: r.code, status: r.status });
  } catch (e) {
    if (e?.code === "P2025") return fail("NOT_FOUND", "Signalement introuvable.", 404);
    throw e;
  }
});
