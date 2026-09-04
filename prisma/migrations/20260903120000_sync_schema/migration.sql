-- Alignement de l'historique de migration sur `schema.prisma`.
--
-- Les évolutions apportées après la migration initiale (module de déclaration
-- de couverture, périodes typées, signalements, téléchargements, corrections
-- de libellés) avaient été appliquées avec `prisma db push`, qui ne laisse
-- aucune trace dans l'historique. Une base vierge se retrouvait donc avec le
-- schéma initial, incompatible avec l'application.
--
-- Cette migration rejoue ce delta. Sur une base déjà mise à jour par
-- `db push`, la marquer comme appliquée plutôt que l'exécuter :
--   npx prisma migrate resolve --applied 20260903120000_sync_schema

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('COVERAGE', 'QOS');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('NO_NETWORK', 'SLOW_NETWORK', 'FREQUENT_DROPS', 'APP_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "DownloadType" AS ENUM ('XLSX', 'CSV', 'PDF', 'KML', 'GEOJSON');

-- CreateEnum
CREATE TYPE "DataDomain" AS ENUM ('COVERAGE', 'QOS');

-- AlterEnum
BEGIN;
CREATE TYPE "ProblemLevel_new" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'VOICE', 'SMS', 'DATA');
ALTER TABLE "Problem" ALTER COLUMN "level" TYPE "ProblemLevel_new" USING ("level"::text::"ProblemLevel_new");
ALTER TYPE "ProblemLevel" RENAME TO "ProblemLevel_old";
ALTER TYPE "ProblemLevel_new" RENAME TO "ProblemLevel";
DROP TYPE "public"."ProblemLevel_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ReportStatus_new" AS ENUM ('PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED');
ALTER TABLE "public"."ReportAppDeclaration" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."ReportNetworkDeclaration" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ReportAppDeclaration" ALTER COLUMN "status" TYPE "ReportStatus_new" USING ("status"::text::"ReportStatus_new");
ALTER TABLE "ReportNetworkDeclaration" ALTER COLUMN "status" TYPE "ReportStatus_new" USING ("status"::text::"ReportStatus_new");
ALTER TYPE "ReportStatus" RENAME TO "ReportStatus_old";
ALTER TYPE "ReportStatus_new" RENAME TO "ReportStatus";
DROP TYPE "public"."ReportStatus_old";
ALTER TABLE "ReportAppDeclaration" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "ReportNetworkDeclaration" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "Status_new" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED');
ALTER TABLE "public"."Locality" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Period" ALTER COLUMN "sattus" DROP DEFAULT;
ALTER TABLE "public"."Problem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Technology" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "status" TYPE "Status_new" USING ("status"::text::"Status_new");
ALTER TABLE "Locality" ALTER COLUMN "status" TYPE "Status_new" USING ("status"::text::"Status_new");
ALTER TABLE "Operator" ALTER COLUMN "status" TYPE "Status_new" USING ("status"::text::"Status_new");
ALTER TABLE "Technology" ALTER COLUMN "status" TYPE "Status_new" USING ("status"::text::"Status_new");
ALTER TABLE "TemporalSummary" ALTER COLUMN "status" TYPE "Status_new" USING ("status"::text::"Status_new");
-- `Period.status` n'existe pas encore à ce stade : la colonne s'appelle
-- « sattus » (coquille corrigée plus bas). La conversion porte donc sur elle.
ALTER TABLE "Period" ALTER COLUMN "sattus" TYPE "Status_new" USING ("sattus"::text::"Status_new");
ALTER TABLE "Problem" ALTER COLUMN "status" TYPE "Status_new" USING ("status"::text::"Status_new");
-- `Notification.satus` (coquille) est supprimée plus bas, mais elle dépend
-- encore du type : sans conversion, l'ancien type ne peut pas être supprimé.
ALTER TABLE "Notification" ALTER COLUMN "satus" TYPE "Status_new" USING ("satus"::text::"Status_new");
ALTER TYPE "Status" RENAME TO "Status_old";
ALTER TYPE "Status_new" RENAME TO "Status";
DROP TYPE "public"."Status_old";
ALTER TABLE "Locality" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
ALTER TABLE "Problem" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
ALTER TABLE "Technology" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_to_fkey";

-- DropForeignKey
ALTER TABLE "OperatorReportNetworkDeclaration" DROP CONSTRAINT "OperatorReportNetworkDeclaration_operatorId_fkey";

-- DropForeignKey
ALTER TABLE "OperatorReportNetworkDeclaration" DROP CONSTRAINT "OperatorReportNetworkDeclaration_reportNetworkDeclarationI_fkey";

-- DropForeignKey
ALTER TABLE "ReportAppDeclarationProblem" DROP CONSTRAINT "ReportAppDeclarationProblem_problemId_fkey";

