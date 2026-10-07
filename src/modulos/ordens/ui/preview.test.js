import { describe, expect, it } from 'vitest';
import { aplicarEdicao, renderCartao, resumo } from './preview.js';
import { analisarTicker } from '../core/validate/ticker.js';
import { parseSolicitacoes } from '../core/parse/parseSolicitacoes.js';

const ordem = (extra = {}) => ({
  ativo: 'PETR4',
  ticker: analisarTicker('PETR4'),
  operacao: 'C',
  quantidade: 100,
  financeiro: null,
  preco: null,
  ...extra
});

const solicitacao = (extra = {}) => ({
  conta: '7000001',
  ordens: [ordem()],
  descartadas: [],
  horario: null,
  ...extra
});

describe('renderCartao', () => {
  it('mostra os campos da ordem para conferência', () => {
    const html = renderCartao(solicitacao(), 0, ['email'], new Set());
    expect(html).toContain('value="7000001"');
    expect(html).toContain('value="PETR4"');
    expect(html).toContain('value="100"');
  });

  it('mostra o financeiro formatado no campo de valor', () => {
    const html = renderCartao(
      solicitacao({ ordens: [ordem({ quantidade: null, financeiro: 50000 })] }),
      0,
      ['twap'],
      new Set()
    );
    expect(html).toContain('value="R$ 50.000,00"');
  });

  it('só mostra os campos de horário quando o TWAP está escolhido', () => {
    expect(renderCartao(solicitacao(), 0, ['email'], new Set())).not.toContain('campo-hora-inicial');
    expect(renderCartao(solicitacao(), 0, ['twap'], new Set())).toContain('campo-hora-inicial');
  });

  it('mostra a classe do ativo por cor, para achar um BDR no meio de FIIs', () => {
    const comTicker = (t) =>
      renderCartao(
        solicitacao({ ordens: [ordem({ ativo: t, ticker: analisarTicker(t) })] }),
        0,
        ['email'],
        new Set()
      );

    expect(comTicker('PETR4')).toContain('selo ok classe-acao');
    expect(comTicker('KNCR11')).toContain('selo ok classe-fii');
    expect(comTicker('M2ST34')).toContain('selo ok classe-bdr');
    expect(comTicker('IVVB11')).toContain('selo ok classe-etf');
  });

  it('o recibo de subscrição herda a classe do papel de origem', () => {
    const s = solicitacao({ ordens: [ordem({ ativo: 'RECR12', ticker: analisarTicker('RECR12') })] });
    expect(renderCartao(s, 0, ['email'], new Set())).toContain('selo ok classe-fii');
  });

  it('marca o ticker suspeito na tabela', () => {
    const html = renderCartao(
      solicitacao({ ordens: [ordem({ ativo: 'KCNR11', ticker: analisarTicker('KCNR11') })] }),
      0,
      ['email'],
      new Set()
    );
    expect(html).toContain('selo suspeito');
  });

  it('lista as linhas descartadas em vez de sumir com elas', () => {
    const html = renderCartao(
      solicitacao({ descartadas: [{ linha: 'V - HGCR11 (Total)', motivo: 'sem quantidade' }] }),
      0,
      ['email'],
      new Set()
    );
    expect(html).toContain('V - HGCR11 (Total)');
    expect(html).toContain('fazer na mão');
  });

  it('esconde a saída atrás do bloqueio até a confirmação', () => {
    const suspeito = solicitacao({
      ordens: [ordem({ ativo: 'KCNR11', ticker: analisarTicker('KCNR11') })]
    });

    const bloqueado = renderCartao(suspeito, 0, ['email'], new Set());
    expect(bloqueado).toContain('saida bloqueada');
    expect(bloqueado).not.toContain('Prezado(a) Cliente');

    const liberado = renderCartao(suspeito, 0, ['email'], new Set(['ticker-suspeito']));
    expect(liberado).toContain('Prezado(a) Cliente');
  });

  it('escapa o texto colado pelo usuário em vez de injetá-lo como HTML', () => {
    const html = renderCartao(solicitacao({ conta: '<img src=x onerror=alert(1)>' }), 0, [], new Set());
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});

describe('resumo da cesta', () => {
  it('conta os ativos', () => {
    expect(resumo(solicitacao({ ordens: [ordem(), ordem({ ativo: 'VALE3' })] })).ativos).toBe(2);
  });

  it('informa a operação quando toda a cesta tem a mesma', () => {
    expect(resumo(solicitacao()).operacao).toBe('C');
  });

  it('acusa cesta com compra e venda misturadas', () => {
    const s = solicitacao({ ordens: [ordem(), ordem({ ativo: 'VALE3', operacao: 'V' })] });
    expect(resumo(s).operacao).toBe('misto');
  });

  it('soma o financeiro, que é a exposição total em reais', () => {
    const s = solicitacao({
      ordens: [
        ordem({ quantidade: null, financeiro: 10000 }),
        ordem({ ativo: 'VALE3', quantidade: null, financeiro: 25000 })
      ]
    });
    expect(resumo(s).financeiro).toBe(35000);
  });

  it('NUNCA soma quantidades de ativos diferentes — 100 PETR4 e 50 VALE3 não são 150 de nada', () => {
    const s = solicitacao({ ordens: [ordem({ quantidade: 100 }), ordem({ ativo: 'VALE3', quantidade: 50 })] });
    expect(resumo(s).financeiro).toBeNull();
    expect(Object.values(resumo(s))).not.toContain(150);
  });

  it('diz de quantas ordens é o total quando ele não cobre a cesta inteira', () => {
    const s = solicitacao({
      ordens: [ordem({ quantidade: null, financeiro: 10000 }), ordem({ ativo: 'VALE3', quantidade: 100 })]
    });
    expect(resumo(s)).toMatchObject({ ativos: 2, ordensComFinanceiro: 1, financeiro: 10000 });
  });

  it('não acusa nada numa solicitação sem ordens', () => {
    expect(resumo(solicitacao({ ordens: [] }))).toMatchObject({
      ativos: 0,
      operacao: null,
      financeiro: null
    });
  });

  it('aparece no cartão com o total formatado', () => {
    const s = solicitacao({
      ordens: [
        ordem({ quantidade: null, financeiro: 10000 }),
        ordem({ ativo: 'VALE3', quantidade: null, financeiro: 25000 })
      ]
    });
    const html = renderCartao(s, 0, ['twap'], new Set());
    expect(html).toContain('R$ 35.000,00');
    expect(html).toContain('2 ativos');
  });
});

describe('controles segmentados', () => {
  it('mostra as duas operações, marcando a escolhida', () => {
    const html = renderCartao(solicitacao(), 0, ['email'], new Set());
    expect(html).toContain('data-campo="operacao" data-valor="C"');
    expect(html).toContain('data-campo="operacao" data-valor="V"');
    expect(html).toMatch(/class="seg compra ativo"[^>]*data-valor="C"/);
  });

  it('marca o tipo conforme a ordem foi informada', () => {
    const porQtd = renderCartao(solicitacao(), 0, ['email'], new Set());
    expect(porQtd).toMatch(/class="seg ativo"[^>]*data-valor="quantidade"/);

    const porFin = renderCartao(
      solicitacao({ ordens: [ordem({ quantidade: null, financeiro: 50000 })] }),
      0,
      ['twap'],
      new Set()
    );
    expect(porFin).toMatch(/class="seg ativo"[^>]*data-valor="financeiro"/);
  });

  it('mostra de que linha do texto a ordem foi lida', () => {
    const s = solicitacao({ ordens: [ordem({ linha: 'C - PETR4 - 100' })] });
    expect(renderCartao(s, 0, ['email'], new Set())).toContain('Lido de: C - PETR4 - 100');
  });
});

describe('aplicarEdicao', () => {
  it('corrige a conta', () => {
    const s = solicitacao({ conta: null });
    aplicarEdicao(s, 'conta', '80000005');
    expect(s.conta).toBe('80000005');
  });

  it('reavalia o ticker ao corrigi-lo, tirando a suspeita', () => {
    const s = solicitacao({ ordens: [ordem({ ativo: 'KCNR11', ticker: analisarTicker('KCNR11') })] });
    aplicarEdicao(s, 'ativo', 'KNCR11', 0);
    expect(s.ordens[0].ativo).toBe('KNCR11');
    expect(s.ordens[0].ticker.situacao).toBe('conhecido');
  });

  it('trocar para financeiro zera a quantidade, e vice-versa', () => {
    const s = solicitacao();
    aplicarEdicao(s, 'tipo', 'financeiro', 0);
    expect(s.ordens[0].quantidade).toBeNull();
    expect(s.ordens[0].financeiro).toBe(100);

    aplicarEdicao(s, 'tipo', 'quantidade', 0);
    expect(s.ordens[0].financeiro).toBeNull();
    expect(s.ordens[0].quantidade).toBe(100);
  });

  it('lê o valor conforme o tipo escolhido', () => {
    const s = solicitacao();
    aplicarEdicao(s, 'valor', '4.900', 0);
    expect(s.ordens[0].quantidade).toBe(4900);

    aplicarEdicao(s, 'tipo', 'financeiro', 0);
    aplicarEdicao(s, 'valor', 'R$ 11.000,00', 0);
    expect(s.ordens[0].financeiro).toBe(11000);
    expect(s.ordens[0].quantidade).toBeNull();
  });

  it('esvaziar o preço volta a valer A mercado', () => {
    const s = solicitacao({ ordens: [ordem({ preco: '39,47' })] });
    aplicarEdicao(s, 'preco', '', 0);
    expect(s.ordens[0].preco).toBeNull();
  });

  it('preenche o horário do TWAP só quando digitado', () => {
    const s = solicitacao();
    aplicarEdicao(s, 'hora-inicial', '10:00');
    expect(s.horario).toEqual({ inicial: '10:00', final: '' });

    aplicarEdicao(s, 'hora-inicial', '');
    expect(s.horario).toBeNull();
  });

  // O ROA do secundário vale para o e-mail inteiro: é escolhido nos botões de copiar, ou no
  // conserto do bloqueio sem teto.
  it('escolhe o ROA zerado ou o máximo para a solicitação inteira', () => {
    const s = solicitacao();
    aplicarEdicao(s, 'roa-zerado', '');
    expect(s.semRoa).toBe(true);
    aplicarEdicao(s, 'roa-maximo', '');
    expect(s.semRoa).toBe(false);
  });
});

describe('caminho completo — do texto colado à saída na tela', () => {
  it('leva o pedido real do grupo até o e-mail gerado', () => {
    const { solicitacoes } = parseSolicitacoes(
      '[14:14, 21/09/2026] +55 11 5555-0202: 7000001\n\nCOMPRA\n\nIVVB11 - 7 qntds\n\nvia email'
    );

    const html = renderCartao(solicitacoes[0], 0, ['email'], new Set());
    expect(html).toContain('Ativo: IVVB11;');
    expect(html).toContain('Quantidade: 7;');
    expect(html).toContain('Preço: A mercado');
    expect(html).toContain('Operação: Compra');
    expect(html).toContain('na conta XP 7000001');
  });
});

describe('fundos cetipados no preview', () => {
  const comFundo = async (nomeDigitado, extra = {}) => {
    const { procurarFundo } = await import('../core/validate/fundo.js');
    return solicitacao({
      ordens: [
        ordem({ ativo: nomeDigitado, ticker: null, fundo: procurarFundo(nomeDigitado), ...extra })
      ]
    });
  };

  it('não quebra ao renderizar ordem sem ticker', async () => {
    const s = await comFundo('Riza Malls Feeder FII RL');
    expect(() => renderCartao(s, 0, ['email'], new Set())).not.toThrow();
  });

  it('marca o fundo reconhecido com selo próprio', async () => {
    const html = renderCartao(await comFundo('Riza Malls Feeder FII RL'), 0, ['email'], new Set());
    expect(html).toContain('selo ok classe-cetipado');
    expect(html).toContain('Riza Malls Feeder FII RL');
  });

  it('oferece os candidatos para escolher quando o nome é ambíguo', async () => {
    const html = renderCartao(await comFundo('Habitat'), 0, ['email'], new Set());
    expect(html).toContain('data-campo="ativo"');
    expect(html).toContain('XP Habitat Renda Imobiliária II Feeder FII RL');
    expect(html).toContain('XP Habitat Renda Imobiliária Feeder FII');
  });

  it('escolher um candidato resolve a ambiguidade', async () => {
    const s = await comFundo('Habitat');
    expect(s.ordens[0].fundo.situacao).toBe('ambiguo');

    aplicarEdicao(s, 'ativo', 'XP Habitat Renda Imobiliária II Feeder FII RL', 0);
    expect(s.ordens[0].fundo.situacao).toBe('exato');
    expect(s.ordens[0].ativo).toBe('XP Habitat Renda Imobiliária II Feeder FII RL');
  });

  it('não põe o nome do fundo em maiúsculas, como faria com um ticker', async () => {
    const s = await comFundo('Riza Malls Feeder FII RL');
    aplicarEdicao(s, 'ativo', 'Riza Viseu FII RL - Subclasse A', 0);
    expect(s.ordens[0].ativo).toBe('Riza Viseu FII RL - Subclasse A');
  });

  it('trocar um fundo por um ticker limpa o diagnóstico de fundo', async () => {
    const s = await comFundo('Riza Malls Feeder FII RL');
    aplicarEdicao(s, 'ativo', 'PETR4', 0);
    expect(s.ordens[0].fundo).toBeNull();
    expect(s.ordens[0].ticker.situacao).toBe('conhecido');
    expect(s.ordens[0].ativo).toBe('PETR4');
  });

  it('trocar um ticker por um fundo limpa o diagnóstico de ticker', () => {
    const s = solicitacao();
    aplicarEdicao(s, 'ativo', 'Riza Malls', 0);
    expect(s.ordens[0].ticker).toBeNull();
    expect(s.ordens[0].fundo.situacao).toBe('exato');
    expect(s.ordens[0].ativo).toBe('Riza Malls Feeder FII RL');
  });

  it('esconde a saída de e-mail até o nome ambíguo ser resolvido', async () => {
    const s = await comFundo('Habitat');
    const html = renderCartao(s, 0, ['email'], new Set());
    expect(html).toContain('saida bloqueada');
    expect(html).not.toContain('Prezado(a) Cliente');
  });
});

describe('nome do papel à vista', () => {
  it('mostra o nome do fundo listado junto da origem da linha', () => {
    const s = solicitacao({
      ordens: [ordem({ ativo: 'PIER11', ticker: analisarTicker('PIER11'), linha: 'PIER11 R$ 16.300,00' })]
    });
    const html = renderCartao(s, 0, ['email'], new Set());
    expect(html).toContain('Pátria Infra Energia Core Renda FIP INFRA');
    expect(html).toContain('Lido de: PIER11 R$ 16.300,00');
  });

  it('uma ação comum mostra só a origem, sem nome inventado', () => {
    const s = solicitacao({ ordens: [ordem({ linha: 'PETR4 100' })] });
    expect(renderCartao(s, 0, ['email'], new Set())).toContain('Lido de: PETR4 100');
  });
});

// O conserto de um clique da cesta mista: `XPML11 3.000`, lido como cotas numa cesta em reais,
// vira R$ 3.000,00 — o mesmo número, só o tipo muda. Quem decide é o operador, clicando.
describe('Tudo em R$', () => {
  const pedido = '1234567\ncompra\nBTLG11 3.000,00\nXPML11 3.000\nKNCR11 100 cotas';

  it('passa para financeiro só a quantidade que veio de número solto', () => {
    const s = parseSolicitacoes(pedido).solicitacoes[0];
    aplicarEdicao(s, 'tudo-em-reais', '');
    expect(s.ordens.map((o) => [o.ativo, o.quantidade, o.financeiro])).toEqual([
      ['BTLG11', null, 3000],
      ['XPML11', null, 3000],
      ['KNCR11', 100, null]
    ]);
  });

  it('some com o bloqueio da cesta mista', () => {
    const s = parseSolicitacoes(pedido).solicitacoes[0];
    expect(renderCartao(s, 0, ['email'], new Set())).toContain('data-campo="tudo-em-reais"');

    aplicarEdicao(s, 'tudo-em-reais', '');
    expect(renderCartao(s, 0, ['email'], new Set())).not.toContain('tudo-em-reais');
  });

  it('corrigir a linha à mão também tira a marca de número solto', () => {
    const s = parseSolicitacoes('1234567\ncompra\nXPML11 3.000').solicitacoes[0];
    aplicarEdicao(s, 'valor', '3000', 0);
    expect(s.ordens[0].quantidadeSolta).toBe(false);
  });
});

describe('e-mail em tabela na tela', () => {
  it('leva o pedido em reais até a tabela com a coluna Financeiro', () => {
    const { solicitacoes } = parseSolicitacoes('7000002 - compra via email\nBTLG11 - 3.000,00\nXPML11 - 3.000,00');
    const html = renderCartao(solicitacoes[0], 0, ['auditoria'], new Set());
    expect(html).toContain('E-mail em tabela');
    expect(html).toContain('>Financeiro</td>');
    expect(html).toContain('>R$ 3.000,00</td>');
  });
});

describe('botão + (acrescentar ativo)', () => {
  it('aparece no cartão', () => {
    expect(renderCartao(solicitacao(), 0, ['email'], new Set())).toContain('data-campo="adicionar-ordem"');
  });

  it('acrescenta uma linha vazia no fim, sem operação nem valor', () => {
    const s = solicitacao();
    aplicarEdicao(s, 'adicionar-ordem', '');
    expect(s.ordens).toHaveLength(2);
    expect(s.ordens[1]).toMatchObject({
      ativo: '',
      ticker: null,
      fundo: null,
      operacao: null,
      quantidade: null,
      financeiro: null,
      preco: null
    });
  });

  it('segura a saída até a linha nova ter ativo e valor', () => {
    const s = solicitacao();
    aplicarEdicao(s, 'adicionar-ordem', '');
    expect(renderCartao(s, 0, ['email'], new Set())).toContain('bloqueado');

    aplicarEdicao(s, 'ativo', 'VALE3', 1);
    aplicarEdicao(s, 'operacao', 'C', 1);
    aplicarEdicao(s, 'valor', '50', 1);
    const html = renderCartao(s, 0, ['email'], new Set());
    expect(html).not.toContain('bloqueado');
    expect(html).toContain('Ativo: VALE3;');
    expect(html).toContain('Quantidade: 50;');
  });

  it('escolher R$ antes de digitar faz o valor entrar como financeiro', () => {
    const s = solicitacao();
    aplicarEdicao(s, 'adicionar-ordem', '');
    aplicarEdicao(s, 'tipo', 'financeiro', 1);
    aplicarEdicao(s, 'valor', '16.000,00', 1);
    expect(s.ordens[1]).toMatchObject({ financeiro: 16000, quantidade: null });
  });

  it('apagar o campo de reais e digitar de novo não vira quantidade', () => {
    const s = solicitacao({ ordens: [ordem({ quantidade: null, financeiro: 3000 })] });
    aplicarEdicao(s, 'valor', '', 0);
    aplicarEdicao(s, 'valor', '5.000,00', 0);
    expect(s.ordens[0]).toMatchObject({ financeiro: 5000, quantidade: null });
  });

  it('apagar o ativo deixa a linha sem ticker e sem fundo', () => {
    const s = solicitacao();
    aplicarEdicao(s, 'ativo', '', 0);
    expect(s.ordens[0]).toMatchObject({ ativo: '', ticker: null, fundo: null });
  });
});

describe('fundo da prateleira digitado pelo ticker no cartão', () => {
  it('corrigir o ativo para VGPR11 faz dele o fundo', () => {
    const s = solicitacao();
    aplicarEdicao(s, 'ativo', 'vgpr11', 0);
    expect(s.ordens[0]).toMatchObject({ ativo: 'VGPR11', ticker: null });
    expect(s.ordens[0].fundo.fundo.nome).toBe('Valora Imobiliário Multiestratégia Premium');
  });

  it('mostra o nome do fundo ao pousar o mouse na linha', () => {
    const { solicitacoes } = parseSolicitacoes('1234567\nCompra\nVGPR11 R$ 10.000,00');
    expect(renderCartao(solicitacoes[0], 0, ['email'], new Set())).toContain('Valora Imobiliário Multiestratégia Premium');
  });
});
