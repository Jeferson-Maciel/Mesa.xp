import { describe, expect, it } from 'vitest';
import {
  chaveDoPedido,
  contasConhecidas,
  diaDe,
  fichaDeExecucao,
  linkDaBoleta,
  mudarEstado,
  novoPedido,
  pedidosDaVista,
  blocosDoEmail,
  quantidadeAprovada,
  titulosDoEmail,
  ordensDoLote,
  destinoDaBoleta,
  quantoParaExecutar,
  pedeAtencao,
  prazoMaisUrgente,
  prazosDoPedido,
  registrarEnvio,
  registrarResposta,
  repetidosHoje,
  resumoDoDia,
  situacaoDoPrazo,
  vencidosDaGuarda,
  marcarPrazoAvisado,
  prazoPerto,
  prazosParaAvisar,
  textoDoAvisoDePrazo
} from './regras.js';

// Contas fictícias. 21/10/2026, uma quarta-feira.
const em = (hora, min = 0, dia = 21) => new Date(2026, 9, dia, hora, min).getTime();
const FUNDO = '11111111-2222-4333-8444-555555555555';
const bolsa = (extra = {}) =>
  novoPedido({
    conta: '1234567',
    cliente: { nome: 'FULANO DE TAL', email: 'fulano@exemplo.com' },
    grupo: 'bolsa',
    formato: 'email',
    assunto: 'Confirmação de ordem',
    ordens: [{ ativo: 'PETR4', operacao: 'C', quantidade: 100, financeiro: null, preco: null }],
    texto: 'Prezado(a) FULANO DE TAL, …',
    em: em(10),
    ...extra
  });

describe('o cartão de um pedido', () => {
  it('nasce aguardando o cliente, no dia local, com o histórico e a chave', () => {
    const p = bolsa();
    expect(p).toMatchObject({ dia: '2026-10-21', estado: 'enviado', conta: '1234567', chave: '1234567|bolsa|PETR4:C' });
    expect(p.historico).toEqual([{ estado: 'enviado', em: em(10) }]);
  });

  it('o dia é o local, nunca o de UTC (às 22h ainda é hoje)', () => {
    expect(diaDe(em(22, 30))).toBe('2026-10-21');
  });

  it('a chave ignora a ordem, a caixa e o acento dos ativos', () => {
    const a = chaveDoPedido({ conta: '1', grupo: 'bolsa', ordens: [{ ativo: 'vale3', operacao: 'V' }, { ativo: 'PETR4', operacao: 'C' }] });
    const b = chaveDoPedido({ conta: '1', grupo: 'bolsa', ordens: [{ ativo: 'PETR4', operacao: 'C' }, { ativo: 'VALE3', operacao: 'V' }] });
    expect(a).toBe(b);
  });
});

describe('os prazos', () => {
  it('bolsa: o leilão; fundos: o secundário, a cotação de venda e o Estoque clientes; Tesouro: as 18h', () => {
    expect(prazosDoPedido({ grupo: 'bolsa', ordens: [], em: em(11) }).map((p) => p.tipo)).toEqual(['leilao']);
    const venda = prazosDoPedido({ grupo: 'fundos-venda', ordens: [], em: em(11), validadeDaCotacao: em(11, 0, 22) });
    expect(venda.map((p) => p.tipo)).toEqual(['secundario', 'cotacao']);
    const p2p = prazosDoPedido({ grupo: 'fundos-compra', ordens: [{ estoque: 'clientes' }], em: em(11) });
    expect(p2p.map((p) => p.tipo)).toEqual(['estoque-clientes', 'secundario']);
    expect(prazosDoPedido({ grupo: 'tesouro', ordens: [], em: em(11) })[0]).toMatchObject({ tipo: 'tesouro', ate: em(18) });
  });

  it('depois da hora, o prazo é o do próximo dia útil', () => {
    expect(prazosDoPedido({ grupo: 'bolsa', ordens: [], em: em(17, 30) })[0].ate).toBe(em(16, 55, 22));
  });

  it('perto é uma hora ou menos; vencido, passou; o mais urgente pede atenção', () => {
    const p = bolsa();
    expect(situacaoDoPrazo(p.prazos[0], em(15))).toBe('ok');
    expect(situacaoDoPrazo(p.prazos[0], em(16, 10))).toBe('perto');
    expect(situacaoDoPrazo(p.prazos[0], em(17))).toBe('vencido');
    expect(pedeAtencao(p, em(15))).toBe(false);
    expect(pedeAtencao(p, em(16, 30))).toBe(true);
    expect(prazoMaisUrgente(mudarEstado(p, 'executado', em(12)), em(17))).toBeNull();
  });
});