-- DropForeignKey
ALTER TABLE "ReportAppDeclarationProblem" DROP CONSTRAINT "ReportAppDeclarationProblem_reportAppDeclarationId_fkey";

-- DropForeignKey
ALTER TABLE "ReportNetworkDeclaration" DROP CONSTRAINT "ReportNetworkDeclaration_localityId_fkey";

-- DropForeignKey
ALTER TABLE "ReportNetworkDeclarationProblem" DROP CONSTRAINT "ReportNetworkDeclarationProblem_problemId_fkey";

-- DropForeignKey
ALTER TABLE "ReportNetworkDeclarationProblem" DROP CONSTRAINT "ReportNetworkDeclarationProblem_reportNetworkDeclarationId_fkey";

-- DropForeignKey
ALTER TABLE "RestorePassword" DROP CONSTRAINT "RestorePassword_userId_fkey";

-- DropForeignKey
ALTER TABLE "Sync" DROP CONSTRAINT "Sync_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "_OperatorReportNetworkDeclaration" DROP CONSTRAINT "_OperatorReportNetworkDeclaration_A_fkey";

-- DropForeignKey
ALTER TABLE "_OperatorReportNetworkDeclaration" DROP CONSTRAINT "_OperatorReportNetworkDeclaration_B_fkey";

-- DropForeignKey
ALTER TABLE "_ReportAppDeclarationProblem" DROP CONSTRAINT "_ReportAppDeclarationProblem_A_fkey";

-- DropForeignKey
ALTER TABLE "_ReportAppDeclarationProblem" DROP CONSTRAINT "_ReportAppDeclarationProblem_B_fkey";

-- DropForeignKey
ALTER TABLE "_ReportNetworkDeclarationProblem" DROP CONSTRAINT "_ReportNetworkDeclarationProblem_A_fkey";

-- DropForeignKey
ALTER TABLE "_ReportNetworkDeclarationProblem" DROP CONSTRAINT "_ReportNetworkDeclarationProblem_B_fkey";

-- AlterTable
ALTER TABLE "Download" DROP COLUMN "dataType",
ADD COLUMN     "domain" "DataDomain",
DROP COLUMN "type",
ADD COLUMN     "type" "DownloadType" NOT NULL;

-- AlterTable
ALTER TABLE "Locality" DROP COLUMN "fialbility",
ADD COLUMN     "reliable" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "regionChiefTown" SET NOT NULL,
ALTER COLUMN "regionChiefTown" SET DEFAULT false,
ALTER COLUMN "departChiefTown" SET NOT NULL,
ALTER COLUMN "departChiefTown" SET DEFAULT false,
ALTER COLUMN "subPrefChiefTown" SET NOT NULL,
ALTER COLUMN "subPrefChiefTown" SET DEFAULT false,
ALTER COLUMN "townAndVillage" SET NOT NULL,
ALTER COLUMN "townAndVillage" SET DEFAULT false,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Newsletter" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "likes" SET NOT NULL,
ALTER COLUMN "likes" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "from",
DROP COLUMN "satus",
DROP COLUMN "to",
ADD COLUMN     "sender" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "userId" INTEGER,
ALTER COLUMN "read" SET NOT NULL;

-- AlterTable
ALTER TABLE "Operator" ADD COLUMN     "fiberKm" INTEGER,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Period" DROP COLUMN "sattus",
ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'ACTIVE',
DROP COLUMN "type",
ADD COLUMN     "type" "PeriodType" NOT NULL DEFAULT 'COVERAGE';

-- AlterTable
ALTER TABLE "Problem" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "ReportAppDeclaration" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "ReportNetworkDeclaration" ADD COLUMN     "category" "ReportCategory",
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "localityName" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ALTER COLUMN "status" SET DEFAULT 'PENDING',
ALTER COLUMN "localityId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Summary" ADD COLUMN     "periodId" INTEGER;

-- AlterTable
ALTER TABLE "Sync" DROP COLUMN "ownerId",
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Technology" ADD COLUMN     "color" TEXT,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "TemporalSummary" ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "confirmNotif",
DROP COLUMN "confirmToken",
DROP COLUMN "first_name",
DROP COLUMN "imagePath",
DROP COLUMN "last_name",
ADD COLUMN     "acceptNews" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "role" SET DEFAULT 'CLIENT',
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "OperatorReportNetworkDeclaration";

-- DropTable
DROP TABLE "ReportAppDeclarationProblem";

-- DropTable
DROP TABLE "ReportNetworkDeclarationProblem";

-- DropTable
DROP TABLE "RestorePassword";

-- DropTable
DROP TABLE "_OperatorReportNetworkDeclaration";

-- DropTable
DROP TABLE "_ReportAppDeclarationProblem";

-- DropTable
DROP TABLE "_ReportNetworkDeclarationProblem";

-- DropEnum
DROP TYPE "DataType";

