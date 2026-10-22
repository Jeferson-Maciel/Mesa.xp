import { describe, expect, it } from 'vitest';
import { comValor, regrasPadrao } from './regras.js';
import { CHAVE, lerRegrasSalvas, salvarRegras } from './regrasSalvas.js';

const armazenamento = (inicial = {}) => {
  const dados = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    dados
  };
};
const bloqueado = {
  getItem: () => {
    throw new Error('bloqueado');
  },
  setItem: () => {
    throw new Error('bloqueado');
  }
};

describe('as regras guardadas no navegador', () => {
  it('sem nada guardado, o padrão dos dois mercados', () => {
    expect(lerRegrasSalvas(armazenamento())).toEqual({ config: { primario: regrasPadrao('primario'), secundario: regrasPadrao('secundario') }, corrompidas: [] });
  });

  it('guarda e lê de volta', () => {
    const a = armazenamento();
    const config = { primario: comValor(regrasPadrao('primario'), 'filtros.puMaximo', 1500), secundario: regrasPadrao('secundario') };
    expect(salvarRegras(config, a)).toBe(true);
    expect(lerRegrasSalvas(a).config.primario.filtros.puMaximo).toBe(1500);
  });

  it('as guardadas inválidas voltam ao padrão, e dizem qual mercado', () => {
    const a = armazenamento({ [CHAVE]: JSON.stringify({ secundario: { filtros: { puMaximo: 'muito' } } }) });
    const { config, corrompidas } = lerRegrasSalvas(a);
    expect(corrompidas).toEqual(['secundario']);
    expect(config.secundario).toEqual(regrasPadrao('secundario'));
  });

  it('com o armazenamento bloqueado: o padrão, e salvar diz que não deu', () => {
    expect(lerRegrasSalvas(bloqueado).config.primario).toEqual(regrasPadrao('primario'));
    expect(salvarRegras({ primario: regrasPadrao('primario'), secundario: regrasPadrao('secundario') }, bloqueado)).toBe(false);
  });
});
