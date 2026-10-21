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
  pedeAtencao,
  prazoMaisUrgente,
  prazosDoPedido,
  registrarEnvio,
  registrarResposta,
  repetidosHoje,
  resumoDoDia,
  situacaoDoPrazo,
  vencidosDaGuarda
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
    expect(ficha).toContain('- XP Hedge Fund: vender 123,4567891 cotas (Estoque XP)');
    expect(ficha).toContain('- Riza Malls: vender o total da posição (Estoque clientes)');
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
