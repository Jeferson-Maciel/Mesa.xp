import { describe, expect, it } from 'vitest';
import { mudarEstado, novoPedido, registrarResposta } from '../../comum/fila/regras.js';
import { htmlConferir, htmlFicha, htmlLista, htmlLote, htmlPastas, pastaDoEstado } from './render.js';

// Contas fictícias. 21/10/2026, uma quarta-feira.
const em = (hora, min = 0) => new Date(2026, 9, 21, hora, min).getTime();
const FUNDO = '11111111-2222-4333-8444-555555555555';
const pedido = (extra = {}) =>
  novoPedido({
    conta: '1234567',
    cliente: { nome: 'FULANO DE TAL', email: 'fulano@exemplo.com' },
    grupo: 'bolsa',
    formato: 'email',
    assunto: 'Confirmação de ordem',
    ordens: [{ ativo: 'PETR4', operacao: 'C', quantidade: 100 }],
    texto: 'Prezado(a) FULANO DE TAL',
    em: em(10),
    ...extra
  });
const respondido = (extra = {}, previa = 'De acordo, pode seguir.') =>
  registrarResposta(pedido(extra), { id: 'r1', de: 'Fulano', email: 'fulano@exemplo.com', assunto: 'RES: Confirmação de ordem', previa, em: em(10, 42) }, em(10, 42));

describe('as pastas', () => {
  it('cada estado tem a sua pasta: à vista só Aprovação e execução', () => {
    expect(['enviado', 'respondeu', 'aprovado', 'executado', 'cancelado'].map(pastaDoEstado)).toEqual(['enviados', 'executar', 'executar', 'executados', 'cancelados']);
  });

  it('contam o que há em cada uma; Cancelados só aparece com cancelado', () => {
    const lista = [pedido(), respondido({ conta: '7654321' }), mudarEstado(pedido(), 'executado', em(11))];
    const html = htmlPastas(lista, 'executar', em(11));
    expect(html).toMatch(/data-pasta="executar"[^>]*aria-pressed="true">[\s\S]*?Aprovação e execução[\s\S]*?<b>1<\/b>/);
    expect(html).toMatch(/data-pasta="enviados"[\s\S]*?<b>1<\/b>/);
    expect(html).toMatch(/data-pasta="executados"[\s\S]*?<b>1<\/b>/);
    expect(html).not.toContain('data-pasta="cancelados"');
    expect(htmlPastas([mudarEstado(pedido(), 'cancelado', em(11))], 'executar', em(11))).toContain('data-pasta="cancelados"');
  });

  it('Enviados avisa do prazo perto, com o ponto âmbar', () => {
    expect(htmlPastas([pedido()], 'executar', em(16, 20))).toContain('fl-pasta-alerta');
    expect(htmlPastas([pedido()], 'executar', em(11))).not.toContain('fl-pasta-alerta');
  });
});

describe('Aprovação e execução', () => {
  it('só o que o cliente respondeu ou foi aprovado: os enviados e os executados ficam fora', () => {
    const lista = [pedido({ conta: '1111111' }), respondido({ conta: '2222222' }), mudarEstado(pedido({ conta: '3333333' }), 'aprovado', em(11)), mudarEstado(pedido({ conta: '4444444' }), 'executado', em(11))];
    const html = htmlLista(lista, 'executar', em(11));
    expect(html).toContain('2222222');
    expect(html).toContain('3333333');
    expect(html).not.toContain('1111111');
    expect(html).not.toContain('4444444');
  });

  it('a resposta em destaque, a ficha, executado, e "não aprovou" volta para os Enviados', () => {
    const html = htmlLista([respondido()], 'executar', em(11));
    expect(html).toContain('De acordo, pode seguir.');
    expect(html).toContain('Fulano respondeu às 10:42');
    // Na bolsa, o botão gera o lote (21/10/2026).
    expect(html).toContain('data-acao="lote"');
    expect(html).toMatch(/data-estado="executado"[^>]*>Executado/);
    expect(html).toContain('data-estado="enviado"');
  });

  it('o aprovado sem resposta diz que foi aprovado pelo operador', () => {
    expect(htmlLista([mudarEstado(pedido(), 'aprovado', em(10, 50))], 'executar', em(11))).toContain('Aprovado por você às 10:50, sem resposta pelo e-mail.');
  });

  it('escapa o que vem de fora: o nome do cliente, o ativo e a resposta dele', () => {
    const p = respondido({ cliente: { nome: '<img src=x onerror=alert(1)>', email: null }, ordens: [{ ativo: '<b>X</b>', operacao: 'C', quantidade: 1 }] }, '<a href="javascript:1">ok</a>');
    const html = htmlLista([p], 'executar', em(11));
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>X');
    expect(html).not.toContain('<a href="javascript');
    expect(html).toContain('&lt;img');
  });

  it('a boleta do Hub aparece no fundo, e nada na bolsa', () => {
    const fundo = respondido({ grupo: 'fundos-venda', ordens: [{ ativo: 'XP Hedge Fund', operacao: 'V', quantidade: 10, fundoId: FUNDO }] });
    expect(htmlLista([fundo], 'executar', em(11))).toMatch(/data-acao="boleta" data-indice="0"[^>]*>Boleta XP</);
    expect(htmlLista([fundo], 'executar', em(11))).toContain('data-acao="ficha"');
    expect(htmlLista([respondido()], 'executar', em(11))).not.toContain('data-acao="boleta"');
  });

  it('vazia, diz o que vai aparecer nela', () => {
    expect(htmlLista([pedido()], 'executar', em(11))).toContain('Quando o cliente responder um e-mail, o pedido aparece aqui.');
  });
});