describe('o envio, a resposta e os estados', () => {
  it('o mesmo pedido ainda à espera é atualizado; o que já andou vira outro cartão', () => {
    const p = bolsa();
    const reenviado = registrarEnvio([p], { conta: '1234567', grupo: 'bolsa', formato: 'email', assunto: 'x', ordens: p.ordens, texto: 'novo', em: em(11) });
    expect(reenviado.id).toBe(p.id);
    expect(reenviado.texto).toBe('novo');
    const executado = mudarEstado(p, 'executado', em(12));
    const outro = registrarEnvio([executado], { conta: '1234567', grupo: 'bolsa', formato: 'email', assunto: 'x', ordens: p.ordens, texto: 'outro', em: em(13) });
    expect(outro.id).not.toBe(p.id);
  });

  it('o pedido repetido confirmado como novo vira outro cartão; copiar de novo o mesmo atualiza o dele', () => {
    const p = bolsa();
    const dados = { conta: '1234567', grupo: 'bolsa', formato: 'email', assunto: 'x', ordens: p.ordens, texto: 'novo', em: em(11) };
    const novo = registrarEnvio([p], dados, { novo: true, proprios: new Set() });
    expect(novo.id).not.toBe(p.id);
    const deNovo = registrarEnvio([p, novo], { ...dados, texto: 'de novo' }, { novo: true, proprios: new Set([novo.id]) });
    expect(deNovo.id).toBe(novo.id);
    expect(deNovo.texto).toBe('de novo');
  });

  it('a resposta passa o cartão para "o cliente respondeu"; o que já andou só a guarda', () => {
    const resposta = { de: 'FULANO DE TAL', assunto: 'RES: Confirmação de ordem', previa: 'De acordo, pode seguir.', em: em(11) };
    expect(registrarResposta(bolsa(), resposta, em(11))).toMatchObject({ estado: 'respondeu', resposta });
    const aprovado = mudarEstado(bolsa(), 'aprovado', em(11));
    expect(registrarResposta(aprovado, resposta, em(12))).toMatchObject({ estado: 'aprovado', resposta });
  });

  it('mudar de estado guarda a passagem; estado que não existe é erro', () => {
    const p = mudarEstado(bolsa(), 'aprovado', em(11));
    expect(p.historico.map((h) => h.estado)).toEqual(['enviado', 'aprovado']);
    expect(() => mudarEstado(p, 'perdido')).toThrow();
  });
});

describe('o pedido repetido', () => {
  it('mesma conta, mesmo ativo e mesma operação de hoje, e não cancelado', () => {
    const hoje = [bolsa()];
    expect(repetidosHoje('1234567', [{ ativo: 'petr4', operacao: 'C' }], hoje)).toEqual([{ ativo: 'petr4', operacao: 'C', em: em(10), estado: 'enviado' }]);
    expect(repetidosHoje('1234567', [{ ativo: 'PETR4', operacao: 'V' }], hoje)).toEqual([]);
    expect(repetidosHoje('7654321', [{ ativo: 'PETR4', operacao: 'C' }], hoje)).toEqual([]);
    expect(repetidosHoje('1234567', [{ ativo: 'PETR4', operacao: 'C' }], [mudarEstado(bolsa(), 'cancelado')])).toEqual([]);
  });

  it('as contas que já passaram pela Fila', () => {
    expect([...contasConhecidas([bolsa(), bolsa({ conta: '7654321' })])]).toEqual(['1234567', '7654321']);
  });
});

