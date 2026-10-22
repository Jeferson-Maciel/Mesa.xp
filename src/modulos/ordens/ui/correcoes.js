import { aplicarEdicao, ordemVazia } from './preview.js';

/**
 * As correções do cartão, para o "Reabrir" do histórico (Fase 3, Q35, decidido com o usuário em
 * 21/10/2026).
 *
 * Reabrir passa o texto colado pelas regras de agora, de novo — nunca uma saída congelada. Mas o que o
 * operador corrigiu no cartão (o valor editado, a linha removida ou acrescentada, a conta, o horário, as
 * confirmações dos bloqueios) não está no texto: sem isto, voltava tudo como foi colado. Por isso o
 * histórico guarda, junto do texto, **a diferença** entre o cartão e o texto lido, e o Reabrir a aplica
 * sobre o texto lido de novo.
 *
 * Nada é adivinhado: cada correção diz a que linha do texto lido se refere (`origem`, a posição dela no
 * texto) e qual ativo estava lá. Se o texto lido agora não tem o mesmo ativo naquele lugar (a regra de
 * leitura mudou), a correção não entra e é avisada — corrigir a linha errada seria pior que não corrigir.
 */

// O que o operador muda numa linha e numa solicitação (preview.js, aplicarEdicao). O que é refeito a
// cada render (o fundo, o ticker, o secundário) fica de fora: vem do ativo.
const CAMPOS_DA_ORDEM = ['ativo', 'operacao', 'tipo', 'quantidade', 'financeiro', 'quantidadeSolta', 'total', 'estoque', 'oQueForPossivel', 'preco', 'numerosSobrando'];
const CAMPOS_DA_SOLICITACAO = ['conta', 'horario', 'semRoa'];

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const copia = (valor) => (valor === undefined ? null : JSON.parse(JSON.stringify(valor)));
const diferencas = (original, atual, campos) => {
  const mudou = {};
  for (const campo of campos) if (!igual(original?.[campo], atual[campo])) mudou[campo] = copia(atual[campo]);
  return mudou;
};
const vazio = (objeto) => Object.keys(objeto).length === 0;

/** Marca em cada ordem lida a posição dela no texto: é por ela que a correção acha a linha. */
export const marcarOrigem = (solicitacoes) => {
  for (const s of solicitacoes) s.ordens.forEach((o, j) => (o.origem = j));
  return solicitacoes;
};

/**
 * A diferença entre o cartão e o texto lido: só dados simples, para o `localStorage`.
 *
 * @param {object[]} lidas  as solicitações do texto lido agora, sem correção (`marcarOrigem`)
 * @param {object[]} atuais  as do cartão, como estão
 * @param {Set<string>[]} confirmados  as confirmações de cada solicitação
 * @returns {{solicitacoes: object[]}|null}  nada quando não há correção
 */
export const correcoesDoCartao = (lidas, atuais, confirmados) => {
  const solicitacoes = [];
  atuais.forEach((s, indice) => {
    const lida = lidas[indice];
    if (!lida) return;
    const porOrigem = new Map(s.ordens.filter((o) => Number.isInteger(o.origem)).map((o) => [o.origem, o]));
    const editadas = [];
    const removidas = [];
    lida.ordens.forEach((original, origem) => {
      const atual = porOrigem.get(origem);
      if (!atual) return removidas.push({ origem, ativo: original.ativo });
      const campos = diferencas(original, atual, CAMPOS_DA_ORDEM);
      if (!vazio(campos)) editadas.push({ origem, ativo: original.ativo, campos });
    });
    const novas = s.ordens.filter((o) => !Number.isInteger(o.origem)).map((o) => ({ campos: diferencas(ordemVazia(), o, CAMPOS_DA_ORDEM) }));
    const campos = diferencas(lida, s, CAMPOS_DA_SOLICITACAO);
    const confirmadas = [...(confirmados[indice] ?? [])];
    if (vazio(campos) && !editadas.length && !removidas.length && !novas.length && !confirmadas.length) return;
    solicitacoes.push({ indice, conta: lida.conta ?? null, campos, editadas, removidas, novas, confirmados: confirmadas });
  });
  return solicitacoes.length ? { solicitacoes } : null;
};

// O que a correção mudava, para o aviso da que não coube.
const descrever = (campos) => {
  const partes = [];
  if ('ativo' in campos) partes.push('o ativo editado');
  if ('operacao' in campos) partes.push('a operação');
  if (campos.financeiro != null) partes.push('o valor editado');
  else if (campos.quantidade != null) partes.push('a quantidade editada');
  if (campos.total) partes.push('o total da posição');
  if ('preco' in campos) partes.push('o preço');
  if ('estoque' in campos) partes.push('o estoque');
  return partes.length ? partes.join(', ') : 'a correção';
};

const aplicarNaOrdem = (solicitacao, indice, campos) => {
  if ('ativo' in campos) aplicarEdicao(solicitacao, 'ativo', campos.ativo ?? '', indice);
  const ordem = solicitacao.ordens[indice];
  for (const [campo, valor] of Object.entries(campos)) if (campo !== 'ativo') ordem[campo] = copia(valor);
};

/**
 * Aplica as correções guardadas sobre as solicitações do texto lido de novo (com `marcarOrigem`).
 *
 * @returns {{naoCouberam: string[]}}  as que não couberam, para o aviso
 */
export const aplicarCorrecoes = (solicitacoes, confirmados, correcoes) => {
  const naoCouberam = [];
  for (const c of correcoes?.solicitacoes ?? []) {
    const s = solicitacoes[c.indice];
    if (!s || (s.conta ?? null) !== c.conta) {
      naoCouberam.push(`conta ${c.conta ?? '(sem conta)'}: as correções (o texto não é mais lido com esta conta)`);
      continue;
    }
    const naOrigem = (origem, ativo) => {
      const i = s.ordens.findIndex((o) => o.origem === origem);
      return i >= 0 && s.ordens[i].ativo === ativo ? i : -1;
    };
    for (const e of c.editadas) {
      const i = naOrigem(e.origem, e.ativo);
      if (i < 0) naoCouberam.push(`${e.ativo}: ${descrever(e.campos)} (a linha não é mais lida no mesmo lugar)`);
      else aplicarNaOrdem(s, i, e.campos);
    }
    // As removidas depois das editadas: as posições no texto não mudam, mas os índices do cartão sim.
    for (const r of c.removidas) {
      const i = naOrigem(r.origem, r.ativo);
      if (i < 0) naoCouberam.push(`${r.ativo}: a linha removida (não é mais lida no mesmo lugar)`);
      else s.ordens.splice(i, 1);
    }
    for (const n of c.novas) {
      s.ordens.push(ordemVazia());
      aplicarNaOrdem(s, s.ordens.length - 1, n.campos);
    }
    for (const [campo, valor] of Object.entries(c.campos)) s[campo] = copia(valor);
    for (const chave of c.confirmados) confirmados[c.indice]?.add(chave);
  }
  return { naoCouberam };
};
