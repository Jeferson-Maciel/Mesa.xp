import { formatarFinanceiro } from '../core/util/dinheiro.js';
import { esc } from '../core/util/html.js';

/**
 * O bloco "Tesouro Direto" do cartão: o título da lista do Hub que cada aplicação vai usar, com a
 * taxa, o vencimento, o PU e a aplicação mínima, e a hora em que a lista foi lida — para conferir
 * contra o Hub antes do e-mail. A lista é lida pelo robô, pela conta, na hora (`core/tesouro`).
 */

const hora = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const FALTA = {
  'sem-lista': 'a lista do Tesouro vem do Hub, pela conta, pelo robô',
  'nao-habilitada': 'a conta não está habilitada no Tesouro Direto',
  erro: 'o Hub não mostrou a lista do Tesouro',
  nenhum: 'nenhum título da lista bate com o pedido',
  ambiguo: 'mais de um título da lista cabe no pedido — escolha no aviso'
};

const titulo = (ordem, indice) => {
  const td = ordem.tesouroDoHub;
  const pedido = ordem.financeiro ? `<span class="secundario-pedido">${esc(formatarFinanceiro(ordem.financeiro))}</span>` : '';
  const topo = `<div class="secundario-topo"><span class="secundario-nome">${esc(ordem.ativo)}</span>${pedido}</div>`;

  if (!td || td.situacao !== 'pronto') {
    const falta = ordem.buscandoTesouro ? 'lendo o Tesouro no Hub…' : FALTA[td?.situacao ?? 'sem-lista'];
    return `<div class="secundario-fundo" data-ordem="${indice}" data-tesouro="${esc(td?.situacao ?? 'sem-lista')}">${topo}
      <div class="secundario-conta"><span class="secundario-falta${ordem.buscandoTesouro ? ' buscando' : ''}">${esc(falta)}</span></div></div>`;
  }

  const t = td.titulo;
  const celula = (coluna, conteudo) => `<span class="secundario-num" role="cell" data-coluna="${coluna}">${conteudo}</span>`;
  return `
    <div class="secundario-fundo" data-ordem="${indice}" data-tesouro="pronto">
      ${topo}
      <div class="secundario-dados">
        <span>${esc(t.nome)} · ${esc(t.tipo)}</span>
        <span class="secundario-origem${td.minutos > 10 ? ' antiga' : ''}">taxa das ${hora(td.lidaEm)}</span>
      </div>
      <div class="secundario-cenarios" role="table" aria-label="O título de ${esc(t.nome)}">
        <div class="secundario-cabecalho" role="row">
          <span class="secundario-th" role="columnheader">Título</span>${['Taxa', 'Vencimento', 'PU', 'Mínimo'].map((c) => `<span class="secundario-th" role="columnheader">${c}</span>`).join('')}
        </div>
        <div class="secundario-cenario escolhido" data-cenario="tesouro" role="row">
          <span class="secundario-rotulo" role="rowheader">${esc(t.nome)} <span class="secundario-no-email">no e-mail</span></span>
          ${celula('Taxa', `<strong>${esc(t.taxa)}</strong>`)}${celula('Vencimento', esc(t.vencimento))}${celula('PU', t.pu ? esc(formatarFinanceiro(t.pu)) : '—')}${celula('Mínimo', t.minimo ? esc(formatarFinanceiro(t.minimo)) : '—')}
        </div>
      </div>
    </div>`;
};

const FALTA_NO_RESGATE = {
  'sem-posicoes': 'a posição do cliente vem do Hub, pela conta, pelo robô',
  'nao-habilitada': 'a conta não está habilitada no Tesouro Direto',
  erro: 'o Hub não mostrou a posição no Tesouro',
  'nao-tem': 'o cliente não tem este título no Tesouro',
  ambiguo: 'mais de um título da carteira cabe no pedido — escolha no aviso'
};

// O resgate: o título na carteira do cliente, o disponível e o que vai ser resgatado.
const posicao = (ordem, indice) => {
  const rg = ordem.resgateDoHub;
  const quanto = ordem.total ? 'resgate do total' : ordem.financeiro ? `resgate de ${formatarFinanceiro(ordem.financeiro)}` : 'resgate';
  const topo = `<div class="secundario-topo"><span class="secundario-nome">${esc(ordem.ativo)}</span><span class="secundario-pedido">${esc(quanto)}</span></div>`;
  if (!rg || rg.situacao !== 'pronto') {
    const falta = ordem.buscandoTesouro ? 'lendo a posição no Hub…' : FALTA_NO_RESGATE[rg?.situacao ?? 'sem-posicoes'];
    return `<div class="secundario-fundo" data-ordem="${indice}" data-resgate="${esc(rg?.situacao ?? 'sem-posicoes')}">${topo}
      <div class="secundario-conta"><span class="secundario-falta${ordem.buscandoTesouro ? ' buscando' : ''}">${esc(falta)}</span></div></div>`;
  }
  const p = rg.posicao;
  const celula = (coluna, conteudo) => `<span class="secundario-num" role="cell" data-coluna="${coluna}">${conteudo}</span>`;
  return `
    <div class="secundario-fundo" data-ordem="${indice}" data-resgate="pronto">
      ${topo}
      <div class="secundario-dados">
        <span>${esc(p.nome)} · vence ${esc(p.vencimento)}</span>
        <span class="secundario-origem${rg.minutos > 10 ? ' antiga' : ''}">posição das ${hora(rg.lidaEm)}</span>
      </div>
      <div class="secundario-cenarios" role="table" aria-label="O resgate de ${esc(p.nome)}">
        <div class="secundario-cabecalho" role="row">
          <span class="secundario-th" role="columnheader">Título</span>${['Disponível', 'Valor disponível', 'PU venda', 'A resgatar'].map((c) => `<span class="secundario-th" role="columnheader">${c}</span>`).join('')}
        </div>
        <div class="secundario-cenario escolhido" data-cenario="resgate" role="row">
          <span class="secundario-rotulo" role="rowheader">${esc(p.nome)} <span class="secundario-no-email">no e-mail</span></span>
          ${celula('Disponível', p.disponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}${celula('Valor disponível', p.valorDisponivel === null ? '—' : esc(formatarFinanceiro(p.valorDisponivel)))}${celula('PU venda', p.puVenda ? esc(formatarFinanceiro(p.puVenda)) : '—')}${celula('A resgatar', rg.valor ? `<strong>${esc(formatarFinanceiro(rg.valor))}</strong>` : '—')}
        </div>
      </div>
    </div>`;
};

/**
 * @param {object} solicitacao  com `ordem.tesouroDoHub` já calculado
 * @returns {string} o bloco, ou vazio sem Tesouro
 */
export const renderTesouro = (solicitacao, { so = 'aplicacao' } = {}) => {
  const resgate = so === 'resgate';
  const ordens = (solicitacao.ordens ?? []).map((o, i) => [o, i]).filter(([o]) => o.tesouro && (o.operacao === 'V') === resgate);
  if (ordens.length === 0) return '';
  return `
    <div class="secundario tesouro${resgate ? ' tesouro-resgate' : ''}">
      <div class="secundario-cabeca"><span class="secundario-titulo">${resgate ? 'Resgate no Tesouro Direto' : 'Tesouro Direto'}</span></div>
      ${ordens.map(([o, i]) => (resgate ? posicao(o, i) : titulo(o, i))).join('')}
    </div>`;
};
