import { prisma } from "@/lib/prisma";
import { ok, withErrorHandling } from "@/lib/api/response";
import { guard } from "@/lib/auth-server";

/** GET /api/v1/admin/summary - compteurs pour le tableau de bord admin. */
export const GET = withErrorHandling(async () => {
  const g = await guard(["ADMIN"]);
  if (g.response) return g.response;

  const [
    users,
    operators,
    technologies,
    periods,
    newsletters,
    problems,
    reportsPending,
    reportsTotal,
    usersByRole,
    recentReports,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.operator.count(),
    prisma.technology.count(),
    prisma.period.count(),
    prisma.newsletter.count(),
    prisma.problem.count(),
    prisma.reportNetworkDeclaration.count({ where: { status: "PENDING" } }),
    prisma.reportNetworkDeclaration.count(),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.reportNetworkDeclaration.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { code: true, category: true, status: true, comment: true, createdAt: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { code: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
    }),
  ]);

  return ok({
    counts: { users, operators, technologies, periods, newsletters, problems, reportsPending, reportsTotal },
    usersByRole: usersByRole.map((r) => ({ role: r.role, count: r._count._all })),
    recentReports,
    recentUsers,
  });
});
