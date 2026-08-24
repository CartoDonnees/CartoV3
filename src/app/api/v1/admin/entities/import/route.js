import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { guard } from "@/lib/auth-server";
import { DATE_RE } from "@/lib/entity-search";

const COV_DIR = path.join(process.cwd(), "dataFiles", "data_server", "data_cov");

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const readGeo = async (f) => JSON.parse(await readFile(path.join(COV_DIR, f), "utf8"));

/** Clé d'unicité d'une entité : son code officiel (ADM*_PCODE), stable et unique. */
const key = (code) => String(code || "").trim().toUpperCase();

/**
 * Insère les entités absentes d'un niveau et renvoie la table
 * « clé → id » nécessaire au rattachement du niveau suivant.
 */
async function syncLevel({ model, rows, label }) {
  const existing = await prisma[model].findMany({ select: { id: true, code: true } });
  const index = new Map(existing.map((e) => [key(e.code), e.id]));

  const toCreate = [];
  const seen = new Set();
  let duplicates = 0; // codes répétés dans la source
  for (const r of rows) {
    const k = key(r.code);
    if (!k || index.has(k)) continue;
    if (seen.has(k)) { duplicates += 1; continue; }
    seen.add(k);
    toCreate.push({ ...r.data, code: r.code, name: r.name });
  }

  if (toCreate.length) await prisma[model].createMany({ data: toCreate, skipDuplicates: true });

  const all = await prisma[model].findMany({ select: { id: true, code: true } });
  return {
    label,
    created: toCreate.length,
    duplicates,
    total: all.length,
    index: new Map(all.map((e) => [key(e.code), e.id])),
  };
}

/**
 * POST /api/v1/admin/entities/import  { date }
 * Synchronise le référentiel administratif (districts → localités) depuis les
 * fichiers GeoJSON de la période indiquée. Les géométries restent dans les
 * fichiers : seuls le nom, le centre et le rattachement sont mis en base.
 * L'opération est journalisée dans `Sync`.
 */
export const POST = withErrorHandling(async (request) => {
  const g = await guard(["ADMIN"]);
  if (g.response) return g.response;

  const body = await request.json().catch(() => ({}));
  const date = body.date;
  if (!DATE_RE.test(date || "")) return fail("BAD_REQUEST", "Période invalide.", 422);

  const year = Number(date.slice(0, 4));
  const report = [];

  /* ----------------------------- Districts ----------------------------- */
  const dFeats = (await readGeo(`district_${date}.geojson`)).features;
  const districts = await syncLevel({
    model: "district",
    label: "Districts",
    rows: dFeats.map((f) => ({
      code: f.properties.ADM0_PCODE,
      name: f.properties.ADM0_FR,
      data: { centerLat: num(f.properties.centerLat), centerLng: num(f.properties.centerLng), year },
    })),
  });
  report.push(districts);

  /* ------------------------------ Régions ------------------------------ */
  const rFeats = (await readGeo(`region_${date}.geojson`)).features;
  const regions = await syncLevel({
    model: "region",
    label: "Régions",
    rows: rFeats.map((f) => {
      const parentId = districts.index.get(key(f.properties.ADM0_PCODE));
      return {
        code: f.properties.ADM1_PCODE,
        name: f.properties.ADM1_FR,
        parentId,
        data: { districtId: parentId, centerLat: num(f.properties.centerLat), centerLng: num(f.properties.centerLng), year },
      };
    }).filter((r) => r.parentId),
  });
  report.push(regions);

  /* ---------------------------- Départements --------------------------- */
  const depFeats = (await readGeo(`departments_${date}.geojson`)).features;
  const departments = await syncLevel({
    model: "department",
    label: "Départements",
    rows: depFeats.map((f) => {
      const parentId = regions.index.get(key(f.properties.ADM1_PCODE));
      return {
        code: f.properties.ADM2_PCODE,
        name: f.properties.ADM2_FR,
        parentId,
        data: { regionId: parentId, centerLat: num(f.properties.centerLat), centerLng: num(f.properties.centerLng), year },
      };
    }).filter((r) => r.parentId),
  });
  report.push(departments);

  /* -------------------------- Sous-préfectures ------------------------- */
  const spFeats = (await readGeo(`subPrefecture_${date}.geojson`)).features;
  const subPrefectures = await syncLevel({
    model: "subPrefecture",
    label: "Sous-préfectures",
    rows: spFeats.map((f) => {
      const parentId = departments.index.get(key(f.properties.ADM2_PCODE));
      return {
        code: f.properties.ADM3_PCODE,
        name: f.properties.ADM3_FR,
        parentId,
        data: { departmentId: parentId, centerLat: num(f.properties.centerLat), centerLng: num(f.properties.centerLng), year },
      };
    }).filter((r) => r.parentId),
  });
  report.push(subPrefectures);

  /* ------------------------------ Localités ---------------------------- */
  const locFeats = (await readGeo(`locality_${date}.geojson`)).features;
  const localities = await syncLevel({
    model: "locality",
    label: "Localités",
    rows: locFeats.map((f) => {
      const parentId = subPrefectures.index.get(key(f.properties.ADM3_PCODE));
      return {
        code: f.properties.ADM4_PCODE,
        name: f.properties.ADM4_FR,
        parentId,
        data: {
          subPrefectureId: parentId,
          latitude: num(f.properties.centerLat),
          longitude: num(f.properties.centerLng),
          population: num(f.properties.pop),
          year,
          status: "ACTIVE",
        },
      };
    }).filter((r) => r.parentId),
  });
  report.push(localities);

  // Journal de synchronisation (module « limites cartographiques » de la V2).
  await prisma.sync.create({
    data: { dateUpdate: new Date(), entityType: `REFERENTIEL ${date}`, userId: g.user.id },
  });

  return ok({
    date,
    levels: report.map(({ label, created, duplicates, total }) => ({ label, created, duplicates, total })),
  });
});
