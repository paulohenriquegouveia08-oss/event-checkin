-- Consentimento da inscricao (LGPD art. 8o, §1o).
--
-- Anulaveis porque as inscricoes que ja existem foram feitas ANTES de
-- a caixa de aceite existir. Preencher com uma data qualquer seria
-- fabricar prova de um consentimento que nunca foi coletado — nulo diz
-- a verdade: "nao consta".
ALTER TABLE "inscriptions"
  ADD COLUMN "consentVersion"    VARCHAR(20),
  ADD COLUMN "consentAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "consentIp"         VARCHAR(64);
