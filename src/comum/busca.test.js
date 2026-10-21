import { describe, expect, it } from 'vitest';
import { acharEm, fontesDeBusca, normalizarBusca, registrarFonteDeBusca } from './busca.js';

const POSTS = [
  { titulo: 'Confirmação de ordem Venda', resto: 'Prezado(a) CLIENTE, ... Ativo: XXX;' },
  { titulo: 'Tabela de Cetipados', resto: 'ROA.E. Deságio Venda' },
  { titulo: 'Resgate Tesouro', resto: 'Confirmação resgate Tesouro Direto' }
];
const achar = (termo) => acharEm(POSTS, termo, (p) => p).map((p) => p.titulo);

describe('a régua da busca', () => {
  it('sem acento, sem caixa, e todas as palavras', () => {
    expect(normalizarBusca('  Confirmação   DE  ')).toBe('confirmacao de');
    expect(achar('confirmacao venda')).toEqual(['Confirmação de ordem Venda']);
    expect(achar('venda xpto')).toEqual([]);
  });

  it('no título vem antes de no resto; o título que começa pelo termo, antes ainda', () => {
    expect(achar('confirma')).toEqual(['Confirmação de ordem Venda', 'Resgate Tesouro']);
    expect(achar('desagio')).toEqual(['Tabela de Cetipados']);
  });

  it('termo vazio não acha nada, e o limite vale', () => {
    expect(achar('   ')).toEqual([]);
    expect(acharEm(POSTS, 'e', (p) => p, 2)).toHaveLength(2);
  });

  it('as fontes ficam na ordem em que foram registradas, e o mesmo id substitui', () => {
    registrarFonteDeBusca({ id: 'teste-a', nome: 'A', buscar: () => [] });
    registrarFonteDeBusca({ id: 'teste-b', nome: 'B', buscar: () => [] });
    registrarFonteDeBusca({ id: 'teste-a', nome: 'A2', buscar: () => [] });
    expect(fontesDeBusca().filter((f) => f.id.startsWith('teste-')).map((f) => f.nome)).toEqual(['A2', 'B']);
  });
});