describe('a ficha de execução e a boleta', () => {
  it('diz o que fazer com cada ativo, o prazo, e quando foi aprovado', () => {
    const p = mudarEstado(bolsa(), 'aprovado', em(10, 42));
    expect(fichaDeExecucao(p, em(11))).toBe(
      ['EXECUTAR · conta 1234567 · FULANO DE TAL', 'Bolsa · aprovado às 10:42', '- PETR4: comprar 100 · A mercado', 'Prazo: leilão da B3 21/10 16:55'].join('\n')
    );
  });

  it('a venda de fundo leva as cotas, o total e a modalidade', () => {
    const p = novoPedido({
      conta: '1234567',
      grupo: 'fundos-venda',
      formato: 'email',
      assunto: 'Confirmação de ordem',
      ordens: [
        { ativo: 'XP Hedge Fund', operacao: 'V', quantidade: 123.4567891, fundoId: FUNDO },
        { ativo: 'Riza Malls', operacao: 'V', total: true, estoque: 'clientes', fundoId: FUNDO }
      ],
      texto: '',
      em: em(10)
    });
    const ficha = fichaDeExecucao(p, em(11));
    expect(ficha).toContain('- XP Hedge Fund: vender 123,4567891 cotas · Estoque XP');
    expect(ficha).toContain('- Riza Malls: vender o total da posição · Estoque clientes');
  });
});

