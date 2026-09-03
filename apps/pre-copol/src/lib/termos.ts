// ============================================================
// Termo de inscricao e aviso de privacidade.
//
// Fica em codigo, e nao no banco, porque a VERSAO precisa ser um
// numero fixo que o registro da inscricao guarda. A LGPD (art. 8o,
// §1o) poe no controlador o onus de provar que o consentimento foi
// obtido — e provar exige saber A QUE TEXTO a pessoa disse sim.
//
// Se o termo mudar, sobe-se VERSAO_TERMOS. As inscricoes antigas
// continuam apontando para a versao que estava na tela quando cada
// pessoa marcou a caixa, que e' o unico registro honesto.
// ============================================================

/** Suba isto SEMPRE que mudar qualquer texto abaixo. */
export const VERSAO_TERMOS = "1.0";

export const VIGENTE_DESDE = "3 de setembro de 2026";

/**
 * Quem responde pelos dados.
 *
 * ATENCAO — os campos abaixo precisam ser preenchidos por quem
 * organiza o evento antes de o site ir ao ar. Deixei em branco de
 * proposito: inventar um CNPJ ou um e-mail que nao existe tornaria o
 * aviso mentiroso, e um aviso de privacidade que mente e' pior que
 * nenhum. Onde estiver vazio, a tela mostra um aviso visivel em vez de
 * fingir que a informacao existe.
 */
export const CONTROLADOR = {
  nome: "Comissão Organizadora do 3º COPOL — Congresso Odontológico Positivo Londrinense",
  cnpj: "", // ex.: "00.000.000/0001-00"
  emailEncarregado: "", // e-mail do encarregado (DPO) — art. 41 da LGPD
  endereco: "",
};

export interface SecaoTermo {
  titulo: string;
  paragrafos: string[];
  itens?: string[];
}

export const SECOES: SecaoTermo[] = [
  {
    titulo: "1. O que este documento é",
    paragrafos: [
      "Este é o termo de inscrição e o aviso de privacidade do 3º COPOL. Ele explica em que condições você participa do evento e o que a organização faz com os seus dados pessoais.",
      "Ao marcar a caixa de aceite no formulário de inscrição, você declara que leu este texto e concorda com ele. O aceite fica registrado com data, hora e a versão do texto que estava publicada naquele momento.",
    ],
  },
  {
    titulo: "2. Quais dados coletamos",
    paragrafos: [
      "Na inscrição, pedimos apenas o necessário para identificar você, emitir o certificado e processar o pagamento:",
    ],
    itens: [
      "Nome completo — para identificação e emissão do certificado;",
      "CPF — para evitar inscrições duplicadas e para constar no certificado, que é documento de comprovação de carga horária;",
      "E-mail — para enviar a confirmação, o comprovante e o certificado;",
      "Telefone — para contato da organização sobre o evento;",
      "Instituição de ensino, quando informada — para fins estatísticos e de credenciamento;",
      "Observações, quando informadas — para atender necessidades específicas de acessibilidade ou alimentação.",
    ],
  },
  {
    titulo: "3. Para que usamos",
    paragrafos: [
      "Os dados são usados exclusivamente para a realização do evento:",
    ],
    itens: [
      "Processar a inscrição e o pagamento;",
      "Controlar a entrada e a presença nas atividades;",
      "Emitir e enviar o certificado de participação;",
      "Comunicar alterações de programação, local ou horário;",
      "Produzir estatísticas do evento — nesse caso, sempre em números agregados, sem identificar ninguém.",
    ],
  },
  {
    titulo: "4. Com base em quê",
    paragrafos: [
      "O tratamento se apoia no seu consentimento (art. 7º, I da LGPD) e na execução do contrato de participação no evento (art. 7º, V). Para a emissão de certificados e a guarda dos comprovantes fiscais, também no cumprimento de obrigação legal (art. 7º, II).",
    ],
  },
  {
    titulo: "5. Com quem compartilhamos",
    paragrafos: [
      "Não vendemos, alugamos nem cedemos os seus dados. O compartilhamento acontece apenas com quem é indispensável para o evento acontecer:",
    ],
    itens: [
      "O meio de pagamento, que recebe os dados necessários para processar a cobrança;",
      "A instituição de ensino que realiza o evento, para fins de registro acadêmico e emissão de certificado;",
      "Autoridades públicas, quando houver determinação legal ou judicial.",
    ],
  },
  {
    titulo: "6. Por quanto tempo guardamos",
    paragrafos: [
      "Os dados da inscrição são mantidos enquanto durar o evento e pelo prazo necessário depois dele para reemissão de certificados e cumprimento de obrigações legais e fiscais.",
      "Passado esse prazo, os dados são apagados ou anonimizados. Registros contábeis e fiscais seguem os prazos que a legislação exige.",
    ],
  },
  {
    titulo: "7. Seus direitos",
    paragrafos: [
      "A LGPD garante a você, a qualquer momento e sem custo (art. 18):",
    ],
    itens: [
      "Saber se tratamos dados seus e ter acesso a eles;",
      "Corrigir dados incompletos, inexatos ou desatualizados;",
      "Pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários ou tratados fora da lei;",
      "Pedir a portabilidade dos dados a outro fornecedor;",
      "Revogar o consentimento — sabendo que, sem os dados essenciais, não é possível manter a inscrição nem emitir o certificado;",
      "Saber com quem compartilhamos os seus dados;",
      "Opor-se a um tratamento feito sem o seu consentimento, quando houver descumprimento da lei.",
    ],
  },
  {
    titulo: "8. Imagem e som",
    paragrafos: [
      "O evento pode ser fotografado e gravado para registro e divulgação institucional. Se você não quiser aparecer, avise a organização na chegada ou pelo canal de contato — a equipe orienta sobre os espaços sem captação de imagem.",
    ],
  },
  {
    titulo: "9. Segurança",
    paragrafos: [
      "Os dados trafegam por conexão criptografada e o acesso ao sistema é restrito à equipe organizadora, com autenticação individual. Nenhum sistema é imune a incidentes; caso ocorra um que possa gerar risco relevante, a organização comunicará você e a Autoridade Nacional de Proteção de Dados, conforme o art. 48 da LGPD.",
    ],
  },
  {
    titulo: "10. Inscrição, pagamento e cancelamento",
    paragrafos: [
      "A inscrição só é confirmada após a compensação do pagamento. O valor segue o lote vigente na data da inscrição.",
      "A participação é pessoal e intransferível, salvo autorização expressa da organização.",
      "O certificado é emitido para quem cumprir a frequência mínima exigida nas atividades.",
      "A organização pode alterar a programação por motivo de força maior, comunicando os inscritos pelos canais informados na inscrição.",
    ],
  },
  {
    titulo: "11. Como falar com a gente",
    paragrafos: [
      "Para exercer qualquer um dos direitos acima, ou para tirar dúvidas sobre este documento, procure o encarregado pelo tratamento de dados pelo canal indicado no rodapé desta página.",
    ],
  },
];

/**
 * O texto curto que fica ao lado da caixa de aceite.
 *
 * Curto de proposito: um paragrafo de vinte linhas ao lado de um
 * checkbox nao e' lido por ninguem, e consentimento que ninguem le nao
 * e' consentimento informado — que e' o que a lei pede (art. 5o, XII).
 * O texto completo fica a um clique, numa aba nova, para nao perder o
 * formulario ja preenchido.
 */
export const RESUMO_ACEITE =
  "Li e concordo com o termo de inscrição e o aviso de privacidade, e autorizo o uso dos meus dados para inscrição, controle de presença e emissão de certificado.";
