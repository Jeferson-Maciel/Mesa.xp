import { describe, expect, it } from 'vitest';
import { formatarTempos } from './tempos.js';

const T0 = Date.UTC(2026, 9, 6, 21, 42, 10);
const VGPR = 'ce52be97-05e7-40d9-887a-215d7711bfc7';
const TERRAX = '9437b32f-0000-4000-8000-000000000001';
const VICA = '7576ec06-0000-4000-8000-000000000002';

// Uma rodada: a cotação e o preço exato de dois fundos, pedidos de uma vez, e um terceiro que não
// precisava da boleta — como a Mesa e o robô os anotam.
const rodada = {
  inicio: T0,
  versao: '1.2.0',
  nomes: { [VGPR]: 'VGPR11', [TERRAX]: 'Riza Terrax', [VICA]: 'VICA11' },
  mesa: [
    { em: T0, passo: 'colou', fundos: 3 },
    { em: T0 + 100, passo: 'pediu a cotação' },
    { em: T0 + 2100, passo: 'recebeu a cotação' },
    { em: T0 + 2140, passo: 'dispensou o preço', fundoId: VICA },
    { em: T0 + 2150, passo: 'pediu os preços', fundoIds: [VGPR, TERRAX] },
    { em: T0 + 4950, passo: 'recebeu o preço', fundoId: VGPR },
    { em: T0 + 6950, passo: 'recebeu o preço', fundoId: TERRAX }
  ],
  robo: [
    { em: T0 + 130, passo: 'pedido recebido', tipo: 'cotação' },
    { em: T0 + 140, passo: 'tarefa começou', tipo: 'cotação', escondida: true, onde: 'Prateleira', botao: true },
    { em: T0 + 200, passo: 'clicou em Atualizar' },
    { em: T0 + 210, passo: 'chamada', fase: 'ida', caminho: 'v3/investment-funds-secondary' },
    { em: T0 + 1900, passo: 'chamada', fase: 'volta', caminho: 'v3/investment-funds-secondary' },
    { em: T0 + 2200, passo: 'abriu a boleta', fundoId: VGPR, direto: false },
    { em: T0 + 3000, passo: 'chamada', fase: 'ida', caminho: 'v1/customer-suitability/<n>' },
    { em: T0 + 4800, passo: 'pre-check chegou', fundoId: VGPR },
    { em: T0 + 4900, passo: 'abriu a boleta', fundoId: TERRAX, direto: true },
    { em: T0 + 6900, passo: 'pre-check chegou', fundoId: TERRAX },
    { em: T0 + 6910, passo: 'voltou à Prateleira' },
    // Antes da rodada: não entra.
    { em: T0 - 5000, passo: 'clicou em Atualizar' }
  ]
};

describe('formatarTempos', () => {
  const texto = formatarTempos(rodada);

  it('abre com o resumo: o total, a cotação e o que cada preço acrescentou', () => {
    expect(texto).toContain('Tempos do robô do Hub');
    expect(texto).toContain('robô 1.2.0');
    expect(texto).toContain('Total: 7,0 s');
    expect(texto).toContain('Cotação: 2,0 s');
    expect(texto).toContain('Preço exato de VGPR11: 2,8 s');
    expect(texto).toContain('Preço exato de Riza Terrax: 2,0 s');
    expect(texto).toContain('Preço exato de VICA11: dispensado, não muda as cotas');
  });

  it('põe os passos da Mesa e do robô numa linha do tempo só, em ordem', () => {
    const linhas = texto.split('\n');
    const i = (trecho) => linhas.findIndex((l) => l.includes(trecho));
    expect(i('Mesa: colou o pedido')).toBeLessThan(i('Robô: clicou em Atualizar'));
    expect(i('Robô: clicou em Atualizar')).toBeLessThan(i('Hub respondeu v3/investment-funds-secondary'));
    expect(i('Robô: abriu a boleta de VGPR11')).toBeLessThan(i('Robô: o pre-check de VGPR11 chegou'));
    expect(texto).toContain('+0,2 s  Robô: clicou em Atualizar');
    expect(texto).toContain('Mesa: pediu o preço exato de VGPR11 e Riza Terrax');
  });

  it('diz onde a aba estava quando a tarefa começou, e se a boleta veio direto da anterior', () => {
    expect(texto).toContain('Robô: começou a tarefa (cotação; aba escondida; na Prateleira; com o botão Atualizar)');
    expect(texto).toContain('Robô: abriu a boleta de Riza Terrax, direto da anterior');
    expect(texto).not.toContain('Robô: abriu a boleta de VGPR11, direto');
  });

  it('diz o que começou a rodada: a colagem ou o clique em Atualizar cotações', () => {
    expect(texto).toContain('+0,0 s  Mesa: colou o pedido (3 fundo(s) com compra)');
    const clique = formatarTempos({ ...rodada, mesa: [{ em: T0, passo: 'atualizou', fundos: 3 }, ...rodada.mesa.slice(1)] });
    expect(clique).toContain('+0,0 s  Mesa: clicou em Atualizar cotações');
    expect(clique).not.toContain('colou');
  });

  it('deixa de fora o que veio antes da rodada', () => {
    expect(texto.match(/clicou em Atualizar/g)).toHaveLength(1);
  });

  it('nunca mostra número longo, como uma conta, mesmo que venha num caminho', () => {
    const comConta = formatarTempos({ ...rodada, robo: [{ em: T0 + 50, passo: 'chamada', fase: 'ida', caminho: 'v1/customer-suitability/1234567' }] });
    expect(comConta).not.toMatch(/\d{5,}/);
    expect(comConta).toContain('customer-suitability/<n>');
  });

  it('a falha aparece com o motivo', () => {
    const falhou = formatarTempos({
      ...rodada,
      mesa: [...rodada.mesa.slice(0, 6), { em: T0 + 27150, passo: 'não recebeu o preço', fundoId: TERRAX, motivo: 'sem-boleta' }]
    });
    expect(falhou).toContain('Preço exato de Riza Terrax: 22,2 s (falhou: sem-boleta)');
  });
});
