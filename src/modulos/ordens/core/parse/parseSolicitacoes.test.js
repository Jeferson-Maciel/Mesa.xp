import { describe, expect, it } from 'vitest';
import { parseSolicitacoes } from './parseSolicitacoes.js';

const uma = (texto) => {
  const { solicitacoes } = parseSolicitacoes(texto);
  expect(solicitacoes).toHaveLength(1);
  return solicitacoes[0];
};

describe('conta', () => {
  it('lê a conta numa linha isolada', () => {
    expect(uma('7000001\nCOMPRA\nIVVB11 - 7').conta).toBe('7000001');
  });

  it('extrai só o código quando o nome vem colado', () => {
    expect(uma('80000005 - Fulana\nCOMPRA\nPETR4 100').conta).toBe('80000005');
  });

  it('lê a conta rotulada', () => {
    expect(uma('Conta XP 80000008\nCOMPRA\nPETR4 100').conta).toBe('80000008');
    expect(uma('Cliente: 80000008\nCOMPRA\nPETR4 100').conta).toBe('80000008');
  });

  it('aceita de 5 a 8 dígitos', () => {
    expect(uma('700003\nV\nPETR4 100').conta).toBe('700003');
    expect(uma('80000004\nV\nPETR4 100').conta).toBe('80000004');
  });

  it('nunca confunde a quantidade com a conta', () => {
    expect(uma('7000001\nCOMPRA\n300 COIN11').ordens[0].quantidade).toBe(300);
  });

  it('fica sem conta quando nenhuma foi informada', () => {
    expect(uma('COMPRA\nPETR4 100').conta).toBeNull();
  });
});

describe('várias contas no mesmo bloco', () => {
  it('abre uma solicitação por conta', () => {
    const { solicitacoes } = parseSolicitacoes('700003\nC\nPETR4 100\n7000001\nV\nVALE3 50');
    expect(solicitacoes.map((s) => s.conta)).toEqual(['700003', '7000001']);
    expect(solicitacoes[0].ordens.map((o) => o.ativo)).toEqual(['PETR4']);
    expect(solicitacoes[1].ordens.map((o) => o.ativo)).toEqual(['VALE3']);
  });

  it('não vaza a operação de uma conta para a outra', () => {
    const { solicitacoes } = parseSolicitacoes('700003\nC\nPETR4 100\n7000001\nV\nVALE3 50');
    expect(solicitacoes[0].ordens[0].operacao).toBe('C');
    expect(solicitacoes[1].ordens[0].operacao).toBe('V');
  });
});

describe('operação', () => {
  it.each([
    ['COMPRA', 'C'],
    ['Compra', 'C'],
    ['comprar', 'C'],
    ['C', 'C'],
    ['VENDA', 'V'],
    ['Vender', 'V'],
    ['V', 'V']
  ])('lê %j como %s', (texto, esperado) => {
    expect(uma('7000001\n' + texto + '\nPETR4 100').ordens[0].operacao).toBe(esperado);
  });

  it('lê a operação no começo da linha do ativo', () => {
    expect(uma('80000006\nC - M2ST34 - R$ 50.000,00').ordens[0].operacao).toBe('C');
  });

  it('a operação da linha vence a global', () => {
    expect(uma('7000001\nCOMPRA\nV - PETR4 - 100').ordens[0].operacao).toBe('V');
  });

  it('não lê o C de COIN11 como compra', () => {
    expect(uma('7000001\nVENDA\n300 COIN11').ordens[0].operacao).toBe('V');
  });
});

