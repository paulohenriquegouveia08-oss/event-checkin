# E-mails (Resend)

Três e-mails saem do sistema: **comprovante de inscrição** (com o QR de
check-in), **comprovante de presença** e **certificado de participação**.

Todos são configuráveis **por evento**. Um evento novo funciona sem
configurar nada — cai nos padrões do sistema, que são os valores do COPOL.

## Configuração

Painel admin → evento → aba **E-mails**.

| Campo | Para que serve |
| --- | --- |
| Nome / e-mail do remetente | O que aparece na caixa de entrada |
| Responder para | Destino do "responder", quando o remetente não é lido |
| Cor principal / destaque | Cabeçalho e botões dos e-mails |
| Endereço do site | Destino do botão "Acessar página do evento" |
| Observação no rodapé | Linha livre (telefone de contato, por exemplo) |
| Envios automáticos | Quais dos três saem sozinhos |

Guardado em `Event.emailSettings` (JSONB). Campo em branco = padrão do
sistema. Shape e fallbacks em
[`src/lib/email/email-settings.ts`](../apps/backend/src/lib/email/email-settings.ts).

### O domínio precisa estar verificado no Resend

O Resend recusa o envio se o domínio do remetente não estiver verificado
na conta. Isso vale por domínio, não por evento: para a Semantix mandar de
`@semantix.com.br`, esse domínio precisa ser verificado no painel do
Resend antes. **Vale conferir com antecedência** — descobrir no dia do
evento significa ninguém receber comprovante.

## Variáveis de ambiente

```bash
RESEND_API_KEY=       # sem ela o sistema NÃO envia: só registra no log
EMAIL_FROM=           # remetente padrão, para evento sem configuração própria
```

Sem `RESEND_API_KEY` o envio é simulado e o retorno traz `mock: true`.
É útil em desenvolvimento e perigoso em produção: a ausência da chave
significa que ninguém recebe nada, sem erro nenhum.

## Envio manual e em massa

| Rota | O que faz |
| --- | --- |
| `POST /events/:id/participants/:pid/certificate/send` | Certificado de uma pessoa |
| `POST /events/:id/participants/:pid/attendance-proof/send` | Comprovante de presença de uma pessoa |
| `POST /events/:id/certificates/send` | Certificado para todos que já podem baixar |
| `POST /events/:id/attendance-proofs/send` | Comprovante para todos com check-in |

Todas exigem `certificates.issue` e ficam no registro de auditoria —
disparo em massa é irreversível.

## Decisões que não são óbvias

**O QR vai como anexo embutido (`cid:`), não como `data:` no `src`.**
O Gmail não renderiza imagem em `data:` URI. Como o QR *é* o comprovante,
o e-mail chegava inutilizável para boa parte dos inscritos.

**O disparo em massa é um a um, com pausa.** O envio em lote do Resend
não aceita anexo, e o documento é justamente o anexo. A pausa mantém o
consumo em ~5 req/s: o limite de 10 req/s é da equipe inteira, e um
disparo consumindo tudo faria o comprovante de quem está pagando naquele
momento receber 429.

**Toda mensagem leva chave de idempotência.** O Resend usa esse cabeçalho
para não entregar a mesma coisa duas vezes em 24 h. Existem caminhos que
repetem: webhook de pagamento reenviado, clique duplo, reprocessamento.
Reenvio pedido por alguém usa chave aleatória de propósito — senão o
pedido explícito seria engolido pela própria proteção.

**O e-mail nunca bloqueia a operação.** No check-in ele sai em segundo
plano: o terminal precisa liberar a fila em milissegundos, e gerar PDF
mais falar com o Resend leva segundos. Falha de e-mail não invalida
presença nem inscrição.
