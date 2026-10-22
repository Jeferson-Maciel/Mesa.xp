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
      expect(html).toContain(`<button class="copy-btn" data-copiar="${formato}" data-grupo="bolsa">Copiar</button><button class="copy-btn btn-outlook" data-outlook="${formato}"`);
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

describe("um e-mail por grupo", () => {
  const fundo = (nome, ticker = null) => ({ situacao: "exato", fundo: { nome, ticker } });
  const misto = () => ({
    conta: "1234567",
    descartadas: [],
    horario: null,
    ordens: [
      { ativo: "KLBN11", ticker: { situacao: "conhecido" }, fundo: null, operacao: "V", quantidade: 674, financeiro: null, preco: null },
      { ativo: "Brio Renda Mais FII RL", ticker: null, fundo: fundo("Brio Renda Mais FII RL"), operacao: "C", quantidade: 10, financeiro: null, preco: null },
      { ativo: "Riza Malls Feeder FII RL", ticker: null, fundo: fundo("Riza Malls Feeder FII RL"), operacao: "V", quantidade: 100, financeiro: null, preco: null, venda: { situacao: "pronto", modalidade: "xp", quantidade: 100, posicao: { disponivel: 200, aVenda: 0 }, condicoes: { aberta: true }, outraAberta: false } }
    ]
  });

  it("o pedido misto sai em três e-mails, cada um com o grupo no título", () => {
    const html = renderSaidas(misto(), ["email"], new Set());
    expect(html.match(/class="saida" data-formato="email" data-grupo="[a-z-]+"/g)).toEqual([
      "class=\"saida\" data-formato=\"email\" data-grupo=\"bolsa\"",
      "class=\"saida\" data-formato=\"email\" data-grupo=\"fundos-compra\"",
      "class=\"saida\" data-formato=\"email\" data-grupo=\"fundos-venda\""
    ]);
    expect(html).toContain(">Fundos · Venda</span>");
  });

  it("cada e-mail leva só as ordens dele, e o de venda no modelo da auditoria", () => {
    expect(gerar(misto(), "email", new Set(), { grupo: "bolsa" }).texto).toContain("Ativo: KLBN11;");
    expect(gerar(misto(), "email", new Set(), { grupo: "bolsa" }).texto).not.toContain("Brio");
    const venda = gerar(misto(), "email", new Set(), { grupo: "fundos-venda" }).texto;
    expect(venda).toContain("Operação: Venda;\n\nCondições:");
    expect(venda.endsWith("atte,")).toBe(true);
  });

  it("o e-mail de venda em HTML leva a imagem do comprovante na tag img abaixo de Condições:", () => {
    const s = misto();
    const ordemVenda = s.ordens[2];
    const prints = new Map([[ordemVenda, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA']]);
    const saida = gerar(s, "email", new Set(), { grupo: "fundos-venda", prints });
    expect(saida.html).toContain('Condições:<br><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA"');
    const htmlTela = renderSaidas(s, ["email"], new Set(), { prints });
    expect(htmlTela).toContain('<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA"');
  });

  it("o lote é só de bolsa: os fundos pelo nome ficam de fora", () => {
    const texto = gerar(misto(), "lote", new Set()).texto;
    expect(texto).toContain("KLBN11");
    expect(texto).not.toContain("Riza");
  });

  it("lote num pedido só de fundos diz por que não sai", () => {
    const s = { ...misto(), ordens: misto().ordens.slice(1) };
    expect(renderSaidas(s, ["lote"], new Set())).toContain("sem ordem de bolsa");
  });

  it("a confirmação vale para o grupo em que foi dada", () => {
    const s = misto();
    s.ordens[0].operacao = null;
    s.ordens[1].operacao = null;
    expect(gerar(s, "email", new Set(["bolsa:operacao-ausente"]), { grupo: "bolsa" })).not.toBeNull();
    expect(gerar(s, "email", new Set(["bolsa:operacao-ausente"]), { grupo: "fundos-compra" })).toBeNull();
  });

  it("o conserto de uma ordem leva o índice dela na solicitação, não no grupo", () => {
    const s = misto();
    s.ordens[2].venda = { ...s.ordens[2].venda, condicoes: { aberta: false }, outraAberta: true };
    const html = renderSaidas(s, ["email"], new Set());
    expect(html).toContain("data-campo=\"estoque-clientes\" data-valor=\"\" data-ordem=\"2\"");
  });
});

describe("o Tesouro no cartão", () => {
  const titulo = { nome: "Tesouro Selic 2031", tipo: "LFT", taxa: "SELIC + 0,0992 %", vencimento: "01/03/2031", pu: 20043.37, minimo: 200.43 };
  const comTesouro = () => ({
    conta: "1234567",
    descartadas: [],
    horario: null,
    ordens: [
      { ativo: "KLBN11", ticker: { situacao: "conhecido" }, fundo: null, operacao: "V", quantidade: 674, financeiro: null, preco: null },
      { ativo: "Tesouro Selic 2031", ticker: null, fundo: null, tesouro: { especies: ["selic"], ano: 2031 }, operacao: "C", quantidade: null, financeiro: 2000, preco: null, tesouroDoHub: { situacao: "pronto", titulo, unicoDoTipo: false, minutos: 1, lidaEm: Date.now(), foraDoHorario: false } }
    ]
  });

  it("a quarta seção, com o título, a taxa e o vencimento, e o e-mail do modelo", () => {
    const html = renderSaidas(comTesouro(), ["email"], new Set());
    expect(html).toContain('data-grupo="tesouro"');
    expect(html).toContain(">Tesouro Direto</span>");
    expect(html).toContain("SELIC + 0,0992 %");
    expect(gerar(comTesouro(), "email", new Set(), { grupo: "tesouro" }).texto).toContain("Título: Tesouro Selic 2031;\nTaxa: SELIC + 0,0992 %;\nVencimento: 01/03/2031;\nValor a ser aplicado: R$ 2.000,00");
  });

  it("o Tesouro não entra no lote nem na tabela", () => {
    expect(gerar(comTesouro(), "lote", new Set()).texto).not.toContain("Tesouro");
  });
});

describe('Baixar o lote como arquivo (F9, 22/10/2026)', () => {
  const solicitacao = {
    conta: '1234567',
    descartadas: [],
    horario: null,
    ordens: [{ ativo: 'PETR4', operacao: 'C', quantidade: 100, financeiro: null, preco: null }]
  };

  it('o Lote Simples e o Lote TWAP ganham um Baixar ao lado do Copiar', () => {
    for (const formato of ['lote', 'twap']) {
      const html = renderSaidas(solicitacao, [formato], new Set());
      expect(html).toContain(
        `<button class="copy-btn" data-copiar="${formato}" data-grupo="bolsa">Copiar</button><button class="copy-btn" data-baixar="${formato}" data-grupo="bolsa" title="Baixa um arquivo .tsv com o mesmo texto do Copiar">Baixar</button>`
      );
    }
  });

  it('os e-mails não ganham Baixar, e o lote bloqueado também não', () => {
    expect(renderSaidas(solicitacao, ['email', 'auditoria'], new Set())).not.toContain('data-baixar');
    expect(renderSaidas({ ...solicitacao, conta: null }, ['lote', 'twap'], new Set())).not.toContain('data-baixar');
  });
});
