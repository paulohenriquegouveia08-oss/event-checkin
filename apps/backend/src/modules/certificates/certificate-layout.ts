import { z } from "zod";

/**
 * Onde cada coisa é desenhada sobre a imagem-base do certificado.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * As coordenadas viviam como constantes no `certificate-template.ts`,
 * calibradas na arte do COPOL (1491×1055). `templateAssetKey` já permitia
 * trocar a IMAGEM por evento — mas não as posições. Trocar a arte sem
 * trocar as posições faz o nome do participante cair no lugar errado, e o
 * PDF sai torto sem erro nenhum.
 *
 * A arte da Semantix é 1536×1024, com o nome à esquerda e sem espaço para
 * o QR onde o COPOL o tinha. Nada disso caberia nas constantes do COPOL.
 *
 * NEM TODO EVENTO DESENHA TUDO. Na arte da Semantix, o parágrafo, a data,
 * o local e a carga horária JÁ ESTÃO na imagem — desenhá-los por cima
 * duplicaria o texto. Por isso cada elemento pode ser desligado: o que a
 * arte já traz, o código não repete.
 *
 * Os padrões são os valores do COPOL, então um evento sem `layout`
 * configurado continua gerando exatamente o mesmo PDF de antes.
 */

const caixaDeTexto = z.object({
  xEsquerda: z.number().int().min(0).max(5000),
  xDireita: z.number().int().min(0).max(5000),
  /** Linha de base do texto, em pixels da imagem de referência. */
  yBase: z.number().int().min(0).max(5000),
});

export const certificateLayoutSchema = z.object({
  /**
   * Dimensões da imagem-base, em pixels.
   *
   * Todas as coordenadas abaixo são nessa escala. É o que permite medir
   * as posições direto no arquivo, com uma régua, sem converter nada.
   */
  imagemLargura: z.number().int().min(100).max(10000),
  imagemAltura: z.number().int().min(100).max(10000),

  /** Nome do participante. É o único elemento obrigatório. */
  nome: caixaDeTexto.extend({
    /** Corpo máximo, em px da imagem. O texto encolhe se não couber. */
    tamanhoMaximo: z.number().int().min(8).max(200).optional(),
    alinhamento: z.enum(["esquerda", "centro"]).optional(),
    /**
     * A família da fonte do nome.
     *
     * Precisa acompanhar a arte: o COPOL usa serifada, a Semantix usa sem
     * serifa. Errar aqui não quebra nada — só faz o nome parecer colado
     * de outro documento, que é como um certificado perde credibilidade.
     */
    fonte: z.enum(["serifada", "sem-serifa"]).optional(),
  }),

  /** Parágrafo descritivo. Ausente = a arte já o traz. */
  paragrafo: z
    .object({
      xEsquerda: z.number().int().min(0).max(5000),
      xDireita: z.number().int().min(0).max(5000),
      yTopo: z.number().int().min(0).max(5000),
      alturaDaLinha: z.number().int().min(6).max(200),
    })
    .nullable()
    .optional(),

  /** Chip de data/local no rodapé. Ausente = a arte já o traz. */
  chipData: z
    .object({
      x: z.number().int().min(0).max(5000),
      xDireita: z.number().int().min(0).max(5000),
      yLinha1: z.number().int().min(0).max(5000),
      yLinha2: z.number().int().min(0).max(5000),
    })
    .nullable()
    .optional(),

  /**
   * QR Code de validação.
   *
   * Ausente significa CERTIFICADO SEM VALIDAÇÃO VISÍVEL: a página pública
   * de conferência continua existindo, mas ninguém chega nela olhando o
   * papel. Só desligue de propósito.
   */
  qr: z
    .object({
      xEsquerda: z.number().int().min(0).max(5000),
      yTopo: z.number().int().min(0).max(5000),
      tamanho: z.number().int().min(40).max(600),
    })
    .nullable()
    .optional(),

  /** Faixa dos signatários. Ausente = a arte já traz as assinaturas. */
  assinaturas: z
    .object({
      xEsquerda: z.number().int().min(0).max(5000),
      xDireita: z.number().int().min(0).max(5000),
      yLinha: z.number().int().min(0).max(5000),
    })
    .nullable()
    .optional(),
});

export type CertificateLayout = z.infer<typeof certificateLayoutSchema>;

/**
 * O layout do COPOL, que era o único que existia.
 *
 * Continua sendo o padrão para que todo evento já cadastrado gere o mesmo
 * PDF de antes, sem ninguém precisar configurar nada.
 */
export const LAYOUT_PADRAO: Required<
  Pick<CertificateLayout, "imagemLargura" | "imagemAltura" | "nome">
> &
  CertificateLayout = {
  imagemLargura: 1491,
  imagemAltura: 1055,
  nome: { xEsquerda: 478, xDireita: 1351, yBase: 372, alinhamento: "centro", fonte: "serifada" },
  paragrafo: { xEsquerda: 478, xDireita: 1330, yTopo: 470, alturaDaLinha: 40 },
  chipData: { x: 508, xDireita: 722, yLinha1: 973, yLinha2: 1000 },
  qr: { xEsquerda: 1206, yTopo: 946, tamanho: 88 },
  assinaturas: { xEsquerda: 475, xDireita: 1385, yLinha: 812 },
};

export function resolveCertificateLayout(guardado: unknown): CertificateLayout {
  const lido = certificateLayoutSchema.safeParse(guardado ?? {});

  // SEM layout configurado = COPOL, inteiro. É o que todo evento já
  // cadastrado usa hoje.
  if (!lido.success) return LAYOUT_PADRAO;

  // COM layout configurado, NADA é herdado do COPOL.
  //
  // Posição é propriedade da IMAGEM, não do sistema. Herdar a caixa do QR
  // do COPOL numa arte diferente o colocaria num ponto arbitrário —
  // provavelmente por cima de um logo — e o PDF sairia errado sem erro
  // nenhum. Elemento não declarado simplesmente não é desenhado: a
  // ausência aparece na hora de conferir o primeiro certificado, que é
  // quando ainda dá para corrigir.
  return lido.data;
}