describe('ativo, quantidade e financeiro', () => {
  it('não confunde o 11 do ticker com quantidade', () => {
    const o = uma('7000001\nCOMPRA\nIVVB11 - 7 qntds').ordens[0];
    expect(o.ativo).toBe('IVVB11');
    expect(o.quantidade).toBe(7);
    expect(o.financeiro).toBeNull();
  });

  it('lê financeiro sem virar quantidade', () => {
    const o = uma('80000006\nAuditar via e-mail\nC - M2ST34 - R$ 50.000,00').ordens[0];
    expect(o.ativo).toBe('M2ST34');
    expect(o.financeiro).toBe(50000);
    expect(o.quantidade).toBeNull();
  });

  it('aplica o financeiro global com "cada" a cada ativo', () => {
    const s = uma('7000001\ncompra R$ 10.000,00 cada\nPETR4\nVALE3');
    expect(s.ordens.map((o) => o.financeiro)).toEqual([10000, 10000]);
    expect(s.ordens.map((o) => o.quantidade)).toEqual([null, null]);
  });

  it('preserva a ordem de digitação dos ativos', () => {
    const s = uma('7000001\nCOMPRA\nVALE3 10\nPETR4 20\nABEV3 30');
    expect(s.ordens.map((o) => o.ativo)).toEqual(['VALE3', 'PETR4', 'ABEV3']);
  });

  it('não soma o ativo repetido', () => {
    const s = uma('7000001\nCOMPRA\nPETR4 100\nPETR4 50');
    expect(s.ordens).toHaveLength(2);
    expect(s.ordens.map((o) => o.quantidade)).toEqual([100, 50]);
  });

  it('deixa o preço nulo quando não informado, para o formatador pôr A mercado', () => {
    expect(uma('7000001\nCOMPRA\nPETR4 100').ordens[0].preco).toBeNull();
  });

  it('preserva o preço informado sem arredondar', () => {
    expect(uma('7000001\nCOMPRA\nPETR4 100 preço 39,47').ordens[0].preco).toBe('39,47');
  });

  it('carrega o diagnóstico do ticker junto da ordem', () => {
    expect(uma('7000001\nCOMPRA\nKCNR11 100').ordens[0].ticker.situacao).toBe('parecido');
  });
});

describe('fora de escopo — descartado, nunca adivinhado', () => {
  it('descarta a linha sem quantidade nem financeiro', () => {
    const s = uma('700003\nV - HGCR11 (Total)');
    expect(s.ordens).toHaveLength(0);
    expect(s.descartadas).toHaveLength(1);
    expect(s.descartadas[0].linha).toBe('V - HGCR11 (Total)');
  });

  it('descarta o ativo sem ticker', () => {
    const s = uma('80000004\nVenda total via e-mail\nBGR Galpões Logísticos I Feeder FII');
    expect(s.ordens).toHaveLength(0);
    expect(s.descartadas.map((d) => d.linha)).toContain('BGR Galpões Logísticos I Feeder FII');
  });

  it('descarta as dez vendas totais do pedido real, sem inventar quantidade', () => {
    const s = uma(
      [
        '700003',
        '',
        'V - HGCR11 (Total)',
        'V - HGLG11 (Total)',
        'V - HGRE11 (Total)',
        'V - HGRU11 (Total)',
        'V - PCIP11 (Total)',
        'V - RECR11 (Total)',
        'V - RECR12 (Total)',
        'V - RZTR11 (Total)',
        'V - VGIP11 (Total)',
        'V - VRTA11 (Total)'
      ].join('\n')
    );
    expect(s.ordens).toHaveLength(0);
    expect(s.descartadas).toHaveLength(10);
  });

  it('dá o motivo de cada descarte', () => {
    const s = uma('700003\nV - HGCR11 (Total)');
    expect(s.descartadas[0].motivo).toMatch(/quantidade|financeiro/i);
  });
});

describe('formatos de saída pedidos no texto', () => {
  it('reconhece "via email"', () => {
    expect(uma('7000001\nCOMPRA\nIVVB11 - 7\nvia email').saidas.email).toBe(true);
  });

  it('reconhece auditoria', () => {
    const s = uma('80000006\nAuditar via e-mail\nC - M2ST34 - R$ 50.000,00');
    expect(s.saidas.auditoria).toBe(true);
    expect(s.saidas.email).toBe(false);
  });

  it('reconhece twap e lote', () => {
    expect(uma('7000001\nCOMPRA twap\nPETR4 100').saidas.twap).toBe(true);
    expect(uma('7000001\nCOMPRA lote\nPETR4 100').saidas.lote).toBe(true);
  });

  it('não pede saída nenhuma quando o texto não diz', () => {
    const s = uma('7000001\nCOMPRA\nPETR4 100');
    expect(s.saidas).toEqual({ email: false, auditoria: false, lote: false, twap: false });
  });
});

describe('horário do TWAP', () => {
  it('lê o intervalo informado', () => {
    const s = uma('7000001\nCOMPRA twap das 10h às 15h\nPETR4 100');
    expect(s.horario).toEqual({ inicial: '10:00', final: '15:00' });
  });

  it('lê horário com minutos', () => {
    const s = uma('7000001\nCOMPRA twap 10:30 as 16:45\nPETR4 100');
    expect(s.horario).toEqual({ inicial: '10:30', final: '16:45' });
  });

  it('fica sem horário quando não informado', () => {
    expect(uma('7000001\nCOMPRA twap\nPETR4 100').horario).toBeNull();
  });

  it('JAMAIS lê o horário do carimbo do WhatsApp como horário da ordem', () => {
    const s = uma('[13:46, 21/09/2026] Paulo Mendes: 7000001\nCOMPRA twap\nPETR4 100');
    expect(s.horario).toBeNull();
  });
});

