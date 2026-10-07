import { acharAssessor, codigoDoAssessor, emailValido } from './assessores.js';

/**
 * O cliente da solicitação, como o robô o trouxe do Hub: o nome para a saudação do e-mail, o e-mail
 * para o Para do Outlook e o assessor responsável, que vai em cópia com o e-mail da planilha.
 *
 * Nada disto é guardado: chega do Hub a cada análise e fica só na tela (decisão do operador em
 * 07/10/2026). O robô entrega só estes campos da ficha do cliente — nada de CPF, telefone ou
 * patrimônio.
 */

// Partículas ficam em minúscula no meio do nome: "Ana Paula da Silva", não "Da Silva".
const PARTICULAS = new Set(['da', 'das', 'de', 'do', 'dos', 'e', 'di', 'du', 'del', 'della', 'van', 'von', 'y']);

const maiuscula = (palavra) => palavra.charAt(0).toLocaleUpperCase('pt-BR') + palavra.slice(1);

/**
 * O Hub manda o nome em maiúsculas ("ANA PAULA DA SILVA"). Para a saudação, cada palavra com a
 * inicial maiúscula, as partículas em minúscula e os numerais romanos inteiros. O acento que o Hub
 * não mandou não é posto: seria inventar a grafia do nome.
 *
 * @returns {string}
 */
export const nomeProprio = (nome) =>
  String(nome ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .filter(Boolean)
    .map((palavra, i) => {
      if (/^(ii|iii|iv)$/.test(palavra)) return palavra.toUpperCase();
      if (i > 0 && PARTICULAS.has(palavra)) return palavra;
      // Ana-Maria, D'Ávila
      return palavra
        .split('-')
        .map((parte) => parte.split("'").map(maiuscula).join("'"))
        .join('-');
    })
    .join(' ');

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
 * O cliente como o e-mail o usa: o nome já arrumado e o e-mail do assessor achado na planilha.
 *
 * @param {ReturnType<typeof lerClienteDoRobo>} dados
 * @param {Parameters<typeof acharAssessor>[0]} assessores
 */
export const clienteParaOEmail = (dados, assessores) => {
  const assessor = { codigo: dados.assessorCodigo, nome: dados.assessorNome };
  const achado = acharAssessor(assessores, assessor);
  return {
    nome: dados.nome ? nomeProprio(dados.nome) : null,
    email: dados.email,
    assessor: {
      ...assessor,
      email: achado.email ?? null,
      peloNome: achado.peloNome === true,
      motivo: achado.motivo ?? null
    }
  };
};
