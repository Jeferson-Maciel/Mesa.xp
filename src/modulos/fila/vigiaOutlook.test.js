import { describe, expect, it } from 'vitest';
import { mudarEstado, novoPedido } from '../../comum/fila/regras.js';
import { criarRepositorioEmMemoria } from '../../comum/fila/repositorio.js';
import { criarVigiaDoOutlook } from './vigiaOutlook.js';

// Contas, nomes e e-mails fictícios. 21/10/2026, às 11h.
const em = (hora, min = 0, dia = 21) => new Date(2026, 9, dia, hora, min).getTime();
const AGORA = em(11);
const pedido = ({ conta = '1234567', nome = 'FULANA DE TAL DA SILVA', email = 'fulana.tal@exemplo.com', grupo = 'bolsa', hora = 10, dia = 21 } = {}) =>
  novoPedido({
    conta,
    cliente: { nome, email },
    grupo,
    formato: 'email',
    assunto: 'Confirmação de ordem',
    ordens: [{ ativo: 'PETR4', operacao: 'C', quantidade: 100 }],
    texto: '',
    em: em(hora, 0, dia)
  });
const resposta = (extra = {}) => ({ id: 'r1', de: 'Fulana Tal', email: 'fulana.tal@exemplo.com', assunto: 'RES: Confirmação de ordem', previa: 'De acordo, pode seguir.', hora: '10:42', ...extra });

const montar = async (pedidos, { versao = '1.8.0' } = {}) => {
  const repo = criarRepositorioEmMemoria();
  for (const p of pedidos) await repo.salvar(p);
  const robo = {
    presente: true,
    versao,
    pedidos: 0,
    aoReceberOutlook(fn) {
      this.entregar = fn;
    },
    vigiarOutlook() {
      this.pedidos++;
    }
  };
  const avisos = [];
  const vigia = criarVigiaDoOutlook({ robo, versaoEsperada: '1.8.0', repo, avisar: (m) => avisos.push(m), agora: () => AGORA });
  const ler = async (respostas, extra = {}) => {
    robo.entregar({ em: AGORA, lista: true, itens: 30, respostas, ...extra });
    await vigia.pronto();
  };
  return { repo, robo, vigia, avisos, ler };
};

describe('o vigia das respostas no Outlook', () => {
  it('a resposta do e-mail do cliente passa o cartão para "o cliente respondeu", com aviso na tela', async () => {
    const p = pedido();
    const { repo, vigia, avisos, ler } = await montar([p]);
    await ler([resposta()]);
    const [lido] = await repo.listarTodos();
    expect(lido).toMatchObject({ estado: 'respondeu', resposta: { id: 'r1', previa: 'De acordo, pode seguir.', em: em(10, 42) } });
    expect(avisos[0]).toContain('Fulana Tal respondeu (conta 1234567): "De acordo, pode seguir."');
    expect(vigia.soltas()).toEqual([]);
  });

  it('a mesma resposta de novo não mexe; a conversa com mensagem nova troca a prévia', async () => {
    const { repo, avisos, ler } = await montar([pedido()]);
    await ler([resposta()]);
    await ler([resposta()]);
    expect(avisos).toHaveLength(1);
    await ler([resposta({ previa: 'Só metade, por favor.' })]);
    const [lido] = await repo.listarTodos();
    expect(lido.resposta.previa).toBe('Só metade, por favor.');
    expect(lido.estado).toBe('respondeu');
  });

  it('o pedido de ontem ainda esperando recebe a resposta de hoje', async () => {
    const ontem = pedido({ hora: 17, dia: 20 });
    const { repo, ler } = await montar([ontem]);
    await ler([resposta()]);
    expect((await repo.listarTodos())[0].estado).toBe('respondeu');
  });

  it('pelo nome, ambígua ou sem cartão: fica a conferir, e o operador atribui ou ignora', async () => {
    const p = pedido();
    const { repo, vigia, ler } = await montar([p]);
    await ler([
      resposta({ id: 'r2', email: 'fulana.pessoal@exemplo.com.br', de: 'Fulana Silva' }),
      resposta({ id: 'r3', email: 'beltrano@exemplo.com', de: 'Beltrano Souza' })
    ]);
    expect(vigia.soltas().map((s) => [s.resposta.id, s.motivo, s.candidatos])).toEqual([
      ['r2', 'pelo-nome', [p.id]],
      ['r3', 'nenhum', []]
    ]);
    await vigia.atribuir('r2', p.id);
    expect((await repo.listarTodos())[0]).toMatchObject({ estado: 'respondeu', resposta: { id: 'r2' } });
    vigia.ignorar('r3');
    expect(vigia.soltas()).toEqual([]);
  });

  it('a mensagem que não é de hoje fica de fora', async () => {
    const { repo, vigia, ler } = await montar([pedido()]);
    await ler([resposta({ hora: 'ter 20/10' })]);
    expect((await repo.listarTodos())[0].estado).toBe('enviado');
    expect(vigia.soltas()).toEqual([]);
  });

  it('pede a vigia só com pedido esperando o cliente', async () => {
    const vazio = await montar([mudarEstado(pedido(), 'executado', em(10, 30))]);
    await vazio.vigia.pedirSePrecisa();
    expect(vazio.robo.pedidos).toBe(0);
    expect(vazio.vigia.situacao().tipo).toBe('parado');

    const { robo, vigia, ler } = await montar([pedido()]);
    await vigia.pedirSePrecisa();
    expect(robo.pedidos).toBe(1);
    expect(vigia.situacao().tipo).toBe('sem-caixa');
    await ler([]);
    expect(vigia.situacao()).toMatchObject({ tipo: 'vigiando', texto: 'Outlook: vendo as respostas · 11:00' });
  });

  it('o robô de outra versão pede a atualização', async () => {
    const { vigia } = await montar([pedido()], { versao: '1.7.1' });
    expect(vigia.situacao()).toMatchObject({ tipo: 'robo-velho' });
  });
});
