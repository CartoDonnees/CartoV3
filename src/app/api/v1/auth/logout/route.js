import { ok, withErrorHandling } from "@/lib/api/response";
import { sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

/** POST /api/v1/auth/logout - ferme la session. */
export const POST = withErrorHandling(async () => {
  const res = ok({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(true));
  return res;
});
