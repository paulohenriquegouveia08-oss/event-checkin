/**
 * Patrocinadores do COPOL, por cota. Aparecem na página de Parcerias (em
 * destaque, acima de quem apoia) e no rodapé de todas as páginas.
 *
 * `logo` fica vazio até a marca chegar em arquivo: sem ele, o nome sai
 * escrito na cor da empresa — nunca uma imagem quebrada.
 */
export interface Patrocinador {
  nome: string;
  descricao: string;
  cota: "Diamante" | "Ouro" | "Prata" | "Bronze";
  url: string;
  /** Cor do nome enquanto não há logo. */
  cor: string;
  logo?: { src: string; largura: number; altura: number };
}

export const PATROCINADORES: Patrocinador[] = [
  {
    nome: "Integrale",
    descricao: "Centro de Educação Continuada em Odontologia",
    cota: "Diamante",
    url: "https://www.instagram.com/integrale_londrina",
    cor: "#d7261e",
    // Recortado do post de divulgação do COPOL, sem o fundo creme.
    logo: { src: "/partners/integrale.png", largura: 859, altura: 187 },
  },
  {
    nome: "Dental DSL",
    descricao: "Dental DSL Londrina",
    cota: "Diamante",
    url: "https://www.instagram.com/dentaldsllondrina",
    cor: "#e06a2b",
    // Recortado do post do COPOL, sem o fundo verde-petróleo.
    logo: { src: "/partners/dental-dsl.png", largura: 936, altura: 306 },
  },
  {
    nome: "Radiotech Smart",
    descricao: "Radiotech Smart",
    cota: "Diamante",
    url: "https://www.instagram.com/radiotech.imagem",
    cor: "#b08850",
    // Recortado do post do COPOL, sem o fundo creme.
    logo: { src: "/partners/radiotech.png", largura: 912, altura: 252 },
  },
];
