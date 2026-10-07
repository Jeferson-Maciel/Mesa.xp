import { describe, expect, it } from 'vitest';
import { secundarioDaOrdem } from '../core/secundario/secundario.js';
import { procurarFundo } from '../core/validate/fundo.js';
import { gerar, renderSaidas } from './saidas.js';

describe('o e-mail de fundo no secundário', () => {
  const RIZA_TERRAX = 'Riza Terrax Vintage FIAgro RL';
  const estoque = {
    arquivo: 'mercado-secundario-05-10-2026-14h32.json',
    exportadaEm: new Date(2026, 9, 5, 14, 32).toISOString(),
    origem: 'hub',
    fundos: [{ nome: RIZA_TERRAX, ticker: null, pu: 98.93, casasDoPu: 2, desagio: 2.25, desagioMinimo: 1.75, corretagem: 1.5, estoque: 86116.6, aplicacaoMinima: 1000 }]
  };

  // A tela calcula `ordem.secundario` antes de renderizar; aqui se faz o mesmo.
  const comFundo = (valor, semRoa = false) => {
    const s = {
      conta: '1234567',
      descartadas: [],
      horario: null,
      semRoa,
      ordens: [{ ativo: RIZA_TERRAX, ticker: null, fundo: procurarFundo(RIZA_TERRAX), operacao: 'C', preco: null, quantidade: null, financeiro: null, ...valor }]
    };
    for (const o of s.ordens) o.secundario = secundarioDaOrdem(o, { estoque, hoje: new Date(2026, 9, 5, 14, 35), semRoa });
    return s;
  };

  it('pedido em R$ ganha um botão de copiar por cenário, e o escolhido fica marcado', () => {
    const html = renderSaidas(comFundo({ financeiro: 50000 }), ['email'], new Set());
    expect(html).toContain('data-copiar="email" data-roa="maximo" aria-pressed="true"');
    expect(html).toContain('data-copiar="email" data-roa="zerado" aria-pressed="false"');
    expect(html).toContain('Copiar · ROA máximo');
    expect(html).toContain('Copiar · ROA zerado');
    expect(html).toContain('Quantidade: 506;');
  });

  it('o texto à vista é o do cenário escolhido', () => {
    const html = renderSaidas(comFundo({ financeiro: 50000 }, true), ['email'], new Set());
    expect(html).toContain('data-roa="zerado" aria-pressed="true"');
    expect(html).toContain('Quantidade: 509;');
    expect(gerar(comFundo({ financeiro: 50000 }, true), 'email', new Set()).texto).toContain('Quantidade: 509;');
  });

  it('pedido por cotas não muda com o ROA: um botão só', () => {
    const html = renderSaidas(comFundo({ quantidade: 100 }), ['email'], new Set());
    expect(html).not.toContain('data-roa=');
    expect(html).toContain('>Copiar</button>');
  });

  // O Outlook abre o cenário à vista: um botão só, ao lado dos dois de copiar.
  it('ganha um Abrir no Outlook só, ao lado dos dois de copiar', () => {
    const html = renderSaidas(comFundo({ financeiro: 50000 }), ['email'], new Set());
    expect(html.match(/data-outlook=/g)).toHaveLength(1);
    expect(html).toMatch(/Copiar · ROA zerado<\/button><\/div><button class="copy-btn btn-outlook" data-outlook="email"/);
  });
});

describe('Abrir no Outlook', () => {
  const solicitacaoSimples = {
    conta: '1234567',
    descartadas: [],
    horario: null,
    ordens: [{ ativo: 'IVVB11', operacao: 'C', quantidade: 7, financeiro: null, preco: null }]
  };

  it('fica ao lado do Copiar nos dois e-mails', () => {
    for (const formato of ['email', 'auditoria']) {
      const html = renderSaidas(solicitacaoSimples, [formato], new Set());
      expect(html).toContain(`<button class="copy-btn" data-copiar="${formato}">Copiar</button><button class="copy-btn btn-outlook" data-outlook="${formato}"`);
      expect(html).toContain('>Abrir no Outlook</button>');
    }
  });

  it('não aparece nos lotes, que vão para a planilha', () => {
    const html = renderSaidas(solicitacaoSimples, ['lote', 'twap'], new Set());
    expect(html).not.toContain('data-outlook');
  });

  it('não aparece enquanto o e-mail está bloqueado', () => {
    const html = renderSaidas({ ...solicitacaoSimples, conta: null }, ['email'], new Set());
    expect(html).toContain('bloqueado');
    expect(html).not.toContain('data-outlook');
  });
});

const solicitacao = (ordem) => ({
  conta: '1234567',
  descartadas: [],
  horario: null,
  ordens: [{ ativo: 'IVVB11', operacao: 'C', quantidade: 7, financeiro: null, preco: null, ...ordem }]
});

describe('gerar', () => {
  // A tabela vai em HTML para chegar em grade no Outlook; o texto com TAB vai junto, para onde
  // HTML não entra.
  it('entrega a auditoria em tabela e em texto com TAB', () => {
    const saida = gerar(solicitacao(), 'auditoria', new Set());
    expect(saida.html).toContain('<table');
    expect(saida.texto).toContain('\nIVVB11\tC\tA mercado\t7\n');
  });

  it('entrega os outros formatos só em texto', () => {
    expect(gerar(solicitacao(), 'lote', new Set()).html).toBeNull();
  });

  // A comporta não pode depender de o botão estar escondido: confirmar um bloqueio que não se
  // confirma escreveria `null` na coluna Qtd. Total.
  it('ignora a confirmação de um bloqueio que não é confirmável', () => {
    const porValor = solicitacao({ quantidade: null, financeiro: 50000 });
    expect(gerar(porValor, 'lote', new Set(['financeiro-em-lote-simples']))).toBeNull();
  });

  it('gera o e-mail em tabela de uma ordem por valor, com a coluna Financeiro', () => {
    const saida = gerar(solicitacao({ quantidade: null, financeiro: 50000 }), 'auditoria', new Set());
    expect(saida.texto).toContain('\nIVVB11\tC\tA mercado\tR$ 50.000,00\n');
    expect(saida.html).toContain('Financeiro');
  });
});
