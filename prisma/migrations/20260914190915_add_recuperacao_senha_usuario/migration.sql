-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "tokenRecuperacaoExpiraEm" TIMESTAMP(3),
ADD COLUMN     "tokenRecuperacaoSenha" TEXT;
