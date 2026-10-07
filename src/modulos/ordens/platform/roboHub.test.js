import { describe, expect, it, vi } from 'vitest';
import { ErroDoRobo, VERSAO_DO_ROBO, criarRoboHub, scriptDoRobo } from './roboHub.js';

/**
 * Uma janela de mentira com um robô de mentira: o que a página manda pelo postMessage chega ao
 * robô, e o que o robô manda chega à página, como acontece com o Tampermonkey na aba de verdade.
 */
const janelaComRobo = ({ instalado = true, responde = true, cota = 'responde', hub = { abas: 1, prateleira: true } } = {}) => {
  const janela = new EventTarget();
  const recebidas = [];
  const entregar = (data) => janela.dispatchEvent(Object.assign(new Event('message'), { data, source: janela }));

  const robo = (m) => {
    if (m.origem !== 'mesa-xp' || !instalado) return;
    recebidas.push(m);
    if (m.tipo === 'ola') entregar({ origem: 'robo-hub', tipo: 'presente', versao: VERSAO_DO_ROBO, hub });
    if (m.tipo === 'pedir-cotacao' && responde) {
      entregar({ origem: 'robo-hub', tipo: 'captura', id: m.id, capturadaEm: '2026-10-06T15:09:48.602Z', resposta: { data: [] } });
    }
    if (m.tipo === 'pedir-registro') {
      entregar({ origem: 'robo-hub', tipo: 'registro', id: m.id, entradas: [{ em: m.desde + 10, passo: 'clicou em Atualizar' }] });
    }
    // O robô lê as boletas uma atrás da outra e entrega cada preço assim que o lê. Com 'falha', a
    // segunda boleta não carrega; com 'mudo', ele entrega a primeira e para de responder.
    if (m.tipo === 'pedir-cotas') {
      m.itens.forEach(({ fundoId }, i) => {
        if (cota === 'mudo' && i > 0) return;
        if (cota === 'falha' && i === 1) entregar({ origem: 'robo-hub', tipo: 'cota-falhou', id: m.id, fundoId, motivo: 'sem-boleta' });
        else entregar({ origem: 'robo-hub', tipo: 'cota', id: m.id, fundoId, valor: 8.337589, dataDaCota: '2026-10-01' });
      });
      if (cota !== 'mudo') entregar({ origem: 'robo-hub', tipo: 'cotas-fim', id: m.id });
    }
  };

  janela.postMessage = (data) => queueMicrotask(() => {
    entregar(data);
    robo(data);
  });
  return { janela, recebidas, entregar };
};

const umInstante = () => new Promise((r) => setTimeout(r, 0));

