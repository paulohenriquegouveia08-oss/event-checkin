# Elgin M10 Pro — resumo operacional

Investigação técnica completa e evidências em [`scanner.md`](scanner.md).
Este documento é o resumo prático para quem for operar/configurar o
equipamento.

## O que o equipamento realmente é

Fisicamente, um **iMin D1** (ODM chinesa) com firmware rebrandizado
"Elgin" — confirmado por inspeção direta via `adb` no aparelho real (não
é suposição). Android 11, câmera 1D/2D de 0,3MP foco fixo (não é um motor
de leitura a laser dedicado).

## Como a leitura funciona

Não existe atalho de sistema (teclado/HID, Intent, serviço) para ler o
QR Code — **confirmado fisicamente**, não é hipótese. O app precisa abrir
a câmera e decodificar via software. Ver [`scanner.md`](scanner.md) para
o teste completo e o PoC funcional em
[`tools/scanner-poc-android/`](../tools/scanner-poc-android/).

## Configuração inicial (Fase 2 — ainda não implementada)

O fluxo abaixo é o desenho previsto pela especificação do produto; a tela
de configuração em si ainda não foi construída (depende do app mobile,
Fase 2):

```text
Abrir o app
  ↓
Tela "Configuração Inicial"
  Servidor: https://api.exemplo.com
  Código de ativação: XXXX-XXXX
  ↓
[ATIVAR TERMINAL] → POST /terminals/activate (já implementado no backend)
  ↓
App salva o token localmente e passa a operar
```

O backend já expõe o endpoint de ativação (`POST /terminals/activate`,
documentado em [`api.md`](api.md)) e foi testado ponta a ponta em
`tests/auth-terminals.test.ts`. O que falta é a tela/fluxo do lado do
app.

## Pendências de validação em campo

Ver a seção "Pendências / próximos passos de validação" em
[`scanner.md`](scanner.md#5-pendências--próximos-passos-de-validação) —
inclui testar sob iluminação real de evento e a distâncias variadas,
dado que a câmera é fixed-focus 0,3MP.
