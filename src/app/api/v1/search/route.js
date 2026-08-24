import { ok, withErrorHandling } from "@/lib/api/response";
import { searchEntities } from "@/lib/entity-search";

/**
 * GET /api/v1/search?q=korhogo&date=2024-12-31[&limit=12][&level=locality]
 * Recherche d'entités (district/région/département/sous-préfecture/localité) par nom,
 * avec les statistiques de couverture de chaque entité.
 */
export const GET = withErrorHandling(async (request) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const date = searchParams.get("date");
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit")) || 12));
  const level = searchParams.get("level") || undefined;

  return ok(await searchEntities(q, date, { limit, level }));
});
