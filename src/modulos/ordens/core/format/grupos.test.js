import { describe, expect, it } from 'vitest';
import { grupoDaOrdem, gruposDe, indiceNaSolicitacao, recorte } from './grupos.js';

const fundo = (nome, ticker = null) => ({ situacao: 'exato', fundo: { nome, ticker } });
const ORDENS = [
  { ativo: 'KLBN11', fundo: null, operacao: 'V' },
  { ativo: 'VULC3', fundo: null, operacao: 'C' },
  { ativo: 'PAAG11', fundo: fundo('Pátria Crédito Agrícola FiAgro', 'PAAG11'), operacao: 'V' },
  { ativo: 'Riza Malls Feeder FII RL', fundo: fundo('Riza Malls Feeder FII RL'), operacao: 'V' },
  { ativo: 'Brio Renda Mais FII RL', fundo: fundo('Brio Renda Mais FII RL'), operacao: 'C' },
  { ativo: 'IMOV11', fundo: fundo('Navi Hedge Fund', 'IMOV11'), operacao: 'C' }
];
const s = { conta: '1234567', ordens: ORDENS };

describe('grupos de e-mail', () => {
  it('cada ordem cai num grupo: bolsa, fundos comprados, fundos vendidos', () => {
    expect(ORDENS.map(grupoDaOrdem)).toEqual(['bolsa', 'bolsa', 'fundos-venda', 'fundos-venda', 'fundos-compra', 'fundos-compra']);
  });

  it('só os grupos que o pedido tem, na ordem fixa', () => {
    expect(gruposDe(s)).toEqual(['bolsa', 'fundos-compra', 'fundos-venda']);
    expect(gruposDe({ ordens: [ORDENS[4]] })).toEqual(['fundos-compra']);
  });

  it('o recorte do e-mail leva só as ordens do grupo, na ordem digitada', () => {
    expect(recorte(s, 'fundos-venda').ordens.map((o) => o.ativo)).toEqual(['PAAG11', 'Riza Malls Feeder FII RL']);
    expect(recorte(s, 'bolsa').ordens.map((o) => o.ativo)).toEqual(['KLBN11', 'VULC3']);
  });

  it('tabela, lote e TWAP levam a bolsa e os fundos escritos pelo ticker', () => {
    expect(recorte(s, 'bolsa', 'lote').ordens.map((o) => o.ativo)).toEqual(['KLBN11', 'VULC3', 'PAAG11', 'IMOV11']);
  });

  it('as ordens do recorte são as mesmas, e o índice volta para o da solicitação', () => {
    const parte = recorte(s, 'fundos-compra');
    expect(parte.ordens[0]).toBe(ORDENS[4]);
    expect(indiceNaSolicitacao(s, parte, 1)).toBe(5);
    expect(indiceNaSolicitacao(s, parte, null)).toBeNull();
  });
});
