import { describe, expect, it } from 'vitest';
import { estadoDaNota, proximoMomento } from './lembretes.js';
import { MODELOS, aplicarModelo } from './modelos.js';
import {
  agruparPorPrazo,
  alternarItem,
  camposDe,
  contagens,
  filtrarNotas,
  lerChecklist,
  mesclarAoSalvar,
  mesmosCampos,
  novaNota,
  paraApagarDeVez,
  progressoChecklist
} from './notas.js';

const AGORA = new Date(2026, 8, 30, 10, 5);
const DIA = 86_400_000;
let seq = 0;
const nota = (extra = {}) => ({ ...novaNota(`n${++seq}`, AGORA.getTime() - seq * 1000), ...extra });

describe('checklist dentro do texto', () => {
  const texto = 'Estorno da taxa\n[ ] pedir o estorno\n[x] anexar o print\n- [ ] avisar o assessor\n  [X] conferir o valor\nfim';

  it('lê as linhas "[ ]" e "[x]", com ou sem traço na frente', () => {
    expect(lerChecklist(texto)).toEqual([
      { linha: 1, feito: false, texto: 'pedir o estorno' },
      { linha: 2, feito: true, texto: 'anexar o print' },
      { linha: 3, feito: false, texto: 'avisar o assessor' },
      { linha: 4, feito: true, texto: 'conferir o valor' }
    ]);
    expect(progressoChecklist(texto)).toEqual({ feitos: 2, total: 4 });
    expect(progressoChecklist('sem lista')).toEqual({ feitos: 0, total: 0 });
  });

  it('marcar e desmarcar muda só aquela linha, e o resto do texto fica igual', () => {
    const marcado = alternarItem(texto, 1);
    expect(marcado.split('\n')[1]).toBe('[x] pedir o estorno');
    expect(alternarItem(marcado, 1)).toBe(texto);
    expect(alternarItem(texto, 3).split('\n')[3]).toBe('- [x] avisar o assessor');
    expect(alternarItem(texto, 0)).toBe(texto); // linha que não é item
  });
});

describe('lixeira (30 dias, como o Apple Notes)', () => {
  const naLixeira = (dias) => nota({ excluidaEm: AGORA.getTime() - dias * DIA, lembrete: { data: '2026-09-01', hora: null } });

  it('anotação excluída não vence, não alerta e só aparece na lixeira', () => {
    const excluida = naLixeira(1);
    expect(estadoDaNota(excluida, AGORA)).toBe('excluida');
    expect(proximoMomento([{ ...excluida, lembrete: { data: '2026-12-01', hora: null } }], AGORA)).toBeNull();
    const notas = [excluida, nota({ titulo: 'viva' })];
    expect(filtrarNotas(notas, { filtro: 'todas' }, AGORA).map((n) => n.titulo)).toEqual(['viva']);
    expect(filtrarNotas(notas, { filtro: 'lixeira' }, AGORA)).toEqual([excluida]);
    expect(contagens(notas, AGORA)).toMatchObject({ todas: 1, lixeira: 1, vencidas: 0 });
  });

  it('passados 30 dias, sai de vez', () => {
    const notas = [naLixeira(31), naLixeira(29), nota()];
    expect(paraApagarDeVez(notas, AGORA)).toEqual([notas[0].id]);
  });
});

describe('agenda: agrupada por prazo, como o "Planejado" do Microsoft To Do', () => {
  it('vencidas, hoje, amanhã, esta semana, depois e sem lembrete — só os grupos com anotação', () => {
    const notas = [
      nota({ titulo: 'sem', lembrete: null }),
      nota({ titulo: 'depois', lembrete: { data: '2026-10-20', hora: null } }),
      nota({ titulo: 'semana', lembrete: { data: '2026-10-03', hora: null } }),
      nota({ titulo: 'amanha', lembrete: { data: '2026-10-01', hora: '09:00' } }),
      nota({ titulo: 'hoje', lembrete: { data: '2026-09-30', hora: '15:00' } }),
      nota({ titulo: 'venceu', lembrete: { data: '2026-09-28', hora: null } })
    ];
    const grupos = agruparPorPrazo(notas, AGORA);
    expect(grupos.map((g) => [g.id, g.notas.map((n) => n.titulo)])).toEqual([
      ['vencidas', ['venceu']],
      ['hoje', ['hoje']],
      ['amanha', ['amanha']],
      ['semana', ['semana']],
      ['depois', ['depois']],
      ['sem-lembrete', ['sem']]
    ]);
  });

  it('dentro do grupo, pela hora do lembrete', () => {
    const notas = [nota({ titulo: 'tarde', lembrete: { data: '2026-09-30', hora: '16:00' } }), nota({ titulo: 'cedo', lembrete: { data: '2026-09-30', hora: '11:00' } })];
    expect(agruparPorPrazo(notas, AGORA)[0].notas.map((n) => n.titulo)).toEqual(['cedo', 'tarde']);
  });
});

