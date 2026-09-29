import { describe, expect, it } from 'vitest';
import { CORES, corSegura, htmlHistorico, htmlHorarios, htmlSemana, indexar } from './render.js';

const XSS = '<img src=x onerror=alert(1)>';
const segunda = new Date(2026, 8, 28);
const hoje = new Date(2026, 8, 30, 15, 0);

const colaboradores = [
  { id: 'a', nome: 'Ana', cor: '#6366f1' },
  { id: 'b', nome: XSS, cor: 'red;background:url(https://x)' }
];

const registros = indexar([
  { data: '2026-09-28', colaboradorId: 'a', presencial: true, observacao: '', indisponiveis: [] },
  { data: '2026-09-28', colaboradorId: 'b', presencial: true, observacao: XSS, indisponiveis: [{ inicio: '14:00', fim: '15:00', motivo: 'Consulta médica' }] },
  { data: '2026-09-30', colaboradorId: 'a', presencial: false, observacao: 'home office', indisponiveis: [] }
]);

describe('cor do colaborador', () => {
  it('aceita só hex; o resto vira a primeira cor da paleta', () => {
    expect(corSegura('#22c55e')).toBe('#22c55e');
    expect(corSegura('#abc')).toBe('#abc');
    expect(corSegura('red;background:url(https://x)')).toBe(CORES[0]);
    expect(corSegura('#22c55e" onmouseover="x')).toBe(CORES[0]);
    expect(corSegura(null)).toBe(CORES[0]);
  });

  it('mantém a paleta do app original, que já está gravada no banco', () => {
    expect(CORES).toEqual(['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7']);
  });
});

describe('semana: matriz colaborador × dia', () => {
  const html = htmlSemana({ colaboradores, registros, segunda, hoje });

  it('tem uma coluna por dia útil e uma linha por colaborador', () => {
    expect(html.match(/<th scope="col"/g)).toHaveLength(6);
    expect(html.match(/<tr class="cal-linha">/g)).toHaveLength(2);
    expect(html).toContain('Seg');
    expect(html).toContain('28/09');
    expect(html).toContain('02/10');
  });

  it('soma os presenciais de cada dia no rodapé', () => {
    const rodape = html.slice(html.indexOf('<tfoot>'));
    const totais = [...rodape.matchAll(/<td[^>]*>(\d+)<\/td>/g)].map((m) => Number(m[1]));
    expect(totais).toEqual([2, 0, 0, 0, 0]);
  });

  it('marca a coluna de hoje', () => {
    expect(html.match(/cal-hoje/g).length).toBeGreaterThanOrEqual(3);
    expect(html).toContain('data-dia="2026-09-30"');
  });

  it('nome com marcação aparece como texto, e a cor maliciosa é trocada', () => {
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('url(https://x)');
  });

  it('na matriz mostra só o horário, sem o motivo — que pode ser de saúde', () => {
    expect(html).toContain('14:00–15:00');
    expect(html).not.toContain('Consulta médica');
  });

  it('pede para cadastrar alguém quando não há colaborador', () => {
    expect(htmlSemana({ colaboradores: [], registros: new Map(), segunda, hoje })).toContain('Nenhum colaborador');
  });
});

describe('histórico do mês', () => {
  it('agrupa por semana, resume presenças e ausências parciais, e escapa observação e motivo', () => {
    const html = htmlHistorico({ colaboradores, registros, ano: 2026, mes: 8 });
    expect(html.match(/class="cal-semana-hist"/g)).toHaveLength(5);
    expect(html).toContain('2 presenças');
    expect(html).toContain('1 ausência parcial');
    expect(html).toContain('home office');
    expect(html).not.toContain('<img');
    expect(html).toContain('14:00–15:00 (Consulta médica)');
    expect(html).toContain('<span class="cal-obs">&lt;img src=x onerror=alert(1)&gt;</span>');
  });

  it('filtrado para ninguém, diz que não há o que mostrar', () => {
    expect(htmlHistorico({ colaboradores: [], registros, ano: 2026, mes: 8 })).toContain('Nenhum colaborador');
  });
});

describe('horários na janela do dia', () => {
  it('lista com botão de remover e escapa o motivo', () => {
    const html = htmlHorarios([{ inicio: '08:00', fim: '09:00', motivo: XSS }]);
    expect(html).toContain('08:00 – 09:00');
    expect(html).toContain('data-remover-horario="0"');
    expect(html).not.toContain('<img');
  });

  it('diz quando não há horário', () => {
    expect(htmlHorarios([])).toContain('Nenhum horário indisponível');
  });
});