// As cotas que o cliente aprovou (pedido do operador em 21/10/2026): lidas do e-mail que saiu.
describe('as cotas do e-mail aprovado', () => {
  const EMAIL_DE_COMPRA = [
    'Prezado(a) Cliente,',
    '',
    'Conforme conversado, gostaria de realizar as ordens abaixo na conta XP 1234567:',
    '',
    'Ativo: VGPR11;',
    'Quantidade: 1193;',
    'Preço: A mercado',
    'Operação: Compra',
    '',
    'Ativo: Riza Terrax Vintage FIAgro RL;',
    'Quantidade: 162;',
    'Preço: A mercado',
    'Operação: Compra',
    '',
    'Ativo: Fundo Fora da Prateleira;',
    'Valor: R$ 5.000,00;',
    'Preço: A mercado',
    'Operação: Compra'
  ].join('\n');
  const EMAIL_DE_VENDA = ['Prezado(a) Cliente,', '', 'Ativo: Riza Malls Feeder FII RL;', 'Quantidade: 123,45678910;', 'Operação: Venda;', '', 'Condições:', '', 'atte,'].join('\n');

  it('o Quantidade de cada Ativo; o bloco com Valor não tem cotas', () => {
    expect(blocosDoEmail(EMAIL_DE_COMPRA)).toEqual([
      { ativo: 'VGPR11', quantidade: 1193 },
      { ativo: 'RIZA TERRAX VINTAGE FIAGRO RL', quantidade: 162 },
      { ativo: 'FUNDO FORA DA PRATELEIRA', quantidade: null }
    ]);
    expect(blocosDoEmail(EMAIL_DE_VENDA)).toEqual([{ ativo: 'RIZA MALLS FEEDER FII RL', quantidade: 123.4567891 }]);
  });

  it('e a coluna Qtd. Total do E-mail em tabela', () => {
    const tabela = ['Conforme conversado…', '', 'Ativo\tC/V\tPreço\tQtd. Total', 'PETR4\tC\tA mercado\t100', 'VGPR11\tC\tA mercado\t1193', '', 'Att,'].join('\n');
    expect(blocosDoEmail(tabela)).toEqual([
      { ativo: 'PETR4', quantidade: 100 },
      { ativo: 'VGPR11', quantidade: 1193 }
    ]);
  });

  it('a compra em R$ executa pelas cotas do e-mail, com o valor pedido ao lado', () => {
    const p = novoPedido({
      conta: '1234567',
      grupo: 'fundos-compra',
      formato: 'email',
      assunto: 'Confirmação de ordem',
      ordens: [
        { ativo: 'VGPR11', operacao: 'C', financeiro: 10000 },
        { ativo: 'Riza Terrax Vintage FIAgro RL', operacao: 'C', financeiro: 15000, estoque: 'clientes' },
        { ativo: 'Fundo Fora da Prateleira', operacao: 'C', financeiro: 5000 }
      ],
      texto: EMAIL_DE_COMPRA,
      em: em(10)
    });
    expect(quantoParaExecutar(p, p.ordens[0])).toEqual({ principal: '1.193 cotas', detalhes: ['pedido R$ 10.000,00'], ativo: 'VGPR11' });
    const ficha = fichaDeExecucao(p, em(11));
    expect(ficha).toContain('- VGPR11: comprar 1.193 cotas · Estoque XP · pedido R$ 10.000,00');
    expect(ficha).toContain('- Riza Terrax Vintage FIAgro RL: comprar 162 cotas · Estoque clientes · pedido R$ 15.000,00');
    // Sem as cotas no e-mail, o valor, e o aviso: nada é convertido aqui.
    expect(ficha).toContain('- Fundo Fora da Prateleira: comprar R$ 5.000,00 · Estoque XP · sem as cotas no e-mail');
  });

  it('a venda do total executa pela posição que o e-mail levou', () => {
    const p = novoPedido({
      conta: '1234567',
      grupo: 'fundos-venda',
      formato: 'email',
      assunto: 'Confirmação de ordem',
      ordens: [{ ativo: 'Riza Malls Feeder FII RL', operacao: 'V', total: true, fundoId: FUNDO }],
      texto: EMAIL_DE_VENDA,
      em: em(10)
    });
    expect(fichaDeExecucao(p, em(11))).toContain('- Riza Malls Feeder FII RL: vender 123,4567891 cotas · Estoque XP · o total da posição');
  });

  it('quando o e-mail não tem o bloco, recupera as cotas auditadas salvas na ordem', () => {
    const p = novoPedido({
      conta: '1234567',
      grupo: 'fundos-compra',
      formato: 'email',
      assunto: 'Confirmação de ordem',
      ordens: [
        { ativo: 'KJNT11', operacao: 'C', financeiro: 44000, quantidade: null, cotas: 5746 },
        { ativo: 'AZ-AXS Energia FIP-IE RL - Subclasse Sênior A1', operacao: 'C', financeiro: 50173.35, quantidade: null, cotas: 464 }
      ],
      texto: 'E-mail sem blocos legíveis',
      em: em(10)
    });
    expect(quantidadeAprovada(p, p.ordens[0])).toBe(5746);
    expect(quantoParaExecutar(p, p.ordens[0])).toEqual({
      principal: '5.746 cotas',
      detalhes: ['pedido R$ 44.000,00'],
      ativo: 'KJNT11'
    });
    expect(quantidadeAprovada(p, p.ordens[1])).toBe(464);
    expect(quantoParaExecutar(p, p.ordens[1])).toEqual({
      principal: '464 cotas',
      detalhes: ['pedido R$ 50.173,35'],
      ativo: 'AZ-AXS Energia FIP-IE RL - Subclasse Sênior A1'
    });
  });

  it('lê números do e-mail com ponto de milhar ou vírgula decimal corretamente', () => {
    const emailComMilhar = [
      'Prezado(a) Cliente,',
      'Ativo: KJNT11;',
      'Quantidade: 5.746;',
      'Preço: A mercado',
      'Operação: Compra'
    ].join('\n');
    const p = novoPedido({
      conta: '1234567',
      grupo: 'fundos-compra',
      formato: 'email',
      assunto: 'Confirmação de ordem',
      ordens: [{ ativo: 'KJNT11', operacao: 'C', financeiro: 44000 }],
      texto: emailComMilhar,
      em: em(10)
    });
    expect(quantidadeAprovada(p, p.ordens[0])).toBe(5746);
  });

  it('a boleta pela rota do Hub, com a conta no caminho; bolsa não tem', () => {
    expect(linkDaBoleta({ operacao: 'V', fundoId: FUNDO }, '1234567', 'fundos-venda')).toBe(
      `https://hub.xpi.com.br/new/fundos-de-investimento#/secundario/vender/${FUNDO}/1234567`
    );
    expect(linkDaBoleta({ operacao: 'C' }, '1234567', 'fundos-compra')).toBeNull();
    expect(linkDaBoleta({ operacao: 'C' }, '1234567', 'bolsa')).toBeNull();
    expect(linkDaBoleta({}, '1234567', 'tesouro')).toContain('#/produtos/tesouro-direto');
  });
});

describe('o que a Fila de um dia mostra', () => {
  it('hoje, também o que ficou aberto nos últimos 7 dias; outro dia, só o dele', () => {
    const ontemAberto = bolsa({ conta: '7654321', em: em(17, 0, 20) });
    const ontemExecutado = mudarEstado(bolsa({ em: em(11, 0, 20) }), 'executado', em(12, 0, 20));
    const velho = bolsa({ em: new Date(2026, 9, 1, 10).getTime() });
    const hoje = bolsa();
    const todos = [ontemAberto, ontemExecutado, velho, hoje];
    expect(pedidosDaVista(todos, '2026-10-21', em(12)).map((p) => p.id)).toEqual([ontemAberto.id, hoje.id]);
    expect(pedidosDaVista(todos, '2026-10-20', em(12)).map((p) => p.id)).toEqual([ontemAberto.id, ontemExecutado.id]);
  });
});

