import { prisma } from "@/lib/prisma";
import { ok, withErrorHandling } from "@/lib/api/response";

const TYPES = ["NETWORK", "APPLICATION"];

/**
 * GET /api/v1/problems?type=NETWORK
 * Taxonomie publique des problèmes proposés au citoyen lors d'un signalement.
 * Groupée par niveau de service (voix, SMS, données) comme en version 2.
 */
export const GET = withErrorHandling(async (request) => {
  const raw = (new URL(request.url).searchParams.get("type") || "").toUpperCase();
  const where = { status: "ACTIVE", ...(TYPES.includes(raw) ? { type: raw } : {}) };

  const rows = await prisma.problem.findMany({
    where,
    orderBy: [{ type: "asc" }, { level: "asc" }, { title: "asc" }],
    select: { code: true, type: true, level: true, title: true, description: true },
  });
  return ok(rows);
});
