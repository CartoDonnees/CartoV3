import "./load-env.mjs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const hash = (pw) => bcrypt.hash(pw, 10);

const OPERATORS = [
  { name: "ORANGE", color: "#f47b20", fiberKm: 12296, imagePath: "1730988953719_blob.png", description: "Opérateur historique (ex-SIM / Ivoiris)." },
  { name: "MTN", color: "#ffcc00", fiberKm: 5800, imagePath: "1730964287117_blob.png", description: "Opérateur lancé en 2005 (rachat de Telecel/Loteny)." },
  { name: "MOOV", color: "#0aa0dd", fiberKm: 4612, imagePath: "1730988968100_blob.png", description: "Filiale Maroc Télécom, lancée en 2006 (ex-Etisalat)." },
];

const TECHNOLOGIES = [
  { name: "2G", color: "#4eda03", description: "Voix et SMS (réseau de base)." },
  { name: "3G", color: "#E21273", description: "Internet mobile haut débit." },
  { name: "4G", color: "#8b5cf6", description: "Internet mobile très haut débit." },
];

// Semestres de couverture publiés. À partir de 2026, les données reposent sur
// le RGPH 2021 (nouveau référentiel de population et de localités).
const PERIOD_DATES = [
  "2021-06-30", "2021-12-31", "2022-06-30", "2022-12-31",
  "2023-06-30", "2023-12-31", "2024-06-30", "2024-12-31", "2025-06-30",
  "2026-06-30",
];

// Taxonomie des problèmes proposée aux citoyens, groupée par service
// (structure reprise de la version 2 : réseau par service, puis plateforme).
const PROBLEMS = [
  // --- Réseau : voix ---
  { type: "NETWORK", level: "VOICE", title: "Aucun réseau / pas de couverture" },
  { type: "NETWORK", level: "VOICE", title: "Impossible d'émettre un appel" },
  { type: "NETWORK", level: "VOICE", title: "Coupures d'appels fréquentes" },
  { type: "NETWORK", level: "VOICE", title: "Mauvaise qualité d'écoute" },
  // --- Réseau : SMS ---
  { type: "NETWORK", level: "SMS", title: "SMS non reçus" },
  { type: "NETWORK", level: "SMS", title: "SMS reçus avec retard" },
  { type: "NETWORK", level: "SMS", title: "Échec d'envoi de SMS" },
  // --- Réseau : données mobiles ---
  { type: "NETWORK", level: "DATA", title: "Internet mobile très lent" },
  { type: "NETWORK", level: "DATA", title: "Connexion internet impossible" },
  { type: "NETWORK", level: "DATA", title: "Coupures fréquentes de la connexion" },
  { type: "NETWORK", level: "DATA", title: "Pas de 4G à cet endroit" },
  // --- Plateforme CARTODONNEES ---
  { type: "APPLICATION", level: "HIGH", title: "Le site ne se charge pas" },
  { type: "APPLICATION", level: "MEDIUM", title: "Données de couverture erronées" },
  { type: "APPLICATION", level: "MEDIUM", title: "Localité absente ou mal placée" },
  { type: "APPLICATION", level: "LOW", title: "Bug d'affichage de l'application" },
  { type: "APPLICATION", level: "LOW", title: "Difficulté à utiliser la carte" },
];