describe('o resumo do dia e a guarda', () => {
  it('conta cada estado e lista o que ficou pendente', () => {
    const lista = [mudarEstado(bolsa(), 'executado', em(11)), bolsa({ conta: '7654321', em: em(14) })];
    const resumo = resumoDoDia(lista, '2026-10-21');
    expect(resumo).toContain('21/10/2026: 2 pedidos — 1 executado, 1 aguardando o cliente.');
    expect(resumo).toContain('- conta 7654321 (FULANO DE TAL): Bolsa — PETR4 · enviado às 14:00');
    expect(resumoDoDia([], '2026-10-21')).toBe('21/10/2026: nenhum pedido na Fila.');
  });

  it('o que passou de 90 dias sai', () => {
    const velho = { ...bolsa(), dia: '2026-07-01' };
    expect(vencidosDaGuarda([velho, bolsa()], em(10))).toEqual([velho]);
  });
});

describe('o Tesouro na Fila: o título, o vencimento e o valor aprovados', () => {
  const EMAIL_DO_TESOURO = [
    'Prezado(a) Cliente,',
    '',
    'Conforme conversado, gostaria de realizar as ordens para a aplicação no Tesouro Direto abaixo na conta XP 1234567:',
    '',
    '',
    'Título: Tesouro Selic 2031;',
    'Taxa: SELIC + 0,0992 %;',
    'Vencimento: 01/03/2031;',
    'Valor a ser aplicado: R$ 2.000,00',
    '',
    'Título: Tesouro Prefixado 2029;',
    'Taxa: ;',
    'Vencimento: ;',
    'Valor a ser aplicado: R$ 5.000,00'
  ].join('\n');

  it('lê cada título do e-mail, na ordem, com a taxa, o vencimento e o valor', () => {
    expect(titulosDoEmail(EMAIL_DO_TESOURO)).toEqual([
      { titulo: 'Tesouro Selic 2031', taxa: 'SELIC + 0,0992 %', vencimento: '01/03/2031', valor: 2000 },
      { titulo: 'Tesouro Prefixado 2029', taxa: null, vencimento: null, valor: 5000 }
    ]);
  });

  it('o pedido mostra o título do Hub (não o que foi digitado), o valor e o vencimento', () => {
    const p = novoPedido({
      conta: '1234567',
      grupo: 'tesouro',
      formato: 'email',
      assunto: 'Confirmação aplicação Tesouro Direto',
      ordens: [
        { ativo: 'LFT', operacao: 'C', financeiro: 2000 },
        { ativo: 'Tesouro Prefixado 2029', operacao: 'C', financeiro: 5000 }
      ],
      texto: EMAIL_DO_TESOURO,
      em: em(10)
    });
    expect(quantoParaExecutar(p, p.ordens[0])).toEqual({ principal: 'R$ 2.000,00', detalhes: ['venc. 01/03/2031', 'taxa SELIC + 0,0992 %'], ativo: 'Tesouro Selic 2031' });
    expect(fichaDeExecucao(p, em(11))).toContain('- Tesouro Selic 2031: aplicar R$ 2.000,00 · venc. 01/03/2031 · taxa SELIC + 0,0992 %');
  });

  it('o resgate do total leva o disponível que o e-mail aprovou', () => {
    const p = novoPedido({
      conta: '1234567',
      grupo: 'tesouro-resgate',
      formato: 'email',
      assunto: 'Confirmação resgate Tesouro Direto',
      ordens: [{ ativo: 'Tesouro Selic 2029', operacao: 'V', total: true }],
      texto: 'Título: Tesouro Selic 2029;\nVencimento: 01/03/2029;\nValor a ser resgatado: R$ 10.045,13',
      em: em(10)
    });
    expect(fichaDeExecucao(p, em(11))).toContain('- Tesouro Selic 2029: resgatar R$ 10.045,13 · venc. 01/03/2029 · o total disponível');
  });
});

