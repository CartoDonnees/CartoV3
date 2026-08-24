import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { createCrud, ApiError, V } from "@/lib/api/crud";

const ROLES = ["CLIENT", "OPERATOR", "CONTROLLER", "SUPERVISOR", "ADMIN"];
const STATUS = ["ACTIVE", "INACTIVE", "PENDING", "SUSPENDED"];
const PROBLEM_TYPES = ["APPLICATION", "NETWORK"];
const PROBLEM_LEVELS = ["HIGH", "MEDIUM", "LOW", "VOICE", "SMS", "DATA"];
const PERIOD_TYPES = ["COVERAGE", "QOS"];

/** Résout l'id d'un opérateur depuis son code public (ou null). */
async function operatorIdFromCode(code, { required = false } = {}) {
  if (!code) {
    if (required) throw new ApiError("Opérateur requis.");
    return null;
  }
  const op = await prisma.operator.findUnique({ where: { code: String(code) } });
  if (!op) throw new ApiError("Opérateur introuvable.");
  return op.id;
}

// ------------------------------- Utilisateurs -------------------------------
export const users = createCrud({
  model: "user",
  findMany: {
    orderBy: { createdAt: "desc" },
    include: { operator: { select: { code: true, name: true } } },
  },
  itemArgs: { include: { operator: { select: { code: true, name: true } } } },
  search: (q) => ({
    OR: [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ],
  }),
  serialize: (u) => ({
    code: u.code,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    operatorCode: u.operator?.code || null,
    operatorName: u.operator?.name || null,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  }),
  parseCreate: async (b) => {
    const role = V.enum(b.role, "Rôle", ROLES, { def: "CLIENT" });
    const password = V.str(b.password, "Mot de passe", { required: true, max: 200 });
    return {
      lastName: V.str(b.lastName, "Nom", { required: true, max: 120 }),
      firstName: V.str(b.firstName, "Prénom", { max: 120 }),
      email: V.str(b.email, "E-mail", { required: true, max: 160 }).toLowerCase(),
      phone: V.str(b.phone, "Téléphone", { max: 40 }),
      password: await hashPassword(password),
      role,
      status: V.enum(b.status, "Statut", STATUS, { def: "ACTIVE" }),
      operatorId: role === "OPERATOR" ? await operatorIdFromCode(b.operatorCode, { required: true }) : null,
    };
  },
  parseUpdate: async (b, existing) => {
    const role = b.role !== undefined ? V.enum(b.role, "Rôle", ROLES) : existing.role;
    const data = {
      lastName: b.lastName !== undefined ? V.str(b.lastName, "Nom", { required: true, max: 120 }) : undefined,
      firstName: b.firstName !== undefined ? V.str(b.firstName, "Prénom", { max: 120 }) : undefined,
      email: b.email !== undefined ? V.str(b.email, "E-mail", { required: true, max: 160 }).toLowerCase() : undefined,
      phone: b.phone !== undefined ? V.str(b.phone, "Téléphone", { max: 40 }) : undefined,
      role: b.role !== undefined ? role : undefined,
      status: b.status !== undefined ? V.enum(b.status, "Statut", STATUS) : undefined,
    };
    const pwd = V.str(b.password, "Mot de passe", { max: 200 });
    if (pwd) data.password = await hashPassword(pwd);
    if (b.role !== undefined || b.operatorCode !== undefined) {
      data.operatorId = role === "OPERATOR" ? await operatorIdFromCode(b.operatorCode, { required: true }) : null;
    }
    return data;
  },
});