describe('as outras pastas', () => {
  it('Enviados: uma linha por e-mail, com o prazo, "Aprovou" e cancelar', () => {
    const html = htmlLista([pedido()], 'enviados', em(16, 20));
    expect(html).toContain('class="fl-linha fl-atencao"');
    expect(html).toContain('data-situacao="perto"');
    expect(html).toMatch(/data-estado="aprovado"[^>]*>Aprovou/);
    expect(html).toContain('data-estado="cancelado"');
  });

  it('Executados: a hora da execução, a ficha e o desfazer', () => {
    const html = htmlLista([mudarEstado(pedido(), 'executado', em(11, 5))], 'executados', em(12));
    expect(html).toContain('executado 11:05');
    expect(html).toContain('data-acao="ficha"');
    expect(html).toMatch(/data-estado="aprovado"[^>]*>Desfazer/);
  });

  it('Cancelados: reabrir volta para os Enviados', () => {
    expect(htmlLista([mudarEstado(pedido(), 'cancelado', em(11))], 'cancelados', em(12))).toMatch(/data-estado="enviado"[^>]*>Reabrir/);
  });

  it('o pedido aberto de outro dia mostra a data dele', () => {
    const ontem = novoPedido({ conta: '1234567', grupo: 'bolsa', formato: 'email', assunto: 'x', ordens: [{ ativo: 'PETR4', operacao: 'C', quantidade: 1 }], texto: '', em: new Date(2026, 9, 20, 17).getTime() });
    expect(htmlLista([registrarResposta(ontem, { id: 'r', previa: 'ok', em: em(9) }, em(9))], 'executar', em(11))).toContain('>de 20/10</span>');
    expect(htmlLista([ontem], 'enviados', em(11))).toContain('enviado 20/10 17:00');
  });
});

describe('as respostas a conferir e a ficha', () => {
  const solta = (extra = {}) => ({
    resposta: { id: 'r1', de: '<img src=x onerror=1>', email: 'fulana@exemplo.com', assunto: 'RES: Confirmação de ordem', previa: '<b>ok</b>', em: em(10, 42) },
    motivo: 'pelo-nome',
    candidatos: [],
    ...extra
  });

  it('escapa o que veio do Outlook e oferece os candidatos, ou quem espera o cliente', () => {
    const p = pedido();
    const html = htmlConferir([solta({ candidatos: [p.id] })], [p]);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>ok');
    expect(html).toContain(`data-acao="atribuir" data-pedido="${p.id}">Conta 1234567 · Bolsa · 10:00`);
    expect(html).toContain('Não é de pedido');
    expect(htmlConferir([], [p])).toBe('');
  });

  it('a ficha mostra o texto escapado e a boleta', () => {
    const p = mudarEstado(pedido({ grupo: 'tesouro', cliente: { nome: '<i>x</i>', email: null }, ordens: [{ ativo: 'Tesouro Selic 2031', operacao: 'C', financeiro: 1000 }] }), 'aprovado', em(11));
    const html = htmlFicha(p, em(11));
    expect(html).toContain('&lt;i&gt;x');
    expect(html).toMatch(/data-acao="boleta"[^>]*>Tesouro do cliente/);
    expect(html).toContain('Copiar a ficha');
  });
});

