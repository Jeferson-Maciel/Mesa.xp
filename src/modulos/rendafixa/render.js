/**
 * O HTML do Renda Fixa: funções puras, sem DOM, testadas em `render.test.js`.
 *
 * Tudo que vem da planilha (nome do ativo, emissor, cabeçalho das colunas) ou do histórico (nome do
 * arquivo, mensagem gravada) passa por `esc` antes de virar marcação. A mensagem ganha o negrito do
 * WhatsApp só depois de escapada.
 *
 * O visual é o do Ordens: painel, segmentado, selo e botão de copiar vêm de src/ui/componentes.css;
 * o que é só daqui está em rendafixa.css, escopado em `.rf`. Sem animação de contagem, sem aurora:
 * número aparece pronto.
 */

import { esc } from '../../ui/html.js';
import { MOTIVOS_DESCARTE, fmtP, fmtT, partesDaTaxa } from './motor.js';
import { registroSecundario, variacao } from './historico.js';

export const UNIDADES = {
  pre: '% ao ano',
  pos: '% do CDI',
  ipca: 'spread sobre o IPCA',
  isentos: 'LCA · LCI · LCD, sem IR'
};

export const DICAS_MERCADO = {
  primario: 'Títulos recém-emitidos, comprados direto do emissor. A mensagem não cita o banco.',
  secundario: 'Títulos revendidos antes do vencimento (com data de emissão). A mensagem cita o banco emissor.'
};

const ROTULOS_COLUNAS = {
  tipo: 'Tipo',
  instrumento: 'Instrumento',
  taxa: 'Taxa',
  indexador: 'Indexador',
  vencimento: 'Vencimento',
  emissao: 'Data de emissão',
  publico: 'Público',
  liquidez: 'Liquidez',
  emissor: 'Emissor',
  pu: 'PU',
  isento: 'Isento'
};

export const numero = (valor) => Math.round(valor).toLocaleString('pt-BR');

export const formatBytes = (bytes, decimals = 1) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)).toLocaleString('pt-BR') + ' ' + sizes[i];
};

const fmtPct = (pct) => {
  if (pct >= 10 || pct === 0) return `${Math.round(pct)}%`;
  return `${pct.toFixed(1).replace('.', ',')}%`;
};

// Renderiza o negrito do WhatsApp (*texto*) depois de escapar o resto
export const mensagemEmHTML = (mensagem) => esc(mensagem).replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');

/* ── Estados da área de resultado ─────────────────────────────────────────────────────── */

export const htmlVazio = () => `
  <div class="empty-state">
    <p>Nenhuma planilha carregada.</p>
    <span>Solte a planilha de renda fixa da XP em qualquer lugar desta aba, ou clique em “Arraste a planilha aqui”.</span>
  </div>`;

export const htmlLendo = (nome) => `
  <div class="empty-state">
    <p>Lendo ${esc(nome)}…</p>
  </div>`;

export const htmlErro = (titulo, descricao) => `
  <div class="empty-state">
    <p>${esc(titulo)}</p>
    <span>${esc(descricao)}</span>
    <button type="button" class="copy-btn" data-acao="abrir">Escolher outro arquivo</button>
  </div>`;

export const htmlSemResultado = (r) => {
  const atual = r.secundario ? 'mercado secundário' : 'emissão primária';
  const outro = r.secundario ? 'emissão primária' : 'mercado secundário';
  return `
  <div class="empty-state">
    <p>Nenhuma oportunidade neste mercado</p>
    <span>Das ${numero(r.totais.lidos)} linhas da planilha, nenhuma passou pelos filtros de ${atual}. O funil ao lado mostra por quê.</span>
    <button type="button" class="copy-btn" data-acao="trocar-mercado">Ver ${outro}</button>
  </div>`;
};

/* ── Cartões ──────────────────────────────────────────────────────────────────────────── */