describe('o lote e a boleta de um pedido', () => {
  const EMAIL = ['Ativo: KLBN11;', 'Quantidade: 674;', 'Preço: A mercado', 'Operação: Venda', '', 'Ativo: VULC3;', 'Valor: R$ 11.800,00;', 'Preço: A mercado', 'Operação: Compra'].join('\n');
  const p = novoPedido({
    conta: '1234567',
    grupo: 'bolsa',
    formato: 'email',
    assunto: 'x',
    ordens: [
      { ativo: 'KLBN11', operacao: 'V', quantidade: 674 },
      { ativo: 'VULC3', operacao: 'C', financeiro: 11800 },
      { ativo: 'Fundo Por Nome', operacao: 'C', quantidade: 10 }
    ],
    texto: EMAIL,
    em: em(10),
    horario: { inicial: '10:00', final: '15:00' }
  });

  it('as ordens do lote com a quantidade aprovada; a em R$ só no TWAP; o que não é ticker, fora', () => {
    const klbn = { ativo: 'KLBN11', operacao: 'V', preco: null, quantidade: 674, financeiro: null };
    const vulc = { ativo: 'VULC3', operacao: 'C', preco: null, quantidade: null, financeiro: 11800 };
    // Misturado (22/10/2026, pedido do usuário): a em R$ vai no TWAP, o resto no Simples.
    expect(ordensDoLote(p)).toEqual({
      ordens: [klbn, vulc],
      fora: ['Fundo Por Nome'],
      semSimples: ['VULC3'],
      paraSimples: [klbn],
      paraTwap: [vulc],
      misto: true
    });
    expect(p.horario).toEqual({ inicial: '10:00', final: '15:00' });
  });

  it('sem mistura, os dois lotes levam tudo o que cabe neles', () => {
    const soQuantidade = ordensDoLote({ ...p, ordens: [p.ordens[0]] });
    expect([soQuantidade.paraSimples, soQuantidade.paraTwap].map((l) => l.map((o) => o.ativo))).toEqual([['KLBN11'], ['KLBN11']]);
    expect(soQuantidade.misto).toBe(false);
    const soReais = ordensDoLote({ ...p, ordens: [p.ordens[1]] });
    expect([soReais.paraSimples, soReais.paraTwap].map((l) => l.map((o) => o.ativo))).toEqual([[], ['VULC3']]);
    expect(soReais.misto).toBe(false);
  });

  it('o destino da boleta: o fundo com o lado, o Tesouro do cliente; a bolsa não tem', () => {
    expect(destinoDaBoleta({ operacao: 'V', fundoId: FUNDO }, '1234567', 'fundos-venda')).toEqual({ tipo: 'fundo', fundoId: FUNDO, conta: '1234567', lado: 'vender' });
    expect(destinoDaBoleta({}, '1234567', 'tesouro-resgate')).toEqual({ tipo: 'tesouro', conta: '1234567', leitura: 'posicoes' });
    expect(destinoDaBoleta({ operacao: 'C' }, '1234567', 'bolsa')).toBeNull();
  });
});

