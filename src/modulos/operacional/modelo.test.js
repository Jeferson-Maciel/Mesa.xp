import { describe, expect, it } from 'vitest';
import { POSTS } from './conteudo.js';
import { camposDoModelo, preencherModelo, temMarcadores } from './modelo.js';

const RESGATE = POSTS.find((p) => p.titulo === 'Confirmação resgate Tesouro Direto').conteudo;
const VENDA = POSTS.find((p) => p.titulo === 'Confirmação de ordem Venda').conteudo;

describe('os campos de um modelo', () => {
  it('o resgate do Tesouro: o cliente, a conta e os campos pelo rótulo da linha', () => {
    expect(camposDoModelo(RESGATE).map((c) => c.rotulo)).toEqual(['Nome do cliente', 'Conta XP', 'Título', 'Vencimento', 'Valor a ser resgatado']);
  });

  it('a ordem de venda: o rótulo de cada linha, e os repetidos numerados', () => {
    const rotulos = camposDoModelo(VENDA).map((c) => c.rotulo);
    expect(rotulos.slice(0, 3)).toEqual(['Nome do cliente', 'Conta XP', 'Ativo']);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });

  it('o cliente e a conta repetidos são um campo só cada', () => {
    expect(camposDoModelo('Olá CLIENTE, na conta XP XXXXX.\nAtte, CLIENTE. Na conta XP XXXXXX.').map((c) => c.chave)).toEqual(['cliente', 'conta']);
    expect(camposDoModelo(VENDA).filter((c) => c.rotulo.startsWith('Conta'))).toHaveLength(1);
  });

  it('sem marcador, não é modelo', () => {
    expect(temMarcadores('Passo a passo sem nada para preencher.')).toBe(false);
    expect(temMarcadores(RESGATE)).toBe(true);
  });
});

describe('o modelo preenchido', () => {
  it('troca cada marcador pelo valor, e o CLIENTE em todos os lugares', () => {
    const { texto, faltam } = preencherModelo('Olá CLIENTE, conta XXXXX.\nAtte, CLIENTE', { cliente: 'Fulana', conta: '1234567' });
    expect(texto).toBe('Olá Fulana, conta 1234567.\nAtte, Fulana');
    expect(faltam).toBe(0);
  });

  it('o que fica em branco sai como o marcador, e é contado', () => {
    const { texto, faltam, pedacos } = preencherModelo('Ativo: XXX; Quantidade: XXXX;', { 'campo-0': 'PETR4', 'campo-1': '  ' });
    expect(texto).toBe('Ativo: PETR4; Quantidade: XXXX;');
    expect(faltam).toBe(1);
    expect(pedacos.map((p) => p.tipo)).toEqual(['fixo', 'preenchido', 'fixo', 'falta', 'fixo']);
  });
});
