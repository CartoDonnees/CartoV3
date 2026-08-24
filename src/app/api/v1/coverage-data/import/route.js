import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { guard } from "@/lib/auth-server";

const truthy = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "oui" || s === "true" || s === "x" || s === "vrai";
};

/**
 * POST /api/v1/coverage-data/import
 * Body: { periodCode, rows: [{ code, "cov2GORANGE": 1, "pres2GORANGE": 0, "prev2GORANGE": 0, … }] }
 *
 * Reprend les conventions de colonnes de la version 2 :
 *   cov{TECHNO}{OPERATEUR}   → couverture
 *   pres{TECHNO}{OPERATEUR}  → station présente
 *   prev{TECHNO}{OPERATEUR}  → couverture prévisionnelle
 * La ligne est rattachée à la localité par son code officiel (ex. C0001).
 */
export const POST = withErrorHandling(async (request) => {
  const g = await guard(["ADMIN", "OPERATOR"]);
  if (g.response) return g.response;
  const { user } = g;

  const b = await request.json().catch(() => ({}));
  const rows = Array.isArray(b.rows) ? b.rows : [];
  if (!rows.length) return fail("BAD_REQUEST", "Aucune ligne à importer.", 422);
  if (rows.length > 20000) return fail("BAD_REQUEST", "Fichier trop volumineux (20 000 lignes maximum).", 422);

  const period = await prisma.period.findUnique({ where: { code: String(b.periodCode || "") } });
  if (!period) return fail("BAD_REQUEST", "Période inconnue.", 422);

  const [allOperators, technologies] = await Promise.all([
    prisma.operator.findMany({ where: { status: "ACTIVE" } }),
    prisma.technology.findMany({ where: { status: "ACTIVE" } }),
  ]);

  // Un opérateur n'importe que ses propres déclarations.
  const operators = user.role === "OPERATOR"
    ? allOperators.filter((o) => o.id === user.operatorId)
    : allOperators;
  if (!operators.length) return fail("FORBIDDEN", "Aucun opérateur rattaché à ce compte.", 403);

  // Résolution des localités par code officiel, en un seul appel.
  const codes = [...new Set(rows.map((r) => String(r.code ?? "").trim()).filter(Boolean))];
  const localities = await prisma.locality.findMany({ where: { code: { in: codes } } });
  const byCode = new Map(localities.map((l) => [l.code, l]));

  const unknown = codes.filter((c) => !byCode.has(c));
  let summaries = 0;
  let cells = 0;

  for (const row of rows) {
    const locality = byCode.get(String(row.code ?? "").trim());
    if (!locality) continue;

    const summary = await prisma.summary.upsert({
      where: { localityId_periodId: { localityId: locality.id, periodId: period.id } },
      update: { dateUpdate: new Date() },
      create: { localityId: locality.id, periodId: period.id, dateUpdate: new Date() },
    });
    summaries += 1;

    for (const op of operators) {
      for (const tech of technologies) {
        const suffix = `${tech.name}${op.name}`;
        // Ligne ignorée si aucune des trois colonnes n'est présente pour ce couple.
        if (!(`cov${suffix}` in row) && !(`pres${suffix}` in row) && !(`prev${suffix}` in row)) continue;

        const coverage = truthy(row[`cov${suffix}`]);
        await prisma.coverageData.upsert({
          where: {
            summaryId_operatorId_technologyId: {
              summaryId: summary.id, operatorId: op.id, technologyId: tech.id,
            },
          },
          update: {
            coverage,
            present: truthy(row[`pres${suffix}`]),
            forecast: truthy(row[`prev${suffix}`]),
            popCov: coverage ? locality.population ?? 0 : 0,
          },
          create: {
            summaryId: summary.id, operatorId: op.id, technologyId: tech.id,
            coverage,
            present: truthy(row[`pres${suffix}`]),
            forecast: truthy(row[`prev${suffix}`]),
            popCov: coverage ? locality.population ?? 0 : 0,
          },
        });
        cells += 1;
      }
    }
  }

  return ok({
    period: period.title,
    scope: operators.map((o) => o.name),
    rows: rows.length,
    summaries,
    cells,
    unknownCodes: unknown.slice(0, 20),
    unknownCount: unknown.length,
  });
});
