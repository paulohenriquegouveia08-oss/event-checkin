# Assets de certificado

`copol-2026-base.png` é a imagem de referência fornecida para o certificado
do 3º COPOL, com três regiões apagadas (preenchidas com a cor de fundo
`#F7F7F7`) para serem desenhadas dinamicamente em tempo de execução por
`../../src/modules/certificates/certificate-template.ts`:

1. Parágrafo descritivo (nome do evento, local, data, carga horária).
2. Chip de data/local no rodapé (mantém o ícone do calendário original).
3. Placeholder do QR Code (substituído pelo QR Code real de validação).

O nome do participante já não estava "queimado" na imagem original — só é
desenhado por cima do espaço em branco abaixo de "Certificamos que".

Título, logo do evento, ondas decorativas, os três signatários e os logos
de apoio (Universidade Positivo, Ecohub) permanecem pixel-a-pixel iguais à
imagem fornecida — não são regeráveis dinamicamente nesta versão (ver nota
de simplificação no relatório de entrega da feature). Para reaproveitar
este mecanismo em outro evento com um layout diferente, gere um novo
`<chave>-base.png` (mesma resolução, 1491×1055) e aponte
`Event.certificateSettings.templateAssetKey` para a nova chave.

## Usar a arte de outro evento

As posições **não são mais constantes no código** — vivem em
`Event.certificateSettings.layout` (ver `../../src/modules/certificates/certificate-layout.ts`).
Um evento sem `layout` continua usando o do COPOL, que é o padrão.

Para um evento novo:

1. Coloque a arte aqui como `<chave>-base.png`.
2. Meça no próprio arquivo, em pixels, onde vai o nome e onde cabe o QR.
3. Aponte `templateAssetKey` para `<chave>` e preencha `layout`.

**Nada é herdado do COPOL quando há `layout` configurado.** Posição é
propriedade da imagem: herdar a caixa do QR numa arte diferente o colocaria
num ponto arbitrário — provavelmente sobre um logo — e o PDF sairia errado
sem erro nenhum. Elemento não declarado simplesmente não é desenhado.

Use `null` para dizer "a arte já traz isto". Na Semantix, o parágrafo, a
data, o local, a carga horária e as assinaturas estão impressos na imagem;
só o nome e o QR são desenhados por código.

### Semantix 2026

`semantix-2026-base.png` (1536×1024). Layout pronto em
[`semantix-2026-layout.json`](./semantix-2026-layout.json).

A proporção é 3:2, diferente do COPOL (~A4). A página do PDF passou a sair
da proporção da própria arte — antes era A4 fixo, o que esticaria esta
imagem em 6% na vertical e deixaria os círculos dos ícones ovais.
