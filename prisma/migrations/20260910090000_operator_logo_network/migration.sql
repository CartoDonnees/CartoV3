-- Nature du réseau exploité par un opérateur.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NetworkType') THEN
    CREATE TYPE "NetworkType" AS ENUM ('FIXED', 'MOBILE', 'HYBRID');
  END IF;
END
$$;

-- Les opérateurs suivis jusqu'ici sont tous mobiles : c'est la valeur par défaut.
ALTER TABLE "Operator"
  ADD COLUMN IF NOT EXISTS "network" "NetworkType" NOT NULL DEFAULT 'MOBILE';

-- Logos des opérateurs historiques. Les chemins pointaient vers des fichiers
-- téléversés dans la version 2, absents de cette installation ; on les remplace
-- par les ressources servies depuis `public/`.
UPDATE "Operator" SET "imagePath" = '/images/logo/operateurs/orange.png' WHERE "name" = 'ORANGE';
UPDATE "Operator" SET "imagePath" = '/images/logo/operateurs/mtn.png'    WHERE "name" = 'MTN';
UPDATE "Operator" SET "imagePath" = '/images/logo/operateurs/moov.png'   WHERE "name" = 'MOOV';
