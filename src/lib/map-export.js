import { legendColumnCount, legendColumns, legendHeightMm } from "@/lib/map-legend";

/**
 * Export cartographique — reprise du contrôle d'export de la version 2
 * (`MapboxExportControlCustom`) : choix du format, du format de page, de
 * l'orientation et de la résolution, avec un rendu hors écran à la définition
 * demandée plutôt qu'une simple capture du canevas affiché.
 */

/** Formats de sortie proposés (identiques à la version 2). */
export const EXPORT_FORMATS = [
  { key: "pdf", label: "PDF", ext: "pdf" },
  { key: "png", label: "PNG", ext: "png" },
  { key: "jpg", label: "JPEG", ext: "jpg" },
  { key: "svg", label: "SVG", ext: "svg" },
];

/** Formats de page, en millimètres, exprimés en paysage [largeur, hauteur]. */
export const PAGE_SIZES = {
  A2: [594, 420],
  A3: [420, 297],
  A4: [297, 210],
  A5: [210, 148],
  B4: [353, 250],
  B5: [250, 176],
};

/** Résolutions disponibles, en points par pouce. */
export const DPI_VALUES = [72, 96, 200, 300, 400];

/** Repère de rendu de Mapbox : 96 ppp correspond au ratio de pixels 1. */
const BASE_DPI = 96;
/** Garde-fou : au-delà, le navigateur refuse d'allouer le canevas. */
export const MAX_SIDE_PX = 8192;

/** Dimensions de page en millimètres, orientation appliquée. */
export function pageMillimeters(size, orientation) {
  const [long, short] = PAGE_SIZES[size] ?? PAGE_SIZES.A4;
  return orientation === "portrait" ? [short, long] : [long, short];
}

/**
 * Dimensions du rendu en pixels pour un format de page et une résolution.
 * `clamped` signale que la taille a dû être réduite pour rester allouable.
 */
export function renderSize(size, orientation, dpi) {
  const [wmm, hmm] = pageMillimeters(size, orientation);
  const toPx = (mm) => Math.round((mm / 25.4) * dpi);
  let width = toPx(wmm);
  let height = toPx(hmm);
  const biggest = Math.max(width, height);
  const clamped = biggest > MAX_SIDE_PX;
  if (clamped) {
    const k = MAX_SIDE_PX / biggest;
    width = Math.floor(width * k);
    height = Math.floor(height * k);
  }
  return { width, height, clamped, widthMm: wmm, heightMm: hmm };
}

/** Poids approximatif du fichier produit, pour prévenir avant un export lourd. */
export function estimateMegapixels(size, orientation, dpi) {
  const { width, height } = renderSize(size, orientation, dpi);
  return (width * height) / 1e6;
}

/** Nom de fichier normalisé. */
export const exportFileName = (date, format, size) =>
  `cartodonnees_${date}_${size}.${EXPORT_FORMATS.find((f) => f.key === format)?.ext ?? format}`;

/* -------------------------------------------------------------------------- */

/** Conversion millimètres → pixels, bornée comme `renderSize`. */
function mmToPx(wmm, hmm, dpi) {
  const toPx = (mm) => Math.max(1, Math.round((mm / 25.4) * dpi));
  let width = toPx(wmm);
  let height = toPx(hmm);
  const biggest = Math.max(width, height);
  if (biggest > MAX_SIDE_PX) {
    const k = MAX_SIDE_PX / biggest;
    width = Math.floor(width * k);
    height = Math.floor(height * k);
  }
  return { width, height };
}

function download(url, name) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

/**
 * Rend la carte hors écran aux dimensions voulues.
 *
 * La définition s'obtient en majorant `devicePixelRatio` le temps du rendu :
 * Mapbox dimensionne alors son canevas en conséquence. C'est la technique du
 * contrôle d'export de la version 2.
 */
