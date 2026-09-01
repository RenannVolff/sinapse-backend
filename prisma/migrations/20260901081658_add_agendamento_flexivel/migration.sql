-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusAtendimento" ADD VALUE 'AGUARDANDO_CONFIRMACAO';
ALTER TYPE "StatusAtendimento" ADD VALUE 'CONFIRMADO';

-- AlterTable
ALTER TABLE "atendimentos" ADD COLUMN     "duracaoMinutos" INTEGER NOT NULL DEFAULT 60;
