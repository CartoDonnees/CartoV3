-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "userId" INTEGER,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "resourceLabel" TEXT,
    "description" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "status" "ActivityStatus" NOT NULL DEFAULT 'SUCCESS',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityLog_code_key" ON "ActivityLog"("code");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");

-- CreateIndex
CREATE INDEX "ActivityLog_resourceType_idx" ON "ActivityLog"("resourceType");

-- CreateIndex
CREATE INDEX "ActivityLog_status_idx" ON "ActivityLog"("status");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Journal en lecture seule, garanti par la base elle-même.
--
-- L'API n'expose aucune route de modification ou de suppression, mais cette
-- garantie ne tiendrait pas face à un bogue, à un script ou à un accès direct
-- à la base. Le déclencheur refuse donc toute modification et toute
-- suppression d'une activité enregistrée.
--
-- Seule exception : l'action référentielle déclenchée par la suppression (ou
-- le renumérotage) d'un compte. Elle ne touche QUE `userId` et provient d'un
-- déclencheur de clé étrangère - profondeur > 1 -, jamais d'une requête
-- directe. L'auteur reste identifiable par son instantané (`actorName`,
-- `actorEmail`, `actorRole`), qui, lui, ne bouge jamais.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "activity_log_read_only"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND pg_trigger_depth() > 1
     AND (to_jsonb(NEW) - 'userId') = (to_jsonb(OLD) - 'userId') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Le journal d''activité est en lecture seule : une activité enregistrée ne peut être ni modifiée ni supprimée.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "activity_log_read_only_rows"
  BEFORE UPDATE OR DELETE ON "ActivityLog"
  FOR EACH ROW EXECUTE FUNCTION "activity_log_read_only"();

-- TRUNCATE contourne les déclencheurs de ligne : il est refusé à part.
CREATE TRIGGER "activity_log_read_only_truncate"
  BEFORE TRUNCATE ON "ActivityLog"
  FOR EACH STATEMENT EXECUTE FUNCTION "activity_log_read_only"();