// -------------------------------- Opérateurs --------------------------------
export const operators = createCrud({
  model: "operator",
  readRoles: ["ADMIN", "SUPERVISOR", "CONTROLLER"],
  findMany: { orderBy: { name: "asc" } },
  search: (q) => ({ name: { contains: q, mode: "insensitive" } }),
  serialize: (o) => ({
    code: o.code,
    name: o.name,
    color: o.color,
    imagePath: o.imagePath,
    fiberKm: o.fiberKm,
    status: o.status,
    description: o.description,
    createdAt: o.createdAt,
  }),
  parseCreate: (b) => ({
    name: V.str(b.name, "Nom", { required: true, max: 80 }).toUpperCase(),
    color: V.str(b.color, "Couleur", { required: true, max: 20 }),
    fiberKm: V.int(b.fiberKm, "Fibre (km)"),
    status: V.enum(b.status, "Statut", STATUS, { def: "ACTIVE" }),
    description: V.str(b.description, "Description"),
  }),
  parseUpdate: (b) => ({
    name: b.name !== undefined ? V.str(b.name, "Nom", { required: true, max: 80 }).toUpperCase() : undefined,
    color: b.color !== undefined ? V.str(b.color, "Couleur", { required: true, max: 20 }) : undefined,
    fiberKm: b.fiberKm !== undefined ? V.int(b.fiberKm, "Fibre (km)") : undefined,
    status: b.status !== undefined ? V.enum(b.status, "Statut", STATUS) : undefined,
    description: b.description !== undefined ? V.str(b.description, "Description") : undefined,
  }),
});

// ------------------------------- Technologies -------------------------------
export const technologies = createCrud({
  model: "technology",
  readRoles: ["ADMIN", "SUPERVISOR", "CONTROLLER"],
  findMany: { orderBy: { name: "asc" } },
  search: (q) => ({ name: { contains: q, mode: "insensitive" } }),
  serialize: (t) => ({
    code: t.code,
    name: t.name,
    color: t.color,
    status: t.status,
    description: t.description,
    createdAt: t.createdAt,
  }),
  parseCreate: (b) => ({
    name: V.str(b.name, "Nom", { required: true, max: 40 }).toUpperCase(),
    color: V.str(b.color, "Couleur", { max: 20 }),
    status: V.enum(b.status, "Statut", STATUS, { def: "ACTIVE" }),
    description: V.str(b.description, "Description"),
  }),
  parseUpdate: (b) => ({
    name: b.name !== undefined ? V.str(b.name, "Nom", { required: true, max: 40 }).toUpperCase() : undefined,
    color: b.color !== undefined ? V.str(b.color, "Couleur", { max: 20 }) : undefined,
    status: b.status !== undefined ? V.enum(b.status, "Statut", STATUS) : undefined,
    description: b.description !== undefined ? V.str(b.description, "Description") : undefined,
  }),
});

// --------------------------------- Périodes ---------------------------------
export const periods = createCrud({
  model: "period",
  readRoles: ["ADMIN", "SUPERVISOR", "CONTROLLER"],
  findMany: { orderBy: [{ type: "asc" }, { title: "desc" }] },
  search: (q) => ({ title: { contains: q, mode: "insensitive" } }),
  serialize: (p) => ({
    code: p.code,
    title: p.title,
    type: p.type,
    status: p.status,
    createdAt: p.createdAt,
  }),
  parseCreate: (b) => ({
    title: V.str(b.title, "Intitulé", { required: true, max: 60 }),
    type: V.enum(b.type, "Type", PERIOD_TYPES, { def: "COVERAGE" }),
    status: V.enum(b.status, "Statut", STATUS, { def: "ACTIVE" }),
  }),
  parseUpdate: (b) => ({
    title: b.title !== undefined ? V.str(b.title, "Intitulé", { required: true, max: 60 }) : undefined,
    type: b.type !== undefined ? V.enum(b.type, "Type", PERIOD_TYPES) : undefined,
    status: b.status !== undefined ? V.enum(b.status, "Statut", STATUS) : undefined,
  }),
});

// ----------------------------- Catégories news ------------------------------
export const newsCategories = createCrud({
  model: "newsCategory",
  findMany: { orderBy: { title: "asc" } },
  serialize: (c) => ({ code: c.code, title: c.title, description: c.description }),
  parseCreate: (b) => ({
    title: V.str(b.title, "Titre", { required: true, max: 120 }),
    description: V.str(b.description, "Description", { max: 500 }),
  }),
  parseUpdate: (b) => ({
    title: b.title !== undefined ? V.str(b.title, "Titre", { required: true, max: 120 }) : undefined,
    description: b.description !== undefined ? V.str(b.description, "Description", { max: 500 }) : undefined,
  }),
});