describe('rascunho e salvar', () => {
  it('compara só o que se edita: título, texto, etiquetas e lembrete (sem o "avisado")', () => {
    const n = nota({ titulo: 'a', etiquetas: ['x'], lembrete: { data: '2026-10-01', hora: null, avisado: true } });
    expect(camposDe(n)).toEqual({ titulo: 'a', texto: '', etiquetas: ['x'], lembrete: { data: '2026-10-01', hora: null } });
    expect(mesmosCampos(camposDe(n), { ...camposDe(n), lembrete: { data: '2026-10-01', hora: null } })).toBe(true);
    expect(mesmosCampos(camposDe(n), { ...camposDe(n), titulo: 'b' })).toBe(false);
    expect(mesmosCampos(camposDe(n), { ...camposDe(n), etiquetas: ['x', 'y'] })).toBe(false);
  });

  // Enquanto a pessoa editava o texto, o alerta adiou o lembrete. Salvar o texto não pode desfazer
  // o adiamento: vale o que ela mudou, e o resto vem do que está gravado agora.
  it('ao salvar, vale o que a pessoa mudou; o que ela não mexeu vem do que está gravado agora', () => {
    const original = nota({ titulo: 'Estorno', texto: 'v1', lembrete: { data: '2026-09-30', hora: '09:00' } });
    const atual = { ...original, lembrete: { data: '2026-10-01', hora: '09:00' }, concluida: false };
    const rascunho = { ...camposDe(original), texto: 'v2 editado' };
    const salva = mesclarAoSalvar({ original: camposDe(original), rascunho, atual });
    expect(salva.texto).toBe('v2 editado');
    expect(salva.lembrete).toEqual({ data: '2026-10-01', hora: '09:00' });
    expect(salva.id).toBe(original.id);
  });

  it('se a pessoa mexeu no lembrete, o dela vale — e nasce sem o "avisado"', () => {
    const original = nota({ lembrete: { data: '2026-09-30', hora: '09:00', avisado: true } });
    const rascunho = { ...camposDe(original), lembrete: { data: '2026-10-05', hora: null } };
    expect(mesclarAoSalvar({ original: camposDe(original), rascunho, atual: original }).lembrete).toEqual({ data: '2026-10-05', hora: null });
  });

  it('anotação nova: não há gravada; sai do rascunho', () => {
    const base = novaNota('nova', AGORA.getTime());
    const rascunho = { ...camposDe(base), titulo: 'Nova' };
    expect(mesclarAoSalvar({ original: camposDe(base), rascunho, atual: base })).toMatchObject({ id: 'nova', titulo: 'Nova' });
  });
});

describe('modelos', () => {
  it('cada modelo tem nome, e aplicar dá título, texto e etiquetas prontos, sem lembrete inventado', () => {
    expect(MODELOS.length).toBeGreaterThanOrEqual(4);
    for (const m of MODELOS) {
      const campos = aplicarModelo(m, AGORA);
      expect(m.nome).toBeTruthy();
      expect(typeof campos.titulo).toBe('string');
      expect(Array.isArray(campos.etiquetas)).toBe(true);
    }
    const estorno = aplicarModelo(MODELOS.find((m) => m.id === 'estorno'), AGORA);
    expect(estorno.texto).toContain('[ ]');
    expect(estorno.etiquetas).toContain('estorno');
    expect(estorno.lembrete).toBeNull();
  });

  it('o de retorno de ligação já sugere daqui 1 hora', () => {
    expect(aplicarModelo(MODELOS.find((m) => m.id === 'retorno'), AGORA).lembrete).toEqual({ data: '2026-09-30', hora: '11:05' });
  });
});