export const htmlCartoes = (r, referencia) => {
  const secoes = r.secoes.filter((s) => s.itens.length);
  return `<div class="rf-secoes">${secoes.map((secao) => htmlSecao(secao, r.secundario, referencia)).join('')}</div>`;
};

const htmlSecao = (secao, secundario, referencia) => `
  <section class="rf-secao" data-sec="${secao.id}">
    <header class="rf-secao-topo">
      <div class="rf-secao-titulo"><strong>${esc(secao.titulo)}</strong><span>${UNIDADES[secao.id]}</span></div>
      ${htmlCurva(secao)}
    </header>
    <ol class="rf-linhas">${secao.itens.map((item) => htmlLinha(item, secao.id, secundario, referencia)).join('')}</ol>
  </section>`;

const htmlLinha = (item, secaoId, secundario, referencia) => {
  const { prefixo, valor, sufixo } = partesDaTaxa(item);
  const emissor = secundario && item.emissor ? `<span class="rf-emissor">${esc(item.emissor)}</span>` : '';
  return `
    <li class="rf-linha">
      <span class="rf-prazo">${item.prazo}<small>${item.prazo === 1 ? 'ano' : 'anos'}</small></span>
      <span class="badge">${esc(item.tipo)}</span>
      <span class="rf-ativo">${emissor}<span title="${esc(item.ativo)}">${esc(item.ativo)}</span></span>
      <span class="rf-taxa">
        <span class="rf-taxa-valor">${prefixo ? `<span class="rf-taxa-pre">${prefixo.trim()}</span> ` : ''}<span class="rf-taxa-num">${valor}</span><span class="rf-taxa-suf">${sufixo}</span></span>
        ${htmlDelta(item, secaoId, referencia)}
      </span>
    </li>`;
};

// Curva de taxa × prazo da seção. Só quando todos os itens usam a mesma unidade.
const htmlCurva = (secao) => {
  const itens = secao.itens;
  if (secao.id === 'isentos' || itens.length < 2) return '';
  if (new Set(itens.map((it) => it.indexador)).size > 1) return '';

  const L = 112;
  const A = 36;
  const M = 5;
  const prazos = itens.map((it) => it.prazo);
  const taxas = itens.map((it) => it.taxa);
  const [pMin, pMax, tMin, tMax] = [Math.min(...prazos), Math.max(...prazos), Math.min(...taxas), Math.max(...taxas)];
  const x = (p) => M + ((p - pMin) / (pMax - pMin)) * (L - 2 * M);
  const y = (t) => (tMax === tMin ? A / 2 : M + (1 - (t - tMin) / (tMax - tMin)) * (A - 2 * M));
  const pontos = itens.map((it) => [x(it.prazo).toFixed(1), y(it.taxa).toFixed(1)]);
  const linha = pontos.map(([px, py], k) => `${k ? 'L' : 'M'}${px} ${py}`).join(' ');
  const marcas = itens
    .map((it, j) => {
      const { prefixo, valor, sufixo } = partesDaTaxa(it);
      const [px, py] = pontos[j];
      return `<circle cx="${px}" cy="${py}" r="3"><title>${fmtP(it.prazo)}: ${prefixo}${valor}${sufixo}</title></circle>`;
    })
    .join('');
  const descricao = itens.map((it) => `${fmtP(it.prazo)}: ${fmtT(it.taxa)}`).join(', ');

  // A área sob a curva, fechada até a base, pintada por um degradê na cor da seção (rendafixa.css).
  // pathLength="1" deixa a linha se desenhar com o mesmo tempo, qualquer que seja o comprimento.
  const [ultimo, primeiro] = [pontos[pontos.length - 1], pontos[0]];
  const area = `${linha} L${ultimo[0]} ${A} L${primeiro[0]} ${A} Z`;
  const gradiente = `rf-degrade-${secao.id}`;

  return `<svg class="rf-curva" viewBox="0 0 ${L} ${A}" role="img" aria-label="Curva por prazo — ${descricao}"><defs><linearGradient id="${gradiente}" x1="0" y1="0" x2="0" y2="1"><stop offset="0"/><stop offset="1"/></linearGradient></defs><path class="rf-area" d="${area}" fill="url(#${gradiente})"/><path class="rf-traco" d="${linha}" pathLength="1"/>${marcas}</svg>`;
};

