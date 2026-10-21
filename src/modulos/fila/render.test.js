import { describe, expect, it } from 'vitest';
import { mudarEstado, novoPedido, registrarResposta } from '../../comum/fila/regras.js';
import { htmlCancelados, htmlCartao, htmlFicha, htmlNumeros, htmlQuadro } from './render.js';

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

describe('o cartão', () => {
  it('escapa o que vem de fora: o nome do cliente, o ativo e a resposta dele', () => {
    const p = registrarResposta(
      pedido({ cliente: { nome: '<img src=x onerror=alert(1)>', email: null }, ordens: [{ ativo: '<b>X</b>', operacao: 'C', quantidade: 1 }] }),
      { de: '<script>', assunto: 'RES', previa: '<a href="javascript:1">ok</a>', em: em(11) },
      em(11)
    );
    const html = htmlCartao(p, em(11));
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>X');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<a href="javascript');
    expect(html).toContain('&lt;img');
  });

  it('cada estado tem os seus botões: aprovar, executar, desfazer', () => {
    expect(htmlCartao(pedido(), em(11))).toContain('data-estado="aprovado">Aprovou');
    const aprovado = mudarEstado(pedido(), 'aprovado', em(11));
    expect(htmlCartao(aprovado, em(11))).toContain('data-acao="ficha"');
    expect(htmlCartao(aprovado, em(11))).toContain('data-estado="executado">Executei');
    const executado = mudarEstado(aprovado, 'executado', em(12));
    expect(htmlCartao(executado, em(12))).toContain('data-estado="aprovado">Desfazer');
    expect(htmlCartao(executado, em(12))).not.toContain('data-estado="cancelado"');
  });

  it('a boleta do Hub aparece no aprovado, só para quem tem rota', () => {
    const fundo = mudarEstado(pedido({ grupo: 'fundos-venda', ordens: [{ ativo: 'XP Hedge Fund', operacao: 'V', quantidade: 10, fundoId: FUNDO }] }), 'aprovado', em(11));
    expect(htmlCartao(fundo, em(11))).toContain(`#/secundario/vender/${FUNDO}/1234567`);
    expect(htmlCartao(mudarEstado(pedido(), 'aprovado', em(11)), em(11))).not.toContain('fl-boleta');
  });

  it('o prazo perto fica âmbar, o vencido vermelho, e o cartão pede atenção', () => {
    expect(htmlCartao(pedido(), em(16, 20))).toContain('data-situacao="perto"');
    expect(htmlCartao(pedido(), em(16, 20))).toContain('fl-atencao');
    expect(htmlCartao(pedido(), em(17))).toContain('data-situacao="vencido"');
    expect(htmlCartao(pedido(), em(11))).toContain('data-situacao="ok"');
    expect(htmlCartao(pedido(), em(11))).not.toContain('fl-atencao');
  });
});

describe('o quadro', () => {
  it('quatro colunas, cada cartão na sua, e a coluna vazia explica o que entra nela', () => {
    const html = htmlQuadro([pedido(), mudarEstado(pedido({ conta: '7654321' }), 'aprovado', em(11))], em(11));
    expect(html.match(/class="fl-coluna"/g)).toHaveLength(4);
    expect(html).toContain('Com o Outlook aberto, o robô traz aqui as respostas');
    const aprovado = html.slice(html.indexOf('data-estado="aprovado" aria-label'));
    expect(aprovado).toContain('7654321');
  });

  it('os cancelados ficam fora do quadro, com um botão para reabrir', () => {
    const lista = [mudarEstado(pedido(), 'cancelado', em(11))];
    expect(htmlQuadro(lista, em(11))).not.toContain('1234567');
    expect(htmlCancelados(lista, em(11))).toContain('1 cancelado');
    expect(htmlCancelados(lista, em(11))).toContain('Reabrir');
    expect(htmlCancelados([pedido()], em(11))).toBe('');
  });

  it('os números do dia contam cada estado e o que pede atenção', () => {
    const html = htmlNumeros([pedido(), registrarResposta(pedido(), { previa: 'ok', em: em(11) }, em(11))], em(11));
    expect(html).toContain('<b>1</b> aguardando');
    expect(html).toContain('<b>1</b> responderam');
    expect(html).toContain('<b>1</b> pedem atenção');
  });
});

describe('a ficha', () => {
  it('mostra o texto escapado e a boleta', () => {
    const p = mudarEstado(pedido({ grupo: 'tesouro', cliente: { nome: '<i>x</i>', email: null }, ordens: [{ ativo: 'Tesouro Selic 2031', operacao: 'C', financeiro: 1000 }] }), 'aprovado', em(11));
    const html = htmlFicha(p, em(11));
    expect(html).toContain('&lt;i&gt;x');
    expect(html).toContain('#/produtos/tesouro-direto');
    expect(html).toContain('Copiar a ficha');
  });
});