async function renderOffscreen(map, { width, height, dpi, featureStates = {} }) {
  const [{ default: mapboxgl }, { registerMapIcons }] = await Promise.all([
    import("mapbox-gl"),
    import("@/lib/mapIcons"),
  ]);

  const holder = document.createElement("div");
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;pointer-events:none;`;
  document.body.appendChild(holder);

  const ratio = dpi / BASE_DPI;
  const original = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
  Object.defineProperty(window, "devicePixelRatio", { get: () => ratio, configurable: true });

  const clone = new mapboxgl.Map({
    container: holder,
    style: map.getStyle(),
    center: map.getCenter(),
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
    interactive: false,
    preserveDrawingBuffer: true,
    attributionControl: false,
    fadeDuration: 0,
  });

  const cleanup = () => {
    clone.remove();
    holder.remove();
    if (original) Object.defineProperty(window, "devicePixelRatio", original);
    else delete window.devicePixelRatio;
  };

  /** Attend un évènement de la carte, avec garde-fou de durée. */
  const waitFor = (event, ms) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Rendu trop long")), ms);
      clone.once(event, () => { clearTimeout(timer); resolve(); });
      clone.once("error", (e) => { clearTimeout(timer); reject(e?.error ?? new Error("Rendu impossible")); });
    });

  try {
    await waitFor("load", 30000);

    // `getStyle()` ne transporte NI les images ajoutées par `addImage`, NI les
    // états d'entités : sans ces deux rappels, la carte exportée perd ses
    // marqueurs et sa choroplèthe. On les rejoue avant la capture.
    await registerMapIcons(clone);
    for (const [source, states] of Object.entries(featureStates)) {
      if (!clone.getSource(source)) continue;
      for (const [id, rate] of Object.entries(states)) {
        clone.setFeatureState({ source, id: Number.isNaN(Number(id)) ? id : Number(id) }, { rate });
      }
    }
    clone.triggerRepaint();

    // `idle` garantit que toutes les tuiles et couches sont peintes.
    await waitFor("idle", 30000);
    return { canvas: clone.getCanvas(), cleanup };
  } catch (e) {
    cleanup();
    throw e;
  }
}

/** Enveloppe une image matricielle dans un document SVG (comportement version 2). */
function toSvg(dataUrl, width, height) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<image width="${width}" height="${height}" xlink:href="${dataUrl}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ------------------------------ Mise en page PDF -------------------------- */

const MARGIN_MM = 8;
const HEADER_MM = 16;
/* La légende ne peut pas rogner la carte au-delà de cette part de la page :
   au-delà, elle part sur une seconde page et la carte garde toute la place. */
const LEGEND_MAX_SHARE = 0.34;

/**
 * Décide où placer la légende : sous la carte si elle tient dans le budget,
 * sur une page dédiée sinon.
 */
export function legendPlacement(size, orientation, legendMm) {
  const [, pageHeight] = pageMillimeters(size, orientation);
  const budget = pageHeight * LEGEND_MAX_SHARE;
  return legendMm > 0 && legendMm <= budget ? "sous-carte" : legendMm > 0 ? "page-dediee" : "aucune";
}

/** Zone réservée à la carte une fois l'en-tête et la légende défalqués. */
export function pdfMapArea(size, orientation, legendMm) {
  const [wmm, hmm] = pageMillimeters(size, orientation);
  return {
    x: MARGIN_MM,
    y: HEADER_MM + MARGIN_MM,
    width: wmm - MARGIN_MM * 2,
    height: hmm - HEADER_MM - MARGIN_MM * 2 - legendMm,
    pageWidth: wmm,
    pageHeight: hmm,
  };
}

/** Dessine le bandeau de titre. */
function drawHeader(pdf, width, { title, subtitle }) {
  pdf.setFillColor(21, 154, 78);
  pdf.rect(0, 0, width, HEADER_MM, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(title, MARGIN_MM, 7);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(subtitle, MARGIN_MM, 12);
}

const hex = (c) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
  const n = m ? parseInt(m[1], 16) : 0x64748b;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Dessine la légende des couches affichées, en colonnes, sous la carte. */
function drawLegend(pdf, groups, { x, y, width }) {
  if (!groups.length) return;
  const columns = legendColumnCount(width);
  const cols = legendColumns(groups, columns);
  const colW = width / columns;

  pdf.setDrawColor(226, 232, 229);
  pdf.line(x, y - 2, x + width, y - 2);

  cols.forEach((groupsOfCol, ci) => {
    let cy = y + 3;
    const cx = x + ci * colW;
    for (const g of groupsOfCol) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.6);
      pdf.setTextColor(100, 117, 112);
      pdf.text(g.title.toUpperCase(), cx, cy);
      cy += 3.4;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(14, 21, 18);
      for (const item of g.items) {
        const [r, gr, b] = hex(item.color);
        pdf.setFillColor(r, gr, b);
        if (item.shape === "line") {
          pdf.rect(cx, cy - 1.1, 4.4, 1.1, "F");
        } else if (item.shape === "swatch") {
          pdf.rect(cx, cy - 2.2, 4.4, 2.6, "F");
        } else {
          pdf.circle(cx + 1.7, cy - 0.9, 1.5, "F");
        }
        pdf.text(String(item.label), cx + 6.4, cy, { maxWidth: colW - 8 });
        cy += 4.2;
      }
      cy += 1.5;
    }
  });
}

/**
 * Exporte la vue courante.
 * @param map          instance Mapbox affichée
 * @param format       pdf | png | jpg | svg
 * @param size         A2…B5
 * @param orientation  landscape | portrait
 * @param dpi          72 | 96 | 200 | 300 | 400
 * @param fileName     nom du fichier produit
 */
export async function exportMapImage(map, { format, size, orientation, dpi, fileName, legend = [], title, subtitle, featureStates = {} }) {
  if (!map) throw new Error("Carte indisponible.");

  // En PDF, la carte ne prend que la zone libre : le reste porte le titre et
  // la légende des couches affichées.
  const [pageW] = pageMillimeters(size, orientation);
  const contentW = pageW - MARGIN_MM * 2;
  const legendMm = format === "pdf" ? legendHeightMm(legend, contentW) : 0;
  const placement = format === "pdf" ? legendPlacement(size, orientation, legendMm) : "aucune";
  const area = pdfMapArea(size, orientation, placement === "sous-carte" ? legendMm : 0);
  const { width, height, widthMm, heightMm } =
    format === "pdf"
      ? { ...mmToPx(area.width, area.height, dpi), widthMm: area.width, heightMm: area.height }
      : renderSize(size, orientation, dpi);

  const { canvas, cleanup } = await renderOffscreen(map, { width, height, dpi, featureStates });

  try {
    if (format === "pdf") {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation, unit: "mm", format: [area.pageWidth, area.pageHeight], compress: true });
      drawHeader(pdf, area.pageWidth, {
        title: title || "CARTODONNEES — Observatoire ARTCI",
        subtitle: subtitle || "",
      });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", area.x, area.y, area.width, area.height, undefined, "FAST");

      if (placement === "sous-carte") {
        drawLegend(pdf, legend, { x: area.x, y: area.y + area.height + 5, width: area.width });
      } else if (placement === "page-dediee") {
        // Trop d'éléments pour la marge basse : la légende a sa propre page.
        pdf.addPage([area.pageWidth, area.pageHeight], orientation);
        drawHeader(pdf, area.pageWidth, { title: "Légende des éléments affichés", subtitle: subtitle || "" });
        drawLegend(pdf, legend, { x: MARGIN_MM, y: HEADER_MM + MARGIN_MM, width: area.pageWidth - MARGIN_MM * 2 });
      }
      pdf.save(fileName);
      return;
    }
    if (format === "svg") {
      download(toSvg(canvas.toDataURL("image/png"), canvas.width, canvas.height), fileName);
      return;
    }
    const mime = format === "jpg" ? "image/jpeg" : "image/png";
    download(canvas.toDataURL(mime, format === "jpg" ? 0.92 : undefined), fileName);
  } finally {
    cleanup();
  }
}