// Variação contra a última análise salva antes de hoje, no mesmo mercado
const htmlDelta = (item, secaoId, referencia) => {
  const v = variacao(item, secaoId, referencia);
  if (!v) return '';
  const { prefixo, valor, sufixo } = partesDaTaxa({ taxa: v.anterior.t, indexador: v.anterior.x });
  const dia = new Date(v.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const sobe = v.diferenca > 0;
  return `<span class="rf-delta ${sobe ? 'rf-sobe' : 'rf-desce'}" title="Em ${dia}: ${prefixo}${valor}${sufixo}">${sobe ? '▲' : '▼'} ${fmtT(Math.abs(v.diferenca))}</span>`;
};

/* ── Mensagem ─────────────────────────────────────────────────────────────────────────── */

export const htmlMensagem = (texto) => `
  <div class="rf-bolha">${mensagemEmHTML(texto.trimEnd())}</div>
  <p class="rf-nota">É exatamente este texto que o botão Copiar coloca na área de transferência.</p>`;

/* ── Bloqueados ───────────────────────────────────────────────────────────────────────── */

export const htmlBloqueados = (r) => {
  const lista = r.bloqueados;
  if (!lista.length) return '';
  return `
  <details class="rf-bloqueados">
    <summary><strong>${lista.length} ${lista.length === 1 ? 'ativo bloqueado' : 'ativos bloqueados'}</strong> <span>PU acima de R$ 1.300 ou público restrito</span></summary>
    <ul>
      ${lista.map((b) => `<li><span title="${esc(b.ativo)}">${esc(b.ativo)}</span><span class="rf-motivo">${esc(b.motivo)}</span></li>`).join('')}
    </ul>
  </details>`;
};

/* ── Funil ────────────────────────────────────────────────────────────────────────────── */

const ROTULOS_FUNIL = ['Linhas lidas', 'No mercado escolhido', 'Passaram nos filtros', 'Na mensagem'];

export const htmlFunilVazio = () =>
  ROTULOS_FUNIL.map(
    (rotulo) => `
    <div class="rf-funil-etapa">
      <div class="rf-funil-rotulo"><span>${rotulo}</span><b>—</b></div>
      <div class="rf-funil-trilho"></div>
    </div>`
  ).join('');

export const htmlFunil = (r) => {
  const t = r.totais;
  const base = Math.max(t.lidos, 1);
  const etapas = [
    ['Linhas lidas', t.lidos, 'Linhas com dados abaixo do cabeçalho'],
    [r.secundario ? 'No mercado secundário' : 'Na emissão primária', t.noMercado, 'Linhas do mercado escolhido'],
    ['Passaram nos filtros', t.elegiveis, 'Disputam a maior taxa de cada prazo'],
    ['Na mensagem', t.exibidos, 'A maior taxa de cada prazo exibido']
  ];

  return etapas
    .map(([rotulo, valor, descricao], i) => {
      const pct = (valor / base) * 100;
      return `
    <div class="rf-funil-etapa${i === etapas.length - 1 ? ' rf-funil-final' : ''}" title="${descricao}: ${numero(valor)} de ${numero(t.lidos)} linhas (${fmtPct(pct)})">
      <div class="rf-funil-rotulo"><span>${rotulo}</span><span class="rf-funil-pct">${fmtPct(pct)}</span><b>${numero(valor)}</b></div>
      <div class="rf-funil-trilho"><div class="rf-funil-barra" style="width:${pct.toFixed(2)}%"></div></div>
    </div>`;
    })
    .join('');
};

/**
 * @param {object} r o resultado do motor
 * @param {boolean[]} abertos quais dos dois quadros estavam abertos, para não fechá-los ao reprocessar
 */
export const htmlDetalhesFunil = (r, abertos) => {
  const t = r.totais;
  const motivos = Object.entries(r.descartes)
    .filter(([, n]) => n > 0)
    .map(([motivo, n]) => [MOTIVOS_DESCARTE[motivo], n])
    .sort((a, b) => b[1] - a[1]);
  const disputa = [
    ['Superadas por taxa maior', t.elegiveis - t.vencedores],
    ['Fora dos prazos da mensagem', t.vencedores - t.exibidos]
  ].filter(([, n]) => n > 0);
  const item = ([rotulo, n], separador) =>
    `<li${separador ? ' class="rf-separa"' : ''}><span>${rotulo}</span><b>${numero(n)}</b></li>`;
  const fora = t.lidos - t.exibidos;
  const colunas = Object.entries(r.colunas).filter(([campo]) => ROTULOS_COLUNAS[campo]);

  return `
  <details class="rf-quadro"${abertos[0] ? ' open' : ''}>
    <summary>Por que ${numero(fora)} ${fora === 1 ? 'linha ficou' : 'linhas ficaram'} de fora</summary>
    <ul class="rf-motivos">${motivos.map((m) => item(m)).join('')}${disputa.map((m, k) => item(m, k === 0 && motivos.length > 0)).join('')}</ul>
  </details>
  <details class="rf-quadro"${abertos[1] ? ' open' : ''}>
    <summary>Colunas usadas <span class="counter-badge">${colunas.length}</span></summary>
    <dl class="rf-colunas">${colunas.map(([campo, nome]) => `<dt>${ROTULOS_COLUNAS[campo]}</dt><dd title="${esc(nome)}">${esc(nome)}</dd>`).join('')}</dl>
  </details>`;
};

/* ── Histórico ────────────────────────────────────────────────────────────────────────── */

export const quando = (iso, agora = new Date()) => {
  const data = new Date(iso);
  if (isNaN(data)) return '—';
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const dia = new Date(data);
  dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoje - dia) / 864e5);
  const rotulo =
    dias === 0 ? 'Hoje' : dias === 1 ? 'Ontem' : data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  return `<strong>${rotulo}</strong> · ${hora}`;
};

