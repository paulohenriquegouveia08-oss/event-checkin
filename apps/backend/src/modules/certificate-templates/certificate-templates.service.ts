import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../../database/prisma.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { certificateStorage } from "../certificates/certificate-storage.js";
import { certificateLayoutSchema } from "../certificates/certificate-layout.js";
import type { AtualizarModeloInput, CriarModeloInput } from "./certificate-templates.schema.js";

/**
 * Biblioteca de modelos de certificado.
 *
 * A arte fica no mesmo volume persistente dos PDFs gerados — e NÃO no
 * repositório, como era antes. Arte no repositório significa que
 * cadastrar um evento novo exige alguém com acesso ao código e um deploy.
 */

const MAX_BYTES = 8 * 1024 * 1024;

/** Só PNG. */
const FORMATOS: Record<string, "png"> = {
  "image/png": "png",
};

function chaveDaArte(id: string): string {
  return `certificate-templates/${id}.png`;
}

/**
 * Lê as dimensões do arquivo, e recusa o que o pdf-lib não conseguir
 * embutir.
 *
 * As dimensões vêm daqui, e nunca do cliente: as coordenadas do layout
 * são nessa escala, e uma escala declarada diferente da real põe o nome
 * do participante no lugar errado sem erro nenhum.
 */
async function medirPng(buffer: Buffer): Promise<{ largura: number; altura: number }> {
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(buffer);
  return { largura: img.width, altura: img.height };
}

async function receberArte(mimeType: string, dataBase64: string) {
  if (!FORMATOS[mimeType]) {
    throw new ValidationError("Envie a arte em PNG. JPEG perde qualidade em texto e linhas finas.");
  }

  const buffer = Buffer.from(dataBase64, "base64");
  if (buffer.length === 0) throw new ValidationError("Arquivo vazio.");
  if (buffer.length > MAX_BYTES) {
    throw new ValidationError(`Arquivo muito grande (${Math.round(buffer.length / 1024 / 1024)}MB) — o limite é 8MB.`);
  }

  try {
    const { largura, altura } = await medirPng(buffer);
    return { buffer, largura, altura };
  } catch {
    throw new ValidationError("Não consegui ler esse PNG — verifique se o arquivo não está corrompido.");
  }
}

/**
 * O layout é validado JÁ COM as dimensões reais.
 *
 * É o que impede uma coordenada fora da arte: uma caixa em x=3000 numa
 * imagem de 1536 de largura desenharia o nome fora da página, e o
 * certificado sairia em branco.
 */
function conferirLayout(layoutSemDimensoes: unknown, largura: number, altura: number) {
  const completo = { ...(layoutSemDimensoes as object), imagemLargura: largura, imagemAltura: altura };
  const lido = certificateLayoutSchema.safeParse(completo);
  if (!lido.success) {
    throw new ValidationError(`Layout inválido: ${lido.error.issues.map((i) => i.message).join("; ")}`);
  }

  const l = lido.data;
  const foraDaArte: string[] = [];
  const dentroX = (x: number) => x >= 0 && x <= largura;
  const dentroY = (y: number) => y >= 0 && y <= altura;

  if (!dentroX(l.nome.xEsquerda) || !dentroX(l.nome.xDireita) || !dentroY(l.nome.yBase)) {
    foraDaArte.push("nome");
  }
  if (l.nome.xDireita <= l.nome.xEsquerda) foraDaArte.push("nome (direita antes da esquerda)");
  if (l.qr && (!dentroX(l.qr.xEsquerda + l.qr.tamanho) || !dentroY(l.qr.yTopo + l.qr.tamanho))) {
    foraDaArte.push("QR");
  }
  if (l.paragrafo && (!dentroX(l.paragrafo.xDireita) || !dentroY(l.paragrafo.yTopo))) foraDaArte.push("parágrafo");
  if (l.chipData && (!dentroX(l.chipData.xDireita) || !dentroY(l.chipData.yLinha2))) foraDaArte.push("chip de data");
  if (l.assinaturas && (!dentroX(l.assinaturas.xDireita) || !dentroY(l.assinaturas.yLinha))) foraDaArte.push("assinaturas");

  if (foraDaArte.length > 0) {
    throw new ValidationError(
      `Estes elementos caem fora da arte (${largura}×${altura}px): ${foraDaArte.join(", ")}. ` +
        `Confira as coordenadas — o certificado sairia com eles cortados ou invisíveis.`,
    );
  }

  return l;
}

