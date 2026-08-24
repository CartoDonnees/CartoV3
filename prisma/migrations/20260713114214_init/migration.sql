-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'SUPERVISOR', 'ADMIN', 'OPERATOR', 'CONTROLLER');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ENABLE', 'DISABLE', 'PENDING', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('UNTREATED', 'TREATED');

-- CreateEnum
CREATE TYPE "ProblemType" AS ENUM ('APPLICATION', 'NETWORK');

-- CreateEnum
CREATE TYPE "ProblemLevel" AS ENUM ('HIGH', 'INTER', 'LOW', 'TEL', 'SMS', 'DATA');

-- CreateEnum
CREATE TYPE "TypeDownload" AS ENUM ('XLSX', 'CSV', 'PDF', 'KML', 'GEOJSON');

-- CreateEnum
CREATE TYPE "DataType" AS ENUM ('COVERAGE', 'QOS');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "first_name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "imagePath" TEXT,
    "status" "Status" NOT NULL DEFAULT 'DISABLE',
    "confirmToken" TEXT,
    "confirmNotif" BOOLEAN,
    "operatorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "year" INTEGER,
    "description" TEXT,
    "coordinates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "year" INTEGER,
    "description" TEXT,
    "coordinates" JSONB,
    "districtId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "year" INTEGER,
    "description" TEXT,
    "coordinates" JSONB,
    "regionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubPrefecture" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "year" INTEGER,
    "description" TEXT,
    "coordinates" JSONB,
    "departmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubPrefecture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Locality" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "year" INTEGER,
    "population" INTEGER,
    "fialbility" BOOLEAN NOT NULL DEFAULT true,
    "regionChiefTown" BOOLEAN,
    "departChiefTown" BOOLEAN,
    "subPrefChiefTown" BOOLEAN,
    "townAndVillage" BOOLEAN,
    "status" "Status" DEFAULT 'ENABLE',
    "description" TEXT,
    "subPrefectureId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Locality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operator" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "imagePath" TEXT,
    "status" "Status",
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technology" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ENABLE',
    "imagePath" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Technology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Summary" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "localityId" INTEGER NOT NULL,
    "description" TEXT,
    "dateUpdate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageData" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "technologyId" INTEGER NOT NULL,
    "summaryId" INTEGER NOT NULL,
    "coverage" BOOLEAN,
    "popCov" INTEGER,
    "present" BOOLEAN,
    "forecast" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemporalSummary" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "localityId" INTEGER NOT NULL,
    "description" TEXT,
    "dateUpdate" TIMESTAMP(3),
    "status" "Status",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemporalSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemporalCoverageData" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "technologyId" INTEGER NOT NULL,
    "temporalSummaryId" INTEGER NOT NULL,
    "coverage" BOOLEAN,
    "popCov" INTEGER,
    "present" BOOLEAN,
    "forecast" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemporalCoverageData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sync" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "dateUpdate" TIMESTAMP(3) NOT NULL,
    "entityType" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ProblemType" NOT NULL,
    "level" "ProblemLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ENABLE',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportAppDeclaration" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "proofFilePath" TEXT,
    "comment" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'UNTREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportAppDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportNetworkDeclaration" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "proofFilePath" TEXT,
    "comment" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'UNTREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "localityId" INTEGER NOT NULL,

    CONSTRAINT "ReportNetworkDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorReportNetworkDeclaration" (
    "operatorId" INTEGER NOT NULL,
    "reportNetworkDeclarationId" INTEGER NOT NULL,

    CONSTRAINT "OperatorReportNetworkDeclaration_pkey" PRIMARY KEY ("operatorId","reportNetworkDeclarationId")
);

-- CreateTable
CREATE TABLE "ReportAppDeclarationProblem" (
    "problemId" INTEGER NOT NULL,
    "reportAppDeclarationId" INTEGER NOT NULL,

    CONSTRAINT "ReportAppDeclarationProblem_pkey" PRIMARY KEY ("problemId","reportAppDeclarationId")
);

-- CreateTable
CREATE TABLE "ReportNetworkDeclarationProblem" (
    "problemId" INTEGER NOT NULL,
    "reportNetworkDeclarationId" INTEGER NOT NULL,

    CONSTRAINT "ReportNetworkDeclarationProblem_pkey" PRIMARY KEY ("problemId","reportNetworkDeclarationId")
);

