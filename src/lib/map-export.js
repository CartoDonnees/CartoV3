import { effectiveColumns, legendColumns, legendHeightMm } from "@/lib/map-legend";
import { reportExport } from "@/lib/activity-client";

/**
 * Export cartographique - reprise du contrôle d'export de la version 2
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

/**
 * Pictogrammes de légende (`item.icon`, data-URI d'image).
 *
 * jsPDF n'intègre pas le SVG : chaque icône est rastérisée une fois en PNG. Le
 * canevas des formats image réutilise ce même rendu. Une icône illisible est
 * simplement omise : l'entrée retombe sur sa forme géométrique habituelle.
 */
async function rasterizeLegendIcons(groups) {
  const out = new Map();
  const uris = [...new Set(groups.flatMap((g) => g.items.map((i) => i.icon).filter(Boolean)))];
  await Promise.all(
    uris.map(async (uri) => {
      try {
        const img = await new Promise((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = uri;
        });
        const h = 96;
        const nw = img.naturalWidth || img.width || h;
        const nh = img.naturalHeight || img.height || h;
        const w = Math.max(1, Math.round((nw * h) / nh));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        out.set(uri, { png: c.toDataURL("image/png"), img: c, ratio: w / h });
      } catch {
        /* repli sur la forme géométrique */
      }
    }),
  );
  return out;
}