describe('bloco real colado do grupo', () => {
  const bloco = [
    '[14:03, 21/09/2026] Mônica Araújo: 80000006',
    '',
    'Auditar via e-mail ',
    'C - M2ST34 - R$ 50.000,00',
    'Enviado mesa',
    '[14:14, 21/09/2026] +55 11 5555-0202: 7000001',
    '',
    'COMPRA ',
    '',
    'IVVB11 - 7 qntds',
    '',
    'via email'
  ].join('\n');

  it('separa as duas contas e lê cada ordem corretamente', () => {
    const { solicitacoes } = parseSolicitacoes(bloco);
    expect(solicitacoes).toHaveLength(2);

    expect(solicitacoes[0]).toMatchObject({ conta: '80000006' });
    expect(solicitacoes[0].saidas.auditoria).toBe(true);
    expect(solicitacoes[0].ordens[0]).toMatchObject({
      ativo: 'M2ST34',
      operacao: 'C',
      financeiro: 50000,
      quantidade: null
    });

    expect(solicitacoes[1]).toMatchObject({ conta: '7000001' });
    expect(solicitacoes[1].saidas.email).toBe(true);
    expect(solicitacoes[1].ordens[0]).toMatchObject({
      ativo: 'IVVB11',
      operacao: 'C',
      quantidade: 7,
      financeiro: null
    });
  });
});

describe('fundos cetipados — identificados pelo nome', () => {
  it('reconhece o fundo pelo nome quando há valor na linha', () => {
    const s = uma('80000004\nCOMPRA\nBGR Galpões Logísticos I Feeder FII - R$ 50.000,00');
    expect(s.ordens).toHaveLength(1);
    expect(s.ordens[0]).toMatchObject({
      ativo: 'BGR Galpões Logísticos I Feeder FII',
      operacao: 'C',
      financeiro: 50000,
      quantidade: null
    });
    expect(s.ordens[0].fundo.situacao).toBe('exato');
    expect(s.ordens[0].ticker).toBeNull();
  });

  it('lê a operação na frente do nome, como nos tickers', () => {
    const s = uma('80000004\nC - Riza Malls - R$ 20.000,00');
    expect(s.ordens[0]).toMatchObject({ ativo: 'Riza Malls Feeder FII RL', operacao: 'C' });
  });

  it('aceita fundo por quantidade de cotas', () => {
    const s = uma('80000004\nCOMPRA\nRiza Malls Feeder FII RL - 1000 cotas');
    expect(s.ordens[0]).toMatchObject({ quantidade: 1000, financeiro: null });
  });

  it('guarda o nome da prateleira, não o que foi digitado por cima', () => {
    const s = uma('80000004\nCOMPRA\nriza malls - R$ 20.000,00');
    expect(s.ordens[0].ativo).toBe('Riza Malls Feeder FII RL');
  });

  it('carrega a aplicação mínima junto, para o validador avisar', () => {
    const s = uma('80000004\nCOMPRA\nRiza Malls - 10 cotas');
    expect(s.ordens[0].fundo.fundo.aplicacaoMinima).toBe(1000);
  });

  it('vira ordem mesmo com nome ambíguo, para o operador escolher no preview', () => {
    const s = uma('80000004\nCOMPRA\nHabitat - R$ 10.000,00');
    expect(s.ordens).toHaveLength(1);
    expect(s.ordens[0].fundo.situacao).toBe('ambiguo');
    expect(s.ordens[0].fundo.candidatos.length).toBe(3);
  });

  it('não inventa fundo quando o nome não bate com a prateleira', () => {
    const s = uma('80000004\nCOMPRA\nFundo Inexistente do Banco X - R$ 10.000,00');
    expect(s.ordens).toHaveLength(0);
    expect(s.descartadas[0].motivo).toMatch(/prateleira|não encontrad/i);
  });

  it('continua descartando fundo sem valor nenhum', () => {
    const s = uma('80000004\nVenda total via e-mail\nBGR Galpões Logísticos I Feeder FII');
    expect(s.ordens).toHaveLength(0);
    expect(s.descartadas).toHaveLength(1);
  });

  it('não confunde linha de formato com nome de fundo', () => {
    const s = uma('80000004\nCOMPRA\nvia email\nRiza Malls - R$ 20.000,00');
    expect(s.ordens.map((o) => o.ativo)).toEqual(['Riza Malls Feeder FII RL']);
  });

  it('mistura ticker e fundo na mesma solicitação', () => {
    const s = uma('80000004\nCOMPRA\nPETR4 100\nRiza Malls - R$ 20.000,00');
    expect(s.ordens.map((o) => o.ativo)).toEqual(['PETR4', 'Riza Malls Feeder FII RL']);
    expect(s.ordens[0].ticker).not.toBeNull();
    expect(s.ordens[1].fundo).not.toBeNull();
  });
});