// A revisão de 21/10/2026 achou: o mesmo ativo duas vezes no pedido (confirmável no Ordens) fazia o
// último bloco do e-mail valer para os dois, e a ordem em R$ virar cotas. Cada ordem casa com o bloco
// dela, pela posição, conferido o nome; sem casar com certeza, nada vem do e-mail.
describe('o mesmo ativo duas vezes no e-mail aprovado', () => {
  const EMAIL = [
    'Ativo: PETR4;', 'Quantidade: 100;', 'Preço: R$ 30,00', 'Operação: Compra', '',
    'Ativo: PETR4;', 'Valor: R$ 5.000,00;', 'Preço: A mercado', 'Operação: Compra', '',
    'Ativo: VALE3;', 'Quantidade: 100;', 'Preço: R$ 60,00', 'Operação: Compra', '',
    'Ativo: VALE3;', 'Quantidade: 200;', 'Preço: R$ 59,00', 'Operação: Compra'
  ].join('\n');
  const p = novoPedido({
    conta: '1234567',
    grupo: 'bolsa',
    formato: 'email',
    assunto: 'x',
    ordens: [
      { ativo: 'PETR4', operacao: 'C', quantidade: 100, preco: 'R$ 30,00' },
      { ativo: 'PETR4', operacao: 'C', financeiro: 5000 },
      { ativo: 'VALE3', operacao: 'C', quantidade: 100, preco: 'R$ 60,00' },
      { ativo: 'VALE3', operacao: 'C', quantidade: 200, preco: 'R$ 59,00' }
    ],
    texto: EMAIL,
    em: em(10)
  });

  it('o lote leva a quantidade de cada bloco, e a ordem em R$ segue em R$', () => {
    expect(ordensDoLote(p).ordens.map((o) => [o.ativo, o.quantidade, o.financeiro])).toEqual([
      ['PETR4', 100, null],
      ['PETR4', null, 5000],
      ['VALE3', 100, null],
      ['VALE3', 200, null]
    ]);
  });

  it('a ficha também', () => {
    const ficha = fichaDeExecucao(p, em(11));
    expect(ficha).toContain('- PETR4: comprar 100 · R$ 30,00');
    expect(ficha).toContain('- PETR4: comprar R$ 5.000,00 · A mercado');
    expect(ficha).toContain('- VALE3: comprar 100 · R$ 60,00');
    expect(ficha).toContain('- VALE3: comprar 200 · R$ 59,00');
  });

  it('o bloco de outra ordem não vale: o nome na posição não bate e o ativo se repete', () => {
    const fora = { ...p, texto: EMAIL.replace('Ativo: PETR4;\nQuantidade: 100;', 'Ativo: ITUB4;\nQuantidade: 100;') };
    // A primeira ordem perdeu o bloco dela; a quantidade é a do pedido, não a de outro bloco.
    expect(quantidadeAprovada(fora, fora.ordens[0])).toBe(100);
    expect(quantidadeAprovada(fora, fora.ordens[1])).toBeNull();
  });
});

// A revisão de 21/10/2026: o e-mail corrigido depois de "só metade" mantinha o cartão como respondido,
// com a resposta antiga ao lado das quantidades novas.
describe('o e-mail refeito depois da resposta do cliente', () => {
  const resposta = { de: 'FULANO', previa: 'Ok, mas só metade', em: em(10, 30) };
  const respondido = () => registrarResposta(bolsa(), resposta, em(10, 30));
  const dados = (texto) => ({
    conta: '1234567',
    grupo: 'bolsa',
    formato: 'email',
    assunto: 'Confirmação de ordem',
    ordens: [{ ativo: 'PETR4', operacao: 'C', quantidade: 50, financeiro: null, preco: null }],
    texto,
    em: em(11)
  });

  it('com o texto novo, volta para Enviados, sem a resposta de antes à vista (ela fica guardada)', () => {
    const r = registrarEnvio([respondido()], dados('Prezado(a) FULANO DE TAL, … 50 …'));
    expect(r).toMatchObject({ estado: 'enviado', resposta: null, respostaAnterior: resposta });
    expect(r.ordens[0].quantidade).toBe(50);
    expect(r.historico.at(-1)).toEqual({ estado: 'enviado', em: em(11) });
  });

  it('o mesmo texto copiado de novo não mexe no cartão respondido', () => {
    const r = registrarEnvio([respondido()], dados('Prezado(a) FULANO DE TAL, …'));
    expect(r).toMatchObject({ estado: 'respondeu', resposta });
  });
});

describe('o que pede atenção', () => {
  it('é o prazo perto ou vencido, não a resposta: o respondido sem pressa não fura a fila', () => {
    const respondido = registrarResposta(bolsa(), { de: 'FULANO', previa: 'De acordo', em: em(10, 30) }, em(10, 30));
    expect(pedeAtencao(respondido, em(11))).toBe(false);
    expect(pedeAtencao(respondido, em(16, 30))).toBe(true);
  });
});

