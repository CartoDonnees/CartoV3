import { prisma } from "@/lib/prisma";
import { ok, withErrorHandling } from "@/lib/api/response";
import { guard } from "@/lib/auth-server";
import { ACTIVITY_READERS, dayStart } from "@/lib/api/activity-query";
import { actionInfo, resourceInfo, dayKey } from "@/lib/activity-format";

/**
 * GET /api/v1/admin/activity/facets - de quoi alimenter les filtres et le
 * résumé de la page : auteurs, actions et ressources RÉELLEMENT présents au
 * journal, et quelques repères chiffrés.
 */
export const GET = withErrorHandling(async () => {
  const g = await guard(ACTIVITY_READERS);
  if (g.response) return g.response;

  const now = new Date();
  const since7 = new Date(now.getTime() - 7 * 86400000);

  const [actors, actions, resources, today, failures7, active7, total] = await Promise.all([
    prisma.activityLog.groupBy({
      by: ["userId", "actorName", "actorRole"],
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.activityLog.groupBy({ by: ["action"], _count: { _all: true } }),
    prisma.activityLog.groupBy({ by: ["resourceType"], _count: { _all: true } }),
    prisma.activityLog.count({ where: { createdAt: { gte: dayStart(dayKey(now)) } } }),
    prisma.activityLog.count({ where: { status: "FAILURE", createdAt: { gte: since7 } } }),
    prisma.activityLog.groupBy({ by: ["userId"], where: { userId: { not: null }, createdAt: { gte: since7 } } }),
    prisma.activityLog.count(),
  ]);

  /* Un compte renommé apparaît sous plusieurs noms : on le regroupe sous son
     nom le plus récent. Les auteurs sans compte restent distingués par nom. */
  const byActor = new Map();
  for (const a of actors) {
    const key = a.userId != null ? `u:${a.userId}` : `n:${a.actorName}`;
    const cur = byActor.get(key);
    const last = a._max.createdAt;
    if (!cur) {
      byActor.set(key, { value: key, label: a.actorName, role: a.actorRole, count: a._count._all, last });
    } else {
      cur.count += a._count._all;
      if (last > cur.last) Object.assign(cur, { label: a.actorName, role: a.actorRole, last });
    }
  }

  return ok({
    actors: [...byActor.values()]
      .sort((x, y) => x.label.localeCompare(y.label, "fr"))
      .map(({ value, label, role, count }) => ({ value, label, role, count })),
    actions: actions
      .map((a) => ({ value: a.action, label: actionInfo(a.action).label, count: a._count._all }))
      .sort((x, y) => x.label.localeCompare(y.label, "fr")),
    resourceTypes: resources.map((r) => ({
      value: r.resourceType,
      label: resourceInfo(r.resourceType).label,
      module: resourceInfo(r.resourceType).module,
      count: r._count._all,
    })),
    stats: { today, failures7, active7: active7.length, total },
  });
});
