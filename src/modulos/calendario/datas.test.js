import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  chaveDoDia,
  diaDaChave,
  diasUteis,
  intervaloDaSemana,
  intervaloDoMes,
  mesmoDia,
  rotuloDaSemana,
  segundaDaSemana,
  semanasDoMes,
  somarDias
} from './datas.js';

describe('chave do dia', () => {
  it('é YYYY-MM-DD no fuso local', () => {
    expect(chaveDoDia(new Date(2026, 8, 7))).toBe('2026-09-07');
  });

  // 23:30 de 30/09 em Brasília já é 01/10 em UTC: toISOString() mudaria o dia do registro.
  it('não pula para o dia seguinte à noite, como faria o toISOString', () => {
    const noite = new Date(2026, 8, 30, 23, 30);
    expect(noite.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(chaveDoDia(noite)).toBe('2026-09-30');
  });

  it('ida e volta sem perder o dia', () => {
    for (const chave of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-12-31']) {
      expect(chaveDoDia(diaDaChave(chave))).toBe(chave);
    }
  });

  it('volta para a meia-noite local', () => {
    const d = diaDaChave('2026-09-30');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 30, 0]);
  });
});

describe('semana', () => {
  it('começa na segunda, inclusive a partir do domingo', () => {
    expect(chaveDoDia(segundaDaSemana(new Date(2026, 8, 30)))).toBe('2026-09-28'); // quarta
    expect(chaveDoDia(segundaDaSemana(new Date(2026, 8, 28)))).toBe('2026-09-28'); // segunda
    expect(chaveDoDia(segundaDaSemana(new Date(2026, 9, 4)))).toBe('2026-09-28'); // domingo
  });

  it('tem cinco dias úteis, atravessando a virada do mês', () => {
    expect(diasUteis(new Date(2026, 8, 28)).map(chaveDoDia)).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'
    ]);
  });

  it('busca de segunda a domingo, como o app original', () => {
    expect(intervaloDaSemana(new Date(2026, 8, 28))).toEqual({ inicio: '2026-09-28', fim: '2026-10-04' });
  });

  it('diz o intervalo da semana por extenso', () => {
    expect(rotuloDaSemana(new Date(2026, 8, 28))).toBe('28 Set — 2 Out 2026');
  });

  it('soma dias no calendário local', () => {
    expect(chaveDoDia(somarDias(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
    expect(mesmoDia(new Date(2026, 8, 30, 8), new Date(2026, 8, 30, 22))).toBe(true);
  });
});

describe('mês do histórico', () => {
  it('busca o mês com uma semana de folga de cada lado', () => {
    expect(intervaloDoMes(2026, 8)).toEqual({ inicio: '2026-08-25', fim: '2026-10-07' });
  });

  it('agrupa os dias úteis do mês por semana, sem dias de outro mês', () => {
    const semanas = semanasDoMes(2026, 8).map((s) => s.map(chaveDoDia));
    expect(semanas[0]).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']);
    expect(semanas.at(-1)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30']);
    expect(semanas).toHaveLength(5);
  });

  it('não cria semana vazia quando o mês começa no fim de semana', () => {
    // Agosto de 2026 começa num sábado.
    const semanas = semanasDoMes(2026, 7).map((s) => s.map(chaveDoDia));
    expect(semanas[0][0]).toBe('2026-08-03');
    expect(semanas.every((s) => s.length > 0)).toBe(true);
  });
});

describe('regra do módulo', () => {
  const pasta = fileURLToPath(new URL('./', import.meta.url));
  const fontes = (dir) =>
    readdirSync(dir).flatMap((n) => {
      const caminho = join(dir, n);
      if (statSync(caminho).isDirectory()) return fontes(caminho);
      return n.endsWith('.js') && !n.endsWith('.test.js') ? [caminho] : [];
    });

  // Os comentários podem citar a regra; o código não pode usar.
  it('nenhum código do Calendário usa toISOString', () => {
    const arquivos = fontes(pasta);
    expect(arquivos.length).toBeGreaterThan(1);
    for (const arquivo of arquivos) {
      const codigo = readFileSync(arquivo, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(codigo, arquivo).not.toContain('toISOString');
    }
  });
});
