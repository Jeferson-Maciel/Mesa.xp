import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEMA_PADRAO, TEMAS, oOutro, temaAtual } from './tema.js';

describe('oOutro', () => {
  it('alterna entre os dois temas', () => {
    expect(oOutro('claro')).toBe('escuro');
    expect(oOutro('escuro')).toBe('claro');
  });

  it('volta ao ponto de partida em dois cliques', () => {
    for (const tema of TEMAS) expect(oOutro(oOutro(tema))).toBe(tema);
  });

  it('cai no claro diante de um valor estranho, em vez de travar o botão', () => {
    expect(oOutro(undefined)).toBe('claro');
  });
});

describe('temaAtual', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('abre no escuro num navegador sem escolha gravada', () => {
    expect(TEMA_PADRAO).toBe('escuro');
    expect(temaAtual()).toBe('escuro');
  });

  it('ignora a preferência do sistema: Windows no claro, ferramenta no escuro', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(temaAtual()).toBe('escuro');
  });

  it('respeita a escolha gravada no navegador', () => {
    const guardado = new Map([['xp_tema', 'claro']]);
    vi.stubGlobal('localStorage', {
      getItem: (chave) => guardado.get(chave) ?? null,
      setItem: (chave, valor) => guardado.set(chave, valor)
    });
    expect(temaAtual()).toBe('claro');
  });

  it('ignora um valor corrompido no armazenamento e volta ao padrão', () => {
    vi.stubGlobal('localStorage', { getItem: () => 'roxo', setItem: () => {} });
    expect(temaAtual()).toBe('escuro');
  });

  it('não quebra quando o armazenamento é negado pelo navegador', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      }
    });
    expect(temaAtual()).toBe('escuro');
  });

  it('devolve sempre um tema válido', () => {
    expect(TEMAS).toContain(temaAtual());
  });
});
