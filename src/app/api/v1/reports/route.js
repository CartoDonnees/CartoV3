import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorHandling } from "@/lib/api/response";

const ENUM_TO_LABEL = {
  NO_NETWORK: "Pas de réseau",
  SLOW_NETWORK: "Réseau lent",
  FREQUENT_DROPS: "Coupures fréquentes",
  APP_ISSUE: "Problème appli",
  OTHER: "Autre",
};

/** Déduit une catégorie synthétique (utilisée par la carte de chaleur). */
function categoryFrom(problems) {
  const titles = problems.map((p) => p.title.toLowerCase()).join(" ");
  const levels = new Set(problems.map((p) => p.level));
  if (/aucun réseau|pas de couverture|impossible/.test(titles)) return "NO_NETWORK";
  if (/lent/.test(titles)) return "SLOW_NETWORK";
  if (/coupure/.test(titles)) return "FREQUENT_DROPS";
  if (levels.has("DATA")) return "SLOW_NETWORK";
  return "OTHER";
}

const str = (v, max) => (v == null ? null : String(v).trim().slice(0, max) || null);

/** GET /api/v1/reports - signalements citoyens géolocalisés (carte de chaleur). */
export const GET = withErrorHandling(async () => {
  const rows = await prisma.reportNetworkDeclaration.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      id: true, latitude: true, longitude: true, category: true,
      comment: true, status: true, createdAt: true, localityName: true,
    },
  });
  return ok(
    rows.map((r) => ({
      id: r.id,
      lat: r.latitude,
      lng: r.longitude,
      type: ENUM_TO_LABEL[r.category] ?? "Autre",
      locality: r.localityName,
      comment: r.comment,
      status: r.status,
      createdAt: r.createdAt,
    })),
  );
});

/**
 * POST /api/v1/reports - enregistre un signalement citoyen.
 *
 * Deux natures, comme en version 2 :
 *  - `kind: "network"` : opérateurs concernés + localité + problèmes réseau
 *  - `kind: "app"`     : problèmes rencontrés sur la plateforme
 * Dans les deux cas : téléphone, e-mail et commentaire facultatifs.
 */
export const POST = withErrorHandling(async (request) => {
  const b = await request.json().catch(() => ({}));
  const kind = b.kind === "app" ? "app" : "network";

  const phone = str(b.phone, 40);
  const email = str(b.email, 160);
  const comment = str(b.comment, 2000);
  const problemCodes = Array.isArray(b.problems) ? b.problems.filter(Boolean).map(String) : [];

  // Les problèmes sont validés contre la taxonomie (et contre leur nature).
  const wantedType = kind === "app" ? "APPLICATION" : "NETWORK";
  const problems = problemCodes.length
    ? await prisma.problem.findMany({ where: { code: { in: problemCodes }, type: wantedType } })
    : [];

  if (!problems.length && !comment) {
    return fail("BAD_REQUEST", "Sélectionnez au moins un problème ou décrivez-le dans le commentaire.", 422);
  }

  /* ------------------------- Plateforme (application) ------------------- */
  if (kind === "app") {
    const report = await prisma.reportAppDeclaration.create({
      data: {
        phone,
        email,
        comment,
        proofFilePath: str(b.proofFilePath, 300),
        status: "PENDING",
        problems: { connect: problems.map((p) => ({ id: p.id })) },
      },
    });
    return ok({ code: report.code, kind: "app" }, { status: 201 });
  }

  /* ------------------------------ Réseau -------------------------------- */
  const operatorCodes = Array.isArray(b.operators) ? b.operators.filter(Boolean).map(String) : [];
  const operators = operatorCodes.length
    ? await prisma.operator.findMany({ where: { OR: [{ code: { in: operatorCodes } }, { name: { in: operatorCodes } }] } })
    : [];
  if (!operators.length) {
    return fail("BAD_REQUEST", "Sélectionnez au moins un opérateur concerné.", 422);
  }

  const lat = Number(b.lat);
  const lng = Number(b.lng);
  const localityName = str(b.locality, 160);
  if (!localityName && !(Number.isFinite(lat) && Number.isFinite(lng))) {
    return fail("BAD_REQUEST", "Indiquez la localité concernée (ou un point sur la carte).", 422);
  }

  const report = await prisma.reportNetworkDeclaration.create({
    data: {
      phone,
      email,
      comment,
      proofFilePath: str(b.proofFilePath, 300),
      status: "PENDING",
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      localityName,
      category: problems.length ? categoryFrom(problems) : "OTHER",
      operators: { connect: operators.map((o) => ({ id: o.id })) },
      problems: { connect: problems.map((p) => ({ id: p.id })) },
    },
  });

  return ok(
    {
      code: report.code,
      kind: "network",
      lat: report.latitude,
      lng: report.longitude,
      locality: report.localityName,
      type: ENUM_TO_LABEL[report.category],
      comment: report.comment,
    },
    { status: 201 },
  );
});
