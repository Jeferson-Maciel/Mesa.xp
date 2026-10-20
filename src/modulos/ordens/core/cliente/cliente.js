import { acharAssessor, codigoDoAssessor, emailValido } from './assessores.js';

/**
 * O cliente da solicitação, como o robô o trouxe do Hub: o nome para a saudação do e-mail, o e-mail
 * para o Para do Outlook e o assessor responsável, que vai em cópia com o e-mail da planilha.
 *
 * Nada disto é guardado: chega do Hub a cada análise e fica só na tela (decisão do operador em
 * 07/10/2026). O robô entrega só estes campos da ficha do cliente — nada de CPF, telefone ou
 * patrimônio.
 */

/**
 * O nome como o Hub o manda, em maiúsculas ("ANA PAULA DA SILVA"), só sem os espaços a mais. É
 * assim que ele vai na saudação: decidido com o operador em 20/10/2026, pelo e-mail de auditoria
 * que o cliente aprovou, com o nome todo em maiúsculas. Até ali a Mesa o reescrevia com as iniciais
 * maiúsculas.
 *
 * @returns {string}
 */
export const nomeDoHub = (nome) => String(nome ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');

/**
 * O que o robô entregou, conferido: só vale para a conta pedida.
 *
 * @param {object} dados  `{conta, nome, email, assessorCodigo, assessorNome}`
 * @param {string} conta
 * @returns {{nome: string|null, email: string|null, assessorCodigo: string|null, assessorNome: string|null}|null}
 */
export const lerClienteDoRobo = (dados, conta) => {
  if (!dados || String(dados.conta) !== String(conta)) return null;
  const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    nome: texto(dados.nome),
    email: emailValido(dados.email),
    assessorCodigo: codigoDoAssessor(dados.assessorCodigo),
    assessorNome: texto(dados.assessorNome)
  };
};

/**
 * O cliente como o e-mail o usa: o nome do Hub e o e-mail do assessor achado na planilha.
 *
 * @param {ReturnType<typeof lerClienteDoRobo>} dados
 * @param {Parameters<typeof acharAssessor>[0]} assessores
 */
export const clienteParaOEmail = (dados, assessores) => {
  const assessor = { codigo: dados.assessorCodigo, nome: dados.assessorNome };
  const achado = acharAssessor(assessores, assessor);
  return {
    nome: dados.nome ? nomeDoHub(dados.nome) : null,
    email: dados.email,
    assessor: {
      ...assessor,
      email: achado.email ?? null,
      peloNome: achado.peloNome === true,
      motivo: achado.motivo ?? null
    }
  };
};
