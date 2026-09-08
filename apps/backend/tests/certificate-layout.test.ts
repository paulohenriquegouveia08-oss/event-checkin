import { describe, expect, it } from "vitest";

import {
  LAYOUT_PADRAO,
  certificateLayoutSchema,
  resolveCertificateLayout,
} from "../src/modules/certificates/certificate-layout.js";
import { resolveCertificateSettings } from "../src/modules/certificates/certificate-settings.js";

const semantix = {
  imagemLargura: 1536,
  imagemAltura: 1024,
  nome: { xEsquerda: 142, xDireita: 1047, yBase: 498, alinhamento: "esquerda", fonte: "sem-serifa" },
  paragrafo: null,
  chipData: null,
  assinaturas: null,
  qr: { xEsquerda: 1310, yTopo: 880, tamanho: 120 },
};

describe("layout do certificado", () => {
  it("evento sem layout usa o do COPOL, inteiro", () => {
    // Todo evento já cadastrado depende disto para continuar gerando o
    // mesmo PDF de antes.
    expect(resolveCertificateLayout(null)).toEqual(LAYOUT_PADRAO);
    expect(resolveCertificateLayout(undefined)).toEqual(LAYOUT_PADRAO);
    expect(resolveCertificateSettings(null).layout).toEqual(LAYOUT_PADRAO);
  });

  it("layout configurado NÃO herda posição nenhuma do COPOL", () => {
    // É a regra que evita o pior erro possível aqui: o QR do COPOL
    // aparecendo num ponto arbitrário de outra arte, por cima de um logo,
    // sem erro nenhum.
    const r = resolveCertificateLayout(semantix);
    expect(r.qr).toEqual(semantix.qr);
    expect(r.qr).not.toEqual(LAYOUT_PADRAO.qr);
    expect(r.paragrafo).toBeNull();
    expect(r.chipData).toBeNull();
    expect(r.assinaturas).toBeNull();
  });

  it("null é 'não desenhe', e é diferente de ausente", () => {
    // A arte da Semantix já traz parágrafo, data e assinaturas: desenhar
    // por cima duplicaria o texto.
    const comNull = resolveCertificateLayout({ ...semantix, paragrafo: null });
    expect(comNull.paragrafo).toBeNull();

    const semCampo = resolveCertificateLayout({
      imagemLargura: 1536, imagemAltura: 1024,
      nome: semantix.nome,
    });
    expect(semCampo.paragrafo).toBeUndefined();
  });

  it("layout inválido cai no padrão em vez de gerar PDF torto", () => {
    expect(resolveCertificateLayout({ imagemLargura: -5 })).toEqual(LAYOUT_PADRAO);
    expect(resolveCertificateLayout("nada disso")).toEqual(LAYOUT_PADRAO);
  });

  it("exige as dimensões da imagem junto das coordenadas", () => {
    // Coordenada sem a escala de referência não significa nada: é o que
    // permite medir as posições direto no arquivo com uma régua.
    expect(certificateLayoutSchema.safeParse({ nome: semantix.nome }).success).toBe(false);
    expect(certificateLayoutSchema.safeParse(semantix).success).toBe(true);
  });

  it("a proporção da página acompanha a arte", () => {
    // A do COPOL é ~A4; a da Semantix é 3:2. Forçar A4 esticaria a
    // segunda em 6% e os círculos dos ícones sairiam ovais.
    const copol = LAYOUT_PADRAO.imagemLargura / LAYOUT_PADRAO.imagemAltura;
    const sem = semantix.imagemLargura / semantix.imagemAltura;
    expect(copol).toBeCloseTo(1.4133, 3);
    expect(sem).toBeCloseTo(1.5, 3);
    expect(Math.abs(copol - sem)).toBeGreaterThan(0.08);
  });
});