async function main() {
  // --- Opérateurs ---
  for (const o of OPERATORS) {
    await prisma.operator.upsert({
      where: { name: o.name },
      update: { color: o.color, fiberKm: o.fiberKm, imagePath: o.imagePath, description: o.description, status: "ACTIVE" },
      create: { ...o, status: "ACTIVE" },
    });
  }

  // --- Technologies ---
  for (const t of TECHNOLOGIES) {
    await prisma.technology.upsert({
      where: { name: t.name },
      update: { color: t.color, description: t.description, status: "ACTIVE" },
      create: { ...t, status: "ACTIVE" },
    });
  }

  // --- Périodes (couverture) ---
  for (const title of PERIOD_DATES) {
    await prisma.period.upsert({
      where: { title_type: { title, type: "COVERAGE" } },
      update: { status: "ACTIVE" },
      create: { title, type: "COVERAGE", status: "ACTIVE" },
    });
  }

  // --- Catégorie + bulletins ---
  const cat = await prisma.newsCategory.upsert({
    where: { title: "Actualités" },
    update: { description: "Actualités et évolutions du secteur télécoms." },
    create: { title: "Actualités", description: "Actualités et évolutions du secteur télécoms." },
  });
  {
    const NEWS = [
        // Médias de démonstration : images déjà présentes dans `public/images`
        // et document d'exemple dans `public/uploads` (à remplacer par les
        // publications réelles de l'ARTCI).
        { categoryId: cat.id, title: "Publication des données de couverture - S1 2025", description: "Les données de couverture du premier semestre 2025 sont désormais disponibles sur l'observatoire. Elles couvrent l'ensemble des localités du territoire, par opérateur et par technologie.", imagePath: "/images/network1.png", filePath: "exemple-document.pdf", published: true },
        { categoryId: cat.id, title: "Extension de la 4G dans les zones rurales", description: "Les opérateurs poursuivent le déploiement de la 4G dans les localités faiblement couvertes.", imagePath: "/images/antenna/antenna.png", published: true },
        { categoryId: cat.id, title: "Nouvelle campagne de mesure de la qualité de service", description: "L'ARTCI lance une nouvelle campagne d'audit QoS sur l'ensemble du territoire.", published: true },
    ];
    for (const n of NEWS) {
      const found = await prisma.newsletter.findFirst({ where: { title: n.title } });
      if (found) await prisma.newsletter.update({ where: { id: found.id }, data: { imagePath: n.imagePath ?? null, filePath: n.filePath ?? null, description: n.description } });
      else await prisma.newsletter.create({ data: n });
    }
  }

  // --- Problèmes (taxonomie) ---
  // Idempotent : n'ajoute que les intitulés absents (pas de doublon au re-seed).
  for (const pb of PROBLEMS) {
    const found = await prisma.problem.findFirst({ where: { title: pb.title, type: pb.type } });
    if (!found) await prisma.problem.create({ data: { ...pb, status: "ACTIVE" } });
  }

  // --- Utilisateurs par rôle ---
  const ops = Object.fromEntries((await prisma.operator.findMany()).map((o) => [o.name, o.id]));
  const pwd = await hash("Passw0rd!"); // mot de passe de démonstration commun
  const USERS = [
    { email: "admin@artci.ci", firstName: "Awa", lastName: "Koné", role: "ADMIN" },
    { email: "superviseur@artci.ci", firstName: "Jean", lastName: "Brou", role: "SUPERVISOR" },
    { email: "controleur@artci.ci", firstName: "Marie", lastName: "Tanoh", role: "CONTROLLER" },
    { email: "orange@artci.ci", firstName: "Opérateur", lastName: "Orange", role: "OPERATOR", operatorId: ops.ORANGE },
    { email: "mtn@artci.ci", firstName: "Opérateur", lastName: "MTN", role: "OPERATOR", operatorId: ops.MTN },
    { email: "moov@artci.ci", firstName: "Opérateur", lastName: "Moov", role: "OPERATOR", operatorId: ops.MOOV },
    { email: "client@artci.ci", firstName: "Yao", lastName: "Parfait", role: "CLIENT", acceptNews: true },
    { email: "citoyen@artci.ci", firstName: "Aya", lastName: "N'Guessan", role: "CLIENT" },
  ];
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, status: "ACTIVE", operatorId: u.operatorId ?? null },
      create: { ...u, password: pwd, status: "ACTIVE", emailVerifiedAt: new Date() },
    });
  }

  const counts = {
    operators: await prisma.operator.count(),
    technologies: await prisma.technology.count(),
    periods: await prisma.period.count(),
    newsletters: await prisma.newsletter.count(),
    problems: await prisma.problem.count(),
    users: await prisma.user.count(),
  };
  console.log("Seed OK", JSON.stringify(counts));
  console.log("Comptes de démo (mot de passe: Passw0rd!):", USERS.map((u) => `${u.role}=${u.email}`).join(" · "));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
