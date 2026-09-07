# CARTODONNEES V3

Observatoire cartographique de la couverture des réseaux de télécommunications
et de la qualité de service — ARTCI, Côte d'Ivoire.

## Mise en service de la base de données

### Base vierge

```bash
npm run db:setup
```

Enchaîne les trois étapes : application des migrations, génération du client
Prisma, puis peuplement (opérateurs, technologies, périodes, comptes de
démonstration, catalogue de problèmes, bulletins).

Les étapes séparées si besoin :

```bash
npm run db:migrate   # prisma migrate deploy
npx prisma generate
npm run seed         # node prisma/seed.mjs — rejouable sans risque
```

### Base déjà en service, construite avec `prisma db push`

Une base montée avec `db push` ne porte aucun historique de migration. Ne pas
lui appliquer les migrations — son schéma est déjà à jour — mais les déclarer
comme appliquées, une seule fois :

```bash
npx prisma migrate resolve --applied 20260713114214_init
npx prisma migrate resolve --applied 20260903120000_sync_schema
npx prisma migrate status   # doit afficher « Database schema is up to date! »
```

Sans cette étape, `prisma migrate deploy` tenterait de rejouer des
modifications déjà présentes et échouerait.

## Variables d'environnement

`DATABASE_URL` dans `.env`. Les outils lancés hors Next.js (CLI Prisma, script
de peuplement) chargent ce fichier via `prisma/load-env.mjs` ; une variable
déjà définie dans l'environnement reste prioritaire.

## Comptes de démonstration

Créés par le peuplement, mot de passe commun `Passw0rd!` :

| Rôle | Adresse |
| --- | --- |
| Administrateur | `admin@artci.ci` |
| Superviseur | `superviseur@artci.ci` |
| Contrôleur | `controleur@artci.ci` |
| Opérateur | `orange@artci.ci`, `mtn@artci.ci`, `moov@artci.ci` |
| Citoyen | `client@artci.ci`, `citoyen@artci.ci` |

## Développement

```bash
npm run dev     # serveur de développement
npm run build   # construction de production
npm run lint
```
