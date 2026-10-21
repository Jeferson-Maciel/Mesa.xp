/**
 * A busca da Mesa inteira (Ctrl+K): cada módulo registra uma fonte — os modelos do Operacional, as
 * anotações, os cartões da Fila, o histórico do Ordens, as abas —, e a casca (`shell/busca.js`)
 * mostra o que todas acham. Tudo roda no navegador: nada da busca sai da máquina.
 *
 * Uma fonte é `{ id, nome, buscar(termo) }`, e `buscar` devolve (ou promete) uma lista de
 * `{ titulo, detalhe?, abrir() }`, já ordenada. `acharEm` é a régua comum: todas as palavras do
 * termo têm de aparecer, e quem as tem no título vem antes.
 */

const fontes = new Map();

/** @param {{id: string, nome: string, buscar: (termo: string) => any}} fonte */
export const registrarFonteDeBusca = (fonte) => fontes.set(fonte.id, fonte);

/** @returns {Array<{id: string, nome: string, buscar: Function}>} na ordem em que foram registradas */
export const fontesDeBusca = () => [...fontes.values()];

export const normalizarBusca = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Os itens que têm todas as palavras do termo, os melhores primeiro: a palavra no título vale mais
 * que no resto, e o título que começa pelo termo vale mais ainda. Empate fica na ordem da lista.
 *
 * @template T
 * @param {T[]} itens
 * @param {string} termo
 * @param {(item: T) => {titulo: string, resto?: string}} textos
 * @param {number} [limite]
 * @returns {T[]}
 */
export const acharEm = (itens, termo, textos, limite = 6) => {
  const palavras = normalizarBusca(termo).split(' ').filter(Boolean);
  if (!palavras.length) return [];
  const pontuados = [];
  itens.forEach((item, ordem) => {
    const { titulo, resto = '' } = textos(item);
    const t = normalizarBusca(titulo);
    const r = normalizarBusca(resto);
    let pontos = 0;
    for (const p of palavras) {
      if (t.includes(p)) pontos += 3;
      else if (r.includes(p)) pontos += 1;
      else return;
    }
    if (t.startsWith(palavras[0])) pontos += 2;
    pontuados.push({ item, pontos, ordem });
  });
  return pontuados
    .sort((a, b) => b.pontos - a.pontos || a.ordem - b.ordem)
    .slice(0, limite)
    .map((p) => p.item);
};
