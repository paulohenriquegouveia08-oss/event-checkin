-- Configuracao de e-mail por evento.
--
-- Ate aqui os e-mails eram do COPOL e so dele: a paleta, o endereco do
-- site e o remetente estavam escritos no HTML e no env. Um segundo
-- evento receberia o comprovante dele com a marca e o link do COPOL.
--
-- Anulavel e sem valor padrao: nulo significa "usa os padroes do
-- sistema", que sao exatamente os valores do COPOL de hoje (ver
-- resolveEmailSettings em src/lib/email/email-settings.ts). O evento que
-- ja existe continua enviando igual, sem ninguem reconfigurar nada.
--
-- Aditiva: nao le, nao apaga e nao reescreve nenhuma linha existente.
ALTER TABLE "events"
  ADD COLUMN "emailSettings" JSONB;
