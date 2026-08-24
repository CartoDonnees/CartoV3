import { prisma } from "@/lib/prisma";
import { ok, withErrorHandling } from "@/lib/api/response";

/** GET /api/v1/technologies — technologies (depuis la base). */
export const GET = withErrorHandling(async () => {
  const rows = await prisma.technology.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });
  const data = rows.map((t) => ({ code: t.name, name: t.name, color: t.color, description: t.description }));
  return ok(data);
});
