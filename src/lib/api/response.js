/**
 * Helpers de réponse pour l'API REST v1 - enveloppe standardisée.
 * Toutes les routes renvoient { success, data } ou { success, error }.
 */
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";

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
 * Modèles déclarés dans `schema.prisma` mais inconnus du client Prisma chargé
 * en mémoire. Non vide, c'est la signature certaine d'un serveur démarré AVANT
 * la dernière migration : `prisma.<modèle>` vaut alors `undefined`, et l'erreur
 * brute (« Cannot read properties of undefined (reading 'count') ») n'en dit
 * rien. N'est évalué que sur le chemin d'erreur.
 */
function staleClientModels() {
  const client = globalThis.prisma; // singleton de développement (`lib/prisma`)
  if (!client) return [];
  try {
    const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    return [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)]
      .map((m) => m[1])
      .filter((name) => client[name.charAt(0).toLowerCase() + name.slice(1)] === undefined);
  } catch {
    return [];
  }
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
      const isDev = process.env.NODE_ENV !== "production";

      // Client Prisma antérieur à une migration qui a AJOUTÉ un modèle.
      const missing = name === "TypeError" ? staleClientModels() : [];
      if (missing.length) {
        console.error(
          `[API] Client Prisma périmé : modèle(s) ${missing.join(", ")} absent(s) du client en mémoire. ` +
            "Redémarrez le serveur (le client a été régénéré après son démarrage).",
        );
        return fail(
          "STALE_PRISMA_CLIENT",
          isDev
            ? `Le serveur doit être redémarré : il utilise un client Prisma antérieur à la dernière migration (modèle inconnu : ${missing.join(", ")}).`
            : "Service momentanément indisponible.",
          503,
        );
      }

      // Le client Prisma en mémoire ne connaît pas un champ du schéma :
      // le serveur doit être redémarré après une migration.
      if (name === "PrismaClientValidationError") {
        console.error(
          "[API] Indice : le client Prisma chargé en mémoire semble périmé. " +
            "Relancez le serveur de développement après `prisma generate`.",
        );
      }

      return fail(
        "INTERNAL_ERROR",
        isDev ? `${name} : ${String(err?.message || "").split("\n")[0]}` : "Une erreur interne est survenue.",
        500,
      );
    }
  };
}