// -------------------------------- Bulletins ---------------------------------
async function categoryIdFromCode(code, { required = false } = {}) {
  if (!code) {
    if (required) throw new ApiError("Catégorie requise.");
    return null;
  }
  const c = await prisma.newsCategory.findUnique({ where: { code: String(code) } });
  if (!c) throw new ApiError("Catégorie introuvable.");
  return c.id;
}

export const newsletters = createCrud({
  model: "newsletter",
  findMany: {
    orderBy: { createdAt: "desc" },
    include: { category: { select: { code: true, title: true } } },
  },
  itemArgs: { include: { category: { select: { code: true, title: true } } } },
  search: (q) => ({ title: { contains: q, mode: "insensitive" } }),
  serialize: (n) => ({
    code: n.code,
    title: n.title,
    description: n.description,
    imagePath: n.imagePath,
    filePath: n.filePath,
    published: n.published,
    likes: n.likes,
    categoryCode: n.category?.code || null,
    categoryTitle: n.category?.title || null,
    createdAt: n.createdAt,
  }),
  parseCreate: async (b) => ({
    title: V.str(b.title, "Titre", { required: true, max: 200 }),
    description: V.str(b.description, "Description"),
    imagePath: V.str(b.imagePath, "Image", { max: 300 }),
    filePath: V.str(b.filePath, "Fichier", { max: 300 }),
    published: V.bool(b.published, true),
    categoryId: await categoryIdFromCode(b.categoryCode, { required: true }),
  }),
  parseUpdate: async (b) => ({
    title: b.title !== undefined ? V.str(b.title, "Titre", { required: true, max: 200 }) : undefined,
    description: b.description !== undefined ? V.str(b.description, "Description") : undefined,
    imagePath: b.imagePath !== undefined ? V.str(b.imagePath, "Image", { max: 300 }) : undefined,
    filePath: b.filePath !== undefined ? V.str(b.filePath, "Fichier", { max: 300 }) : undefined,
    published: b.published !== undefined ? V.bool(b.published, true) : undefined,
    categoryId: b.categoryCode !== undefined ? await categoryIdFromCode(b.categoryCode, { required: true }) : undefined,
  }),
});

// -------------------------------- Problèmes ---------------------------------
export const problems = createCrud({
  model: "problem",
  readRoles: ["ADMIN", "SUPERVISOR", "CONTROLLER"],
  findMany: { orderBy: [{ type: "asc" }, { level: "asc" }, { title: "asc" }] },
  // `q` accepte « NETWORK »/« APPLICATION » pour filtrer par nature (onglets V2).
  search: (q) => (PROBLEM_TYPES.includes(q.toUpperCase())
    ? { type: q.toUpperCase() }
    : { title: { contains: q, mode: "insensitive" } }),
  serialize: (p) => ({
    code: p.code,
    type: p.type,
    level: p.level,
    title: p.title,
    status: p.status,
    description: p.description,
    createdAt: p.createdAt,
  }),
  parseCreate: (b) => ({
    type: V.enum(b.type, "Type", PROBLEM_TYPES, { required: true }),
    level: V.enum(b.level, "Niveau", PROBLEM_LEVELS, { required: true }),
    title: V.str(b.title, "Titre", { required: true, max: 200 }),
    status: V.enum(b.status, "Statut", STATUS, { def: "ACTIVE" }),
    description: V.str(b.description, "Description"),
  }),
  parseUpdate: (b) => ({
    type: b.type !== undefined ? V.enum(b.type, "Type", PROBLEM_TYPES, { required: true }) : undefined,
    level: b.level !== undefined ? V.enum(b.level, "Niveau", PROBLEM_LEVELS, { required: true }) : undefined,
    title: b.title !== undefined ? V.str(b.title, "Titre", { required: true, max: 200 }) : undefined,
    status: b.status !== undefined ? V.enum(b.status, "Statut", STATUS) : undefined,
    description: b.description !== undefined ? V.str(b.description, "Description") : undefined,
  }),
});

/* ==================== Référentiel administratif ======================== */

/** Résout l'id d'un parent depuis son code public. */
async function parentIdFromCode(model, code, label) {
  if (!code) throw new ApiError(`${label} requis.`);
  const row = await prisma[model].findUnique({ where: { code: String(code) } });
  if (!row) throw new ApiError(`${label} introuvable.`);
  return row.id;
}

