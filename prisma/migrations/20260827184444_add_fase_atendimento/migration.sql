-- CreateEnum
CREATE TYPE "FaseAtendimento" AS ENUM ('LINHA_BASE', 'INTERVENCAO');

-- AlterTable
ALTER TABLE "aprendentes" ADD COLUMN     "faseAtual" "FaseAtendimento" NOT NULL DEFAULT 'LINHA_BASE';

-- AlterTable
ALTER TABLE "atendimentos" ADD COLUMN     "fase" "FaseAtendimento" NOT NULL DEFAULT 'LINHA_BASE';