describe('preço na linha — os defeitos do relatório de 22/09', () => {
  it.each([
    'PETR4 100 a 39,50',
    'PETR4 100 @ 39,50',
    'PETR4 100 limite 39,50',
    'PETR4 100 por 39,50',
    'PETR4 100 a R$ 39,50',
    'PETR4 100 preço 39,50'
  ])('lê o preço em %j sem perder a quantidade', (linhaDoAtivo) => {
    const o = uma('1234567\nCOMPRA\n' + linhaDoAtivo).ordens[0];
    expect(o.preco).toBe('39,50');
    expect(o.quantidade).toBe(100);
    expect(o.financeiro).toBeNull();
    expect(o.numerosSobrando).toEqual([]);
  });

  it('NUNCA deixa uma ordem limite virar ordem a mercado em silêncio', () => {
    const o = uma('1234567\nCOMPRA\nPETR4 100 a 39,50').ordens[0];
    expect(o.preco).not.toBeNull();
  });

  it('um número que ninguém explicou fica registrado em vez de sumir', () => {
    const o = uma('1234567\nCOMPRA\nPETR4 - 100 - 39,50').ordens[0];
    expect(o.quantidade).toBe(100);
    expect(o.numerosSobrando).toEqual(['39,50']);
  });

  it('dois números soltos não são resolvidos por palpite', () => {
    expect(uma('1234567\nCOMPRA\nPETR4 100 200').ordens[0].numerosSobrando).toEqual(['200']);
  });

  it('quantidade com R$ na linha registra a sobra em vez de perder a quantidade', () => {
    const o = uma('1234567\nCOMPRA\nPETR4 100 R$ 39,50').ordens[0];
    expect(o.numerosSobrando).toEqual(['100']);
  });

  it('as linhas normais não sobram número nenhum', () => {
    for (const linhaDoAtivo of [
      'PETR4 100',
      'IVVB11 - 7 qntds',
      'C - M2ST34 - R$ 50.000,00',
      'PETR4 4.900 ações',
      'PETR4 100 a mercado',
      'JGPT11    R$ 15.000,00'
    ]) {
      const s = uma('1234567\nCOMPRA\n' + linhaDoAtivo);
      expect(s.ordens[0].numerosSobrando, linhaDoAtivo).toEqual([]);
    }
  });

  it('o nome do fundo com dígito não vira número sobrando', () => {
    const o = uma('1234567\nCOMPRA\nXP CDI 99 FOF Private Jun/27 FII RL - R$ 50.000,00').ordens[0];
    expect(o.numerosSobrando).toEqual([]);
    expect(o.financeiro).toBe(50000);
  });
});

// Pedido real de 28/09, colado como chegou. Saía com as seis ordens sem operação e lidas como
// 3.000, 5.000 e 1.000 **cotas**: o texto depois da conta era jogado fora como se fosse o nome do
// cliente, e sem `R$` todo número virava quantidade.
describe('pedido real — cesta em reais sem R$, operação na linha da conta', () => {
  const pedido = [
    '7000002 - compra via email',
    '',
    'BTLG11 - 3.000,00 ',
    'XPML11 - 3.000,00',
    'KNSC11 - 5.000,00',
    'KNCR11 -  5.000,00',
    'MCRE11 - 1.000,00',
    'AFHI11 - 1.000,00'
  ].join('\n');

  it('lê a conta e a compra da mesma linha', () => {
    const s = uma(pedido);
    expect(s.conta).toBe('7000002');
    expect(s.ordens.map((o) => o.operacao)).toEqual(['C', 'C', 'C', 'C', 'C', 'C']);
  });

  it('lê cada valor como financeiro, nunca como quantidade', () => {
    const s = uma(pedido);
    expect(s.ordens.map((o) => [o.ativo, o.financeiro, o.quantidade])).toEqual([
      ['BTLG11', 3000, null],
      ['XPML11', 3000, null],
      ['KNSC11', 5000, null],
      ['KNCR11', 5000, null],
      ['MCRE11', 1000, null],
      ['AFHI11', 1000, null]
    ]);
  });

  it('não deixa número sobrando nem descarte', () => {
    const s = uma(pedido);
    expect(s.ordens.every((o) => o.numerosSobrando.length === 0)).toBe(true);
    expect(s.descartadas).toEqual([]);
  });

  it('"via email" marca os dois e-mails: o de texto e o em tabela', () => {
    expect(uma(pedido).saidas).toMatchObject({ email: true, auditoria: true });
  });
});