// Fase 3 (Q31, 21/10/2026): o aviso de prazo — 15 min antes em Aprovação e execução, 30 min antes nos
// Enviados sem resposta; uma vez por pedido e por prazo.
describe('o aviso de prazo', () => {
  const bolsa = (extra = {}) =>
    novoPedido({ conta: '1234567', grupo: 'bolsa', formato: 'email', assunto: 'Confirmação de ordem', ordens: [{ ativo: 'PETR4', operacao: 'C', quantidade: 100 }], texto: '', em: em(10), ...extra });
  const respondido = () => registrarResposta(bolsa(), { id: 'r1', de: 'Fulano', previa: 'ok', em: em(11) }, em(11));

  it('nos Enviados, a partir de 30 min antes do leilão (16h55)', () => {
    expect(prazosParaAvisar([bolsa()], em(16, 24))).toEqual([]);
    const [aviso] = prazosParaAvisar([bolsa()], em(16, 25));
    expect(aviso).toMatchObject({ pasta: 'enviados', prazo: { tipo: 'leilao', ate: em(16, 55) } });
    expect(aviso.pedido.conta).toBe('1234567');
  });

  it('em Aprovação e execução (respondido ou aprovado), a partir de 15 min antes', () => {
    expect(prazosParaAvisar([respondido()], em(16, 25))).toEqual([]);
    expect(prazosParaAvisar([respondido()], em(16, 40))).toMatchObject([{ pasta: 'executar' }]);
    expect(prazosParaAvisar([mudarEstado(bolsa(), 'aprovado', em(11))], em(16, 40))).toHaveLength(1);
  });

  it('o prazo que já passou, o executado e o cancelado não avisam', () => {
    expect(prazosParaAvisar([bolsa()], em(16, 55))).toEqual([]);
    expect(prazosParaAvisar([mudarEstado(bolsa(), 'executado', em(11))], em(16, 50))).toEqual([]);
    expect(prazosParaAvisar([mudarEstado(bolsa(), 'cancelado', em(11))], em(16, 50))).toEqual([]);
  });

  it('uma vez por pedido e por prazo: o avisado não avisa de novo, nem ao mudar de pasta', () => {
    const [aviso] = prazosParaAvisar([bolsa()], em(16, 30));
    const marcado = marcarPrazoAvisado(aviso.pedido, aviso.prazo, em(16, 30));
    expect(prazosParaAvisar([marcado], em(16, 31))).toEqual([]);
    const respondeu = registrarResposta(marcado, { id: 'r1', de: 'Fulano', previa: 'ok', em: em(16, 35) }, em(16, 35));
    expect(prazosParaAvisar([respondeu], em(16, 45))).toEqual([]);
  });

  it('cada prazo do pedido avisa por si: o Estoque clientes às 14h e o secundário às 16h30', () => {
    const fundos = bolsa({ grupo: 'fundos-compra', ordens: [{ ativo: 'Fundo Fictício FII', operacao: 'C', financeiro: 1000, estoque: 'clientes' }] });
    const [primeiro] = prazosParaAvisar([fundos], em(13, 40));
    expect(primeiro.prazo.tipo).toBe('estoque-clientes');
    const marcado = marcarPrazoAvisado(fundos, primeiro.prazo, em(13, 40));
    expect(prazosParaAvisar([marcado], em(16, 10))).toMatchObject([{ prazo: { tipo: 'secundario' } }]);
  });

  it('o e-mail refeito guarda o que já foi avisado', () => {
    const [aviso] = prazosParaAvisar([bolsa()], em(16, 30));
    const marcado = marcarPrazoAvisado(aviso.pedido, aviso.prazo, em(16, 30));
    const refeito = registrarEnvio([marcado], { conta: '1234567', grupo: 'bolsa', formato: 'email', assunto: 'Confirmação de ordem', ordens: [{ ativo: 'PETR4', operacao: 'C', quantidade: 200 }], texto: 'outro', em: em(16, 32) });
    expect(prazosParaAvisar([refeito], em(16, 33))).toEqual([]);
  });

  it('o prazo perto, para o contador âmbar: dentro da antecedência e ainda não passou', () => {
    expect(prazoPerto(bolsa(), em(16, 24))).toBe(false);
    expect(prazoPerto(bolsa(), em(16, 30))).toBe(true);
    expect(prazoPerto(respondido(), em(16, 30))).toBe(false);
    expect(prazoPerto(respondido(), em(16, 45))).toBe(true);
    expect(prazoPerto(bolsa(), em(17))).toBe(false);
  });

  it('o texto do aviso: a conta, o grupo, o prazo, quanto falta e o que falta fazer', () => {
    const [enviado] = prazosParaAvisar([bolsa()], em(16, 25));
    expect(textoDoAvisoDePrazo(enviado, em(16, 25))).toBe('Conta 1234567 · Bolsa: leilão da B3 16:55, falta 30 min. O cliente ainda não respondeu.');
    const [executar] = prazosParaAvisar([respondido()], em(16, 41));
    expect(textoDoAvisoDePrazo(executar, em(16, 41))).toBe('Conta 1234567 · Bolsa: leilão da B3 16:55, falta 14 min. Falta executar.');
  });
});
