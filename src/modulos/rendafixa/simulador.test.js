import { describe, expect, it } from 'vitest';
import { layoutDaImagem } from './imagem.js';
import { diasUteisAte, simularPre } from './simulador.js';

describe('o simulador de pré-fixado', () => {
  it('um ano de 252 dias úteis a 14% vira 14% bruto, e o IR de 17,5% acima de 360 dias', () => {
    const r = simularPre({ valor: 10000, taxa: 14, diasUteis: 252, diasCorridos: 365 });
    expect(r.bruto).toBeCloseTo(11400, 6);
    expect(r.aliquota).toBe(17.5);
    expect(r.ir).toBeCloseTo(245, 6);
    expect(r.liquido).toBeCloseTo(11155, 6);
    expect(r.taxaLiquida).toBeCloseTo(11.55, 6);
  });

  it('o isento não paga IR, e o prazo curto paga 22,5%', () => {
    expect(simularPre({ valor: 1000, taxa: 12, diasUteis: 252, diasCorridos: 365, isento: true }).ir).toBe(0);
    expect(simularPre({ valor: 1000, taxa: 12, diasUteis: 100, diasCorridos: 150 }).aliquota).toBe(22.5);
  });

  it('sem valor, sem prazo ou com taxa que não é número, não simula', () => {
    expect(simularPre({ valor: 0, taxa: 12, diasUteis: 252, diasCorridos: 365 })).toBeNull();
    expect(simularPre({ valor: 1000, taxa: NaN, diasUteis: 252, diasCorridos: 365 })).toBeNull();
    expect(simularPre({ valor: 1000, taxa: 12, diasUteis: 0, diasCorridos: 0 })).toBeNull();
  });

  it('os dias úteis contam do dia seguinte ao vencimento, pela regra de dia útil', () => {
    const semFimDeSemana = (d) => d.getDay() !== 0 && d.getDay() !== 6;
    // Quarta 21/10 a quarta 28/10: qui, sex, seg, ter, qua.
    expect(diasUteisAte(new Date(2026, 9, 21), new Date(2026, 9, 28), semFimDeSemana)).toBe(5);
  });
});

describe('a imagem das oportunidades', () => {
  const resultado = {
    secundario: false,
    secoes: [
      { id: 'pre', titulo: 'Pré-fixadas', itens: [{ prazo: 2, tipo: 'CDB', taxa: 14.2, indexador: 'PRE' }] },
      { id: 'pos', titulo: 'Pós-fixadas', itens: [] },
      { id: 'ipca', titulo: 'IPCA+', itens: [{ prazo: 5, tipo: 'CRA', taxa: 8.4, indexador: 'IPCA' }] },
      { id: 'isentos', titulo: 'Isentos de IR', itens: [] }
    ]
  };

  it('só as categorias com oportunidade, com o prazo, o tipo e a taxa como na mensagem', () => {
    const { itens, largura, altura } = layoutDaImagem(resultado, { data: '21/10/2026' });
    const textos = itens.filter((i) => i.tipo === 'texto').map((i) => i.texto);
    expect(textos).toContain('Pré-fixadas');
    expect(textos).not.toContain('Pós-fixadas');
    expect(textos).toContain('2 anos · CDB');
    expect(textos).toContain('14,20% a.a.');
    expect(textos).toContain('IPCA + 8,40% a.a.');
    expect(largura).toBe(1080);
    expect(altura).toBeGreaterThan(400);
  });

  it('no secundário, o emissor embaixo de cada linha, e a imagem cresce com as linhas', () => {
    const sec = { ...resultado, secundario: true, secoes: [{ id: 'pre', titulo: 'Pré-fixadas', itens: [{ prazo: 2, tipo: 'CDB', taxa: 14.2, indexador: 'PRE', emissor: 'BANCO EXEMPLO' }] }] };
    const textos = layoutDaImagem(sec, { data: '21/10/2026' }).itens.map((i) => i.texto);
    expect(textos).toContain('BANCO EXEMPLO');
    expect(textos).toContain('21/10/2026 · mercado secundário');
  });
});
