-- Biblioteca de modelos de certificado.
--
-- Ate aqui a arte de cada evento era um arquivo dentro do repositorio e as
-- posicoes eram constantes no codigo: um evento novo exigia programador.
-- Esta tabela guarda o modelo inteiro — arte, dimensoes e posicoes — para
-- o painel administrar sozinho.
CREATE TABLE "certificate_templates" (
  "id"          TEXT NOT NULL,
  "name"        VARCHAR(120) NOT NULL,
  "description" TEXT,
  "fileKey"     VARCHAR(300) NOT NULL,
  "imageWidth"  INTEGER NOT NULL,
  "imageHeight" INTEGER NOT NULL,
  "layout"      JSONB NOT NULL,
  "createdBy"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- Anulavel: todo evento que ja existe fica com NULL e continua usando o
-- modelo embutido do COPOL, sem ninguem reconfigurar nada.
ALTER TABLE "events" ADD COLUMN "certificateTemplateId" TEXT;

-- RESTRICT, e nao SET NULL nem CASCADE.
--
-- Apagar um modelo em uso trocaria em silencio o certificado de um evento
-- (SET NULL) ou apagaria o evento (CASCADE). As duas coisas sao piores que
-- recusar a exclusao e dizer quais eventos usam o modelo.
ALTER TABLE "events"
  ADD CONSTRAINT "events_certificateTemplateId_fkey"
  FOREIGN KEY ("certificateTemplateId") REFERENCES "certificate_templates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "events_certificateTemplateId_idx" ON "events"("certificateTemplateId");
