import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken, SESSION_COOKIE } from "@/lib/auth";
import { fail } from "@/lib/api/response";

/**
 * Lit le cookie de session et renvoie l'utilisateur complet (ou null).
 * À utiliser côté serveur (layouts, route handlers).
 */
export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    include: { operator: { select: { id: true, name: true, color: true } } },
  });
  if (!user || user.status === "INACTIVE" || user.status === "SUSPENDED") return null;
  return user;
}

/** Rôles autorisés à accéder à l'espace d'administration/pilotage. */
export const STAFF_ROLES = ["ADMIN", "SUPERVISOR", "CONTROLLER", "OPERATOR"];

/** Espace d'accueil du back-office selon le rôle. */
export function homePathForRole(role) {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "SUPERVISOR":
    case "CONTROLLER":
      return "/superviseur";
    case "OPERATOR":
      return "/operateur";
    default:
      return "/carte";
  }
}

/**
 * Garde pour route handlers : renvoie { user } si autorisé, sinon { response }.
 * Usage :
 *   const g = await guard(["ADMIN"]);
 *   if (g.response) return g.response;
 *   const { user } = g;
 */
export async function guard(roles) {
  const user = await getSessionUser();
  if (!user) return { response: fail("UNAUTHENTICATED", "Connexion requise.", 401) };
  if (roles && !roles.includes(user.role)) {
    return { response: fail("FORBIDDEN", "Accès non autorisé.", 403) };
  }
  return { user };
}
