import { describe, expect, it } from 'vitest';
import { parseSolicitacoes } from '../core/parse/parseSolicitacoes.js';
import { aplicarEdicao } from './preview.js';
import { aplicarCorrecoes, correcoesDoCartao, marcarOrigem } from './correcoes.js';

// Fase 3 (Q35, 21/10/2026): o "Reabrir" do histórico volta com as correções do cartão — os valores
// editados, as linhas removidas, as confirmações —, e avisa das que não couberem. Contas fictícias.
const TEXTO = '1234567\nCOMPRA\nIVVB11 - 7 qntds\nPETR4 100\nVALE3 50\nvia email';
const lido = (texto = TEXTO) => marcarOrigem(parseSolicitacoes(texto).solicitacoes);
const vazios = (s) => s.map(() => new Set());

describe('as correções do cartão', () => {
  it('sem mexer em nada, não há correção', () => {
    const atuais = lido();
    expect(correcoesDoCartao(lido(), atuais, vazios(atuais))).toBeNull();
  });

  it('o valor editado, a linha removida, a linha nova e a confirmação voltam ao reabrir', () => {
    const atuais = lido();
    const [s] = atuais;
    aplicarEdicao(s, 'valor', '200', 1); // PETR4 100 → 200
    s.ordens.splice(2, 1); // VALE3 removida
    aplicarEdicao(s, 'adicionar-ordem', '');
    aplicarEdicao(s, 'ativo', 'ITUB4', 2);
    aplicarEdicao(s, 'operacao', 'V', 2);
    aplicarEdicao(s, 'valor', '30', 2);
    const confirmados = [new Set(['bolsa|ticker-suspeito'])];
    const correcoes = correcoesDoCartao(lido(), atuais, confirmados);
    expect(JSON.parse(JSON.stringify(correcoes))).toEqual(correcoes); // vai para o localStorage

    const reaberto = lido();
    const confirmadosDeNovo = vazios(reaberto);
    const { naoCouberam } = aplicarCorrecoes(reaberto, confirmadosDeNovo, correcoes);
    expect(naoCouberam).toEqual([]);
    expect(reaberto[0].ordens.map((o) => [o.ativo, o.operacao, o.quantidade])).toEqual([
      ['IVVB11', 'C', 7],
      ['PETR4', 'C', 200],
      ['ITUB4', 'V', 30]
    ]);
    expect(reaberto[0].ordens[2].ticker?.ticker).toBe('ITUB4');
    expect([...confirmadosDeNovo[0]]).toEqual(['bolsa|ticker-suspeito']);
  });

  it('a troca de quantidade por financeiro volta como financeiro, sem a quantidade pendurada', () => {
    const atuais = lido();
    aplicarEdicao(atuais[0], 'tipo', 'financeiro', 0);
    aplicarEdicao(atuais[0], 'valor', '1.500,00', 0);
    const reaberto = lido();
    aplicarCorrecoes(reaberto, vazios(reaberto), correcoesDoCartao(lido(), atuais, vazios(atuais)));
    expect(reaberto[0].ordens[0]).toMatchObject({ ativo: 'IVVB11', quantidade: null, financeiro: 1500, tipo: 'financeiro' });
  });

  it('a conta corrigida e o horário do TWAP voltam', () => {
    const atuais = lido();
    aplicarEdicao(atuais[0], 'conta', '7654321');
    aplicarEdicao(atuais[0], 'hora-inicial', '10:00');
    const reaberto = lido();
    aplicarCorrecoes(reaberto, vazios(reaberto), correcoesDoCartao(lido(), atuais, vazios(atuais)));
    expect(reaberto[0].conta).toBe('7654321');
    expect(reaberto[0].horario).toEqual({ inicial: '10:00', final: '' });
  });

  it('a correção que não cabe no texto lido agora não entra: é avisada, e o resto entra', () => {
    const atuais = lido();
    aplicarEdicao(atuais[0], 'valor', '200', 1);
    aplicarEdicao(atuais[0], 'valor', '80', 2);
    const correcoes = correcoesDoCartao(lido(), atuais, vazios(atuais));
    // O texto agora é lido com a VALE3 no lugar da PETR4 (a regra mudou, ou o texto foi outro).
    const reaberto = lido('1234567\nCOMPRA\nIVVB11 - 7 qntds\nVALE3 50\nvia email');
    const { naoCouberam } = aplicarCorrecoes(reaberto, vazios(reaberto), correcoes);
    expect(naoCouberam).toEqual(['PETR4: a quantidade editada (a linha não é mais lida no mesmo lugar)', 'VALE3: a quantidade editada (a linha não é mais lida no mesmo lugar)']);
    expect(reaberto[0].ordens.map((o) => o.quantidade)).toEqual([7, 50]);
  });

  it('a solicitação que não existe mais (outra conta no lugar) não recebe nada', () => {
    const atuais = lido();
    aplicarEdicao(atuais[0], 'valor', '200', 1);
    const correcoes = correcoesDoCartao(lido(), atuais, vazios(atuais));
    const reaberto = lido(TEXTO.replace('1234567', '7654321'));
    const { naoCouberam } = aplicarCorrecoes(reaberto, vazios(reaberto), correcoes);
    expect(naoCouberam).toEqual(['conta 1234567: as correções (o texto não é mais lido com esta conta)']);
    expect(reaberto[0].ordens[1].quantidade).toBe(100);
  });

  it('duas contas: cada uma com as suas correções', () => {
    const texto = '1234567\nC\nPETR4 100\n7654321\nV\nVALE3 50';
    const atuais = lido(texto);
    aplicarEdicao(atuais[1], 'valor', '60', 0);
    const reaberto = lido(texto);
    aplicarCorrecoes(reaberto, vazios(reaberto), correcoesDoCartao(lido(texto), atuais, vazios(atuais)));
    expect(reaberto.map((s) => s.ordens[0].quantidade)).toEqual([100, 60]);
  });
});
