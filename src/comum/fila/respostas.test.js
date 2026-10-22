import { describe, expect, it } from 'vitest';
import { mudarEstado, novoPedido } from './regras.js';
import { assuntoSemPrefixo, casarResposta, ehRespostaDePedido, momentoDaHora } from './respostas.js';

// Contas, nomes e e-mails fictícios. 21/10/2026.
const em = (hora, min = 0) => new Date(2026, 9, 21, hora, min).getTime();
const pedido = ({ conta = '1234567', nome = 'FULANA DE TAL DA SILVA', email = 'fulana.tal@exemplo.com', grupo = 'bolsa', assunto = 'Confirmação de ordem', hora = 10 } = {}) =>
  novoPedido({
    conta,
    cliente: { nome, email },
    grupo,
    formato: 'email',
    assunto,
    ordens: [{ ativo: 'PETR4', operacao: 'C', quantidade: 100 }],
    texto: '',
    em: em(hora)
  });
const resposta = (extra = {}) => ({ de: 'Fulana Tal', email: 'fulana.tal@exemplo.com', assunto: 'RES: Confirmação de ordem', previa: 'De acordo.', ...extra });

describe('o que é resposta a um pedido', () => {
  it.each([
    ['RE: Confirmação de ordem', true],
    ['RES: Confirmação resgate Tesouro Direto', true],
    ['Re: RES: Confirmacao de ordem', true],
    ['ENC: Confirmação aplicação Tesouro Direto', true],
    ['Confirmação de ordem', false],
    ['RE: Reunião amanhã', false],
    ['', false]
  ])('%s → %s', (assunto, esperado) => expect(ehRespostaDePedido(assunto)).toBe(esperado));

  it('tira os prefixos do assunto', () => {
    expect(assuntoSemPrefixo('RE: RES: Confirmação de ordem')).toBe('Confirmação de ordem');
  });

  it('a hora do Outlook vira o momento de hoje; data ou dia da semana não é de hoje', () => {
    expect(momentoDaHora('10:42', em(15))).toBe(em(10, 42));
    expect(momentoDaHora(' 10:42 ', em(15))).toBe(em(10, 42));
    expect(momentoDaHora('2:42 PM', em(15))).toBe(em(14, 42));
    expect(momentoDaHora('11:15 AM', em(15))).toBe(em(11, 15));
    expect(momentoDaHora('ter 20/10', em(15))).toBeNull();
    expect(momentoDaHora('25:00', em(15))).toBeNull();
  });
});

describe('o cartão de cada resposta', () => {
  it('o e-mail do cliente casa sozinho, sem ligar para a caixa', () => {
    const p = pedido();
    expect(casarResposta(resposta({ email: 'Fulana.Tal@Exemplo.com ' }), [p])).toEqual({ tipo: 'casou', pedido: p });
  });

  it('com dois cartões do cliente, vale o que espera a resposta', () => {
    const aprovado = mudarEstado(pedido({ hora: 9 }), 'aprovado', em(9, 30));
    const esperando = pedido({ hora: 11 });
    expect(casarResposta(resposta(), [aprovado, esperando])).toEqual({ tipo: 'casou', pedido: esperando });
  });

  it('e depois o do mesmo assunto: o resgate do Tesouro não é o e-mail da bolsa', () => {
    const bolsa = pedido();
    const resgate = pedido({ grupo: 'tesouro-resgate', assunto: 'Confirmação resgate Tesouro Direto' });
    expect(casarResposta(resposta({ assunto: 'RE: Confirmação resgate Tesouro Direto' }), [bolsa, resgate])).toEqual({ tipo: 'casou', pedido: resgate });
  });

  it('dois esperando com o mesmo assunto: ambígua, o operador escolhe', () => {
    const [a, b] = [pedido({ hora: 10 }), pedido({ grupo: 'fundos-compra', hora: 11 })];
    expect(casarResposta(resposta(), [a, b])).toEqual({ tipo: 'ambigua', candidatos: [a, b] });
  });

  it('de outro endereço, pelo nome, é só sugestão', () => {
    const p = pedido();
    expect(casarResposta(resposta({ email: 'fulana.pessoal@exemplo.com.br', de: 'Fulana Silva' }), [p])).toEqual({ tipo: 'pelo-nome', candidatos: [p] });
    // Uma parte do nome só não basta: "Fulana" sozinha é qualquer Fulana.
    expect(casarResposta(resposta({ email: 'outra@exemplo.com', de: 'Fulana' }), [p])).toEqual({ tipo: 'nenhum' });
  });

  it('o cartão cancelado não recebe resposta, e quem não tem cartão fica sem', () => {
    expect(casarResposta(resposta(), [mudarEstado(pedido(), 'cancelado', em(11))])).toEqual({ tipo: 'nenhum' });
    expect(casarResposta(resposta({ email: 'beltrano@exemplo.com', de: 'Beltrano Souza' }), [pedido()])).toEqual({ tipo: 'nenhum' });
  });
});

