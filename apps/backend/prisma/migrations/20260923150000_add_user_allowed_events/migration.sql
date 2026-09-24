-- Restrição de usuário a eventos específicos (ex.: organizador externo
-- que só acompanha o próprio evento). Vazio = todos os eventos, que é
-- como todo usuário existente continua — ver User.allowedEventIds.
ALTER TABLE "users" ADD COLUMN "allowedEventIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
