-- CreateEnum
CREATE TYPE "StatusAtendimento" AS ENUM ('AGENDADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');

-- AlterTable
ALTER TABLE "atendimentos" ADD COLUMN     "status" "StatusAtendimento" NOT NULL DEFAULT 'AGENDADO';
