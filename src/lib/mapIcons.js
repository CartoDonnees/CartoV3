/**
 * Icônes cartographiques modernes enregistrées dans Mapbox via addImage.
 * - Couverture / technologies : badges circulaires plats (anneau blanc + ombre).
 * - Opérateurs : triangles disposés en trèfle (chacun à sa place, fond transparent) ;
 *   superposés ils forment le trèfle 3 opérateurs, seul chacun garde sa position.
 */

const BADGE = (color, glyph) => `
<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'>
  <defs>
    <filter id='sh' x='-40%' y='-40%' width='180%' height='180%'>
      <feDropShadow dx='0' dy='1' stdDeviation='1.3' flood-opacity='0.28'/>
    </filter>
  </defs>
  <circle cx='22' cy='22' r='16' fill='${color}' stroke='#
  
  
  ' stroke-width='3' filter='url(#sh)'/>
  <circle cx='22' cy='22' r='16' fill='none' stroke='rgba(0,0,0,0.05)' stroke-width='1'/>
  ${glyph}
</svg>`;

/* Un triangle du trèfle : base près du centre, pointe vers l'extérieur, tourné de `angle`.
   angle 0 = bas · 120 = haut-gauche · 240 = haut-droit. */
const TRIANGLE = (color, angle) => `
<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 50 50'>
  <defs>
    <filter id='t' x='-30%' y='-30%' width='160%' height='160%'>
      <feDropShadow dx='0' dy='1' stdDeviation='1.2' flood-opacity='0.3'/>
    </filter>
  </defs>
  <g filter='url(#t)' transform='rotate(${angle} 25 25)'>
    <path d='M25 47 L14.5 28 A2.6 2.6 0 0 1 16.8 24.2 L33.2 24.2 A2.6 2.6 0 0 1 35.5 28 Z'
      fill='${color}' stroke='#ffffff' stroke-width='2' stroke-linejoin='round'/>
  </g>
</svg>`;

const label = (txt, c = "#fff") =>
  `<text x='22' y='27' text-anchor='middle' font-family='system-ui,-apple-system,sans-serif' font-size='14' font-weight='800' letter-spacing='-0.5' fill='${c}'>${txt}</text>`;

const GLYPHS = {
  check: `<path d='M15 22.5l4.5 4.5 9-10' fill='none' stroke='#fff' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/>`,
  cross: `<path d='M16.5 16.5l11 11M27.5 16.5l-11 11' stroke='#fff' stroke-width='3.2' stroke-linecap='round'/>`,
  white: `<circle cx='22' cy='22' r='7.5' fill='none' stroke='#0f172a' stroke-width='3' stroke-dasharray='3.6 3.2' stroke-linecap='round'/>`,
  tower: `<g fill='none' stroke='#fff' stroke-width='2.4' stroke-linecap='round'>
      <path d='M16 16a9 9 0 0 1 12 0'/><path d='M18.5 19.5a5 5 0 0 1 7 0'/>
    </g><path d='M22 21l3 10h-6z' fill='#fff'/>`,
};

/* ------------------------- Qualité de service -------------------------- */
/* Reprise du marqueur de la version 2 : un pictogramme de service entouré
   d'un anneau découpé en arcs, un par opérateur audité (Moov / MTN / Orange). */

const QOS_OP_COLOR = { MOOV: "#0aa0dd", MTN: "#ffcc00", ORANGE: "#f47b20" };
export const QOS_SERVICES = ["VOIX", "SMS", "DATA"];
/* Combinaisons d'opérateurs, dans l'ordre des fichiers de données. */
export const QOS_OP_COMBOS = [
  ["MOOV"], ["MTN"], ["ORANGE"],
  ["MOOV", "MTN"], ["MOOV", "ORANGE"], ["MTN", "ORANGE"],
  ["MOOV", "MTN", "ORANGE"],
];

