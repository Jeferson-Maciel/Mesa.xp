/**
 * Abrir o e-mail da ordem já montado no Outlook na web.
 *
 * O operador escreve pelo Outlook na web (CLAUDE.md, "E-mail em tabela"). Um `mailto:` abriria o
 * programa de e-mail padrão do Windows, que não é ele. O endereço de compor do Outlook na web aceita
 * assunto e corpo, mas o corpo só em texto puro: a tabela do "E-mail em tabela" não entra nele e vai
 * pela área de transferência, para colar com Ctrl+V.
 */

export const ASSUNTO = 'Confirmação de ordem';

// O endereço novo do Outlook do Microsoft 365. A Microsoft está mudando as contas de
// outlook.office.com para ele aos poucos, e quem já mudou é redirecionado — e no redirecionamento o
// pedido de compor se perde: abre a caixa de entrada vazia (um colega, em 07/10/2026). O endereço
// novo funciona nas contas que já mudaram e nas que ainda não (conferido nas duas em 07/10).
const COMPOR = 'https://outlook.cloud.microsoft/mail/deeplink/compose';

// Endereço longo demais pode ser recusado no caminho até o Outlook. Acima deste tamanho o corpo
// fica de fora e vai pela área de transferência. Um e-mail com dez ativos fica perto de 2.900 com
// o cliente e o assessor (o texto vai codificado duas vezes, dentro do `mailto:`), e de 2.000 sem.
export const TAMANHO_MAXIMO = 7000;

// O `encodeURIComponent` escreve o espaço como %20. O `URLSearchParams` escreveria `+`, que nem
// todo leitor desfaz.
const codificar = (texto) => encodeURIComponent(texto.replace(/\r?\n/g, '\r\n'));

// O endereço do Para vai como está, como no teste; só o que mudaria o sentido do `mailto:` é
// codificado.
const enderecoNoMailto = (email) => email.replace(/[^A-Za-z0-9._+@-]/g, (c) => encodeURIComponent(c));

/**
 * O cliente vai no Para e o assessor em cópia, quando o robô e a planilha os trouxeram.
 *
 * O Outlook na web ignora o `cc` solto no endereço: Para, assunto e texto entram, a cópia não
 * (conferido no Outlook da mesa em 07/10/2026). Ele preenche tudo, a cópia inclusive, quando o `to`
 * leva um `mailto:` inteiro — é assim que o Chrome e o Edge lhe entregam os links de e-mail. Sem o
 * e-mail do cliente, vale o endereço simples, com assunto e texto; a cópia fica de fora (`cc`
 * solto não entraria).
 *
 * @param {{assunto?: string, corpo?: string, para?: string|null, cc?: string|null}} [email]
 * @returns {string|null} o endereço do e-mail novo, ou null se o corpo não couber nele
 */
export const enderecoDoEmail = ({ assunto = ASSUNTO, corpo = '', para = null, cc = null } = {}) => {
  const juntar = (campos) =>
    campos
      .filter(([, valor]) => valor)
      .map(([nome, valor]) => `${nome}=${codificar(valor)}`)
      .join('&');
  const endereco = para
    ? `${COMPOR}?to=${encodeURIComponent(`mailto:${enderecoNoMailto(para)}?${juntar([['cc', cc], ['subject', assunto], ['body', corpo]])}`)}`
    : `${COMPOR}?${juntar([['subject', assunto], ['body', corpo]])}`;
  return endereco.length <= TAMANHO_MAXIMO ? endereco : null;
};

/**
 * Abre o e-mail numa janela só dele, no meio da janela da Mesa, como o "abrir em nova janela" do
 * próprio Outlook (decidido com o operador em 07/10/2026): não enche a barra de abas e sai de cena
 * ao ser fechada. Cada clique abre a sua, para um e-mail não sobrescrever outro ainda não enviado.
 * A página não consegue usar a aba do Outlook que a pessoa já tem aberta: o navegador só deixa
 * reaproveitar uma janela que a própria página abriu.
 *
 * Precisa vir de um clique: fora dele, o navegador bloqueia a janela.
 * @returns {boolean} false se o navegador bloqueou a janela
 */
export const abrirNoOutlook = (endereco) => {
  const largura = Math.min(980, window.screen.availWidth);
  const altura = Math.min(860, window.screen.availHeight);
  const esquerda = Math.round(window.screenX + (window.outerWidth - largura) / 2);
  const topo = Math.round(window.screenY + (window.outerHeight - altura) / 2);
  const janela = window.open(endereco, '_blank', `popup,width=${largura},height=${altura},left=${esquerda},top=${topo}`);
  if (!janela) return false;
  janela.opener = null;
  return true;
};
