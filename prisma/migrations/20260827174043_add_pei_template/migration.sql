-- CreateTable
CREATE TABLE "pei_templates" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dificuldades" TEXT NOT NULL,
    "objetivos" TEXT NOT NULL,
    "estrategias" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pei_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pei_templates_usuarioId_idx" ON "pei_templates"("usuarioId");

-- AddForeignKey
ALTER TABLE "peis" ADD CONSTRAINT "peis_templateOrigemId_fkey" FOREIGN KEY ("templateOrigemId") REFERENCES "pei_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pei_templates" ADD CONSTRAINT "pei_templates_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
