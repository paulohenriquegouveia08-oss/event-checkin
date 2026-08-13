-- category deixa de ser enum fixo e passa a ser texto livre (categorias
-- agora são configuráveis por evento via Event.siteContent.pricingTiers).
-- USING preserva os valores já gravados (convertidos pro texto do enum
-- correspondente) em vez de dropar/recriar a coluna.
ALTER TABLE "inscriptions" ALTER COLUMN "category" TYPE VARCHAR(50) USING "category"::text;

-- DropEnum
DROP TYPE "InscriptionCategory";
