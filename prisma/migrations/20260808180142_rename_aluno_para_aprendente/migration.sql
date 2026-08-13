-- Rename da entidade Aluno -> Aprendente (tabela, coluna FK, constraints e índice)
-- Usa RENAME em vez de DROP/CREATE para preservar os dados já cadastrados.

-- RenameTable
ALTER TABLE "alunos" RENAME TO "aprendentes";

-- RenameConstraint (Primary Key)
ALTER TABLE "aprendentes" RENAME CONSTRAINT "alunos_pkey" TO "aprendentes_pkey";

-- RenameConstraint (FK Aprendente -> Usuario)
ALTER TABLE "aprendentes" RENAME CONSTRAINT "alunos_usuarioId_fkey" TO "aprendentes_usuarioId_fkey";

-- RenameColumn (Atendimento.alunoId -> Atendimento.aprendenteId)
ALTER TABLE "atendimentos" RENAME COLUMN "alunoId" TO "aprendenteId";

-- RenameConstraint (FK Atendimento -> Aprendente)
ALTER TABLE "atendimentos" RENAME CONSTRAINT "atendimentos_alunoId_fkey" TO "atendimentos_aprendenteId_fkey";

-- RenameIndex
ALTER INDEX "atendimentos_alunoId_dataAtendimento_idx" RENAME TO "atendimentos_aprendenteId_dataAtendimento_idx";
