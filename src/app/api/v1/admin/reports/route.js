import { prisma } from "@/lib/prisma";
import { ok, withErrorHandling } from "@/lib/api/response";
import { guard } from "@/lib/auth-server";

const ENUM_TO_LABEL = {
  NO_NETWORK: "Pas de réseau",
  SLOW_NETWORK: "Réseau lent",
  FREQUENT_DROPS: "Coupures fréquentes",
  APP_ISSUE: "Problème appli",
  OTHER: "Autre",
};

/** GET /api/v1/admin/reports?status=PENDING — signalements citoyens (staff). */
export const GET = withErrorHandling(async (request) => {
  const g = await guard(["ADMIN", "SUPERVISOR", "CONTROLLER"]);
  if (g.response) return g.response;

  const status = new URL(request.url).searchParams.get("status");
  const where = status && status !== "ALL" ? { status } : {};
  const rows = await prisma.reportNetworkDeclaration.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { locality: { select: { name: true } } },
  });
  const data = rows.map((r) => ({
    code: r.code,
    lat: r.latitude,
    lng: r.longitude,
    category: r.category,
    categoryLabel: ENUM_TO_LABEL[r.category] ?? "Autre",
    comment: r.comment,
    email: r.email,
    phone: r.phone,
    status: r.status,
    locality: r.locality?.name || null,
    createdAt: r.createdAt,
  }));
  return ok(data);
});
