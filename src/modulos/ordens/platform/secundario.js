/**
 * A planilha do secundário e os tetos de ROA anotados, no `localStorage` do navegador.
 *
 * Nenhum dos dois tem dado de cliente: a planilha é a prateleira do dia (preço, deságio,
 * estoque), e o teto é um número por fundo. Ficam no navegador porque o Ordens funciona aberto do
 * disco, sem rede. A planilha guardada vale até a próxima ser carregada — o aviso de planilha
 * antiga é que diz quando trocar.
 */

const CHAVE_ESTOQUE = 'ordens_secundario_estoque';
const CHAVE_TETOS = 'ordens_secundario_tetos_roa';
const CHAVE_COTAS = 'ordens_secundario_cotas';

const ler = (chave) => {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
};

const escrever = (chave, valor) => {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
};

/** @returns {import('../core/secundario/secundario.js').Estoque|null} */
export const carregarEstoque = () => {
  const estoque = ler(CHAVE_ESTOQUE);
  return estoque && Array.isArray(estoque.fundos) ? estoque : null;
};

export const salvarEstoque = (estoque) => escrever(CHAVE_ESTOQUE, estoque);

/** @returns {import('../core/secundario/secundario.js').Tetos} */
export const carregarTetos = () => {
  const tetos = ler(CHAVE_TETOS);
  return tetos && typeof tetos === 'object' && !Array.isArray(tetos) ? tetos : {};
};

export const salvarTetos = (tetos) => escrever(CHAVE_TETOS, tetos);

/**
 * O preço exato da cota de cada fundo, trazido da boleta pelo robô do Hub. Só um número por fundo,
 * com o dia da cota e a hora da leitura: vale por 10 minutos (ver `secundario.js`). O que tem mais de
 * 10 dias sai ao carregar.
 *
 * @returns {import('../core/secundario/secundario.js').Cotas}
 */
export const carregarCotas = () => {
  const cotas = ler(CHAVE_COTAS);
  if (!cotas || typeof cotas !== 'object' || Array.isArray(cotas)) return {};
  const limite = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return Object.fromEntries(Object.entries(cotas).filter(([, c]) => typeof c?.valor === 'number' && c.dataDaCota >= limite));
};

export const salvarCotas = (cotas) => escrever(CHAVE_COTAS, cotas);
