-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "duploFatorAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "duploFatorCodigosBackup" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "duploFatorSegredo" TEXT;

