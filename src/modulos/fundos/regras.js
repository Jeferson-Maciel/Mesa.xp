import { normalizarBusca } from '../../comum/busca.js';

/**
 * A Prateleira de fundos: os fundos do secundário que o robô traz do Hub (a mesma captura que o
 * Ordens usa para converter R$ em cotas), numa tabela que ordena e filtra, e o que mudou desde o
 * último dia visto. Funções puras, testadas em `regras.test.js`.
 *
 * É dado de mercado, não de cliente: o nome do fundo, o deságio, o PU, o estoque. A foto de cada dia
 * fica no navegador (`localStorage`), para comparar com o dia seguinte.
 */

/**
 * As linhas da tabela. O ROA máximo é o deságio menos o deságio mínimo do cliente — o fim da barra de
 * ROA adicional na boleta —, e só existe com os dois.
 *
 * @param {{fundos: object[]}|null} estoque  a captura, como o Ordens a guarda
 */
export const linhasDaPrateleira = (estoque) =>
  (estoque?.fundos ?? []).map((f) => ({
    chave: f.id ?? f.nome,
    id: f.id ?? null,
    nome: f.nome,
    ticker: f.ticker ?? null,
    desagio: f.desagio ?? null,
    roaMaximo: f.desagio !== null && f.desagio !== undefined && f.desagioMinimo !== null && f.desagioMinimo !== undefined ? Math.round((f.desagio - f.desagioMinimo) * 100) / 100 : null,
    pu: f.pu ?? null,
    estoque: f.estoque ?? null,
    aplicacaoMinima: f.aplicacaoMinima ?? null,
    corretagem: f.corretagem ?? null,
    clientes: f.p2p?.pode ? { desagio: f.p2p.desagio ?? null, estoque: f.p2p.estoque ?? null } : null
  }));

const normalizar = normalizarBusca;

/**
 * @param {ReturnType<typeof linhasDaPrateleira>} linhas
 * @param {{termo?: string, comEstoque?: boolean, estoqueClientes?: boolean}} filtro
 */
export const filtrarPrateleira = (linhas, { termo = '', comEstoque = false, estoqueClientes = false } = {}) => {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  return linhas.filter(
    (l) =>
      palavras.every((p) => normalizar(`${l.ticker ?? ''} ${l.nome}`).includes(p)) &&
      (!comEstoque || (l.estoque ?? 0) > 0) &&
      (!estoqueClientes || Boolean(l.clientes))
  );
};

/** Ordena por um campo; o que não tem o valor vai sempre para o fim, nos dois sentidos. */
export const ordenarPrateleira = (linhas, campo = 'desagio', sentido = 'desc') =>
  [...linhas].sort((a, b) => {
    if (campo === 'nome') return (sentido === 'asc' ? 1 : -1) * a.nome.localeCompare(b.nome, 'pt-BR');
    const [va, vb] = [a[campo], b[campo]];
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return sentido === 'asc' ? va - vb : vb - va;
  });

/** A foto de um dia: os números de cada fundo que valem comparar no dia seguinte. */
export const fotoDaPrateleira = (linhas) =>
  Object.fromEntries(linhas.map((l) => [l.chave, { nome: l.nome, ticker: l.ticker, desagio: l.desagio, roaMaximo: l.roaMaximo, estoque: l.estoque }]));

/**
 * O que mudou de uma foto para a outra: os fundos que entraram e saíram, o deságio e o ROA que
 * mudaram, e o estoque que zerou ou voltou.
 */
export const mudancasNaPrateleira = (antes, agora) => {
  const nomeDe = (f) => (f.ticker ? `${f.ticker} · ${f.nome}` : f.nome);
  const mudancas = { entraram: [], sairam: [], desagio: [], roa: [], estoque: [] };
  for (const [chave, f] of Object.entries(agora)) {
    const a = antes[chave];
    if (!a) {
      mudancas.entraram.push(nomeDe(f));
      continue;
    }
    if (a.desagio !== null && f.desagio !== null && a.desagio !== f.desagio) mudancas.desagio.push({ fundo: nomeDe(f), de: a.desagio, para: f.desagio });
    if (a.roaMaximo !== null && f.roaMaximo !== null && a.roaMaximo !== f.roaMaximo) mudancas.roa.push({ fundo: nomeDe(f), de: a.roaMaximo, para: f.roaMaximo });
    const tinha = (a.estoque ?? 0) > 0;
    const tem = (f.estoque ?? 0) > 0;
    if (tinha !== tem) mudancas.estoque.push({ fundo: nomeDe(f), zerou: tinha && !tem });
  }
  for (const [chave, f] of Object.entries(antes)) if (!agora[chave]) mudancas.sairam.push(nomeDe(f));
  return mudancas;
};

export const semMudanca = (m) => Object.values(m).every((lista) => lista.length === 0);

/**
 * As fotos guardadas: uma por dia, as dos últimos `dias`. A de hoje é a mais nova do dia.
 *
 * @param {Record<string, object>} fotos  por dia `AAAA-MM-DD`
 */
export const guardarFoto = (fotos, dia, foto, dias = 10) => {
  const todas = { ...fotos, [dia]: foto };
  const ficam = Object.keys(todas).sort().slice(-dias);
  return Object.fromEntries(ficam.map((d) => [d, todas[d]]));
};

/** O dia anterior a `dia` que tem foto, para comparar; nenhum, `null`. */
export const diaAnteriorComFoto = (fotos, dia) =>
  Object.keys(fotos)
    .filter((d) => d < dia)
    .sort()
    .pop() ?? null;
