import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { lerCapturaDoHub } from '../core/secundario/estoque.js';
import { enderecoDoFavorito, scriptDoFavorito } from './favoritoDoHub.js';

const LISTA = 'https://api-advisor.xpi.com.br/investment-funds/yield-rede/v3/investment-funds-secondary';
const DESTAQUES = 'https://api-advisor.xpi.com.br/investment-funds/yield-rede/v1/investment-funds-secondary/highlights';

const PRATELEIRA = {
  isMarketOpen: true,
  data: [{ fundName: 'IMOV11 - Navi Hedge Fund', unityPrice: '9,00', secondaryPurchaseDiscount: '8,75', treasuryMinimumPurchaseDiscount: '8,25' }]
};

/**
 * Uma página do Hub de mentira: o botão Atualizar faz o app pedir os destaques e a lista, como o
 * de verdade. Guarda o que o favorito baixou e os alertas.
 */
const hubFalso = ({ host = 'hub.xpi.com.br', comBotao = true, lista = PRATELEIRA } = {}) => {
  const pagina = { baixados: [], alertas: [], avisos: [], pedidos: [] };
  const blobs = new Map();

  const fetchDoApp = async (url) => {
    pagina.pedidos.push(url);
    const corpo = url === LISTA ? lista : { data: [] };
    return { clone: () => ({ json: async () => structuredClone(corpo) }) };
  };

  const elemento = (tag) => ({
    tag,
    style: {},
    click() {
      if (tag === 'a') pagina.baixados.push({ nome: this.download, blob: blobs.get(this.href) });
    },
    remove() {}
  });

  const janela = {
    location: { hostname: host },
    alert: (texto) => pagina.alertas.push(texto),
    // Os prazos do favorito (o aviso que some, o Hub que não responde) não interessam aqui.
    setTimeout: () => 0,
    clearTimeout: () => {},
    Blob,
    URL: {
      createObjectURL: (blob) => {
        const id = `blob:${blobs.size}`;
        blobs.set(id, blob);
        return id;
      },
      revokeObjectURL() {}
    },
    document: {
      body: { appendChild: (el) => el.tag === 'div' && pagina.avisos.push(el.textContent) },
      createElement: elemento,
      querySelector: (seletor) =>
        comBotao && seletor === 'soma-button[aria-label="atualizar"]'
          ? { click: () => Promise.all([janela.fetch(DESTAQUES), janela.fetch(LISTA)]) }
          : null
    }
  };
  janela.window = janela;
  janela.fetch = fetchDoApp;

  // O favorito roda como o navegador o roda: o endereço decodificado, no escopo da página.
  pagina.clicarNoFavorito = async () => {
    runInNewContext(decodeURIComponent(enderecoDoFavorito().slice('javascript:'.length)), janela);
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  };
  return pagina;
};

describe('o endereço do favorito', () => {
  it('é uma linha só, sem o comentário do cabeçalho, e compila', () => {
    const script = scriptDoFavorito();
    expect(script).not.toMatch(/\n/);
    expect(script.startsWith('(() =>')).toBe(true);
    expect(() => new Function(script)).not.toThrow();
  });

  it('vai inteiro no javascript:, codificado', () => {
    const endereco = enderecoDoFavorito();
    expect(endereco.startsWith('javascript:')).toBe(true);
    expect(endereco).not.toMatch(/[\s"<>]/);
  });
});

describe('o favorito no Hub', () => {
  it('baixa a resposta da prateleira com a hora da captura, e o Ordens a lê', async () => {
    const hub = hubFalso();
    await hub.clicarNoFavorito();

    expect(hub.alertas).toEqual([]);
    expect(hub.baixados).toHaveLength(1);
    expect(hub.baixados[0].nome).toMatch(/^mercado-secundario-\d{2}-\d{2}-\d{4}-\d{2}h\d{2}\.json$/);

    const { capturadaEm, fundos } = lerCapturaDoHub(await hub.baixados[0].blob.text());
    expect(capturadaEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(fundos[0]).toMatchObject({ ticker: 'IMOV11', desagio: 8.75, desagioMinimo: 8.25 });
    expect(hub.avisos[0]).toContain('1 fundos baixados');
  });

  it('não confunde os destaques com a lista', async () => {
    const hub = hubFalso();
    await hub.clicarNoFavorito();
    expect(hub.pedidos).toEqual([DESTAQUES, LISTA]);
    expect(hub.baixados).toHaveLength(1);
  });

  it('cada clique baixa uma captura, sem empilhar o gancho', async () => {
    const hub = hubFalso();
    await hub.clicarNoFavorito();
    await hub.clicarNoFavorito();
    expect(hub.baixados).toHaveLength(2);
  });

  it('fora do Hub, só explica onde usar', async () => {
    const hub = hubFalso({ host: 'mesa-xp.netlify.app' });
    await hub.clicarNoFavorito();
    expect(hub.alertas[0]).toContain('abra o Hub XP');
    expect(hub.baixados).toEqual([]);
  });

  it('fora da Prateleira, diz que não achou o Atualizar', async () => {
    const hub = hubFalso({ comBotao: false });
    await hub.clicarNoFavorito();
    expect(hub.alertas[0]).toContain('botão Atualizar');
  });

  it('resposta num formato desconhecido não vira arquivo', async () => {
    const hub = hubFalso({ lista: { fundos: [] } });
    await hub.clicarNoFavorito();
    expect(hub.baixados).toEqual([]);
    expect(hub.alertas[0]).toContain('formato');
  });
});