// O modo conversas do Outlook (visto na caixa de entrada do operador em 21/10/2026): o assunto sem o
// "RE:", e a prévia com o começo do e-mail original, "na conta XP 1234567".
describe('a conta citada na resposta', () => {
  it('liga a resposta ao pedido da conta, mesmo sem o e-mail do cliente', () => {
    const semEmail = pedido({ email: null, nome: null });
    expect(casarResposta(resposta({ email: 'outro@exemplo.com', de: 'Outro Nome', conta: '1234567', assunto: 'Confirmação de ordem' }), [semEmail])).toEqual({
      tipo: 'casou',
      pedido: semEmail
    });
  });

  it('vem antes do e-mail: a mesma pessoa com duas contas', () => {
    const [a, b] = [pedido({ conta: '1234567' }), pedido({ conta: '7654321' })];
    expect(casarResposta(resposta({ conta: '7654321' }), [a, b])).toEqual({ tipo: 'casou', pedido: b });
  });

  it('dois pedidos esperando da mesma conta, com o mesmo assunto: ambígua se a mensagem for genérica', () => {
    const [a, b] = [pedido({ hora: 10 }), pedido({ grupo: 'fundos-compra', hora: 11 })];
    expect(casarResposta(resposta({ conta: '1234567', email: null, previa: 'De acordo.' }), [a, b])).toEqual({ tipo: 'ambigua', candidatos: [a, b] });
  });

  it('dois pedidos da mesma conta (um de compra e um de venda): identifica compra na mensagem e casa certo', () => {
    const compra = novoPedido({
      conta: '1234567',
      cliente: { nome: 'Fulana Tal', email: 'fulana@exemplo.com' },
      grupo: 'fundos-compra',
      formato: 'email',
      assunto: 'Confirmação de ordem',
      ordens: [{ ativo: 'KJNT11', operacao: 'C', quantidade: 5746 }],
      texto: 'Ativo: KJNT11;\nQuantidade: 5746;\nOperação: Compra',
      em: em(10)
    });
    const venda = novoPedido({
      conta: '1234567',
      cliente: { nome: 'Fulana Tal', email: 'fulana@exemplo.com' },
      grupo: 'fundos-venda',
      formato: 'email',
      assunto: 'Confirmação de ordem',
      ordens: [{ ativo: 'XPHT11', operacao: 'V', quantidade: 100 }],
      texto: 'Ativo: XPHT11;\nQuantidade: 100;\nOperação: Venda;\nCondições:',
      em: em(10, 5)
    });

    const respostaCompra = resposta({
      conta: '1234567',
      previa: 'De acordo. Em qui, escreveu: Gostaria de realizar a ordem abaixo na conta XP 1234567: Ativo: KJNT11; Quantidade: 5746; Operação: Compra'
    });
    expect(casarResposta(respostaCompra, [compra, venda])).toEqual({ tipo: 'casou', pedido: compra });
  });

  it('dois pedidos da mesma conta (um de compra e um de venda): identifica venda e condições na mensagem e casa certo', () => {
    const compra = novoPedido({
      conta: '1234567',
      cliente: { nome: 'Fulana Tal', email: 'fulana@exemplo.com' },
      grupo: 'fundos-compra',
      formato: 'email',
      assunto: 'Confirmação de ordem',
      ordens: [{ ativo: 'KJNT11', operacao: 'C', quantidade: 5746 }],
      texto: 'Ativo: KJNT11;\nQuantidade: 5746;\nOperação: Compra',
      em: em(10)
    });
    const venda = novoPedido({
      conta: '1234567',
      cliente: { nome: 'Fulana Tal', email: 'fulana@exemplo.com' },
      grupo: 'fundos-venda',
      formato: 'email',
      assunto: 'Confirmação de ordem',
      ordens: [{ ativo: 'XPHT11', operacao: 'V', quantidade: 100 }],
      texto: 'Ativo: XPHT11;\nQuantidade: 100;\nOperação: Venda;\nCondições:',
      em: em(10, 5)
    });

    const respostaVenda = resposta({
      conta: '1234567',
      previa: 'De acordo com a venda. Em qui, escreveu: Gostaria de realizar na conta XP 1234567: Ativo: XPHT11; Operação: Venda; Condições: cotação'
    });
    expect(casarResposta(respostaVenda, [compra, venda])).toEqual({ tipo: 'casou', pedido: venda });
  });
});