/** Dessine la légende des couches affichées, en colonnes, sous la carte. */
function drawLegend(pdf, groups, { x, y, width, icons = new Map() }) {
  if (!groups.length) return;
  const columns = effectiveColumns(groups, width);
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
        const icon = item.icon && icons.get(item.icon);
        if (icon) {
          const h = 3.8;
          const w = h * icon.ratio;
          pdf.addImage(icon.png, "PNG", cx + 2.2 - w / 2, cy - h + 0.6, w, h);
        } else if (item.shape === "line") {
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
 * Compose une image matricielle « prête à diffuser » : bandeau de titre,
 * carte, puis légende - la même mise en page que le PDF, aux mêmes
 * proportions (tout est calculé en millimètres puis converti à la résolution
 * demandée). Sans cela, un PNG sortirait sans sa légende.
 */
function composeRaster(canvas, { legend, title, subtitle, dpi, icons = new Map() }) {
  const pxPerMm = dpi / 25.4;
  const mm = (v) => Math.round(v * pxPerMm);
  const widthMm = canvas.width / pxPerMm;
  const contentMm = widthMm - MARGIN_MM * 2;
  const legendMm = legend.length ? legendHeightMm(legend, contentMm) : 0;

  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = mm(HEADER_MM) + canvas.height + mm(legendMm);
  const ctx = out.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);

  // Bandeau de titre, identique à celui du PDF.
  ctx.fillStyle = "#159a4e";
  ctx.fillRect(0, 0, out.width, mm(HEADER_MM));
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `bold ${mm(3.9)}px Helvetica, Arial, sans-serif`;
  ctx.fillText(title, mm(MARGIN_MM), mm(7));
  ctx.font = `${mm(2.6)}px Helvetica, Arial, sans-serif`;
  ctx.fillText(subtitle, mm(MARGIN_MM), mm(12));

  ctx.drawImage(canvas, 0, mm(HEADER_MM));

  if (legendMm) {
    drawLegendCanvas(ctx, legend, {
      x: mm(MARGIN_MM),
      y: mm(HEADER_MM) + canvas.height + mm(4),
      width: mm(contentMm),
      widthMm: contentMm,
      pxPerMm,
      icons,
    });
  }
  return out;
}

/** Légende dessinée sur un canevas - transposition de `drawLegend`. */
function drawLegendCanvas(ctx, groups, { x, y, width, widthMm, pxPerMm, icons = new Map() }) {
  const mm = (v) => v * pxPerMm;
  const columns = effectiveColumns(groups, widthMm);
  const cols = legendColumns(groups, columns);
  const colW = width / columns;

  ctx.strokeStyle = "#e2e8e5";
  ctx.lineWidth = Math.max(1, mm(0.3));
  ctx.beginPath();
  ctx.moveTo(x, y - mm(2));
  ctx.lineTo(x + width, y - mm(2));
  ctx.stroke();

  cols.forEach((groupsOfCol, ci) => {
    let cy = y + mm(3);
    const cx = x + ci * colW;
    for (const g of groupsOfCol) {
      ctx.fillStyle = "#647570";
      ctx.font = `bold ${mm(2.3)}px Helvetica, Arial, sans-serif`;
      ctx.fillText(g.title.toUpperCase(), cx, cy, colW - mm(2));
      cy += mm(3.4);

      for (const item of g.items) {
        ctx.fillStyle = item.color || "#64748b";
        const icon = item.icon && icons.get(item.icon);
        if (icon) {
          const h = mm(3.8);
          const w = h * icon.ratio;
          ctx.drawImage(icon.img, cx + mm(2.2) - w / 2, cy - h + mm(0.6), w, h);
        } else if (item.shape === "line") ctx.fillRect(cx, cy - mm(1.1), mm(4.4), mm(1.1));
        else if (item.shape === "swatch") ctx.fillRect(cx, cy - mm(2.2), mm(4.4), mm(2.6));
        else {
          ctx.beginPath();
          ctx.arc(cx + mm(1.7), cy - mm(0.9), mm(1.5), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#0e1512";
        ctx.font = `${mm(2.4)}px Helvetica, Arial, sans-serif`;
        ctx.fillText(String(item.label), cx + mm(6.4), cy, colW - mm(8));
        cy += mm(4.2);
      }
      cy += mm(1.5);
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
export async function exportMapImage(map, {
  format, size, orientation, dpi, fileName,
  legend = [], title, subtitle, featureStates = {},
  /* Les formats matriciels sortent la carte nue par défaut (comportement
     historique de la carte publique). Quand l'appelant le demande, ils
     reçoivent le même habillage que le PDF : titre puis légende. */
  legendOnRaster = false,
}) {
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
    // Pictogrammes de légende rastérisés une fois, pour le PDF comme pour l'image.
    const icons = await rasterizeLegendIcons(legend);

    if (format === "pdf") {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation, unit: "mm", format: [area.pageWidth, area.pageHeight], compress: true });
      drawHeader(pdf, area.pageWidth, {
        title: title || "CARTODONNEES - Observatoire ARTCI",
        subtitle: subtitle || "",
      });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", area.x, area.y, area.width, area.height, undefined, "FAST");

      if (placement === "sous-carte") {
        drawLegend(pdf, legend, { x: area.x, y: area.y + area.height + 5, width: area.width, icons });
      } else if (placement === "page-dediee") {
        // Trop d'éléments pour la marge basse : la légende a sa propre page.
        pdf.addPage([area.pageWidth, area.pageHeight], orientation);
        drawHeader(pdf, area.pageWidth, { title: "Légende des éléments affichés", subtitle: subtitle || "" });
        drawLegend(pdf, legend, { x: MARGIN_MM, y: HEADER_MM + MARGIN_MM, width: area.pageWidth - MARGIN_MM * 2, icons });
      }
      pdf.save(fileName);
      reportExport("PDF", title || fileName);
      return;
    }
    const out =
      legendOnRaster && legend.length
        ? composeRaster(canvas, {
            legend,
            title: title || "CARTODONNEES - Observatoire ARTCI",
            subtitle: subtitle || "",
            dpi,
            icons,
          })
        : canvas;

    if (format === "svg") {
      download(toSvg(out.toDataURL("image/png"), out.width, out.height), fileName);
      reportExport("SVG", title || fileName);
      return;
    }
    const mime = format === "jpg" ? "image/jpeg" : "image/png";
    download(out.toDataURL(mime, format === "jpg" ? 0.92 : undefined), fileName);
    reportExport(format === "jpg" ? "JPEG" : "PNG", title || fileName);
  } finally {
    cleanup();
  }
}