export const htmlRegistro = (registro, agora = new Date()) => {
  const secundario = registroSecundario(registro);
  const mensagem = String(registro.resultado || '').trimEnd();
  return `
  <article class="rf-hist" data-id="${esc(registro.id)}">
    <header class="rf-hist-topo">
      <span class="rf-hist-quando">${quando(registro.created_at, agora)}</span>
      <span class="badge">${secundario ? 'Secundário' : 'Primário'}</span>
    </header>
    ${registro.arquivo ? `<div class="rf-hist-arquivo" title="${esc(registro.arquivo)}">${esc(registro.arquivo)}</div>` : ''}
    <div class="rf-hist-numeros">
      <span><b>${numero(registro.total_ativos || 0)}</b> linhas lidas</span>
      <span><b>${numero(registro.total_oportunidades || 0)}</b> oportunidades</span>
    </div>
    <div class="rf-hist-previa">${mensagemEmHTML(mensagem)}</div>
    <footer class="rf-hist-acoes">
      <button type="button" class="rf-link" data-acao="expandir">Ver tudo</button>
      <button type="button" class="copy-btn" data-acao="copiar">Copiar</button>
      <button type="button" class="rf-excluir" data-acao="excluir" aria-label="Excluir análise" title="Excluir análise">&times;</button>
    </footer>
  </article>`;
};

export const htmlHistorico = (lista, agora = new Date()) =>
  lista.length
    ? lista.map((registro) => htmlRegistro(registro, agora)).join('')
    : '<div class="empty-state pequeno"><p>Nenhuma análise salva ainda.</p><span>Depois de analisar, clique em Salvar.</span></div>';
