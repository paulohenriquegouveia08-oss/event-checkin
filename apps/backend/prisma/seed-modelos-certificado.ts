import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { certificateStorage } from "../src/modules/certificates/certificate-storage.js";

/**
 * Cadastra na biblioteca os modelos cuja arte já está no repositório.
 *
 * Existe para que a produção não dependa de alguém abrir o painel e
 * reenviar um arquivo que já está versionado aqui. Rodar de novo não
 * duplica: um modelo com o mesmo nome é reaproveitado.
 *
 * `npm run seed:modelos --workspace=apps/backend`
 */

const prisma = new PrismaClient();

const MODELOS = [
  {
    nome: "Semantix 2026",
    descricao:
      "Semantix na UP — Carreira, Tecnologia e Oportunidades. A arte já traz o texto, a data, o local, a carga horária e as assinaturas; só o nome e o QR são desenhados.",
    arquivo: "../assets/certificates/semantix-2026-base.png",
    // Medido no próprio arquivo: a linha roxa sob o nome está em y=514,
    // de x=142 a x=1047; a região do QR foi conferida como 100% branca.
    layout: {
      // Amostradas da propria arte: o texto impresso e azul-marinho
      // escuro, nao o roxo do titulo. Sem isto o nome herdava o verde do
      // COPOL, que e o padrao do sistema.
      corPrincipal: "#0B0B52",
      corDoTexto: "#000048",
      nome: { xEsquerda: 142, xDireita: 1047, yBase: 498, tamanhoMaximo: 62, alinhamento: "esquerda", fonte: "sem-serifa" },
      paragrafo: null,
      chipData: null,
      assinaturas: null,
      qr: { xEsquerda: 1310, yTopo: 880, tamanho: 120 },
    },
  },
];

async function main() {
  for (const m of MODELOS) {
    const jaExiste = await prisma.certificateTemplate.findFirst({ where: { name: m.nome } });
    if (jaExiste) {
      // Já cadastrado: atualiza só o LAYOUT, nunca a arte.
      //
      // É o que permite corrigir uma cor ou uma coordenada rodando o
      // script de novo, sem reenviar a imagem e sem apagar e recriar o
      // modelo — que os eventos já apontam e por isso nem pode ser
      // apagado.
      const atualLayout = JSON.stringify(jaExiste.layout);
      const novoLayout = JSON.stringify(m.layout);
      if (atualLayout === novoLayout) {
        console.log(`— "${m.nome}" já está cadastrado e igual; nada a fazer.`);
      } else {
        await prisma.certificateTemplate.update({ where: { id: jaExiste.id }, data: { layout: m.layout } });
        console.log(`✓ "${m.nome}": layout atualizado (arte preservada).`);
      }
      continue;
    }

    const buffer = await readFile(fileURLToPath(new URL(m.arquivo, import.meta.url)));

    // As dimensões saem do arquivo, e não da lista acima: é a mesma regra
    // do upload pelo painel, e pelo mesmo motivo — coordenada numa escala
    // que não é a da arte põe o nome no lugar errado sem erro nenhum.
    const doc = await PDFDocument.create();
    const img = await doc.embedPng(buffer);

    const id = randomUUID();
    const fileKey = `certificate-templates/${id}.png`;
    await certificateStorage.save(fileKey, buffer);

    await prisma.certificateTemplate.create({
      data: {
        id,
        name: m.nome,
        description: m.descricao,
        fileKey,
        imageWidth: img.width,
        imageHeight: img.height,
        layout: m.layout,
        // Null porque não houve pessoa: veio do sistema.
        createdBy: null,
      },
    });

    console.log(`✓ "${m.nome}" cadastrado (${img.width}×${img.height}px) — id ${id}`);
  }
}

main()
  .catch((erro) => {
    console.error("Falha ao cadastrar os modelos:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