-- CreateTable
CREATE TABLE "NewsCategory" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Newsletter" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "imagePath" TEXT,
    "filePath" TEXT,
    "videoPath" TEXT,
    "description" TEXT,
    "likes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Newsletter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Download" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "type" "TypeDownload" NOT NULL,
    "dataType" "DataType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Download_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "from" TEXT,
    "to" INTEGER,
    "content" TEXT,
    "satus" "Status",
    "read" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestorePassword" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "userId" INTEGER,
    "token" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestorePassword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sattus" "Status" NOT NULL DEFAULT 'ENABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_OperatorReportNetworkDeclaration" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_OperatorReportNetworkDeclaration_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ReportNetworkDeclarationProblem" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ReportNetworkDeclarationProblem_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ReportAppDeclarationProblem" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ReportAppDeclarationProblem_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_code_key" ON "User"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "District_code_key" ON "District"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SubPrefecture_code_key" ON "SubPrefecture"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Locality_code_key" ON "Locality"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Operator_code_key" ON "Operator"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Technology_code_key" ON "Technology"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Summary_code_key" ON "Summary"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageData_code_key" ON "CoverageData"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TemporalSummary_code_key" ON "TemporalSummary"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TemporalCoverageData_code_key" ON "TemporalCoverageData"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Sync_code_key" ON "Sync"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_code_key" ON "Problem"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReportAppDeclaration_code_key" ON "ReportAppDeclaration"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReportNetworkDeclaration_code_key" ON "ReportNetworkDeclaration"("code");

-- CreateIndex
CREATE UNIQUE INDEX "NewsCategory_code_key" ON "NewsCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Newsletter_code_key" ON "Newsletter"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Download_code_key" ON "Download"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_code_key" ON "Notification"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RestorePassword_code_key" ON "RestorePassword"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Period_code_key" ON "Period"("code");

-- CreateIndex
CREATE INDEX "_OperatorReportNetworkDeclaration_B_index" ON "_OperatorReportNetworkDeclaration"("B");

-- CreateIndex
CREATE INDEX "_ReportNetworkDeclarationProblem_B_index" ON "_ReportNetworkDeclarationProblem"("B");

-- CreateIndex
CREATE INDEX "_ReportAppDeclarationProblem_B_index" ON "_ReportAppDeclarationProblem"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubPrefecture" ADD CONSTRAINT "SubPrefecture_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Locality" ADD CONSTRAINT "Locality_subPrefectureId_fkey" FOREIGN KEY ("subPrefectureId") REFERENCES "SubPrefecture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageData" ADD CONSTRAINT "CoverageData_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageData" ADD CONSTRAINT "CoverageData_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "Technology"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageData" ADD CONSTRAINT "CoverageData_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "Summary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemporalSummary" ADD CONSTRAINT "TemporalSummary_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemporalCoverageData" ADD CONSTRAINT "TemporalCoverageData_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemporalCoverageData" ADD CONSTRAINT "TemporalCoverageData_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "Technology"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemporalCoverageData" ADD CONSTRAINT "TemporalCoverageData_temporalSummaryId_fkey" FOREIGN KEY ("temporalSummaryId") REFERENCES "TemporalSummary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sync" ADD CONSTRAINT "Sync_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportNetworkDeclaration" ADD CONSTRAINT "ReportNetworkDeclaration_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorReportNetworkDeclaration" ADD CONSTRAINT "OperatorReportNetworkDeclaration_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorReportNetworkDeclaration" ADD CONSTRAINT "OperatorReportNetworkDeclaration_reportNetworkDeclarationI_fkey" FOREIGN KEY ("reportNetworkDeclarationId") REFERENCES "ReportNetworkDeclaration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAppDeclarationProblem" ADD CONSTRAINT "ReportAppDeclarationProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAppDeclarationProblem" ADD CONSTRAINT "ReportAppDeclarationProblem_reportAppDeclarationId_fkey" FOREIGN KEY ("reportAppDeclarationId") REFERENCES "ReportAppDeclaration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportNetworkDeclarationProblem" ADD CONSTRAINT "ReportNetworkDeclarationProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportNetworkDeclarationProblem" ADD CONSTRAINT "ReportNetworkDeclarationProblem_reportNetworkDeclarationId_fkey" FOREIGN KEY ("reportNetworkDeclarationId") REFERENCES "ReportNetworkDeclaration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Newsletter" ADD CONSTRAINT "Newsletter_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "NewsCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_to_fkey" FOREIGN KEY ("to") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestorePassword" ADD CONSTRAINT "RestorePassword_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OperatorReportNetworkDeclaration" ADD CONSTRAINT "_OperatorReportNetworkDeclaration_A_fkey" FOREIGN KEY ("A") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OperatorReportNetworkDeclaration" ADD CONSTRAINT "_OperatorReportNetworkDeclaration_B_fkey" FOREIGN KEY ("B") REFERENCES "ReportNetworkDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReportNetworkDeclarationProblem" ADD CONSTRAINT "_ReportNetworkDeclarationProblem_A_fkey" FOREIGN KEY ("A") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReportNetworkDeclarationProblem" ADD CONSTRAINT "_ReportNetworkDeclarationProblem_B_fkey" FOREIGN KEY ("B") REFERENCES "ReportNetworkDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReportAppDeclarationProblem" ADD CONSTRAINT "_ReportAppDeclarationProblem_A_fkey" FOREIGN KEY ("A") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReportAppDeclarationProblem" ADD CONSTRAINT "_ReportAppDeclarationProblem_B_fkey" FOREIGN KEY ("B") REFERENCES "ReportAppDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
