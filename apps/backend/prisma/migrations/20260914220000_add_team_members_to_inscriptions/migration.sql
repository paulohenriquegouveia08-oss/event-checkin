-- Inscrição em equipe (ex.: maratonas de programação).
--
-- Uma Inscription continua sendo UMA pessoa de contato (o líder: nome,
-- e-mail, CPF, telefone) — isso não muda. team_members guarda só os
-- NOMES dos demais integrantes, porque é certificado individual que
-- cada um precisa, não um cadastro completo por pessoa.
--
-- Ambos anuláveis/opcionais: todo evento que já existe continua com
-- inscrição individual, sem ninguém reconfigurar nada.
ALTER TABLE "inscriptions" ADD COLUMN "teamName" VARCHAR(150);

CREATE TABLE "team_members" (
  "id"            TEXT NOT NULL,
  "inscriptionId" TEXT NOT NULL,
  "name"          VARCHAR(200) NOT NULL,
  "order"         INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CASCADE: um integrante sem a inscrição que o trouxe não significa nada.
ALTER TABLE "team_members"
  ADD CONSTRAINT "team_members_inscriptionId_fkey"
  FOREIGN KEY ("inscriptionId") REFERENCES "inscriptions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "team_members_inscriptionId_idx" ON "team_members"("inscriptionId");
