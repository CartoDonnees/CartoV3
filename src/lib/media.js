/**
 * Résolution des médias attachés aux bulletins d'information.
 *
 * `imagePath` / `filePath` / `videoPath` peuvent contenir :
 *  - une URL absolue        → utilisée telle quelle
 *  - un chemin racine (/…)  → servi depuis `public/`
 *  - un simple nom de fichier → cherché dans `public/uploads/`
 */
const UPLOADS = "/uploads/";

const EXT = (p) => (String(p).split("?")[0].split(".").pop() || "").toLowerCase();

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "jfif", "bmp"]);
const VIDEO_EXT = new Set(["mp4", "webm", "ogg", "mov"]);
const DOC_LABEL = {
  pdf: "Document PDF",
  doc: "Document Word", docx: "Document Word",
  xls: "Classeur Excel", xlsx: "Classeur Excel", csv: "Fichier CSV",
  ppt: "Présentation", pptx: "Présentation",
  zip: "Archive", geojson: "Données GeoJSON", json: "Données JSON",
};

/** URL exploitable pour un chemin stocké en base (null si vide). */
export function mediaUrl(path) {
  const p = String(path || "").trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/")) return p;
  return UPLOADS + p;
}

/** Décrit un média : URL, nature et libellé lisible. */
export function describeMedia(path) {
  const url = mediaUrl(path);
  if (!url) return null;
  const ext = EXT(url);
  const name = decodeURIComponent(url.split("/").pop() || "fichier");
  const kind = IMAGE_EXT.has(ext) ? "image" : VIDEO_EXT.has(ext) ? "video" : ext === "pdf" ? "pdf" : "file";
  return { url, ext, name, kind, label: DOC_LABEL[ext] || (ext ? `Fichier ${ext.toUpperCase()}` : "Fichier") };
}