describe('o robô do Hub, visto pela Mesa', () => {
  it('descobre o robô instalado e o estado do Hub', async () => {
    const { janela } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    await umInstante();
    expect(robo.presente).toBe(true);
    expect(robo.versao).toBe(VERSAO_DO_ROBO);
    expect(robo.hub).toEqual({ abas: 1, prateleira: true });
  });

  it('sem o robô, diz que não está instalado e não espera resposta', async () => {
    const { janela } = janelaComRobo({ instalado: false });
    const robo = criarRoboHub({ janela });
    await umInstante();
    expect(robo.presente).toBe(false);
    await expect(robo.pedirCotacao()).rejects.toMatchObject({ codigo: 'sem-robo' });
  });

  it('pede a cotação e recebe a resposta daquele pedido', async () => {
    const { janela } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    await umInstante();
    const captura = await robo.pedirCotacao();
    expect(captura).toMatchObject({ capturadaEm: '2026-10-06T15:09:48.602Z', resposta: { data: [] } });
  });

  it('desiste depois do prazo, se o Hub não responder', async () => {
    vi.useFakeTimers();
    try {
      const { janela } = janelaComRobo({ responde: false });
      const robo = criarRoboHub({ janela });
      await vi.advanceTimersByTimeAsync(0);
      const pedido = robo.pedirCotacao({ prazo: 30000 });
      const falhou = expect(pedido).rejects.toBeInstanceOf(ErroDoRobo);
      await vi.advanceTimersByTimeAsync(30001);
      await falhou;
      await expect(pedido).rejects.toMatchObject({ codigo: 'sem-resposta' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('avisa de toda captura, mesmo a que ninguém pediu (alguém atualizou o Hub à mão)', async () => {
    const { janela, entregar } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    const recebidas = [];
    robo.aoReceberCaptura((c) => recebidas.push(c));
    entregar({ origem: 'robo-hub', tipo: 'captura', id: null, capturadaEm: '2026-10-06T15:20:00.000Z', resposta: { data: [] } });
    expect(recebidas).toHaveLength(1);
  });

  it('ignora mensagem que não é do robô', async () => {
    const { janela, entregar } = janelaComRobo({ instalado: false });
    const robo = criarRoboHub({ janela });
    const recebidas = [];
    robo.aoReceberCaptura((c) => recebidas.push(c));
    entregar({ origem: 'outra-coisa', tipo: 'captura', resposta: { data: [] } });
    entregar({ tipo: 'presente' });
    expect(recebidas).toEqual([]);
    expect(robo.presente).toBe(false);
  });

  it('pede a última captura guardada ao achar o robô', async () => {
    const { janela, recebidas } = janelaComRobo();
    criarRoboHub({ janela });
    await umInstante();
    await umInstante();
    expect(recebidas.map((m) => m.tipo)).toEqual(['ola', 'ultima-captura']);
  });
});

describe('o preço exato das cotas, pelas boletas', () => {
  const FUNDO = 'ce52be97-05e7-40d9-887a-215d7711bfc7';
  const OUTRO = '9437b32f-0000-4000-8000-000000000001';
  const itens = [
    { fundoId: FUNDO, conta: '1234567' },
    { fundoId: OUTRO, conta: 1234567 }
  ];
  const preco = (fundoId) => ({ fundoId, valor: 8.337589, dataDaCota: '2026-10-01' });

  it('pede os preços de vários fundos de uma vez e recebe cada um assim que chega', async () => {
    const { janela, recebidas } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    await umInstante();
    const chegaram = [];
    const resultados = await robo.pedirCotas({ itens, aoChegar: (r) => chegaram.push(r.fundoId) });
    expect(resultados).toEqual([preco(FUNDO), preco(OUTRO)]);
    expect(chegaram).toEqual([FUNDO, OUTRO]);
    expect(recebidas.filter((m) => m.tipo === 'pedir-cotas')).toHaveLength(1);
    expect(recebidas.at(-1).itens).toEqual([
      { fundoId: FUNDO, conta: '1234567' },
      { fundoId: OUTRO, conta: '1234567' }
    ]);
  });

  it('a falha de um fundo vem com o motivo e não derruba os outros', async () => {
    const { janela } = janelaComRobo({ cota: 'falha' });
    const robo = criarRoboHub({ janela });
    await umInstante();
    const [primeiro, segundo] = await robo.pedirCotas({ itens });
    expect(primeiro).toEqual(preco(FUNDO));
    expect(segundo.erro).toBeInstanceOf(ErroDoRobo);
    expect(segundo.erro).toMatchObject({ codigo: 'sem-boleta' });
    expect(segundo.erro.message).toContain('boleta');
  });

  it('sem notícia do robô por um tempo, o que falta vem como sem resposta, e o que chegou fica', async () => {
    vi.useFakeTimers();
    try {
      const { janela } = janelaComRobo({ cota: 'mudo' });
      const robo = criarRoboHub({ janela });
      await vi.advanceTimersByTimeAsync(0);
      const pedido = robo.pedirCotas({ itens, prazo: 40000 });
      await vi.advanceTimersByTimeAsync(40001);
      const [primeiro, segundo] = await pedido;
      expect(primeiro).toEqual(preco(FUNDO));
      expect(segundo.erro).toMatchObject({ codigo: 'sem-resposta' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('sem o robô, todos vêm com o motivo', async () => {
    const { janela } = janelaComRobo({ instalado: false });
    const robo = criarRoboHub({ janela });
    const resultados = await robo.pedirCotas({ itens });
    expect(resultados.map((r) => r.erro?.codigo)).toEqual(['sem-robo', 'sem-robo']);
  });

  it('o preço visto numa boleta que a pessoa abriu também chega, sem pedido', async () => {
    const { janela, entregar } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    const vistas = [];
    robo.aoReceberCota((c) => vistas.push(c));
    entregar({ origem: 'robo-hub', tipo: 'cota', id: null, fundoId: FUNDO, valor: 8.337589, dataDaCota: '2026-10-01' });
    expect(vistas).toEqual([{ fundoId: FUNDO, valor: 8.337589, dataDaCota: '2026-10-01' }]);
  });

  it('não manda ao robô conta ou fundo que não tenham a forma certa', async () => {
    const { janela, recebidas } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    await umInstante();
    const resultados = await robo.pedirCotas({
      itens: [
        { fundoId: '../../x', conta: '1234567' },
        { fundoId: FUNDO, conta: '12/34' }
      ]
    });
    expect(resultados.map((r) => r.erro?.codigo)).toEqual(['invalido', 'invalido']);
    expect(recebidas.some((m) => m.tipo === 'pedir-cotas')).toBe(false);
  });
});

describe('o registro de tempos do robô', () => {
  it('pede ao robô o que ele anotou desde um instante', async () => {
    const { janela, recebidas } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    await umInstante();
    await expect(robo.pedirRegistro(1000)).resolves.toEqual([{ em: 1010, passo: 'clicou em Atualizar' }]);
    expect(recebidas.at(-1)).toMatchObject({ tipo: 'pedir-registro', desde: 1000 });
  });

  it('sem resposta, o registro vem vazio — o relatório sai só com o lado da Mesa', async () => {
    const { janela } = janelaComRobo({ instalado: false });
    const robo = criarRoboHub({ janela });
    await expect(robo.pedirRegistro(1000, { prazo: 10 })).resolves.toEqual([]);
  });
});

describe('o cliente da conta, pelo robô', () => {
  // Um robô que responde ao pedido do cliente como `resposta(m)` mandar.
  const comCliente = (resposta) => {
    const montado = janelaComRobo();
    const postar = montado.janela.postMessage;
    montado.janela.postMessage = (data) => {
      postar(data);
      if (data.tipo === 'pedir-cliente') queueMicrotask(() => montado.entregar({ origem: 'robo-hub', tipo: 'cliente', id: data.id, ...resposta(data) }));
    };
    return montado;
  };

  it('pede pela conta e recebe só o nome, o e-mail e o assessor', async () => {
    const { janela, recebidas } = comCliente((m) => ({
      conta: m.conta,
      nome: 'ANA PAULA DA SILVA',
      email: 'ANA@EXEMPLO.COM',
      assessorCodigo: 'A12345',
      assessorNome: 'Bruno Costa',
      cpf: 'não deveria vir'
    }));
    const robo = criarRoboHub({ janela });
    await umInstante();
    await expect(robo.pedirCliente('1234567')).resolves.toEqual({
      conta: '1234567',
      nome: 'ANA PAULA DA SILVA',
      email: 'ANA@EXEMPLO.COM',
      assessorCodigo: 'A12345',
      assessorNome: 'Bruno Costa'
    });
    expect(recebidas.at(-1)).toMatchObject({ tipo: 'pedir-cliente', conta: '1234567' });
  });

  it('o cliente que o Hub não mostrou vem com o motivo', async () => {
    const { janela } = comCliente(() => ({ erro: 'sem-cliente' }));
    const robo = criarRoboHub({ janela });
    await umInstante();
    await expect(robo.pedirCliente('1234567')).rejects.toMatchObject({ codigo: 'sem-cliente' });
  });

  // A ficha chegou, mas num formato que o robô não lê: o aviso diz que é o robô, não a conta.
  it('a ficha num formato desconhecido diz que o robô precisa ser atualizado', async () => {
    const { janela } = comCliente(() => ({ erro: 'ficha-desconhecida' }));
    const robo = criarRoboHub({ janela });
    await umInstante();
    await expect(robo.pedirCliente('1234567')).rejects.toMatchObject({ codigo: 'ficha-desconhecida', message: expect.stringContaining('atualizado') });
  });

  it('conta numa forma estranha nem chega ao robô', async () => {
    const { janela, recebidas } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    await umInstante();
    await expect(robo.pedirCliente('12 34')).rejects.toMatchObject({ codigo: 'invalido' });
    expect(recebidas.some((m) => m.tipo === 'pedir-cliente')).toBe(false);
  });
});

describe('o script do robô que a Mesa oferece para copiar', () => {
  it('é o script do Tampermonkey, com a versão que a Mesa espera', () => {
    expect(scriptDoRobo).toMatch(/^\/\/ ==UserScript==/);
    expect(scriptDoRobo).toContain(`// @version      ${VERSAO_DO_ROBO}`);
    expect(scriptDoRobo).toContain(`const VERSAO = '${VERSAO_DO_ROBO}';`);
    expect(scriptDoRobo).toContain('// @match        https://hub.xpi.com.br/*');
  });

  // A Mesa publicada na Vercel: o @match faz o Tampermonkey rodar nela, e MESAS_NO_AR faz o robô
  // reconhecê-la como a Mesa.
  it('roda na Mesa publicada na Vercel', () => {
    expect(scriptDoRobo).toContain('// @match        https://mesa-xp.vercel.app/*');
    expect(scriptDoRobo).toContain("const MESAS_NO_AR = ['mesa-xp.vercel.app'];");
  });

  it('não lê senha, token nem cabeçalho, e não chama a API por conta própria', () => {
    expect(scriptDoRobo).not.toMatch(/localStorage|sessionStorage|document\.cookie|authorization|headers/i);
    expect(scriptDoRobo).not.toMatch(/api-advisor\.xpi\.com\.br/);
  });
});