/** Arc de l'anneau, du secteur `i` sur `n`, décrit en coordonnées polaires. */
function ringArc(color, i, n) {
  const R = 18.5;
  const gap = n > 1 ? 5 : 0; // degrés de respiration entre deux arcs
  const a0 = (360 / n) * i - 90 + gap / 2;
  const a1 = (360 / n) * (i + 1) - 90 - gap / 2;
  const pt = (a) => [22 + R * Math.cos((a * Math.PI) / 180), 22 + R * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = pt(a0);
  const [x1, y1] = pt(a1);
  // Un secteur unique ne peut pas être tracé d'un seul arc : on ferme le cercle.
  if (n === 1) {
    return `<circle cx='22' cy='22' r='${R}' fill='none' stroke='${color}' stroke-width='5'/>`;
  }
  const large = a1 - a0 > 180 ? 1 : 0;
  return `<path d='M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}'
    fill='none' stroke='${color}' stroke-width='5' stroke-linecap='round'/>`;
}

const QOS_GLYPH = {
  VOIX: `<path d='M17.4 15.6c.5-.5 1.3-.5 1.8.1l1.5 1.9c.4.5.4 1.2 0 1.7l-.9 1c-.2.3-.3.7-.1 1a9 9 0 0 0 3.4 3.4c.3.2.7.1 1-.1l1-.9c.5-.4 1.2-.4 1.7 0l1.9 1.5c.6.5.6 1.3.1 1.8l-.9.9c-.7.7-1.7.9-2.6.6a15 15 0 0 1-9.3-9.3c-.3-.9-.1-1.9.6-2.6z' fill='#0e1512'/>`,
  SMS: `<path d='M11.5 15.5h21a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H21l-5.5 4v-4h-4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z' fill='#0e1512'/>
        <text x='22' y='24.5' text-anchor='middle' font-family='system-ui,-apple-system,sans-serif' font-size='8.5' font-weight='800' fill='#ffffff'>SMS</text>`,
  DATA: `<g fill='none' stroke='#0e1512' stroke-width='2'>
           <circle cx='22' cy='22' r='9.5'/><path d='M12.5 22h19M22 12.5c2.6 2.6 4 6 4 9.5s-1.4 6.9-4 9.5c-2.6-2.6-4-6-4-9.5s1.4-6.9 4-9.5z'/>
         </g>`,
};

/** Marqueur d'un service audité, cerclé des opérateurs sélectionnés. */
function qosBadge(service, ops) {
  const arcs = ops.map((op, i) => ringArc(QOS_OP_COLOR[op], i, ops.length)).join("");
  return `
<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'>
  <defs><filter id='q' x='-40%' y='-40%' width='180%' height='180%'>
    <feDropShadow dx='0' dy='1' stdDeviation='1.3' flood-opacity='0.3'/></filter></defs>
  <g filter='url(#q)'><circle cx='22' cy='22' r='16' fill='#ffffff'/></g>
  ${arcs}
  ${QOS_GLYPH[service]}
</svg>`;
}

/** Identifiant Mapbox du marqueur d'un service pour une sélection d'opérateurs. */
export const qosIconId = (service, ops) => `ic-qos-${service}-${ops.join("_")}`;

const QOS_ICONS = Object.fromEntries(
  QOS_SERVICES.flatMap((service) =>
    QOS_OP_COMBOS.map((ops) => [qosIconId(service, ops), qosBadge(service, ops)]),
  ),
);

/* ---------------------- Stations radioélectriques ----------------------- */
/* Pylône en treillis, tête et ondes à la couleur de la technologie. Un liseré
   blanc sous chaque trait garde le pictogramme lisible sur l'imagerie satellite
   comme sur le fond clair. Il s'ancre par le PIED (`icon-anchor: bottom`) :
   c'est la base du pylône qui désigne l'emplacement du site. */
const PYLON_FRAME =
  "M20 12 L11.5 48 M20 12 L28.5 48 M9 48 L31 48 " +
  "M17.6 22 L22.4 22 M15.3 32 L24.7 32 M13 41.5 L27 41.5 " +
  "M17.6 22 L24.7 32 M22.4 22 L15.3 32 M15.3 32 L27 41.5 M24.7 32 L13 41.5";
const PYLON_WAVES =
  "M14.2 4.6 Q11 8.5 14.2 12.4 M25.8 4.6 Q29 8.5 25.8 12.4 " +
  "M10.4 2.6 Q5 8.5 10.4 14.4 M29.6 2.6 Q35 8.5 29.6 14.4";
const PYLON = (color) => `
<svg xmlns='http://www.w3.org/2000/svg' width='40' height='52' viewBox='0 0 40 52'>
  <defs><filter id='py' x='-30%' y='-20%' width='160%' height='140%'>
    <feDropShadow dx='0' dy='1' stdDeviation='1' flood-opacity='0.35'/></filter></defs>
  <g filter='url(#py)' fill='none' stroke-linecap='round' stroke-linejoin='round'>
    <path d='${PYLON_WAVES}' stroke='#ffffff' stroke-width='4.4'/>
    <path d='${PYLON_WAVES}' stroke='${color}' stroke-width='2.2'/>
    <path d='${PYLON_FRAME}' stroke='#ffffff' stroke-width='4.6'/>
    <path d='${PYLON_FRAME}' stroke='#1f2937' stroke-width='2.2'/>
    <circle cx='20' cy='8.5' r='4' fill='${color}' stroke='#ffffff' stroke-width='2'/>
  </g>
</svg>`;

/** Couleurs des pylônes - celles des technologies dans tout le reste de l'application. */
export const PYLON_COLORS = { "2G": "#4eda03", "3G": "#E21273", "4G": "#8b5cf6" };

/** Identifiant de l'icône de pylône d'une technologie. */
export const pylonIconId = (tech) => `ic-pylon-${tech}`;

const PYLON_ICONS = Object.fromEntries(
  Object.entries(PYLON_COLORS).map(([tech, color]) => [pylonIconId(tech), PYLON(color)]),
);

/** SVG complet par icône. */
const ICON_SVG = {
  ...PYLON_ICONS,
  ...QOS_ICONS,
  // Localité retenue dans l'échantillon d'audit.
  "ic-qos-audited": BADGE("#0f8442", GLYPHS.check),
  "ic-covered": BADGE("#159a4e", GLYPHS.check),
  "ic-uncovered": BADGE("#e11d48", GLYPHS.cross),
  // Zone blanche : cœur blanc cerné de noir - lisible sur tous les fonds de carte.
  "ic-white": `
<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'>
  <defs><filter id='w' x='-40%' y='-40%' width='180%' height='180%'>
    <feDropShadow dx='0' dy='1' stdDeviation='1.4' flood-opacity='0.4'/></filter></defs>
  <circle cx='22' cy='22' r='15' fill='#ffffff' stroke='#0f172a' stroke-width='3.5' filter='url(#w)'/>
  ${GLYPHS.white}
</svg>`,
  "ic-station": BADGE("#334155", GLYPHS.tower),
  "ic-tech-2G": BADGE("#4eda03", label("2G", "#0a3d00")),
  "ic-tech-3G": BADGE("#E21273", label("3G")),
  "ic-tech-4G": BADGE("#8b5cf6", label("4G")),
  // Opérateurs : triangles en trèfle (bas / haut-gauche / haut-droit)
  "ic-op-ORANGE": TRIANGLE("#f47b20", 0),
  "ic-op-MTN": TRIANGLE("#ffcc00", 120),
  "ic-op-MOOV": TRIANGLE("#0aa0dd", 240),
};

/* Triangle centré (apex en haut) pour l'UI - légende & sidebar (pas la carte). */
const OP_CHIP = (color) => `
<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'>
  <defs><filter id='c' x='-30%' y='-30%' width='160%' height='160%'>
    <feDropShadow dx='0' dy='1' stdDeviation='1.2' flood-opacity='0.28'/></filter></defs>
  <path d='M20 6 L33 30 A2.4 2.4 0 0 1 30.7 33.6 L9.3 33.6 A2.4 2.4 0 0 1 7 30 Z'
    fill='${color}' stroke='#000000' stroke-width='2' stroke-linejoin='round' filter='url(#c)'/>
</svg>`;
const UI_OVERRIDE = {
  "ic-op-ORANGE": OP_CHIP("#f47b20"),
  "ic-op-MTN": OP_CHIP("#ffcc00"),
  "ic-op-MOOV": OP_CHIP("#0aa0dd"),
};

/** Data-URI d'une icône pour l'UI (légende, cartes opérateur). */
export function iconDataUri(id) {
  const svg = UI_OVERRIDE[id] || ICON_SVG[id];
  if (!svg) return null;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function svgToImage(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

/** Enregistre toutes les icônes sur la carte (idempotent, à rappeler après style.load). */
export async function registerMapIcons(map) {
  await Promise.all(
    Object.entries(ICON_SVG).map(async ([id, svg]) => {
      if (map.hasImage(id)) return;
      try {
        const img = await svgToImage(svg);
        if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 });
      } catch {
        /* ignore */
      }
    }),
  );
}