describe('linha da conta', () => {
  it.each([
    ['7000002 compra via email', 'C'],
    ['7000002 - Venda', 'V'],
    ['Conta: 7000002 - compra', 'C']
  ])('lê a operação escrita junto da conta em %j', (linhaDaConta, operacao) => {
    const s = uma(linhaDaConta + '\nBTLG11 100');
    expect(s.conta).toBe('7000002');
    expect(s.ordens[0].operacao).toBe(operacao);
  });

  it('lê a conta com o nome do cliente sem traço', () => {
    expect(uma('7000002 Fulana\nC - PETR4 - 100').conta).toBe('7000002');
  });

  it.each(['cc 7000002', 'CC: 7000002', 'código 7000002', 'cód. 7000002', 'cod 7000002', 'conta nº 7000002'])(
    'lê a conta rotulada como %j',
    (linhaDaConta) => expect(uma(linhaDaConta + '\ncompra\nPETR4 100').conta).toBe('7000002')
  );

  // O nome do cliente vem colado na conta, e uma letra solta nele não pode virar operação.
  it('não lê operação na letra solta do nome do cliente', () => {
    expect(uma('1234567 - Carlos V. Silva\nPETR4 100').ordens[0].operacao).toBeNull();
  });

  it('lê o valor que vale para todos quando vem na linha da conta', () => {
    const s = uma('1234567 - compra R$ 3.000,00 cada\nPETR4\nVALE3');
    expect(s.ordens.map((o) => o.financeiro)).toEqual([3000, 3000]);
    expect(s.ordens.map((o) => o.operacao)).toEqual(['C', 'C']);
  });

  // `10000 - PETR4` era lido como a conta 10000: abria uma solicitação nova e o PETR4 sumia sem
  // ir para os descartes.
  it('não lê como conta uma linha que tem ticker', () => {
    const s = uma('1234567\ncompra\nBTLG11 100\n10000 - PETR4');
    expect(s.conta).toBe('1234567');
    expect(s.ordens.map((o) => [o.ativo, o.quantidade])).toEqual([
      ['BTLG11', 100],
      ['PETR4', 10000]
    ]);
  });

  it.each(['50000 reais cada', '10000 cotas cada'])('não lê %j como conta: é valor', (linha) => {
    expect(uma('1234567\ncompra\n' + linha + '\nPETR4').conta).toBe('1234567');
  });

  // Com conta, ativo e valor na mesma linha, o número da frente tanto pode ser a conta quanto a
  // quantidade. Ler 1234567 como quantidade daria uma ordem de mais de um milhão de cotas.
  it('descarta a linha que começa com número de conta e traz ativo e valor', () => {
    const s = uma('7654321\ncompra\n1234567 - BTLG11 - 3.000,00');
    expect(s.ordens).toEqual([]);
    expect(s.descartadas[0].motivo).toMatch(/conta/);
  });
});

describe('operação por seção', () => {
  // Saía tudo como Compra: a operação do bloco era a primeira palavra encontrada no texto inteiro.
  it('aplica cada cabeçalho às linhas de baixo', () => {
    const s = uma('1234567\nVenda:\nXPML11 - 100\nHGLG11 - 50\nCompra:\nBTLG11 - 100');
    expect(s.ordens.map((o) => [o.ativo, o.operacao])).toEqual([
      ['XPML11', 'V'],
      ['HGLG11', 'V'],
      ['BTLG11', 'C']
    ]);
  });

  it('a operação escrita na própria linha vale mais que a seção', () => {
    const s = uma('1234567\nCompra:\nV - XPML11 - 100\nBTLG11 - 100');
    expect(s.ordens.map((o) => o.operacao)).toEqual(['V', 'C']);
  });

  it('um cabeçalho só vale para o bloco inteiro, mesmo escrito depois das ordens', () => {
    const s = uma('1234567\nXPML11 100\nBTLG11 100\ncompra');
    expect(s.ordens.map((o) => o.operacao)).toEqual(['C', 'C']);
  });

  it('linha acima do primeiro de dois cabeçalhos diferentes fica sem operação', () => {
    const s = uma('1234567\nXPML11 100\nVenda:\nBTLG11 100\nCompra:\nPETR4 100');
    expect(s.ordens.map((o) => o.operacao)).toEqual([null, 'V', 'C']);
  });

  it('"compra e venda" no mesmo cabeçalho não escolhe nenhuma das duas', () => {
    const s = uma('1234567 - compra e venda\nXPML11 100\nBTLG11 100');
    expect(s.ordens.map((o) => o.operacao)).toEqual([null, null]);
  });
});

