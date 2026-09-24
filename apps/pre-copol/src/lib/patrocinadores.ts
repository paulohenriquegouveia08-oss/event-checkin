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
  },
];
