import { ok, withErrorHandling } from "@/lib/api/response";
import { sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { getSessionUser } from "@/lib/auth-server";
import { recordActivity } from "@/lib/activity";

/** POST /api/v1/auth/logout - ferme la session. */
export const POST = withErrorHandling(async (request) => {
  // L'auteur est lu AVANT d'effacer le cookie qui l'identifie.
  const user = await getSessionUser();
  if (user) await recordActivity({ actor: user, action: "LOGOUT", resourceType: "session", request });

  const res = ok({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(true));
  return res;
});
