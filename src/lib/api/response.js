/**
 * Helpers de réponse pour l'API REST v1 - enveloppe standardisée.
 * Toutes les routes renvoient { success, data } ou { success, error }.
 */
import { NextResponse } from "next/server";

export function ok(data, init) {
  return NextResponse.json(
    { success: true, data, ...(init?.meta ? { meta: init.meta } : {}) },
    { status: init?.status ?? 200 },
  );
}

export function fail(code, message, status = 400) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}

/**
 * Enveloppe un handler pour capturer les exceptions non gérées.
 * En développement, le message réel est renvoyé au client : sans cela, une
 * erreur courante (client Prisma périmé après une migration, contrainte
 * violée…) se présente comme un opaque « erreur interne ».
 */
export function withErrorHandling(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      const name = err?.constructor?.name ?? "Error";
      console.error(`[API] ${name}:`, err);

      // Le client Prisma en mémoire ne connaît pas un champ du schéma :
      // le serveur doit être redémarré après une migration.
      if (name === "PrismaClientValidationError") {
        console.error(
          "[API] Indice : le client Prisma chargé en mémoire semble périmé. " +
            "Relancez le serveur de développement après `prisma generate`.",
        );
      }

      const isDev = process.env.NODE_ENV !== "production";
      return fail(
        "INTERNAL_ERROR",
        isDev ? `${name} : ${String(err?.message || "").split("\n")[0]}` : "Une erreur interne est survenue.",
        500,
      );
    }
  };
}
