import { prisma } from "@/lib/prisma";
import { ok, withErrorHandling } from "@/lib/api/response";

/** GET /api/v1/newsletters — bulletins d'informations publiés. */
export const GET = withErrorHandling(async () => {
  const rows = await prisma.newsletter.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { category: { select: { title: true } } },
  });
  const data = rows.map((n) => ({
    id: n.id,
    code: n.code,
    title: n.title,
    description: n.description,
    imagePath: n.imagePath,
    filePath: n.filePath,
    videoPath: n.videoPath,
    category: n.category?.title,
    likes: n.likes,
    createdAt: n.createdAt,
  }));
  return ok(data);
});