describe('palavras de operação', () => {
  it.each([
    ['compre', 'C'],
    ['compro', 'C'],
    ['aplicação', 'C'],
    ['aplicar', 'C'],
    ['aporte', 'C'],
    ['vende', 'V'],
    ['vendo', 'V'],
    ['resgate', 'V'],
    ['resgatar', 'V'],
    ['saída', 'V'],
    ['saida', 'V']
  ])('lê %j como %s', (palavra, operacao) => {
    expect(uma(`1234567\n${palavra}\nBTLG11 100`).ordens[0].operacao).toBe(operacao);
  });
});

describe('formas de escrever o valor', () => {
  it.each([
    ['BTLG11 3.000,00', 3000],
    ['BTLG11: 3.000,00', 3000],
    ['BTLG11 3000,00', 3000],
    ['3.000,00 de BTLG11', 3000],
    ['BTLG11 3.000 reais', 3000],
    ['BTLG11 valor 3.000', 3000],
    ['BTLG11 3 mil', 3000],
    ['BTLG11 R$ 3 mil', 3000],
    ['BTLG11 3k', 3000]
  ])('lê %j como financeiro', (linha, valor) => {
    const o = uma('1234567\ncompra\n' + linha).ordens[0];
    expect(o).toMatchObject({ ativo: 'BTLG11', financeiro: valor, quantidade: null });
    expect(o.numerosSobrando).toEqual([]);
  });

  it.each([
    ['BTLG11 1 mil cotas', 1000],
    ['BTLG11 - 100', 100],
    ['BTLG11 3.000', 3000]
  ])('lê %j como quantidade', (linha, valor) => {
    expect(uma('1234567\ncompra\n' + linha).ordens[0]).toMatchObject({ quantidade: valor, financeiro: null });
  });

  it('lê o valor global sem R$ que vale para cada ativo', () => {
    const s = uma('1234567\ncompra 3.000,00 cada\nBTLG11\nXPML11');
    expect(s.ordens.map((o) => o.financeiro)).toEqual([3000, 3000]);
  });

  it('marca a quantidade que veio de número solto', () => {
    const s = uma('1234567\ncompra\nBTLG11 3.000\nXPML11 100 cotas\nKNCR11 3.000,00');
    expect(s.ordens.map((o) => o.quantidadeSolta)).toEqual([true, false, false]);
  });

  it('lê o valor novo também no fundo cetipado', () => {
    for (const valor of ['3 mil', '3.000,00', '3.000 reais', 'valor 3.000']) {
      const o = uma('80000004\nCOMPRA\nRiza Malls - ' + valor).ordens[0];
      expect(o, valor).toMatchObject({ ativo: 'Riza Malls Feeder FII RL', financeiro: 3000 });
    }
  });
});

describe('formatação colada do WhatsApp', () => {
  it('lê a lista numerada sem tomar a numeração por quantidade', () => {
    const s = uma('1234567\ncompra\n1. BTLG11 - 100\n2. XPML11 - 200');
    expect(s.ordens.map((o) => [o.ativo, o.quantidade, o.numerosSobrando.length])).toEqual([
      ['BTLG11', 100, 0],
      ['XPML11', 200, 0]
    ]);
  });

  it('lê o ticker em negrito', () => {
    expect(uma('1234567\n*compra*\n*BTLG11* - 100').ordens[0]).toMatchObject({ ativo: 'BTLG11', operacao: 'C' });
  });
});

// Lia só o primeiro ativo, como Compra (a primeira palavra achada), e perdia o segundo.
describe('dois ativos na mesma linha', () => {
  it('descarta a linha com o motivo, em vez de ler um e perder o outro', () => {
    const s = uma('1234567\nvender XPML11 100 e comprar BTLG11 100');
    expect(s.ordens).toEqual([]);
    expect(s.descartadas[0].motivo).toMatch(/mais de um ativo/);
  });

  it('o mesmo ticker repetido na linha não conta como dois', () => {
    expect(uma('1234567\ncompra\nBTLG11 100 (BTLG11)').ordens).toHaveLength(1);
  });
});

