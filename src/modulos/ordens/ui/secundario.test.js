import { describe, expect, it } from 'vitest';
import { procurarFundo } from '../core/validate/fundo.js';
import { secundarioDaOrdem } from '../core/secundario/secundario.js';
import { renderSecundario } from './secundario.js';

const RIZA_TERRAX = 'Riza Terrax Vintage FIAgro RL';
const hoje = new Date(2026, 9, 5, 16, 0);
const estoque = {
  arquivo: 'mercado-secundario-05-10-2026.xlsx',
  exportadaEm: new Date(2026, 9, 5, 14, 32).toISOString(),
  fundos: [{ nome: RIZA_TERRAX, ticker: null, pu: 98.93, casasDoPu: 2, desagio: 2.25, estoque: 86116.6, aplicacaoMinima: 1000 }]
};
const doHub = (extra = {}) => ({ ...estoque, origem: 'hub', fundos: [{ ...estoque.fundos[0], desagioMinimo: 1.75, corretagem: 1.5, ...extra }] });
const tetos = { 'riza terrax vintage fiagro rl': { teto: 0.5, desagio: 2.25, em: '2026-10-05' } };

const cartao = (extra = {}, contexto = {}) => {
  const ordem = {
    ativo: RIZA_TERRAX,
    ticker: null,
    fundo: procurarFundo(RIZA_TERRAX),
    operacao: 'C',
    quantidade: null,
    financeiro: 16000,
    ...extra
  };
  ordem.secundario = secundarioDaOrdem(ordem, { estoque, tetos, hoje, ...contexto });
  return renderSecundario({ ordens: [ordem] });
};

// O texto de uma linha de cenário, sem as tags: "ROA máximo no e-mail 1,75% 162 ≈ R$ …".
const linhaDe = (html, cenario) => {
  const achada = html.match(new RegExp(`data-cenario="${cenario}"[^>]*>(.*?)</div>`, 's'));
  return achada ? achada[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null;
};

describe('renderSecundario', () => {
  it('não aparece sem compra de fundo', () => {
    expect(renderSecundario({ ordens: [{ ativo: 'PETR4', secundario: null }] })).toBe('');
  });

  it('mostra os números do fundo, o pedido e os dois cenários da boleta', () => {
    const html = cartao();
    expect(html).toContain('planilha de 05/10 às 14:32');
    expect(html).toContain('PU R$ 98,93 · deságio 2,25% · corretagem 1,50%');
    expect(html).toContain('value="0,50"');
    expect(html).toContain('pedido R$ 16.000,00');
    expect(linhaDe(html, 'maximo')).toMatch(/^ROA máximo no e-mail 1,75% 162 ≈ R\$ [\d.]+,\d\d ≈ R\$ [\d.]+,\d\d 2,00%$/);
    expect(linhaDe(html, 'zerado')).toMatch(/^ROA zerado 2,25% 16[23] ≈ R\$ /);
    expect(html).not.toContain('data-campo="sem-roa"');
  });

  // Os dois cenários em colunas, para comparar de relance — cotas com cotas, valor com valor.
  it('põe os cenários numa tabela, com o cabeçalho de cada coluna', () => {
    const html = cartao();
    expect(html).toContain('role="table"');
    for (const coluna of ['Desconto do cliente', 'Cotas', 'Cliente paga', 'Escritório']) {
      expect(html).toContain(`role="columnheader">${coluna}</span>`);
    }
  });

  it('marca o cenário que vai no e-mail', () => {
    expect(cartao()).toContain('class="secundario-cenario escolhido" data-cenario="maximo"');
    expect(cartao({}, { semRoa: true })).toContain('class="secundario-cenario escolhido" data-cenario="zerado"');
    expect(linhaDe(cartao({}, { semRoa: true }), 'zerado')).toMatch(/^ROA zerado no e-mail /);
    expect(linhaDe(cartao({}, { semRoa: true }), 'maximo')).not.toContain('no e-mail');
  });

  it('sem teto, pede o ROA máximo — e o zerado continua de pé', () => {
    const html = cartao({}, { tetos: {} });
    expect(linhaDe(html, 'maximo')).toContain('falta o ROA máximo');
    expect(html).toContain('value=""');
    expect(linhaDe(html, 'zerado')).toMatch(/^ROA zerado 2,25% /);
  });

  it('fundo com ágio: o desconto do cliente aparece como ágio', () => {
    const html = cartao({}, { estoque: doHub({ desagio: -0.5, desagioMinimo: -0.5 }), tetos: {} });
    expect(linhaDe(html, 'unico')).toMatch(/^Sem ROA adicional ágio 0,50% /);
  });

  it('com o teto do Hub, mostra o número e não pede anotação', () => {
    const html = cartao({}, { estoque: doHub(), tetos: {} });
    expect(html).toContain('captura de 05/10 às 14:32');
    expect(html).toContain('ROA até 0,50% do Hub');
    expect(html).not.toContain('campo-teto');
  });

  it('fundo sem ROA adicional: um cenário só', () => {
    const html = cartao({}, { estoque: doHub({ desagioMinimo: 2.25 }), tetos: {} });
    expect(html).toContain('Sem ROA adicional');
    expect(html).not.toContain('data-cenario="zerado"');
  });

  it('enquanto o robô busca a cotação, o bloco diz que ela está a caminho', () => {
    const ordem = { ativo: RIZA_TERRAX, ticker: null, fundo: procurarFundo(RIZA_TERRAX), operacao: 'C', quantidade: null, financeiro: 16000 };
    ordem.secundario = secundarioDaOrdem(ordem, { estoque, tetos, hoje });
    expect(renderSecundario({ ordens: [ordem], buscandoCotacao: true })).toContain('buscando cotações no Hub…');

    const semNada = { ...ordem };
    semNada.secundario = secundarioDaOrdem(semNada, { estoque: null, hoje });
    const html = renderSecundario({ ordens: [semNada], buscandoCotacao: true });
    expect(html).toContain('buscando cotações no Hub…');
    expect(html).not.toContain('Sem os fundos do secundário');
  });

  it('com o preço exato da cota, mostra o PU inteiro e tira o "≈" dos valores', () => {
    const exato = { ...doHub(), fundos: [{ ...doHub().fundos[0], id: 'f1', dataDaCota: '2026-10-01' }] };
    const cotas = { f1: { valor: 98.932175, dataDaCota: '2026-10-01' } };
    const html = cartao({}, { estoque: exato, tetos: {}, cotas });
    expect(html).toContain('PU R$ 98,932175 exato');
    expect(linhaDe(html, 'maximo')).toMatch(/^ROA máximo no e-mail 1,75% 162 R\$ /);
    expect(html).not.toContain('≈');

    expect(linhaDe(cartao({}, { estoque: exato, tetos: {} }), 'maximo')).toContain('≈ R$');
  });

  it('sem planilha, diz onde carregar', () => {
    expect(cartao({}, { estoque: null })).toContain('Sem os fundos do secundário');
  });
});