export async function listarModelos() {
  const linhas = await prisma.certificateTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { events: true } } },
  });

  return linhas.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    imageWidth: m.imageWidth,
    imageHeight: m.imageHeight,
    layout: m.layout,
    createdAt: m.createdAt,
    // Quantos eventos usam — é o que explica por que um modelo não pode
    // ser apagado.
    eventosUsando: m._count.events,
  }));
}

export async function buscarModeloOuFalhar(templateId: string) {
  const m = await prisma.certificateTemplate.findUnique({ where: { id: templateId } });
  if (!m) throw new NotFoundError("Modelo de certificado não encontrado");
  return m;
}

export async function lerArte(templateId: string): Promise<Buffer> {
  const m = await buscarModeloOuFalhar(templateId);
  return certificateStorage.read(m.fileKey);
}

export async function criarModelo(input: CriarModeloInput, autorUserId: string | null) {
  const { buffer, largura, altura } = await receberArte(input.mimeType, input.dataBase64);
  const layout = conferirLayout(input.layout, largura, altura);

  const id = randomUUID();
  const fileKey = chaveDaArte(id);

  // Grava o arquivo ANTES da linha: uma linha apontando para um arquivo
  // que não existe geraria certificado quebrado. O contrário — arquivo
  // órfão sem linha — só ocupa disco.
  await certificateStorage.save(fileKey, buffer);

  return prisma.certificateTemplate.create({
    data: {
      id,
      name: input.name,
      description: input.description ?? null,
      fileKey,
      imageWidth: largura,
      imageHeight: altura,
      layout,
      createdBy: autorUserId,
    },
  });
}

export async function atualizarModelo(templateId: string, input: AtualizarModeloInput) {
  const atual = await buscarModeloOuFalhar(templateId);

  let largura = atual.imageWidth;
  let altura = atual.imageHeight;

  if (input.dataBase64 || input.mimeType) {
    if (!input.dataBase64 || !input.mimeType) {
      throw new ValidationError("Para trocar a arte, envie o arquivo e o tipo juntos.");
    }
    const arte = await receberArte(input.mimeType, input.dataBase64);
    largura = arte.largura;
    altura = arte.altura;
    // Mesma chave: trocar a arte substitui o arquivo, sem acumular versões
    // órfãs no disco.
    await certificateStorage.save(atual.fileKey, arte.buffer);
  }

  // O layout é reconferido contra as dimensões VIGENTES — inclusive quando
  // só a arte muda. Trocar a imagem por uma de outro tamanho invalida as
  // coordenadas antigas, e isso precisa aparecer agora.
  const layout = conferirLayout(input.layout ?? atual.layout, largura, altura);

  return prisma.certificateTemplate.update({
    where: { id: templateId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      imageWidth: largura,
      imageHeight: altura,
      layout,
    },
  });
}

export async function apagarModelo(templateId: string) {
  const emUso = await prisma.event.count({ where: { certificateTemplateId: templateId } });
  if (emUso > 0) {
    // Recusar é melhor que desvincular em silêncio: os eventos voltariam
    // ao modelo do COPOL e ninguém perceberia até alguém baixar um
    // certificado com a arte errada.
    throw new ConflictError(
      "TEMPLATE_IN_USE",
      `Este modelo está em uso por ${emUso} evento(s). Troque o modelo desses eventos antes de apagar.`,
    );
  }

  await buscarModeloOuFalhar(templateId);
  await prisma.certificateTemplate.delete({ where: { id: templateId } });
}
