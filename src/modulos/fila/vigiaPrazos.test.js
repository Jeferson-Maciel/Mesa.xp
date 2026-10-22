import { describe, expect, it } from 'vitest';
import { mudarEstado, novoPedido, registrarResposta } from '../../comum/fila/regras.js';
import { criarRepositorioEmMemoria } from '../../comum/fila/repositorio.js';
import { criarVigiaDePrazos } from './vigiaPrazos.js';

// Contas fictícias. 21/10/2026, uma quarta-feira.
const em = (hora, min = 0) => new Date(2026, 9, 21, hora, min).getTime();
const pedido = (conta = '1234567') =>
  novoPedido({ conta, grupo: 'bolsa', formato: 'email', assunto: 'Confirmação de ordem', ordens: [{ ativo: 'PETR4', operacao: 'C', quantidade: 100 }], texto: '', em: em(10) });

const montar = async (pedidos, agora) => {
  const repo = criarRepositorioEmMemoria();
  for (const p of pedidos) await repo.salvar(p);
  const avisos = [];
  const abertos = [];
  const relogio = { agora };
  const vigia = criarVigiaDePrazos({ repo, avisar: (texto, opcoes) => avisos.push({ texto, opcoes }), abrir: (p) => abertos.push(p.id), agora: () => relogio.agora });
  return { repo, avisos, abertos, relogio, vigia };
};

describe('o vigia dos prazos da Fila', () => {
  it('avisa em qualquer aba, com som (tipo prazo) e "Ver na Fila", que leva ao cartão', async () => {
    const p = pedido();
    const { avisos, abertos, vigia } = await montar([p], em(16, 30));
    await vigia.conferir();
    expect(avisos).toHaveLength(1);
    expect(avisos[0].texto).toContain('Conta 1234567 · Bolsa: leilão da B3 16:55');
    expect(avisos[0].opcoes).toMatchObject({ tipo: 'prazo', acao: { rotulo: 'Ver na Fila' } });
    avisos[0].opcoes.acao.fazer();
    expect(abertos).toEqual([p.id]);
  });

  it('uma vez só: o aviso fica marcado no cartão, mesmo depois de recarregar (outro vigia)', async () => {
    const { repo, avisos, vigia, relogio } = await montar([pedido()], em(16, 30));
    await vigia.conferir();
    relogio.agora = em(16, 31);
    await vigia.conferir();
    const outro = [];
    await criarVigiaDePrazos({ repo, avisar: (t) => outro.push(t), agora: () => em(16, 32) }).conferir();
    expect(avisos).toHaveLength(1);
    expect(outro).toEqual([]);
    expect((await repo.listarTodos())[0].prazosAvisados).toHaveLength(1);
  });

  it('marca no cartão como está no banco agora: não apaga a resposta que o vigia do Outlook acabou de gravar', async () => {
    const p = pedido();
    const { repo, vigia } = await montar([p], em(16, 30));
    const ler = repo.listarDesde;
    let primeira = true;
    repo.listarDesde = async (dia) => {
      const lidos = await ler(dia);
      if (primeira) {
        primeira = false;
        // Entre a leitura e a gravação, a resposta do cliente chegou.
        await repo.salvar(registrarResposta(p, { id: 'r1', de: 'Fulano', previa: 'ok', em: em(16, 30) }, em(16, 30)));
      }
      return lidos;
    };
    await vigia.conferir();
    expect((await repo.listarTodos())[0]).toMatchObject({ estado: 'respondeu', resposta: { id: 'r1' } });
  });

  it('o executado não avisa; nem fora da antecedência', async () => {
    const { avisos, vigia, relogio } = await montar([mudarEstado(pedido(), 'executado', em(11)), pedido('7654321')], em(16));
    await vigia.conferir();
    expect(avisos).toEqual([]);
    relogio.agora = em(16, 26);
    await vigia.conferir();
    expect(avisos.map((a) => a.texto)).toEqual([expect.stringContaining('7654321')]);
  });
});
