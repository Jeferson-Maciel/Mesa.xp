import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ENDERECO_DO_ROBO, ErroDoRobo, VERSAO_DO_ROBO, VERSAO_MINIMA_DO_ROBO, compararVersoes, criarRoboHub, fonteDoRobo, roboAtende } from './roboHub.js';
import { montarRobo } from './montarRobo.js';

/**
 * Uma janela de mentira com um robô de mentira: o que a página manda pelo postMessage chega ao
 * robô, e o que o robô manda chega à página, como acontece com o Tampermonkey na aba de verdade.
 */
const janelaComRobo = ({ instalado = true, responde = true, cota = 'responde', planilha = 'responde', hub = { abas: 1, prateleira: true }, versao = VERSAO_DO_ROBO } = {}) => {
  const janela = new EventTarget();
  const recebidas = [];
  const entregar = (data) => janela.dispatchEvent(Object.assign(new Event('message'), { data, source: janela }));

  const robo = (m) => {
    if (m.origem !== 'mesa-xp' || !instalado) return;
    recebidas.push(m);
    if (m.tipo === 'ola') entregar({ origem: 'robo-hub', tipo: 'presente', versao, hub });
    if (m.tipo === 'pedir-cotacao' && responde) {
      entregar({ origem: 'robo-hub', tipo: 'captura', id: m.id, capturadaEm: '2026-10-06T15:09:48.602Z', resposta: { data: [] } });
    }
    if (m.tipo === 'pedir-registro') {
      entregar({ origem: 'robo-hub', tipo: 'registro', id: m.id, entradas: [{ em: m.desde + 10, passo: 'clicou em Atualizar' }] });
    }
    if (m.tipo === 'pedir-planilha-renda-fixa' && responde) {
      if (planilha === 'falha') entregar({ origem: 'robo-hub', tipo: 'planilha-renda-fixa', id: m.id, erro: 'sem-planilha' });
      else if (planilha !== 'mudo') entregar({ origem: 'robo-hub', tipo: 'planilha-renda-fixa', id: m.id, base64: btoa('PKconteudo-de-teste'), tamanho: 19, em: 1729600000000 });
    }
    // O robô lê as boletas uma atrás da outra e entrega cada preço assim que o lê. Com 'falha', a
    // segunda boleta não carrega; com 'mudo', ele entrega a primeira e para de responder.
    if (m.tipo === 'pedir-cotas') {
      m.itens.forEach(({ fundoId, lado }, i) => {
        if (cota === 'mudo' && i > 0) return;
        // A 1.4.0 diz de qual item é a resposta (`indice`) e, da boleta lida, o estoque e a posição.
        const daBoleta = lado
          ? { indice: i, lado, stock: { canOperateSellTreasury: true }, posicao: lado === 'vender' ? { quotaQuantityAvailable: 10.5 } : null }
          : {};
        if (cota === 'falha' && i === 1) entregar({ origem: 'robo-hub', tipo: 'cota-falhou', id: m.id, fundoId, motivo: 'sem-boleta', ...(lado ? { indice: i } : {}) });
        else entregar({ origem: 'robo-hub', tipo: 'cota', id: m.id, fundoId, valor: 8.337589, dataDaCota: '2026-10-01', ...daBoleta });
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
    expect(vistas).toEqual([{ fundoId: FUNDO, valor: 8.337589, dataDaCota: '2026-10-01', em: expect.any(Number) }]);
  });

  // O preço vale poucos minutos: o que veio de uma boleta aberta mais cedo conta da hora dela.
  it('o preço de uma boleta aberta mais cedo chega com a hora em que foi lido', async () => {
    const { janela, entregar } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    const vistas = [];
    robo.aoReceberCota((c) => vistas.push(c));
    entregar({ origem: 'robo-hub', tipo: 'cota', id: null, fundoId: FUNDO, valor: 8.337589, dataDaCota: '2026-10-01', em: 1_790_000_000_000 });
    expect(vistas[0].em).toBe(1_790_000_000_000);
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

const snapdom = readFileSync(new URL('../../../vendor/snapdom.js', import.meta.url), 'utf8');
const scriptDoRobo = montarRobo(fonteDoRobo, snapdom);

describe('o script do robô publicado para o Tampermonkey (robo-hub.user.js)', () => {
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

  // O código do robô, sem a SnapDOM: a biblioteca do print tem `fetch` e `headers` dentro (traz as
  // imagens da própria página para o print) e é conferida à parte, byte a byte, no teste do vendor.
  it('não lê senha, token nem cabeçalho, e não chama a API por conta própria', () => {
    expect(fonteDoRobo).not.toMatch(/localStorage|sessionStorage|document\.cookie|authorization|headers/i);
    expect(fonteDoRobo).not.toMatch(/api-advisor\.xpi\.com\.br/);
    expect(fonteDoRobo).not.toMatch(/\bfetch\(|XMLHttpRequest\(\)/);
  });

  it('o script publicado é o robô com a SnapDOM vendorizada no marcador, e nada mais', () => {
    expect(fonteDoRobo).toContain('/*@@SNAPDOM@@*/');
    expect(scriptDoRobo).not.toContain('/*@@SNAPDOM@@*/');
    expect(scriptDoRobo).toBe(fonteDoRobo.replace('/*@@SNAPDOM@@*/', () => snapdom));
  });

  it('nunca clica em Próximo: os cliques do print estão numa lista fechada', () => {
    expect(fonteDoRobo).toContain("const CLIQUES_PERMITIDOS = ['Estoque XP', 'Estoque clientes', 'Total de cotas', 'Visualizar mais detalhes da operação'];");
    expect(fonteDoRobo).toContain("const CLIQUES_POR_ROTULO = ['Exportar'];");
    // O código sem os comentários: fora do `clicarSo`, o robô só clica no Atualizar da Prateleira, e
    // nenhum botão de seguir adiante aparece nele.
    const codigo = fonteDoRobo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(codigo.match(/\.click\(\)/g)).toHaveLength(2);
    expect(codigo).not.toMatch(/Próximo|Enviar|Confirmar|Vender/);
  });

  it('o único clique novo é no botão Exportar do Renda Fixa, por aria-label exato', () => {
    expect(fonteDoRobo).toContain("const CLIQUES_POR_ROTULO = ['Exportar'];");
    expect(fonteDoRobo).not.toMatch(/CLIQUES_POR_ROTULO\s*=\s*\[[^\]]*(?:Próximo|Enviar|Confirmar|Vender)/);
  });
});

describe('a planilha de Renda Fixa do Hub (robô 1.14.0)', () => {
  it('pede a planilha e recebe os bytes decodificados em Uint8Array', async () => {
    const { janela, recebidas } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    await umInstante();
    const res = await robo.pedirPlanilhaRendaFixa();
    expect(res).toMatchObject({ tamanho: 19, em: 1729600000000 });
    expect(res.dados).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(res.dados)).toBe('PKconteudo-de-teste');
    expect(recebidas.at(-1)).toMatchObject({ tipo: 'pedir-planilha-renda-fixa' });
  });

  it('com falha do robô ou Hub, rejeita com ErroDoRobo(sem-planilha)', async () => {
    const { janela } = janelaComRobo({ planilha: 'falha' });
    const robo = criarRoboHub({ janela });
    await umInstante();
    await expect(robo.pedirPlanilhaRendaFixa()).rejects.toMatchObject({
      codigo: 'sem-planilha',
      message: expect.stringContaining('Hub não entregou a planilha de Renda Fixa')
    });
  });

  it('sem o robô instalado, rejeita com sem-robo', async () => {
    const { janela } = janelaComRobo({ instalado: false });
    const robo = criarRoboHub({ janela });
    await expect(robo.pedirPlanilhaRendaFixa()).rejects.toMatchObject({ codigo: 'sem-robo' });
  });

  it('sem resposta no prazo, rejeita com sem-resposta', async () => {
    vi.useFakeTimers();
    try {
      const { janela } = janelaComRobo({ planilha: 'mudo' });
      const robo = criarRoboHub({ janela });
      await vi.advanceTimersByTimeAsync(0);
      const checagem = expect(robo.pedirPlanilhaRendaFixa({ prazo: 1000 })).rejects.toMatchObject({ codigo: 'sem-resposta' });
      await vi.advanceTimersByTimeAsync(1001);
      await checagem;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('as boletas de compra e de venda (robô 1.4.0)', () => {
  const FUNDO = 'ce52be97-05e7-40d9-887a-215d7711bfc7';

  it('pede cada boleta com o lado, e o mesmo fundo em duas contas volta separado', async () => {
    const { janela, recebidas } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    await umInstante();
    const itens = [
      { fundoId: FUNDO, conta: '1234567', lado: 'vender' },
      { fundoId: FUNDO, conta: '7654321', lado: 'vender' },
      { fundoId: FUNDO, conta: '1234567', lado: 'comprar' }
    ];
    const resultados = await robo.pedirBoletas({ itens });
    expect(recebidas.at(-1).itens).toEqual(itens);
    expect(resultados.map((r) => [r.indice, r.lado, r.boleta?.posicao?.quotaQuantityAvailable ?? null])).toEqual([
      [0, 'vender', 10.5],
      [1, 'vender', 10.5],
      [2, 'comprar', null]
    ]);
    expect(resultados[0].boleta).toMatchObject({ fundoId: FUNDO, lado: 'vender', quotaValue: 8.337589, quotaDate: '2026-10-01' });
  });

  it('a falha de uma boleta vem com o motivo, no lugar dela', async () => {
    const { janela } = janelaComRobo({ cota: 'falha' });
    const robo = criarRoboHub({ janela });
    await umInstante();
    const [, segundo] = await robo.pedirBoletas({ itens: [{ fundoId: FUNDO, conta: '1234567', lado: 'vender' }, { fundoId: FUNDO, conta: '7654321', lado: 'vender' }] });
    expect(segundo).toMatchObject({ indice: 1, erro: { codigo: 'sem-boleta' } });
  });

  it('lado estranho vira compra; conta ou fundo estranhos nem chegam ao robô', async () => {
    const { janela, recebidas } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    await umInstante();
    const resultados = await robo.pedirBoletas({ itens: [{ fundoId: FUNDO, conta: '1234567', lado: 'xyz' }, { fundoId: 'x', conta: '1', lado: 'vender' }] });
    expect(recebidas.at(-1).itens).toEqual([{ fundoId: FUNDO, conta: '1234567', lado: 'comprar' }]);
    expect(resultados[1].erro).toMatchObject({ codigo: 'invalido' });
  });
});

describe('o print da cotação de venda e o corpo no Outlook (robô 1.5.0)', () => {
  const FUNDO = 'ce52be97-05e7-40d9-887a-215d7711bfc7';
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';

  // Um robô de mentira que tira os prints (o segundo não bate a quantidade) e cola no Outlook.
  const janelaComPrints = () => {
    const { janela, recebidas, entregar } = janelaComRobo();
    const original = janela.postMessage;
    janela.postMessage = (data) => {
      original(data);
      if (data.origem !== 'mesa-xp') return;
      queueMicrotask(() => {
        if (data.tipo === 'pedir-prints') {
          data.itens.forEach(({ fundoId }, i) =>
            entregar({ origem: 'robo-hub', tipo: 'print', id: data.id, indice: i, fundoId, png: i === 1 ? null : PNG, quantidade: 10.5, em: 1, erro: i === 1 ? 'quantidade-diferente' : null })
          );
          entregar({ origem: 'robo-hub', tipo: 'prints-fim', id: data.id });
        }
        if (data.tipo === 'preparar-outlook' && typeof data.html === 'string') entregar({ origem: 'robo-hub', tipo: 'corpo-colado', id: data.id, ok: true, motivo: null });
      });
    };
    return { janela, recebidas };
  };

  it('pede os prints com a quantidade (null é o total) e recebe cada um, ou o motivo', async () => {
    const { janela, recebidas } = janelaComPrints();
    const robo = criarRoboHub({ janela });
    await umInstante();
    const itens = [
      { fundoId: FUNDO, conta: '1234567', quantidade: null },
      { fundoId: FUNDO, conta: '7654321', quantidade: 590, modalidade: 'clientes', desagio: 10 }
    ];
    const [primeiro, segundo] = await robo.pedirPrints({ itens });
    // O estoque vai junto (1.9.0): sem ele, o Estoque XP, e sem o deságio, nada a conferir no painel.
    expect(recebidas.find((m) => m.tipo === 'pedir-prints').itens).toEqual([
      { fundoId: FUNDO, conta: '1234567', quantidade: null, modalidade: 'xp', desagio: null },
      { fundoId: FUNDO, conta: '7654321', quantidade: 590, modalidade: 'clientes', desagio: 10 }
    ]);
    expect(primeiro).toMatchObject({ indice: 0, png: PNG, quantidade: 10.5 });
    expect(segundo.erro).toMatchObject({ codigo: 'quantidade-diferente' });
    expect(segundo.erro.message).toContain('não bateu');
  });

  it('quantidade zero, negativa ou em texto nem chega ao robô', async () => {
    const { janela, recebidas } = janelaComPrints();
    const robo = criarRoboHub({ janela });
    await umInstante();
    const resultados = await robo.pedirPrints({ itens: [{ fundoId: FUNDO, conta: '1234567', quantidade: 0 }, { fundoId: FUNDO, conta: '1234567', quantidade: '5' }] });
    expect(resultados.map((r) => r.erro?.codigo)).toEqual(['invalido', 'invalido']);
    expect(recebidas.some((m) => m.tipo === 'pedir-prints')).toBe(false);
  });

  it('deixa o corpo em HTML com o robô e espera ele dizer que colou', async () => {
    const { janela, recebidas } = janelaComPrints();
    const robo = criarRoboHub({ janela });
    await umInstante();
    const r = await robo.prepararOutlook({ html: '<div>oi</div>', texto: 'oi', inicio: 'oi' });
    expect(r).toEqual({ ok: true, motivo: null });
    const mandadas = recebidas.filter((m) => m.tipo === 'preparar-outlook');
    // Primeiro a reserva, sem o HTML; depois o HTML, com o mesmo id.
    expect(mandadas.map((m) => m.html)).toEqual([null, '<div>oi</div>']);
    expect(mandadas[0].id).toBe(mandadas[1].id);
    expect(mandadas[1].inicio).toBe('oi');
  });

  it('a reserva cancelada deixa o corpo de texto e responde que foi cancelada', async () => {
    const { janela, recebidas } = janelaComPrints();
    const robo = criarRoboHub({ janela });
    await umInstante();
    const reserva = robo.reservarOutlook({ inicio: 'oi' });
    reserva.cancelar();
    expect(await reserva.resposta).toEqual({ ok: false, motivo: 'cancelado' });
    await umInstante();
    expect(recebidas.some((m) => m.tipo === 'cancelar-outlook')).toBe(true);
  });

  it('sem o robô, o Outlook fica sem o corpo em HTML, com o motivo', async () => {
    const { janela } = janelaComRobo({ instalado: false });
    const robo = criarRoboHub({ janela });
    expect(await robo.prepararOutlook({ html: '<div></div>', texto: '' })).toEqual({ ok: false, motivo: 'sem-robo' });
  });
});

describe('as respostas no Outlook (robô 1.8.0)', () => {
  it('pede a vigia só com o robô, e entrega o que ele viu, com cada campo no tamanho certo', async () => {
    const { janela, recebidas } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    await umInstante();
    robo.vigiarOutlook();
    await umInstante();
    expect(recebidas.at(-1).tipo).toBe('vigiar-outlook');

    const leituras = [];
    robo.aoReceberOutlook((l) => leituras.push(l));
    janela.dispatchEvent(
      Object.assign(new Event('message'), {
        source: janela,
        data: {
          origem: 'robo-hub',
          tipo: 'outlook',
          em: 1,
          lista: true,
          itens: 30,
          respostas: [
            { id: 'r1', de: 'Fulana Tal', email: 'fulana.tal@exemplo.com', assunto: 'RES: Confirmação de ordem', previa: 'x'.repeat(2500), hora: '10:42' },
            { id: 2, assunto: 'sem id de texto' },
            null
          ]
        }
      })
    );
    expect(leituras).toHaveLength(1);
    expect(leituras[0]).toMatchObject({ em: 1, lista: true, itens: 30 });
    expect(leituras[0].respostas).toHaveLength(1);
    expect(leituras[0].respostas[0].previa).toHaveLength(2000);
  });

  it('sem o robô, pedir a vigia não manda nada', () => {
    const { janela } = janelaComRobo({ instalado: false });
    const mandadas = [];
    const postMessage = janela.postMessage;
    janela.postMessage = (data) => {
      mandadas.push(data.tipo);
      postMessage(data);
    };
    criarRoboHub({ janela }).vigiarOutlook();
    expect(mandadas).toEqual(['ola']);
  });

  it('o robô não clica, não abre e-mail e não envia nada no Outlook', () => {
    const vigia = fonteDoRobo.slice(fonteDoRobo.indexOf('const naCaixaDoOutlook'), fonteDoRobo.indexOf('/* ── Na aba da Mesa'));
    expect(vigia.length).toBeGreaterThan(500);
    expect(vigia).not.toMatch(/\.click\(|dispatchEvent|\.focus\(|scroll|execCommand/);
  });
});

describe('a conta citada na resposta (robô 1.9.1)', () => {
  it('passa só a conta na forma de conta, e o prefixo como sim ou não', async () => {
    const { janela } = janelaComRobo();
    const robo = criarRoboHub({ janela });
    await umInstante();
    const leituras = [];
    robo.aoReceberOutlook((l) => leituras.push(l));
    const entregar = (r) =>
      janela.dispatchEvent(Object.assign(new Event('message'), { source: janela, data: { origem: 'robo-hub', tipo: 'outlook', em: 1, lista: true, itens: 3, respostas: [r] } }));
    entregar({ id: 'r1', assunto: 'Confirmação de ordem', conta: '1234567', prefixo: false });
    entregar({ id: 'r2', assunto: 'Confirmação de ordem', conta: '12a<b>', prefixo: 'sim' });
    expect(leituras.map((l) => [l.respostas[0].conta, l.respostas[0].prefixo])).toEqual([
      ['1234567', false],
      [null, false]
    ]);
  });
});

// A atualização automática (robô 1.13.0, 21/10/2026): o Tampermonkey de cada máquina busca a versão
// nova no site, cada uma no seu tempo. A Mesa aceita o robô a partir da versão mínima que faz tudo o
// que ela pede, e só oferece a mais nova; antes, exigia a versão exata, e cada versão nova desligava o
// robô de todo mundo até cada um colar de novo.
describe('a versão do robô', () => {
  it('compara pelo número de cada parte, não pelo texto: 1.9.1 vem antes de 1.10.0', () => {
    expect(compararVersoes('1.9.1', '1.10.0')).toBeLessThan(0);
    expect(compararVersoes('1.12.0', '1.12.0')).toBe(0);
    expect(compararVersoes('1.13.0', '1.12.9')).toBeGreaterThan(0);
  });

  it('atende a partir da versão mínima; antes dela, ou sem robô, não', () => {
    expect(roboAtende(VERSAO_MINIMA_DO_ROBO)).toBe(true);
    expect(roboAtende(VERSAO_DO_ROBO)).toBe(true);
    expect(roboAtende('1.11.0')).toBe(false);
    expect(roboAtende(null)).toBe(false);
    expect(compararVersoes(VERSAO_MINIMA_DO_ROBO, VERSAO_DO_ROBO)).toBeLessThanOrEqual(0);
  });

  it('o robô da versão mínima atende, mas não está atualizado; o da versão do repositório está', async () => {
    const antigo = criarRoboHub({ janela: janelaComRobo({ versao: VERSAO_MINIMA_DO_ROBO }).janela });
    const novo = criarRoboHub({ janela: janelaComRobo().janela });
    const velho = criarRoboHub({ janela: janelaComRobo({ versao: '1.11.0' }).janela });
    await umInstante();
    expect([antigo.compativel, antigo.atualizado]).toEqual([true, VERSAO_MINIMA_DO_ROBO === VERSAO_DO_ROBO]);
    expect([novo.compativel, novo.atualizado]).toEqual([true, true]);
    expect([velho.compativel, velho.atualizado]).toEqual([false, false]);
  });

  it('o script diz ao Tampermonkey de onde buscar a versão nova: o arquivo do site', () => {
    expect(ENDERECO_DO_ROBO).toBe('https://mesa-xp.vercel.app/robo-hub.user.js');
    expect(scriptDoRobo).toContain(`// @updateURL    ${ENDERECO_DO_ROBO}`);
    expect(scriptDoRobo).toContain(`// @downloadURL  ${ENDERECO_DO_ROBO}`);
  });
});