// Pedido real de 28/09: o nome do fundo numa linha, o valor na de baixo. Os sete nomes batiam
// exatos com a prateleira, mas nenhum virava ordem — o nome ia para os descartes por falta de
// valor, e a linha `R$ 16.000,00`, sem ativo, era pulada em silêncio.
describe('pedido real — valor na linha de baixo do fundo', () => {
  const pedido = [
    '80000007',
    '',
    '',
    'compra',
    '',
    'Riza Renda Imobiliária Feeder FII RL - Subclasse I',
    'R$ 16.000,00',
    'AZ Quest Panorama Data Centers FII RL',
    'R$ 16.000,00',
    'Riza Terrax Vintage FIAgro RL',
    'R$ 16.000,00',
    'Valora Agro Pré I Fiagro RL',
    'R$ 16.000,00',
    'XP Logístico Prime Yield II FII RL',
    'R$ 16.000,00',
    'Mauá Capital Logística Feeder FII - RL',
    'R$ 16.000,00',
    'Wings Renda Imobiliária Feeder FII - RL',
    'R$ 16.000,00'
  ].join('\n');

  it('lê os sete fundos, cada um com o valor da linha de baixo', () => {
    const s = uma(pedido);
    expect(s.conta).toBe('80000007');
    expect(s.ordens.map((o) => [o.ativo, o.operacao, o.financeiro, o.quantidade])).toEqual([
      ['Riza Renda Imobiliária Feeder FII RL - Subclasse I', 'C', 16000, null],
      ['AZ Quest Panorama Data Centers FII RL', 'C', 16000, null],
      ['Riza Terrax Vintage FIAgro RL', 'C', 16000, null],
      ['Valora Agro Pré I Fiagro RL', 'C', 16000, null],
      ['XP Logístico Prime Yield II FII RL', 'C', 16000, null],
      ['Mauá Capital Logística Feeder FII - RL', 'C', 16000, null],
      ['Wings Renda Imobiliária Feeder FII - RL', 'C', 16000, null]
    ]);
  });

  it('reconhece todos na prateleira, sem descarte nem número sobrando', () => {
    const s = uma(pedido);
    expect(s.ordens.every((o) => o.fundo?.situacao === 'exato')).toBe(true);
    expect(s.ordens.every((o) => o.numerosSobrando.length === 0)).toBe(true);
    expect(s.descartadas).toEqual([]);
  });

  it('guarda as duas linhas de origem, para o operador conferir', () => {
    expect(uma(pedido).ordens[1].linha).toBe('AZ Quest Panorama Data Centers FII RL / R$ 16.000,00');
  });
});

