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
