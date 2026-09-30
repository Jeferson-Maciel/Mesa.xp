import { describe, expect, it } from 'vitest';
import {
  ATALHOS,
  aplicarAtalho,
  chaveDoDia,
  estadoDaNota,
  momentoDoLembrete,
  proximoMomento,
  rotuloDoLembrete
} from './lembretes.js';

// Quarta, 30/09/2026, 10:05 no fuso de Brasília (os testes rodam em America/Sao_Paulo).
const AGORA = new Date(2026, 8, 30, 10, 5);
const nota = (lembrete, extra = {}) => ({ id: 'n1', titulo: 'Estorno', lembrete, concluida: false, ...extra });

describe('estado da anotação', () => {
  it('sem lembrete é livre; resolvida é resolvida, com ou sem lembrete', () => {
    expect(estadoDaNota(nota(null), AGORA)).toBe('livre');
    expect(estadoDaNota(nota({ data: '2026-09-01', hora: null }, { concluida: true }), AGORA)).toBe('resolvida');
  });

  // "Lembrar dia 02/10, daqui dois dias": amarelo até o dia chegar.
  it('lembrete num dia que ainda não chegou fica pendente (amarelo)', () => {
    expect(estadoDaNota(nota({ data: '2026-10-02', hora: null }), AGORA)).toBe('pendente');
    expect(estadoDaNota(nota({ data: '2026-10-01', hora: '09:00' }), AGORA)).toBe('pendente');
  });

  // "Quando chegar o dia ou a hora, fica vermelho."
  it('no dia marcado, sem hora, já vence de manhã (vermelho)', () => {
    expect(estadoDaNota(nota({ data: '2026-09-30', hora: null }), AGORA)).toBe('vencida');
  });

  it('com hora, fica "hoje" até a hora e vence nela', () => {
    expect(estadoDaNota(nota({ data: '2026-09-30', hora: '14:00' }), AGORA)).toBe('hoje');
    expect(estadoDaNota(nota({ data: '2026-09-30', hora: '14:00' }), new Date(2026, 8, 30, 14, 0))).toBe('vencida');
    expect(estadoDaNota(nota({ data: '2026-09-30', hora: '10:05' }), AGORA)).toBe('vencida');
  });

  it('um lembrete de dias atrás que ninguém resolveu continua vencido', () => {
    expect(estadoDaNota(nota({ data: '2026-09-25', hora: '16:00' }), AGORA)).toBe('vencida');
  });
});

describe('momento do lembrete', () => {
  // A data é a chave local do dia: às 22h de Brasília, toISOString() já estaria no dia seguinte.
  it('lê a data no fuso local, sem virar o dia', () => {
    const m = momentoDoLembrete({ data: '2026-10-02', hora: '22:30' });
    expect([m.getFullYear(), m.getMonth(), m.getDate(), m.getHours(), m.getMinutes()]).toEqual([2026, 9, 2, 22, 30]);
    expect(chaveDoDia(new Date(2026, 9, 2, 23, 59))).toBe('2026-10-02');
  });

  it('sem hora, é a meia-noite do dia', () => {
    const m = momentoDoLembrete({ data: '2026-10-02', hora: null });
    expect([m.getDate(), m.getHours(), m.getMinutes()]).toEqual([2, 0, 0]);
  });
});

describe('rótulo do lembrete', () => {
  const rotulo = (lembrete, extra) => rotuloDoLembrete(nota(lembrete, extra), AGORA);

  it('pendente diz quando', () => {
    expect(rotulo({ data: '2026-10-01', hora: null })).toBe('Lembrar amanhã');
    expect(rotulo({ data: '2026-10-01', hora: '09:00' })).toBe('Lembrar amanhã às 09:00');
    expect(rotulo({ data: '2026-10-02', hora: null })).toBe('Lembrar sex 02/10');
    expect(rotulo({ data: '2026-10-20', hora: '15:30' })).toBe('Lembrar 20/10 às 15:30');
  });

  it('hoje, antes da hora', () => {
    expect(rotulo({ data: '2026-09-30', hora: '14:00' })).toBe('Hoje às 14:00');
  });

  it('vencido diz desde quando', () => {
    expect(rotulo({ data: '2026-09-30', hora: null })).toBe('Para hoje');
    expect(rotulo({ data: '2026-09-30', hora: '09:00' })).toBe('Venceu hoje às 09:00');
    expect(rotulo({ data: '2026-09-29', hora: null })).toBe('Venceu ontem');
    expect(rotulo({ data: '2026-09-25', hora: '16:00' })).toBe('Venceu em 25/09 (há 5 dias)');
  });

  it('resolvida e sem lembrete', () => {
    expect(rotulo(null)).toBe('');
    expect(rotuloDoLembrete(nota(null, { concluida: true, concluidaEm: new Date(2026, 8, 29, 18, 0).getTime() }), AGORA)).toBe(
      'Resolvida em 29/09'
    );
  });
});

describe('atalhos de lembrete e de adiar', () => {
  it('daqui 1 hora arredonda para os próximos 5 minutos', () => {
    expect(aplicarAtalho('1h', AGORA)).toEqual({ data: '2026-09-30', hora: '11:05' });
    expect(aplicarAtalho('1h', new Date(2026, 8, 30, 10, 7))).toEqual({ data: '2026-09-30', hora: '11:10' });
  });

  it('daqui 1 hora atravessa a meia-noite', () => {
    expect(aplicarAtalho('1h', new Date(2026, 8, 30, 23, 30))).toEqual({ data: '2026-10-01', hora: '00:30' });
  });

  it('hoje às 17h, amanhã às 9h, em 2 dias (sem hora) e segunda às 9h', () => {
    expect(aplicarAtalho('hoje-17h', AGORA)).toEqual({ data: '2026-09-30', hora: '17:00' });
    expect(aplicarAtalho('amanha-9h', AGORA)).toEqual({ data: '2026-10-01', hora: '09:00' });
    expect(aplicarAtalho('2-dias', AGORA)).toEqual({ data: '2026-10-02', hora: null });
    expect(aplicarAtalho('segunda-9h', AGORA)).toEqual({ data: '2026-10-05', hora: '09:00' });
  });

  it('"segunda" numa segunda é a da semana que vem; "hoje 17h" some depois das 17h', () => {
    expect(aplicarAtalho('segunda-9h', new Date(2026, 9, 5, 8, 0))).toEqual({ data: '2026-10-12', hora: '09:00' });
    expect(ATALHOS.filter((a) => a.disponivel(new Date(2026, 8, 30, 17, 30))).map((a) => a.id)).not.toContain('hoje-17h');
  });

  it('atalho desconhecido é erro, não um lembrete inventado', () => {
    expect(() => aplicarAtalho('depois', AGORA)).toThrow();
  });
});

describe('próximo momento', () => {
  it('o lembrete futuro mais cedo entre as anotações não resolvidas', () => {
    const notas = [
      nota({ data: '2026-10-02', hora: null }),
      nota({ data: '2026-09-30', hora: '14:00' }),
      nota({ data: '2026-09-30', hora: '11:00' }, { concluida: true }),
      nota({ data: '2026-09-25', hora: null }),
      nota(null)
    ];
    expect(proximoMomento(notas, AGORA)).toEqual(new Date(2026, 8, 30, 14, 0));
  });

  it('sem lembrete futuro, nada', () => {
    expect(proximoMomento([nota(null), nota({ data: '2026-09-01', hora: null })], AGORA)).toBeNull();
  });
});
