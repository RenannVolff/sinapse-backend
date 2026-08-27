-- CreateTable
CREATE TABLE "peis" (
    "id" TEXT NOT NULL,
    "aprendenteId" TEXT NOT NULL,
    "dificuldades" TEXT NOT NULL,
    "objetivos" TEXT NOT NULL,
    "estrategias" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "templateOrigemId" TEXT,

    CONSTRAINT "peis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "peis_aprendenteId_idx" ON "peis"("aprendenteId");

-- AddForeignKey
ALTER TABLE "peis" ADD CONSTRAINT "peis_aprendenteId_fkey" FOREIGN KEY ("aprendenteId") REFERENCES "aprendentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
