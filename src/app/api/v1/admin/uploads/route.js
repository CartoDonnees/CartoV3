import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { guard } from "@/lib/auth-server";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { ApiError } from "@/lib/api/crud";
import { recordActivity } from "@/lib/activity";

/**
 * Téléversement d'une image (logo d'opérateur, illustration…).
 *
 * Les fichiers atterrissent dans `public/uploads/` et sont servis tels quels ;
 * `lib/media.js` sait déjà résoudre un simple nom de fichier vers ce dossier.
 * On ne réutilise jamais le nom d'origine : il est remplacé par un identifiant
 * tiré au sort, ce qui écarte d'un coup les collisions et les remontées de
 * chemin (« ../ ») glissées dans un nom de fichier.
 */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/** Types acceptés, avec l'extension qui leur est imposée. */
const IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
  "image/avif": "avif",
};

const MAX_BYTES = 2 * 1024 * 1024; // 2 Mo : largement assez pour un logo

export const POST = withErrorHandling(async (request) => {
  const g = await guard(["ADMIN", "SUPERVISOR"]);
  if (g.response) return g.response;

  try {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      throw new ApiError("Aucun fichier reçu.");
    }

    const ext = IMAGE_TYPES[file.type];
    if (!ext) {
      throw new ApiError(
        `Format non pris en charge (${file.type || "inconnu"}). Formats acceptés : PNG, JPEG, WebP, SVG, GIF, AVIF.`,
      );
    }
    if (file.size > MAX_BYTES) {
      throw new ApiError(`Fichier trop volumineux (${(file.size / 1048576).toFixed(1)} Mo). Maximum : 2 Mo.`);
    }

    const filename = `${randomUUID()}.${ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));

    await recordActivity({
      actor: g.user,
      action: "UPLOAD",
      resourceType: "file",
      resourceId: filename,
      resourceLabel: String(file.name || filename).slice(0, 120),
      newValue: { Type: file.type, "Taille (Ko)": Math.round(file.size / 1024), "Chemin publié": `/uploads/${filename}` },
      request,
    });

    // Chemin racine : directement exploitable dans un `src`, et distinct des
    // chemins figurant dans le dépôt (`/images/…`).
    return ok({ path: `/uploads/${filename}`, name: file.name, size: file.size, type: file.type });
  } catch (err) {
    if (err instanceof ApiError) {
      await recordActivity({
        actor: g.user,
        action: "UPLOAD",
        resourceType: "file",
        status: "FAILURE",
        reason: err.message,
        request,
      });
      return fail(err.code, err.message, err.status);
    }
    throw err;
  }
});
