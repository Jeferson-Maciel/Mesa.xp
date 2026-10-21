import { describe, expect, it } from 'vitest';
import { faixaDeHorarios, proximoHorario, quantoFalta } from './horarios.js';

// 21/10/2026 é uma quarta-feira; 24/10, um sábado; 02/11, Finados.
const em = (dia, hora, min = 0) => new Date(2026, 9, dia, hora, min);

describe('o próximo horário num dia útil', () => {
  it('hoje, se ainda não deu a hora; senão, no próximo dia útil', () => {
    expect(proximoHorario(em(21, 11), '14:00')).toEqual(em(21, 14));
    expect(proximoHorario(em(21, 15), '14:00')).toEqual(em(22, 14));
    expect(proximoHorario(em(23, 15), '14:00')).toEqual(em(26, 14)); // sexta → segunda
    expect(proximoHorario(em(24, 9), '14:00')).toEqual(em(26, 14)); // sábado
    expect(proximoHorario(new Date(2026, 9, 30, 18), '14:00')).toEqual(new Date(2026, 10, 3, 14)); // pula Finados (02/11)
  });
});

describe('quanto falta', () => {
  it.each([
    [20 * 1000, 'agora'],
    [35 * 60000, '35 min'],
    [60 * 60000, '1h'],
    [72 * 60000, '1h12']
  ])('%i ms: %s', (ms, texto) => expect(quantoFalta(ms)).toBe(texto));
});

describe('a faixa de horários', () => {
  const item = (agora, id) => faixaDeHorarios(agora).itens.find((i) => i.id === id);

  it('o pregão: antes de abrir, aberto, no leilão e encerrado', () => {
    expect(item(em(21, 9, 25), 'pregao')).toMatchObject({ situacao: 'fechado', texto: 'abre em 35 min' });
    expect(item(em(21, 15, 43), 'pregao')).toMatchObject({ situacao: 'aberto', texto: 'leilão em 1h12' });
    expect(item(em(21, 16, 40), 'pregao')).toMatchObject({ situacao: 'perto', texto: 'leilão em 15 min' });
    expect(item(em(21, 16, 57), 'pregao')).toMatchObject({ situacao: 'perto', texto: 'leilão de encerramento' });
    expect(item(em(21, 17, 30), 'pregao')).toMatchObject({ situacao: 'fechado' });
    expect(item(em(24, 11), 'pregao')).toMatchObject({ situacao: 'fechado', texto: 'sem pregão hoje' });
  });

  it('o Estoque clientes casa até as 14h, e o Tesouro vai das 9h30 às 18h', () => {
    expect(item(em(21, 13, 10), 'estoque-clientes')).toMatchObject({ situacao: 'aberto', texto: 'casa até as 14h · 50 min' });
    expect(item(em(21, 14, 1), 'estoque-clientes').situacao).toBe('fechado');
    expect(item(em(21, 9, 10), 'tesouro')).toMatchObject({ situacao: 'fechado', texto: 'abre em 20 min' });
    expect(item(em(21, 17, 40), 'tesouro')).toMatchObject({ situacao: 'perto' });
  });

  it('o próximo a fechar é o que a faixa mostra de longe', () => {
    expect(faixaDeHorarios(em(21, 11)).proximo.id).toBe('estoque-clientes');
    expect(faixaDeHorarios(em(21, 15)).proximo.id).toBe('secundario');
    expect(faixaDeHorarios(em(21, 17, 30)).proximo.id).toBe('tesouro');
    expect(faixaDeHorarios(em(21, 19)).proximo).toBeNull();
  });
});
