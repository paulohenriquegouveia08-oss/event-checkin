/**
 * Servidor fixo do sistema — este cliente opera com uma única VPS, então
 * o app não pergunta o endereço do servidor ao configurar um terminal
 * (evita erro de digitação, que já causou problema real em campo: um
 * terminal apontando pro servidor errado simplesmente não reconhece
 * nenhum participante, sem erro claro além de "credencial inválida").
 *
 * Pra migrar de servidor no futuro, troque o valor abaixo e gere um novo
 * build/APK — não é configurável em tela por design (ver pedido do
 * cliente). Se um dia for necessário apontar pra servidores diferentes
 * por instalação, reintroduzir o campo é simples: o resto do app já lida
 * com `serverUrl` vindo de qualquer lugar (ver TerminalConfig).
 */
export const SERVER_URL = "http://137.131.233.254:3000";

/**
 * PIN pra acessar a tela de configurações do terminal (trocar de
 * terminal, forçar sincronização, gerar relatório). Não é uma senha de
 * usuário nem protege dados sensíveis remotos — é só uma trava simples
 * pra um participante/visitante não conseguir mexer na configuração do
 * equipamento por engano ou curiosidade. Por isso pode ficar em claro no
 * código, sem hash: quem tem o APK sempre consegue ler esse valor de
 * qualquer forma (decompilação), então "esconder" aqui não muda o nível
 * de proteção real — o que protege de fato é o operador não repassar o
 * PIN pra quem não deveria.
 */
export const SETTINGS_PASSWORD = "pkdigital0508";