const geoBase = {
  readRoles: ["ADMIN", "SUPERVISOR", "CONTROLLER"],
  search: (q) => ({ name: { contains: q, mode: "insensitive" } }),
};

export const districts = createCrud({
  ...geoBase,
  model: "district",
  findMany: { orderBy: { name: "asc" }, take: 500 },
  serialize: (d) => ({ code: d.code, name: d.name, year: d.year, centerLat: d.centerLat, centerLng: d.centerLng }),
  parseCreate: (b) => ({
    name: V.str(b.name, "Nom", { required: true, max: 120 }),
    year: V.int(b.year, "Année"),
    centerLat: b.centerLat === "" ? null : Number(b.centerLat) || null,
    centerLng: b.centerLng === "" ? null : Number(b.centerLng) || null,
  }),
  parseUpdate: (b) => ({
    name: b.name !== undefined ? V.str(b.name, "Nom", { required: true, max: 120 }) : undefined,
    year: b.year !== undefined ? V.int(b.year, "Année") : undefined,
  }),
});

export const regions = createCrud({
  ...geoBase,
  model: "region",
  findMany: { orderBy: { name: "asc" }, take: 500, include: { district: { select: { code: true, name: true } } } },
  itemArgs: { include: { district: { select: { code: true, name: true } } } },
  serialize: (r) => ({ code: r.code, name: r.name, year: r.year, parentCode: r.district?.code, parentName: r.district?.name }),
  parseCreate: async (b) => ({
    name: V.str(b.name, "Nom", { required: true, max: 120 }),
    year: V.int(b.year, "Année"),
    districtId: await parentIdFromCode("district", b.parentCode, "District"),
  }),
  parseUpdate: async (b) => ({
    name: b.name !== undefined ? V.str(b.name, "Nom", { required: true, max: 120 }) : undefined,
    year: b.year !== undefined ? V.int(b.year, "Année") : undefined,
    districtId: b.parentCode !== undefined ? await parentIdFromCode("district", b.parentCode, "District") : undefined,
  }),
});

export const departments = createCrud({
  ...geoBase,
  model: "department",
  findMany: { orderBy: { name: "asc" }, take: 500, include: { region: { select: { code: true, name: true } } } },
  itemArgs: { include: { region: { select: { code: true, name: true } } } },
  serialize: (d) => ({ code: d.code, name: d.name, year: d.year, parentCode: d.region?.code, parentName: d.region?.name }),
  parseCreate: async (b) => ({
    name: V.str(b.name, "Nom", { required: true, max: 120 }),
    year: V.int(b.year, "Année"),
    regionId: await parentIdFromCode("region", b.parentCode, "Région"),
  }),
  parseUpdate: async (b) => ({
    name: b.name !== undefined ? V.str(b.name, "Nom", { required: true, max: 120 }) : undefined,
    year: b.year !== undefined ? V.int(b.year, "Année") : undefined,
    regionId: b.parentCode !== undefined ? await parentIdFromCode("region", b.parentCode, "Région") : undefined,
  }),
});

export const subPrefectures = createCrud({
  ...geoBase,
  model: "subPrefecture",
  findMany: { orderBy: { name: "asc" }, take: 800, include: { department: { select: { code: true, name: true } } } },
  itemArgs: { include: { department: { select: { code: true, name: true } } } },
  serialize: (s) => ({ code: s.code, name: s.name, year: s.year, parentCode: s.department?.code, parentName: s.department?.name }),
  parseCreate: async (b) => ({
    name: V.str(b.name, "Nom", { required: true, max: 120 }),
    year: V.int(b.year, "Année"),
    departmentId: await parentIdFromCode("department", b.parentCode, "Département"),
  }),
  parseUpdate: async (b) => ({
    name: b.name !== undefined ? V.str(b.name, "Nom", { required: true, max: 120 }) : undefined,
    year: b.year !== undefined ? V.int(b.year, "Année") : undefined,
    departmentId: b.parentCode !== undefined ? await parentIdFromCode("department", b.parentCode, "Département") : undefined,
  }),
});

