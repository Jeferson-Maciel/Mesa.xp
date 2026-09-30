import { describe, expect, it } from 'vitest';
import { lerDataNatural, semOsTrechos } from './dataNatural.js';

// Quarta, 30/09/2026, 10:05 em Brasília.
const AGORA = new Date(2026, 8, 30, 10, 5);
const ler = (texto, agora = AGORA) => lerDataNatural(texto, agora)?.lembrete ?? null;

describe('datas relativas e dias da semana', () => {
  it('hoje, amanhã e depois de amanhã', () => {
    expect(ler('ligar pro cliente hoje')).toEqual({ data: '2026-09-30', hora: null });
    expect(ler('ligar pro cliente amanhã')).toEqual({ data: '2026-10-01', hora: null });
    expect(ler('ligar pro cliente amanha')).toEqual({ data: '2026-10-01', hora: null });
    expect(ler('conferir depois de amanhã')).toEqual({ data: '2026-10-02', hora: null });
  });

  it('dia da semana é o próximo; o de hoje é o da semana que vem', () => {
    expect(ler('reunião sexta')).toEqual({ data: '2026-10-02', hora: null });
    expect(ler('reunião na sexta-feira')).toEqual({ data: '2026-10-02', hora: null });
    expect(ler('enviar relatório segunda')).toEqual({ data: '2026-10-05', hora: null });
    expect(ler('fechar quarta')).toEqual({ data: '2026-10-07', hora: null });
    expect(ler('ver terça')).toEqual({ data: '2026-10-06', hora: null });
  });

  it('daqui N dias, horas ou minutos', () => {
    expect(ler('ajudar a Ana daqui 2 dias')).toEqual({ data: '2026-10-02', hora: null });
    expect(ler('ajudar a Ana em 3 dias')).toEqual({ data: '2026-10-03', hora: null });
    expect(ler('retornar daqui a 2 horas')).toEqual({ data: '2026-09-30', hora: '12:05' });
    expect(ler('retornar em 30 min')).toEqual({ data: '2026-09-30', hora: '10:35' });
    expect(ler('retornar daqui 1 semana')).toEqual({ data: '2026-10-07', hora: null });
  });
});

describe('hora', () => {
  it('com o dia, vale o dia; sozinha, hoje se ainda não passou, senão amanhã', () => {
    expect(ler('ligar amanhã 14h')).toEqual({ data: '2026-10-01', hora: '14:00' });
    expect(ler('ligar amanhã às 9h30')).toEqual({ data: '2026-10-01', hora: '09:30' });
    expect(ler('ligar sexta 15:45')).toEqual({ data: '2026-10-02', hora: '15:45' });
    expect(ler('ligar às 16h')).toEqual({ data: '2026-09-30', hora: '16:00' });
    expect(ler('ligar às 8h')).toEqual({ data: '2026-10-01', hora: '08:00' });
    expect(ler('ligar às 14')).toEqual({ data: '2026-09-30', hora: '14:00' });
  });

  // Frases da mesa que parecem data e não são.
  it('"segunda via" não é segunda-feira; "as 3 notas" não é três horas', () => {
    expect(ler('pedir segunda via do boleto')).toBeNull();
    expect(ler('enviar as 3 notas de corretagem')).toBeNull();
    expect(ler('pedir segunda via amanhã')).toEqual({ data: '2026-10-01', hora: null });
  });

  it('hora impossível não vira lembrete', () => {
    expect(ler('ligar 25h')).toBeNull();
    expect(ler('ligar 14:75')).toBeNull();
  });
});

describe('data com dia do mês: só depois de uma palavra de prazo', () => {
  // "Estorno do dia 25" diz quando o estorno aconteceu, não quando lembrar. Adivinhar aqui seria
  // criar um lembrete errado a partir do título que o operador sempre escreve.
  it('não lê "do dia 25", "25/10" nem números soltos', () => {
    expect(ler('estorno do dia 25')).toBeNull();
    expect(ler('estorno de 25/09 da conta 1234567')).toBeNull();
    expect(ler('enviar para 3 clientes')).toBeNull();
    expect(ler('ligar para 1234567')).toBeNull();
  });

  it('lê "até dia 25", "lembrar dia 5", "prazo 10/10" e "vence 15/10 14h"', () => {
    expect(ler('mandar o print até dia 25')).toEqual({ data: '2026-10-25', hora: null });
    expect(ler('lembrar dia 5')).toEqual({ data: '2026-10-05', hora: null });
    expect(ler('recadastro prazo 10/10')).toEqual({ data: '2026-10-10', hora: null });
    expect(ler('boleto vence 15/10 14h')).toEqual({ data: '2026-10-15', hora: '14:00' });
    expect(ler('até 02/01/2027')).toEqual({ data: '2027-01-02', hora: null });
  });

  it('um dia do mês que já passou vai para o mês seguinte; data inválida não vale', () => {
    expect(ler('até dia 30')).toEqual({ data: '2026-09-30', hora: null });
    expect(ler('até dia 29')).toEqual({ data: '2026-10-29', hora: null });
    expect(ler('até 31/02')).toBeNull();
  });
});

describe('o que sobra para o título', () => {
  it('tira a data e as palavras de ligação que ficaram penduradas', () => {
    const texto = 'Ligar pro cliente 1234567 amanhã às 14h';
    const lido = lerDataNatural(texto, AGORA);
    expect(semOsTrechos(texto, lido.trechos)).toBe('Ligar pro cliente 1234567');
    const outro = 'Mandar o print até dia 25 — conta 9876543';
    expect(semOsTrechos(outro, lerDataNatural(outro, AGORA).trechos)).toBe('Mandar o print — conta 9876543');
  });

  it('marca os trechos no texto original, com acento e maiúscula', () => {
    const texto = 'Reunião Amanhã às 9h';
    const { trechos } = lerDataNatural(texto, AGORA);
    expect(trechos.map(([i, f]) => texto.slice(i, f))).toEqual(['Amanhã', 'às 9h']);
  });

  it('sem data, nada', () => {
    expect(lerDataNatural('Conferir a planilha do fixing', AGORA)).toBeNull();
    expect(lerDataNatural('', AGORA)).toBeNull();
  });
});
