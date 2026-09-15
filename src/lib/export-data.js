/**
 * Exportation des données de couverture - GeoJSON, Excel et PDF.
 * Le format des colonnes reprend celui de la version 2 :
 * CODE, LOCALITE, SOUS-PREFECTURE, DEPARTEMENT, REGION, DISTRICT, POPULATION,
 * LATITUDE, LONGITUDE puis « COUVERTURE {technologie} {opérateur} ».
 */

import { reportExport } from "@/lib/activity-client";

const OPS = ["ORANGE", "MTN", "MOOV"];
const TECHS = ["2G", "3G", "4G"];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const oneDec = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : null);

/** Déclenche le téléchargement d'un blob. */
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Une localité est un point portant ADM4_FR (nom de la localité). */
const isLocalityFeature = (f) => !!f?.properties?.ADM4_FR;

/** Hiérarchie administrative, du plus large au plus fin. */
const ADM_CHAIN = [
  { prop: "ADM0_FR", code: "ADM0_PCODE", label: "DISTRICT" },
  { prop: "ADM1_FR", code: "ADM1_PCODE", label: "REGION" },
  { prop: "ADM2_FR", code: "ADM2_PCODE", label: "DEPARTEMENT" },
  { prop: "ADM3_FR", code: "ADM3_PCODE", label: "SOUS-PREFECTURE" },
  { prop: "ADM4_FR", code: "ADM4_PCODE", label: "LOCALITE" },
];

/** Rang du niveau représenté par une entité (le champ ADM le plus fin renseigné). */
function levelIndexOf(props) {
  let idx = 0;
  for (let i = 0; i < ADM_CHAIN.length; i++) if (props?.[ADM_CHAIN[i].prop]) idx = i;
  return idx;
}

/**
 * Indicateurs de qualité de service par type d'audit (préfixes de la version 2).
 * Chaque indicateur est décliné par opérateur : `{prefixe}_{OPERATEUR}`.
 */
/**
 * `threshold` = seuil réglementaire tracé sur les graphiques (valeurs reprises
 * de la version 2). `dir` indique le sens de conformité : « max » = la mesure
 * doit rester en dessous du seuil, « min » = elle doit rester au-dessus.
 */
export const QOS_INDICATORS = {
  VOIX: [
    { key: "Te", label: "Te", name: "Taux d'échec", threshold: 2, dir: "max", unit: "%" },
    { key: "Tbd", label: "Tbd", name: "Taux de bonne desserte", threshold: 95, dir: "min", unit: "%" },
    { key: "Tc", label: "Tc", name: "Taux de coupure", threshold: 2, dir: "max", unit: "%" },
    { key: "Tq", label: "Tq", name: "Taux de mauvaise qualité", threshold: 2, dir: "max", unit: "%" },
  ],
  SMS: [
    { key: "TeS", label: "TeS", name: "Taux d'échec SMS", threshold: 2, dir: "max", unit: "%" },
    { key: "TedS", label: "TedS", name: "Taux d'émission dans les délais", threshold: 95, dir: "min", unit: "%" },
    { key: "TR3", label: "Tr3", name: "Taux de réception > 3 min", threshold: 1, dir: "max", unit: "%" },
    { key: "TeRd", label: "TeRd", name: "Taux de réception dans les délais", threshold: 95, dir: "min", unit: "%" },
    { key: "TS", label: "Ts", name: "Taux de succès SMS", threshold: 99, dir: "min", unit: "%" },
  ],
  DATA: [
    { key: "Ted", label: "Ted", name: "Taux d'échec data", threshold: 2, dir: "max", unit: "%" },
    { key: "Tcd", label: "Tcd", name: "Taux de connexion data", threshold: 95, dir: "min", unit: "%" },
    { key: "Tddu", label: "Tddu", name: "Débit descendant utile", threshold: null, dir: "min", unit: "" },
    { key: "Tddd", label: "Tddd", name: "Débit descendant", threshold: null, dir: "min", unit: "" },
    { key: "Dmd", label: "Dmd", name: "Débit moyen descendant", threshold: 512, dir: "min", unit: "kbit/s" },
    { key: "Dmu", label: "Dmu", name: "Débit moyen montant", threshold: 512, dir: "min", unit: "kbit/s" },
  ],
};

/** Une mesure respecte-t-elle son seuil ? (null si non applicable) */
export function meetsThreshold(value, ind) {
  if (value == null || ind?.threshold == null) return null;
  return ind.dir === "max" ? value <= ind.threshold : value >= ind.threshold;
}

/**
 * Lignes d'un audit de qualité de service (format V2) :
 * LOCALITE, SOUS-PREFECTURE, POPULATION, LATITUDE, LONGITUDE
 * puis un indicateur par opérateur (« Te ORANGE », « Tbd MTN »…).
 */
export function buildQosRows(geojson, service) {
  const features = geojson?.features ?? [];
  if (!features.length) return { rows: [], columns: [] };
  const indicators = QOS_INDICATORS[service] || [];

  const rows = features.map((f) => {
    const p = f.properties || {};
    const row = {
      LOCALITE: p.ADM4_FR ?? "",
      "SOUS-PREFECTURE": p.ADM3_FR ?? "",
      DEPARTEMENT: p.ADM2_FR ?? "",
      REGION: p.ADM1_FR ?? "",
      POPULATION: num(p.pop),
      LATITUDE: num(p.centerLat),
      LONGITUDE: num(p.centerLng),
    };
    // Ordre V2 : un bloc par indicateur, décliné par opérateur.
    for (const ind of indicators) {
      for (const op of OPS) {
        const v = p[`${ind.key}_${op}`];
        row[`${ind.label} ${op}`] = Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null;
      }
    }
    return row;
  });

  return { rows, columns: Object.keys(rows[0]), locality: true };
}

