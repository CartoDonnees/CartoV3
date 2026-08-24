import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { guard } from "@/lib/auth-server";

const DECLARANTS = ["ADMIN", "OPERATOR"];
const READERS = ["ADMIN", "SUPERVISOR", "CONTROLLER", "OPERATOR"];

/** Opérateurs qu'un utilisateur a le droit de déclarer. */
function allowedOperatorIds(user, all) {
  if (user.role === "OPERATOR") return user.operatorId ? [user.operatorId] : [];
  return all.map((o) => o.id);
}

/**
 * GET /api/v1/coverage-data?period=<code>&q=<localité>&limit=
 * Déclarations de couverture d'une période, par localité.
 * Un opérateur ne voit que ses propres déclarations.
 */
export const GET = withErrorHandling(async (request) => {
  const g = await guard(READERS);
  if (g.response) return g.response;
  const { user } = g;

  const sp = new URL(request.url).searchParams;
  const periodCode = sp.get("period");
  const q = (sp.get("q") || "").trim();
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 50));

  const period = periodCode
    ? await prisma.period.findUnique({ where: { code: periodCode } })
    : await prisma.period.findFirst({ where: { type: "COVERAGE", status: "ACTIVE" }, orderBy: { title: "desc" } });
  if (!period) return fail("NOT_FOUND", "Aucune période de couverture.", 404);

  // Localités affichées : recherche libre, sinon les premières du référentiel.
  const localities = await prisma.locality.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { name: "asc" },
    take: limit,
    include: { subPrefecture: { select: { name: true } } },
  });

  const summaries = await prisma.summary.findMany({
    where: { periodId: period.id, localityId: { in: localities.map((l) => l.id) } },
    include: {
      coverageData: {
        include: { operator: { select: { name: true } }, technology: { select: { name: true } } },
      },
    },
  });
  const byLocality = new Map(summaries.map((s) => [s.localityId, s]));

  const opFilter = user.role === "OPERATOR" ? user.operator?.name : null;

  const data = localities.map((l) => {
    const sum = byLocality.get(l.id);
    const cells = (sum?.coverageData ?? [])
      .filter((c) => !opFilter || c.operator.name === opFilter)
      .map((c) => ({
        operator: c.operator.name,
        technology: c.technology.name,
        coverage: !!c.coverage,
        present: !!c.present,
        forecast: !!c.forecast,
      }));
    return {
      code: l.code,
      name: l.name,
      subPrefecture: l.subPrefecture?.name,
      population: l.population,
      declared: !!sum,
      updatedAt: sum?.updatedAt ?? null,
      cells,
    };
  });

  return ok({
    period: { code: period.code, title: period.title },
    scope: opFilter ?? "TOUS",
    count: data.length,
    data,
  });
});

/**
 * PUT /api/v1/coverage-data
 * Body: { periodCode, localityCode, operator, values: { "2G": {coverage, present, forecast}, … } }
 * Déclare (ou met à jour) la couverture d'une localité pour un opérateur.
 */
export const PUT = withErrorHandling(async (request) => {
  const g = await guard(DECLARANTS);
  if (g.response) return g.response;
  const { user } = g;

  const b = await request.json().catch(() => ({}));
  const [period, locality, operators, technologies] = await Promise.all([
    prisma.period.findUnique({ where: { code: String(b.periodCode || "") } }),
    prisma.locality.findUnique({ where: { code: String(b.localityCode || "") } }),
    prisma.operator.findMany(),
    prisma.technology.findMany(),
  ]);
  if (!period) return fail("BAD_REQUEST", "Période inconnue.", 422);
  if (!locality) return fail("BAD_REQUEST", "Localité inconnue.", 422);

  const operator = operators.find((o) => o.name === b.operator || o.code === b.operator);
  if (!operator) return fail("BAD_REQUEST", "Opérateur inconnu.", 422);

  // Un opérateur ne peut déclarer que pour lui-même.
  if (!allowedOperatorIds(user, operators).includes(operator.id)) {
    return fail("FORBIDDEN", "Vous ne pouvez déclarer que pour votre propre réseau.", 403);
  }

  const summary = await prisma.summary.upsert({
    where: { localityId_periodId: { localityId: locality.id, periodId: period.id } },
    update: { dateUpdate: new Date() },
    create: { localityId: locality.id, periodId: period.id, dateUpdate: new Date() },
  });

  const values = b.values && typeof b.values === "object" ? b.values : {};
  for (const tech of technologies) {
    const v = values[tech.name];
    if (!v) continue;
    const coverage = !!v.coverage;
    await prisma.coverageData.upsert({
      where: {
        summaryId_operatorId_technologyId: {
          summaryId: summary.id, operatorId: operator.id, technologyId: tech.id,
        },
      },
      update: {
        coverage,
        present: !!v.present,
        forecast: !!v.forecast,
        popCov: coverage ? locality.population ?? 0 : 0,
      },
      create: {
        summaryId: summary.id, operatorId: operator.id, technologyId: tech.id,
        coverage, present: !!v.present, forecast: !!v.forecast,
        popCov: coverage ? locality.population ?? 0 : 0,
      },
    });
  }

  return ok({ locality: locality.code, period: period.code, operator: operator.name });
});
