import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { guard } from "@/lib/auth-server";
import { recordActivity } from "@/lib/activity";
import { referenceOf, formatFieldValue } from "@/lib/activity-format";

const REPORT_STATUS = ["PENDING", "IN_REVIEW", "RESOLVED", "REJECTED"];

/** PATCH /api/v1/admin/reports/[code] - met à jour le statut d'un signalement. */
export const PATCH = withErrorHandling(async (request, ctx) => {
  const g = await guard(["ADMIN", "SUPERVISOR", "CONTROLLER"]);
  if (g.response) return g.response;

  const { code } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status || "").toUpperCase();
  if (!REPORT_STATUS.includes(status)) return fail("BAD_REQUEST", "Statut invalide.", 422);

  // Le statut d'origine est lu d'abord : c'est lui que le journal compare.
  const existing = await prisma.reportNetworkDeclaration.findUnique({ where: { code } });
  if (!existing) return fail("NOT_FOUND", "Signalement introuvable.", 404);

  try {
    const r = await prisma.reportNetworkDeclaration.update({ where: { code }, data: { status } });
    if (existing.status !== r.status) {
      await recordActivity({
        actor: g.user,
        action: "STATUS_CHANGE",
        resourceType: "report",
        resourceId: r.code,
        resourceLabel: referenceOf(r.code),
        detail: `(${formatFieldValue("status", existing.status)} → ${formatFieldValue("status", r.status)})`,
        oldValue: { status: existing.status },
        newValue: { status: r.status },
        request,
      });
    }
    return ok({ code: r.code, status: r.status });
  } catch (e) {
    if (e?.code === "P2025") return fail("NOT_FOUND", "Signalement introuvable.", 404);
    throw e;
  }
});
