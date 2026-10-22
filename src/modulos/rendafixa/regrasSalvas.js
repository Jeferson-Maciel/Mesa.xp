import { MERCADOS, completarRegras } from './regras.js';

/**
 * As regras do Renda Fixa guardadas neste navegador (sem login, decidido com o usuário em 21/10/2026):
 * a configuração dos dois mercados, no `localStorage`. Não há dado de cliente nelas.
 *
 * O armazenamento pode estar bloqueado (o acesso lança): aí valem as regras do padrão, e salvar diz que
 * não deu — a tela avisa, e as regras valem até a página fechar.
 */

export const CHAVE = 'mesa_rendafixa_regras_v1';

/**
 * @returns {{config: {primario: object, secundario: object}, corrompidas: string[]}}  os mercados cujas
 *   regras salvas não eram válidas (e voltaram ao padrão)
 */
export const lerRegrasSalvas = (armazenamento = globalThis.localStorage) => {
  let dados = null;
  try {
    dados = JSON.parse(armazenamento?.getItem(CHAVE) ?? 'null');
  } catch {
    dados = null;
  }
  const config = {};
  const corrompidas = [];
  for (const mercado of MERCADOS) {
    const { regras, corrompidas: ruim } = completarRegras(dados?.[mercado], mercado);
    config[mercado] = regras;
    if (ruim) corrompidas.push(mercado);
  }
  return { config, corrompidas };
};

/** @returns {boolean} se conseguiu guardar */
export const salvarRegras = (config, armazenamento = globalThis.localStorage) => {
  try {
    armazenamento.setItem(CHAVE, JSON.stringify({ primario: config.primario, secundario: config.secundario }));
    return true;
  } catch {
    return false;
  }
};
