import { describe, expect, it } from 'vitest';
import { ehDiaUtil, pascoa, umDiaUtilDepois } from './diasUteis.js';

const dia = (texto) => {
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(a, m - 1, d, 11, 30);
};
const chave = (data) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')} ${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;

describe('pascoa', () => {
  it('acerta a Páscoa de anos conhecidos', () => {
    expect(chave(pascoa(2026)).slice(0, 10)).toBe('2026-04-05');
    expect(chave(pascoa(2027)).slice(0, 10)).toBe('2027-03-28');
    expect(chave(pascoa(2024)).slice(0, 10)).toBe('2024-03-31');
  });
});

describe('ehDiaUtil', () => {
  it('fim de semana não é dia útil', () => {
    expect(ehDiaUtil(dia('2026-10-24'))).toBe(false); // sábado
    expect(ehDiaUtil(dia('2026-10-25'))).toBe(false); // domingo
    expect(ehDiaUtil(dia('2026-10-23'))).toBe(true); // sexta
  });

  it('feriados fixos e móveis de 2026 fecham a B3', () => {
    for (const d of ['2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-20', '2026-12-24', '2026-12-25', '2026-12-31']) {
      expect(ehDiaUtil(dia(d)), d).toBe(false);
    }
  });

  it('a quarta-feira de cinzas é dia útil', () => {
    expect(ehDiaUtil(dia('2026-02-18'))).toBe(true);
  });
});

describe('umDiaUtilDepois', () => {
  it('de terça vai para quarta, no mesmo horário', () => {
    expect(chave(umDiaUtilDepois(dia('2026-10-20')))).toBe('2026-10-21 11:30');
  });

  it('de sexta vai para segunda', () => {
    expect(chave(umDiaUtilDepois(dia('2026-10-23')))).toBe('2026-10-26 11:30');
  });

  it('pula o feriado: a cotação de sexta, 30/10, vale até terça, 03/11 (02/11 é Finados)', () => {
    expect(chave(umDiaUtilDepois(dia('2026-10-30')))).toBe('2026-11-03 11:30');
  });

  it('pula o fim de ano', () => {
    expect(chave(umDiaUtilDepois(dia('2026-12-23')))).toBe('2026-12-28 11:30');
    expect(chave(umDiaUtilDepois(dia('2026-12-30')))).toBe('2027-01-04 11:30');
  });
});
