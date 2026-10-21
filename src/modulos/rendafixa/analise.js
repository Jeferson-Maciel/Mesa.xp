/**
 * O que a tela do Renda Fixa mostra além do motor: o destaque de cada categoria, a equivalência dos
 * isentos e os trechos da mensagem. Regras acrescentadas na Mesa XP em 21/10/2026 — o motor continua
 * igual ao original, conferido pelos goldens —, em funções puras, testadas em `analise.test.js`.
 * Nenhuma delas muda o texto da mensagem: é informação para o assessor, na tela.
 */

/* ── A equivalência dos isentos ───────────────────────────────────────────────────────────
   Um isento (LCA, LCI, LCD) não paga IR; o CDB do mesmo prazo paga, pela tabela regressiva. A taxa
   que um CDB precisaria pagar para render o mesmo depois do IR é a do isento dividida por
   (1 − alíquota): a conta que o assessor faz de cabeça ao comparar os dois. É uma aproximação — o IR
   incide sobre o rendimento no resgate, e a conta exata de um pré composto muda nas casas decimais —,
   e a tela a mostra com "≈". Só para pré e % do CDI: num IPCA+ ou CDI+ isento o spread não se
   converte assim, e nada é mostrado. */

/** A alíquota do IR de renda fixa pelos dias corridos: 22,5% até 180, 20% até 360, 17,5% até 720, 15%. */
export const aliquotaDoIR = (dias) => (dias <= 180 ? 22.5 : dias <= 360 ? 20 : dias <= 720 ? 17.5 : 15);

/**
 * @param {{taxa: number, indexador: string, dias?: number|null}} item um isento
 * @returns {{taxa: number, ir: number}|null} a taxa equivalente num tributado, e a alíquota usada
 */
export const equivalenteBruto = (item) => {
  if (!item || !(item.dias > 0) || (item.indexador !== 'PRE' && item.indexador !== 'CDI')) return null;
  const ir = aliquotaDoIR(item.dias);
  return { taxa: item.taxa / (1 - ir / 100), ir };
};

/**
 * O tributado com que o isento se compara: o da mensagem, no mesmo prazo e na mesma unidade (pré com
 * pré, % do CDI com % do CDI). Sem ele, não há comparação.
 */
export const tributadoDoMesmoPrazo = (item, secoes) => {
  const id = item.indexador === 'PRE' ? 'pre' : item.indexador === 'CDI' ? 'pos' : null;
  const secao = (secoes ?? []).find((s) => s.id === id);
  return secao?.itens.find((t) => t.prazo === item.prazo && t.indexador === item.indexador) ?? null;
};

/* ── Os destaques ─────────────────────────────────────────────────────────────────────── */

/**
 * O destaque de uma seção: a maior taxa na unidade que mais aparece nela — numa seção de pós com
 * % do CDI e CDI+, um número não se compara com o outro. No empate, fica o prazo mais curto (os
 * itens vêm por prazo).
 */
export const destaqueDaSecao = (secao) => {
  if (!secao?.itens?.length) return null;
  const contagem = new Map();
  for (const it of secao.itens) contagem.set(it.indexador, (contagem.get(it.indexador) ?? 0) + 1);
  const [unidade] = [...contagem.entries()].reduce((melhor, par) => (par[1] > melhor[1] ? par : melhor));
  return secao.itens.filter((it) => it.indexador === unidade).reduce((melhor, it) => (it.taxa > melhor.taxa ? it : melhor));
};

/**
 * A força de cada taxa na seção, de 0,25 a 1, para a barra da linha: a menor da unidade fica com um
 * quarto, a maior com tudo. Só compara taxas da mesma unidade; sozinha na unidade, a barra é cheia.
 */
export const forcaDaTaxa = (item, secao) => {
  const mesmas = secao.itens.filter((it) => it.indexador === item.indexador).map((it) => it.taxa);
  const [menor, maior] = [Math.min(...mesmas), Math.max(...mesmas)];
  return maior === menor ? 1 : 0.25 + (0.75 * (item.taxa - menor)) / (maior - menor);
};

/* ── Os trechos da mensagem ───────────────────────────────────────────────────────────── */

/**
 * Um trecho por seção com oportunidade, para copiar só uma categoria: o título da mensagem e o bloco
 * daquela seção, exatamente como `montarTexto` os escreve — quem manda só as pré-fixadas manda o
 * mesmo texto, recortado. Se a mensagem não tiver a forma esperada, não há trecho (e a tela não
 * oferece o botão).
 *
 * @returns {Record<string, string>} id da seção → texto
 */
export const trechosDaMensagem = (texto, secoes) => {
  if (!texto) return {};
  const [titulo, ...blocos] = texto.split('\n\n');
  const comItens = (secoes ?? []).filter((s) => s.itens.length);
  if (!titulo || blocos.length !== comItens.length) return {};
  return Object.fromEntries(comItens.map((s, i) => [s.id, `${titulo}\n\n${blocos[i].trimEnd()}`]));
};
