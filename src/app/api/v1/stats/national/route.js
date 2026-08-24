import { ok, withErrorHandling } from "@/lib/api/response";
import { guard } from "@/lib/auth-server";
import { loadNationalStats, shapeStats, listStatDates } from "@/lib/national-stats";

/**
 * GET /api/v1/stats/national?date=YYYY-MM-DD[&operator=ORANGE]
 * Statistiques nationales de couverture pour les tableaux de bord (staff).
 * Un opérateur ne voit que ses propres chiffres agrégés.
 */
export const GET = withErrorHandling(async (request) => {
  const g = await guard(["ADMIN", "SUPERVISOR", "CONTROLLER", "OPERATOR"]);
  if (g.response) return g.response;
  const { user } = g;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  // Un opérateur est verrouillé sur son propre opérateur.
  let operator = searchParams.get("operator");
  if (user.role === "OPERATOR") operator = user.operator?.name || null;

  const [raw, dates] = await Promise.all([loadNationalStats(date), listStatDates()]);
  const data = shapeStats(raw, { operator });
  return ok({ stats: data, dates });
});