-- DropEnum
DROP TYPE "TypeDownload";

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ReportOperators" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ReportOperators_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_NetworkReportProblems" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_NetworkReportProblems_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AppReportProblems" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AppReportProblems_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset"("token");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "_ReportOperators_B_index" ON "_ReportOperators"("B");

-- CreateIndex
CREATE INDEX "_NetworkReportProblems_B_index" ON "_NetworkReportProblems"("B");

-- CreateIndex
CREATE INDEX "_AppReportProblems_B_index" ON "_AppReportProblems"("B");

-- CreateIndex
CREATE INDEX "CoverageData_operatorId_idx" ON "CoverageData"("operatorId");

-- CreateIndex
CREATE INDEX "CoverageData_technologyId_idx" ON "CoverageData"("technologyId");

-- CreateIndex
CREATE INDEX "CoverageData_summaryId_idx" ON "CoverageData"("summaryId");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageData_summaryId_operatorId_technologyId_key" ON "CoverageData"("summaryId", "operatorId", "technologyId");

-- CreateIndex
CREATE INDEX "Department_regionId_idx" ON "Department"("regionId");

-- CreateIndex
CREATE INDEX "Download_userId_idx" ON "Download"("userId");

-- CreateIndex
CREATE INDEX "Locality_subPrefectureId_idx" ON "Locality"("subPrefectureId");

-- CreateIndex
CREATE INDEX "Locality_name_idx" ON "Locality"("name");

-- CreateIndex
CREATE UNIQUE INDEX "NewsCategory_title_key" ON "NewsCategory"("title");

-- CreateIndex
CREATE INDEX "Newsletter_categoryId_idx" ON "Newsletter"("categoryId");

-- CreateIndex
CREATE INDEX "Newsletter_published_idx" ON "Newsletter"("published");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE UNIQUE INDEX "Operator_name_key" ON "Operator"("name");

-- CreateIndex
CREATE INDEX "Period_type_idx" ON "Period"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Period_title_type_key" ON "Period"("title", "type");

-- CreateIndex
CREATE INDEX "Problem_type_idx" ON "Problem"("type");

-- CreateIndex
CREATE INDEX "Region_districtId_idx" ON "Region"("districtId");

-- CreateIndex
CREATE INDEX "ReportAppDeclaration_status_idx" ON "ReportAppDeclaration"("status");

-- CreateIndex
CREATE INDEX "ReportNetworkDeclaration_status_idx" ON "ReportNetworkDeclaration"("status");

-- CreateIndex
CREATE INDEX "ReportNetworkDeclaration_localityId_idx" ON "ReportNetworkDeclaration"("localityId");

-- CreateIndex
CREATE INDEX "SubPrefecture_departmentId_idx" ON "SubPrefecture"("departmentId");

-- CreateIndex
CREATE INDEX "Summary_localityId_idx" ON "Summary"("localityId");

-- CreateIndex
CREATE INDEX "Summary_periodId_idx" ON "Summary"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "Summary_localityId_periodId_key" ON "Summary"("localityId", "periodId");

-- CreateIndex
CREATE INDEX "Sync_userId_idx" ON "Sync"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Technology_name_key" ON "Technology"("name");

-- CreateIndex
CREATE INDEX "TemporalCoverageData_operatorId_idx" ON "TemporalCoverageData"("operatorId");

-- CreateIndex
CREATE INDEX "TemporalCoverageData_technologyId_idx" ON "TemporalCoverageData"("technologyId");

-- CreateIndex
CREATE INDEX "TemporalCoverageData_temporalSummaryId_idx" ON "TemporalCoverageData"("temporalSummaryId");

-- CreateIndex
CREATE INDEX "TemporalSummary_localityId_idx" ON "TemporalSummary"("localityId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_operatorId_idx" ON "User"("operatorId");

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sync" ADD CONSTRAINT "Sync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportNetworkDeclaration" ADD CONSTRAINT "ReportNetworkDeclaration_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReportOperators" ADD CONSTRAINT "_ReportOperators_A_fkey" FOREIGN KEY ("A") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReportOperators" ADD CONSTRAINT "_ReportOperators_B_fkey" FOREIGN KEY ("B") REFERENCES "ReportNetworkDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_NetworkReportProblems" ADD CONSTRAINT "_NetworkReportProblems_A_fkey" FOREIGN KEY ("A") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_NetworkReportProblems" ADD CONSTRAINT "_NetworkReportProblems_B_fkey" FOREIGN KEY ("B") REFERENCES "ReportNetworkDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AppReportProblems" ADD CONSTRAINT "_AppReportProblems_A_fkey" FOREIGN KEY ("A") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AppReportProblems" ADD CONSTRAINT "_AppReportProblems_B_fkey" FOREIGN KEY ("B") REFERENCES "ReportAppDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