/**
 * Transforme un GeoJSON de couverture en lignes de tableau (format V2).
 * Localités : couverture binaire par opérateur × technologie (Oui/Non).
 * Niveaux administratifs : agrégats + taux de couverture population (%).
 */
export function buildRows(geojson) {
  const features = geojson?.features ?? [];
  if (!features.length) return { rows: [], columns: [] };

  const locality = isLocalityFeature(features[0]);

  const rows = features.map((f) => {
    const p = f.properties || {};
    const row = locality
      ? {
          CODE: p.ADM4_PCODE ?? "",
          LOCALITE: p.ADM4_FR ?? "",
          "SOUS-PREFECTURE": p.ADM3_FR ?? "",
          DEPARTEMENT: p.ADM2_FR ?? "",
          REGION: p.ADM1_FR ?? "",
          DISTRICT: p.ADM0_FR ?? "",
          POPULATION: num(p.pop),
          LATITUDE: num(p.centerLat),
          LONGITUDE: num(p.centerLng),
        }
      : {
          CODE: p[ADM_CHAIN[levelIndexOf(p)].code] ?? "",
          NOM: p[ADM_CHAIN[levelIndexOf(p)].prop] ?? "",
          // Filiation : entité parente, puis ses propres parents (du plus proche au plus large).
          ...Object.fromEntries(
            ADM_CHAIN.slice(0, levelIndexOf(p))
              .reverse()
              .map((a) => [a.label, p[a.prop] ?? ""]),
          ),
          POPULATION: num(p.pop),
          LOCALITES: num(p.locs),
          "LOCALITES COUVERTES": num(p.locCov),
          "% POPULATION COUVERTE": oneDec(p.perPopCov),
          "% LOCALITES COUVERTES": oneDec(p.perLocCov),
          STATIONS: num(p.nombrepresent),
        };

    // Colonnes de couverture, opérateur × technologie (ordre V2 : technologie puis opérateur).
    for (const t of TECHS) {
      for (const op of OPS) {
        row[`COUVERTURE ${t} ${op}`] = locality
          ? (Number(p[`cov${op}${t}`]) === 1 ? "Oui" : "Non")
          : oneDec(p[`perCov${op}${t}`]);
      }
    }
    return row;
  });

  return { rows, columns: Object.keys(rows[0]), locality };
}

/** Nom de fichier horodaté, comme en V2. */
const stamp = (base, ext) => `artci_cartodonnees_${base}_${Date.now()}.${ext}`;

/** Télécharge le GeoJSON brut servi par l'API. */
export async function exportGeoJson(url, base) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Téléchargement impossible.");
  saveBlob(await res.blob(), stamp(base, "geojson"));
  reportExport("GEOJSON", base);
}

/**
 * Génère un CSV (séparateur `;`, BOM UTF-8) : Excel francophone l'ouvre
 * directement, avec les accents intacts.
 */
export function exportCsv(rows, columns, base) {
  if (!rows.length) throw new Error("Aucune donnée à exporter.");
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [columns, ...rows.map((r) => columns.map((c) => r[c]))]
    .map((line) => line.map(cell).join(";"))
    .join("\r\n");
  saveBlob(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }), stamp(base, "csv"));
  reportExport("CSV", base);
}

/** Génère un classeur Excel (.xlsx) à partir des lignes. */
export async function exportExcel(rows, columns, base, sheetName = "Données") {
  if (!rows.length) throw new Error("Aucune donnée à exporter.");
  const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
  const wb = new ExcelJS.Workbook();
  wb.creator = "ARTCI - CARTODONNEES";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));

  ws.columns = columns.map((c) => ({
    header: c,
    key: c,
    width: Math.min(28, Math.max(10, c.length + 2)),
  }));
  ws.addRows(rows);

  // En-tête mis en forme + figé.
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF159A4E" } };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    stamp(base, "xlsx"),
  );
  reportExport("XLSX", sheetName && sheetName !== "Données" ? sheetName : base);
}

/** Génère un PDF tabulaire (paysage) à partir des lignes. */
export async function exportPdf(rows, columns, base, title, subtitle) {
  if (!rows.length) throw new Error("Aucune donnée à exporter.");
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(subtitle, 40, 56);
    doc.setTextColor(0);
  }

  autoTable(doc, {
    startY: 70,
    head: [columns],
    body: rows.map((r) => columns.map((c) => (r[c] ?? "") + "")),
    styles: { fontSize: 6.5, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [21, 154, 78], textColor: 255, fontSize: 6.5 },
    alternateRowStyles: { fillColor: [245, 248, 246] },
    margin: { left: 30, right: 30 },
    didDrawPage: (data) => {
      const page = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(130);
      doc.text(
        `ARTCI - CARTODONNEES · page ${page}`,
        data.settings.margin.left,
        doc.internal.pageSize.getHeight() - 14,
      );
      doc.setTextColor(0);
    },
  });

  doc.save(stamp(base, "pdf"));
  reportExport("PDF", title || base);
}