export const localities = createCrud({
  ...geoBase,
  model: "locality",
  // Volume important : la liste est bornée, la recherche sert de filtre.
  findMany: { orderBy: { name: "asc" }, take: 300, include: { subPrefecture: { select: { code: true, name: true } } } },
  itemArgs: { include: { subPrefecture: { select: { code: true, name: true } } } },
  serialize: (l) => ({
    code: l.code, name: l.name, population: l.population, latitude: l.latitude, longitude: l.longitude,
    status: l.status, parentCode: l.subPrefecture?.code, parentName: l.subPrefecture?.name,
  }),
  parseCreate: async (b) => ({
    name: V.str(b.name, "Nom", { required: true, max: 160 }),
    population: V.int(b.population, "Population"),
    latitude: b.latitude === "" ? null : Number(b.latitude) || null,
    longitude: b.longitude === "" ? null : Number(b.longitude) || null,
    status: V.enum(b.status, "Statut", STATUS, { def: "ACTIVE" }),
    subPrefectureId: await parentIdFromCode("subPrefecture", b.parentCode, "Sous-préfecture"),
  }),
  parseUpdate: async (b) => ({
    name: b.name !== undefined ? V.str(b.name, "Nom", { required: true, max: 160 }) : undefined,
    population: b.population !== undefined ? V.int(b.population, "Population") : undefined,
    status: b.status !== undefined ? V.enum(b.status, "Statut", STATUS) : undefined,
    subPrefectureId: b.parentCode !== undefined ? await parentIdFromCode("subPrefecture", b.parentCode, "Sous-préfecture") : undefined,
  }),
});

/* ========================= Journal & notifications ===================== */

export const syncs = createCrud({
  model: "sync",
  readRoles: ["ADMIN", "SUPERVISOR", "CONTROLLER"],
  findMany: { orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { firstName: true, lastName: true, email: true } } } },
  serialize: (s) => ({
    code: s.code,
    entityType: s.entityType,
    dateUpdate: s.dateUpdate,
    author: s.user ? `${s.user.firstName ?? ""} ${s.user.lastName ?? ""}`.trim() || s.user.email : "—",
    createdAt: s.createdAt,
  }),
  parseCreate: () => { throw new ApiError("Les synchronisations sont créées par l'import du référentiel.", "READ_ONLY", 405); },
  parseUpdate: () => { throw new ApiError("Journal non modifiable.", "READ_ONLY", 405); },
});

export const notifications = createCrud({
  model: "notification",
  findMany: { orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { email: true } } } },
  itemArgs: { include: { user: { select: { email: true } } } },
  search: (q) => ({ OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }] }),
  serialize: (n) => ({
    code: n.code, title: n.title, content: n.content, sender: n.sender,
    read: n.read, target: n.user?.email ?? "Tous", createdAt: n.createdAt,
  }),
  parseCreate: async (b, user) => {
    const email = V.str(b.target, "Destinataire", { max: 160 });
    let userId = null;
    if (email) {
      const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!u) throw new ApiError("Aucun utilisateur avec cet e-mail.");
      userId = u.id;
    }
    return {
      title: V.str(b.title, "Titre", { required: true, max: 160 }),
      content: V.str(b.content, "Message", { max: 2000 }),
      sender: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
      userId, // null = notification générale
    };
  },
  parseUpdate: (b) => ({
    title: b.title !== undefined ? V.str(b.title, "Titre", { required: true, max: 160 }) : undefined,
    content: b.content !== undefined ? V.str(b.content, "Message", { max: 2000 }) : undefined,
    read: b.read !== undefined ? V.bool(b.read, false) : undefined,
  }),
});

export const downloads = createCrud({
  model: "download",
  readRoles: ["ADMIN", "SUPERVISOR", "CONTROLLER"],
  findMany: { orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { email: true } } } },
  serialize: (d) => ({ code: d.code, type: d.type, domain: d.domain, user: d.user?.email ?? "—", createdAt: d.createdAt }),
  parseCreate: () => { throw new ApiError("Journal alimenté automatiquement.", "READ_ONLY", 405); },
  parseUpdate: () => { throw new ApiError("Journal non modifiable.", "READ_ONLY", 405); },
});
