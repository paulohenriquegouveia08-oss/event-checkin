# Impressora térmica do Elgin M10 Pro — investigação

Mesma disciplina da investigação do scanner ([`scanner.md`](scanner.md)):
não implementar sem confirmar como o hardware realmente expõe a
funcionalidade. Classificação: `CONFIRMADO` (evidência direta),
`PROVÁVEL` (inferência forte, não testada), `NÃO CONFIRMADO`.

## Como a impressora é acessada — CONFIRMADO (biblioteca) / PROVÁVEL (no M10 Pro específico)

Investigando pacotes instalados no aparelho real via `adb shell dumpsys
package com.elgin.elginexperience` (o app de exemplo oficial da Elgin,
pré-instalado de fábrica no equipamento), encontrei:

```
requested permissions:
  android.permission.CLOUDPOS_PRINTER
  ...
Service Resolver Table:
  br.com.setis.interfaceautomacao.SERVICO:
    com.elgin.elginexperience/br.com.setis.interfaceautomacao.ComunicacaoServico
```

Isso bate exatamente com a biblioteca **"e1" / "InterfaceAutomacao"**
usada nos exemplos oficiais da Elgin no GitHub
([`ElginDeveloperCommunity/PDV_Android_Elgin`](https://github.com/ElginDeveloperCommunity/PDV_Android_Elgin))
já usada como referência na investigação do scanner. Ou seja: o mesmo
app pré-instalado no equipamento real usa a mesma biblioteca cujo
código-fonte de exemplo está publicamente disponível — não é uma
suposição, é a mesma peça de software.

A classe real que fala com a impressora é `com.elgin.e1.Impressora.Termica`,
dentro do arquivo `e1-V02.16.00-release.aar`, que está **commitado
publicamente** no repositório de exemplos da Elgin (não é um binário
secreto — baixei diretamente de
`Exemplos/App_eXperience_ReactNative/.../android/app/libs/e1-V02.16.00-release.aar`
no GitHub).

### API confirmada (a partir do código-fonte oficial, não inventada)

```java
Termica.setContext(activity);
Termica.AbreConexaoImpressora(tipo, modelo, host, porta); // tipo 6 = impressora interna
Termica.FechaConexaoImpressora();
Termica.ImpressaoTexto(texto, alinhamento, estilo, tamanhoFonte);
  // alinhamento: 0 esquerda, 1 centro, 2 direita
  // estilo: soma de flags — 1 fonte B, 2 sublinhado, 8 negrito
Termica.AvancaPapel(linhas);
Termica.Corte(linhas);
Termica.StatusImpressora(3); // status do sensor de papel
Termica.ImpressaoQRCode(texto, tamanho, nivelCorrecao);
Termica.ImpressaoCodigoBarras(tipo, texto, altura, largura, hri);
```

Fonte: [`Printer.java`](https://github.com/ElginDeveloperCommunity/PDV_Android_Elgin/blob/master/Exemplos/App_eXperience_ReactNative/Elgin_AppExperience_ReactNative-font/android/app/src/main/java/com/elginm8/Printer.java)
e [`service_printer.js`](https://github.com/ElginDeveloperCommunity/PDV_Android_Elgin/blob/master/Exemplos/App_eXperience_ReactNative/Elgin_AppExperience_ReactNative-font/src/services/service_printer.js)
do exemplo oficial React Native da Elgin.

### O que é PROVÁVEL, não 100% confirmado

- Os exemplos oficiais foram escritos pra linha **M8**, chamando
  `AbreConexaoImpressora(6, "M8", "", 0)` — o parâmetro `"modelo"` é
  literalmente a string `"M8"`. Como o M10 Pro roda a mesma "Plataforma
  de Comunicação Elgin" (confirmado na Fase 0 — ver `scanner.md` e a
  documentação oficial que descreve a plataforma como compartilhada entre
  "Linha PosGo e M10"), a implementação usa `"M10"` como string de
  modelo. **Não testei se a biblioteca valida essa string contra uma
  lista fixa** — se `AbreConexaoImpressora` falhar com `"M10"`, o
  primeiro fallback a tentar é `"M8"` (o valor literal usado nos
  exemplos).
- Não testei impressão de QR Code/código de barras/imagem na impressora
  física ainda — só texto (o suficiente para o relatório de presença).
  Os métodos existem na biblioteca (confirmado no código-fonte) mas não
  foram exercitados no equipamento real por este projeto.

## Implementação

Módulo nativo Expo local em [`apps/mobile/modules/elgin-printer/`](../apps/mobile/modules/elgin-printer/),
usando a AAR oficial da Elgin (copiada do repositório público, ver
`android/build.gradle` do módulo). Exposto em JS como
`services/report/printReport.ts`, com a mesma estrutura de conteúdo do
relatório em PDF (`services/report/attendanceReport.ts`): nome do
evento e do terminal no topo, participante + horário por linha.

## Por que uma AAR de terceiro no repositório

A biblioteca não está publicada em nenhum Maven/npm — é distribuída pela
Elgin só dentro dos próprios repositórios de exemplo. Copiá-la pro
`android/libs/` do módulo é o mesmo padrão que todos os exemplos oficiais
da Elgin usam (Java, Kotlin, React Native, Flutter, Xamarin — todos têm
a AAR commitada dentro do próprio projeto de exemplo). Arquivo de origem:
[`e1-V02.16.00-release.aar`](https://github.com/ElginDeveloperCommunity/PDV_Android_Elgin/blob/master/Exemplos/App_eXperience_ReactNative/Elgin_AppExperience_ReactNative-font/android/app/libs/e1-V02.16.00-release.aar).