describe('valor na linha de baixo', () => {
  it('vale também para ticker', () => {
    const s = uma('1234567\ncompra\nBTLG11\nR$ 3.000,00\nXPML11\n3.000,00');
    expect(s.ordens.map((o) => [o.ativo, o.financeiro])).toEqual([
      ['BTLG11', 3000],
      ['XPML11', 3000]
    ]);
  });

  it('lê quantidade na linha de baixo', () => {
    const s = uma('1234567\ncompra\nBTLG11\n100 cotas\nXPML11\n200');
    expect(s.ordens.map((o) => [o.ativo, o.quantidade, o.quantidadeSolta])).toEqual([
      ['BTLG11', 100, false],
      ['XPML11', 200, true]
    ]);
  });

  it('lê o valor com observação entre parênteses', () => {
    const o = uma('1234567\ncompra\nBTLG11\nR$ 34.800(não ultrapassar esse valor)').ordens[0];
    expect(o).toMatchObject({ financeiro: 34800, numerosSobrando: [] });
  });

  it('o ativo sem valor no meio da lista vai para os descartes, e os outros seguem', () => {
    const s = uma('1234567\ncompra\nBTLG11\nR$ 3.000,00\nXPML11\nKNCR11\nR$ 5.000,00');
    expect(s.ordens.map((o) => [o.ativo, o.financeiro])).toEqual([
      ['BTLG11', 3000],
      ['KNCR11', 5000]
    ]);
    expect(s.descartadas.map((d) => d.linha)).toEqual(['XPML11']);
  });

  // Com o valor ACIMA do nome, casar de cima para baixo daria a cada fundo o valor do seguinte:
  // o Riza Malls sairia com os R$ 10.000,00 do AZ Quest. Um valor sem ativo logo acima é o sinal
  // de que o bloco não segue o padrão, e aí nada é casado.
  it('NUNCA casa quando os valores vêm acima dos nomes', () => {
    const s = uma(
      '1234567\ncompra\nR$ 16.000,00\nRiza Malls\nR$ 10.000,00\nAZ Quest Panorama Data Centers FII RL'
    );
    expect(s.ordens).toEqual([]);
    expect(s.descartadas.map((d) => d.linha)).toEqual([
      'R$ 16.000,00',
      'Riza Malls',
      'R$ 10.000,00',
      'AZ Quest Panorama Data Centers FII RL'
    ]);
  });

  it('não casa nada quando sobra um valor sem ativo logo acima', () => {
    const s = uma('1234567\ncompra\nBTLG11\nR$ 3.000,00\nR$ 5.000,00\nXPML11\nR$ 1.000,00');
    expect(s.ordens).toEqual([]);
    expect(s.descartadas.find((d) => d.linha === 'R$ 5.000,00').motivo).toMatch(/ativo logo acima/);
  });

  it('não casa o valor com um ativo que já tem valor na própria linha', () => {
    const s = uma('1234567\ncompra\nBTLG11 100\nR$ 3.000,00');
    expect(s.ordens.map((o) => [o.ativo, o.quantidade, o.financeiro])).toEqual([['BTLG11', 100, null]]);
    expect(s.descartadas.map((d) => d.linha)).toEqual(['R$ 3.000,00']);
  });

  it('não casa por cima de uma linha de contexto', () => {
    const s = uma('1234567\nBTLG11\ncompra\nR$ 3.000,00');
    expect(s.ordens).toEqual([]);
  });

  it('valor sozinho na linha nunca some calado', () => {
    const s = uma('1234567\ncompra\nR$ 3.000,00');
    expect(s.descartadas.map((d) => d.linha)).toEqual(['R$ 3.000,00']);
  });
});

// Decidido com o operador em 28/09, pela segunda vez: fundo cetipado não entra no e-mail em
// tabela. Marcar a tabela num pedido de fundo só mostraria um bloqueio que não se confirma.
describe('via email num pedido com fundo', () => {
  it('marca só a Ordem por e-mail', () => {
    const s = uma('80000007\ncompra via email\nRiza Malls\nR$ 16.000,00');
    expect(s.saidas).toMatchObject({ email: true, auditoria: false });
  });

  it('também quando o fundo divide a cesta com um ticker', () => {
    const s = uma('80000007\ncompra via email\nBTLG11 - 3.000,00\nRiza Malls - R$ 16.000,00');
    expect(s.saidas).toMatchObject({ email: true, auditoria: false });
  });

  it('"auditar" pedido com todas as letras continua marcando a tabela', () => {
    const s = uma('80000007\nAuditar via e-mail\nC - Riza Malls - R$ 16.000,00');
    expect(s.saidas.auditoria).toBe(true);
  });
});

// Decisão da mesa em 06/10/2026: o ticker de um fundo da prateleira, escrito sozinho, é o fundo —
// compra pela boleta do secundário, não papel de bolsa.
describe('fundo da prateleira escrito pelo ticker', () => {
  it('VGPR11 é o fundo, e o ticker fica como foi escrito', () => {
    const o = uma('1234567\nCompra\nVGPR11 R$ 10.000,00').ordens[0];
    expect(o).toMatchObject({ ativo: 'VGPR11', ticker: null, financeiro: 10000, operacao: 'C' });
    expect(o.fundo).toMatchObject({ situacao: 'exato', fundo: { nome: 'Valora Imobiliário Multiestratégia Premium' } });
  });

  it('em minúsculas, com traço e com o nome atrás, também', () => {
    for (const linha of ['vgpr11 - 10.000,00', 'VGPR11 - Valora R$ 10.000,00']) {
      const o = uma('1234567\nCompra\n' + linha).ordens[0];
      expect(o.fundo?.fundo?.ticker, linha).toBe('VGPR11');
      expect(o.financeiro, linha).toBe(10000);
    }
  });

  it('o ticker de quatro letras do TG Renda Imobiliária também', () => {
    expect(uma('1234567\nCompra\nTGRI R$ 5.000,00').ordens[0].fundo?.fundo?.ticker).toBe('TGRI');
  });

  it('papel de bolsa continua papel de bolsa', () => {
    const o = uma('1234567\nCompra\nPETR4 100').ordens[0];
    expect(o.fundo).toBeNull();
    expect(o.ticker.ticker).toBe('PETR4');
  });
});