describe('as cotas para executar', () => {
  it('a compra em R$ mostra as cotas do e-mail aprovado em destaque, com o valor pedido e o estoque', () => {
    const p = respondido({
      grupo: 'fundos-compra',
      ordens: [{ ativo: 'VGPR11', operacao: 'C', financeiro: 10000, fundoId: FUNDO }],
      texto: 'Ativo: VGPR11;\nQuantidade: 1193;\nPreço: A mercado\nOperação: Compra'
    });
    const html = htmlLista([p], 'executar', em(11));
    expect(html).toContain('<b>1.193 cotas</b><small>pedido R$');
    expect(html).toContain('Estoque XP</small>');
  });

  it('sem as cotas no e-mail, o valor em âmbar e o aviso', () => {
    const p = respondido({ grupo: 'fundos-compra', ordens: [{ ativo: 'Fundo X', operacao: 'C', financeiro: 5000 }], texto: 'Ativo: Fundo X;\nValor: R$ 5.000,00;' });
    const html = htmlLista([p], 'executar', em(11));
    expect(html).toContain('class="fl-sem-cotas"');
    expect(html).toContain('sem as cotas no e-mail');
  });
});

describe('o lote e o Tesouro na Fila', () => {
  it('a janela do lote: as tabelas, o Copiar de cada uma, e o porquê do que falta', () => {
    const p = respondido();
    const tsvSimples = 'Estratégia\tCliente\tAtivo\tC/V\tPreço\tQtd. Total\nSimples\t1234567\t<b>PETR4</b>\tC\tA mercado\t100\n';
    const html = htmlLote(p, { simples: tsvSimples, twap: null, fora: ['Fundo X'], semSimples: [] }, em(11));
    expect(html).toContain('data-acao="copiar-lote" data-formato="simples"');
    expect(html).not.toContain('<b>PETR4');
    expect(html).toContain('<td>1234567</td>');
    expect(html).toContain('Fora do lote (não são ticker): Fundo X.');
    const semSimples = htmlLote(p, { simples: null, twap: 'Estratégia\tCliente\nTWAP\t1234567\n', fora: [], semSimples: ['VULC3'] }, em(11));
    expect(semSimples).toContain('O Lote Simples não tem coluna de financeiro: VULC3 está em R$. Use o Lote TWAP.');
    expect(semSimples).toContain('O pedido não disse o horário: as colunas de hora saem vazias.');
  });

  it('o Tesouro mostra o título do Hub, o valor e o vencimento do e-mail, e o botão do Tesouro do cliente', () => {
    const p = respondido({
      grupo: 'tesouro',
      ordens: [{ ativo: 'LFT', operacao: 'C', financeiro: 2000 }],
      texto: 'Título: Tesouro Selic 2031;\nTaxa: SELIC + 0,0992 %;\nVencimento: 01/03/2031;\nValor a ser aplicado: R$ 2.000,00'
    });
    const html = htmlLista([p], 'executar', em(11));
    expect(html).toContain('>Tesouro Selic 2031</span>');
    expect(html).toContain('<b>R$');
    expect(html).toContain('venc. 01/03/2031');
    expect(html).toMatch(/data-acao="boleta" data-indice="0"[^>]*>Tesouro do cliente/);
  });
});

// A revisão de 21/10/2026: "quem lê 'de acordo' e clica em 'Aprovou' é o operador" — o respondido não
// tinha o Aprovou, e a hora da aprovação nunca ficava registrada.
describe('o Aprovou no cartão respondido', () => {
  it('o respondido tem o Aprovou; o aprovado com resposta diz quando foi aprovado', () => {
    expect(htmlLista([respondido()], 'executar', em(11))).toMatch(/data-estado="aprovado"[^>]*>Aprovou</);
    const aprovado = mudarEstado(respondido(), 'aprovado', em(10, 50));
    const html = htmlLista([aprovado], 'executar', em(11));
    expect(html).not.toMatch(/>Aprovou</);
    expect(html).toContain('De acordo, pode seguir.');
    expect(html).toContain('Aprovado por você às 10:50.');
  });
});
