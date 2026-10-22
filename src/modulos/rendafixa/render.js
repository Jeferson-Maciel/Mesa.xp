/**
 * O HTML do Renda Fixa: funções puras, sem DOM, testadas em `render.test.js`.
 *
 * Tudo que vem da planilha (nome do ativo, emissor, cabeçalho das colunas) ou do histórico (nome do
 * arquivo, mensagem gravada) passa por `esc` antes de virar marcação. A mensagem ganha o negrito do
 * WhatsApp só depois de escapada.
 *
 * O visual é o da Mesa: painel, segmentado, selo e botão de copiar vêm de src/ui/componentes.css; o
 * que é só daqui está em rendafixa.css, escopado em `.rf`. Desde 21/10/2026 (a repaginação pedida
 * pelo usuário): os destaques de cada categoria no alto, o gráfico de taxa × prazo largo e ligado às
 * linhas, a força de cada taxa, a equivalência dos isentos (`analise.js`), copiar uma categoria só e
 * a prévia num celular. Os números que chegam contam até o valor (index.js); o HTML já traz o valor
 * final, para quem não tem movimento.
 */

import { esc } from '../../ui/html.js';
import { MOTIVOS_DESCARTE, fmtP, fmtT, partesDaTaxa } from './motor.js';
import { registroSecundario, variacao } from './historico.js';
import { destaqueDaSecao, equivalenteBruto, forcaDaTaxa, tributadoDoMesmoPrazo } from './analise.js';

export const UNIDADES = {
  pre: '% ao ano',
  pos: '% do CDI',
  ipca: 'spread sobre o IPCA',
  isentos: 'LCA · LCI · LCD, sem IR'
};

// O nome de cada categoria no destaque e nos botões de copiar.
const NOMES = {
  pre: { um: 'Pré-fixado', varios: 'as pré-fixadas' },
  pos: { um: 'Pós-fixado', varios: 'as pós-fixadas' },
  ipca: { um: 'IPCA+', varios: 'os IPCA+' },
  isentos: { um: 'Isento de IR', varios: 'os isentos de IR' }
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

// A ilustração da tela vazia: uma planilha cujas linhas viram uma curva de taxas. Desenha-se uma vez,
// ao chegar (rendafixa.css); não fica em laço.
const ILUSTRACAO = `
  <svg class="rf-ilustra" viewBox="0 0 220 132" aria-hidden="true">
    <rect class="rf-ilustra-folha" x="14" y="10" width="112" height="112" rx="10"/>
    <rect class="rf-ilustra-cabeca" x="14" y="10" width="112" height="22" rx="10"/>
    <g class="rf-ilustra-linhas">
      <rect x="26" y="44" width="58" height="7" rx="3.5"/><rect x="92" y="44" width="22" height="7" rx="3.5"/>
      <rect x="26" y="62" width="46" height="7" rx="3.5"/><rect x="92" y="62" width="22" height="7" rx="3.5"/>
      <rect x="26" y="80" width="64" height="7" rx="3.5"/><rect x="92" y="80" width="22" height="7" rx="3.5"/>
      <rect x="26" y="98" width="38" height="7" rx="3.5"/><rect x="92" y="98" width="22" height="7" rx="3.5"/>
    </g>
    <path class="rf-ilustra-seta" d="M134 66 h22" pathLength="1"/>
    <path class="rf-ilustra-seta-ponta" d="M150 60 l7 6 -7 6"/>
    <path class="rf-ilustra-area" d="M164 104 L174 88 L186 80 L198 66 L208 58 L208 112 L164 112 Z"/>
    <path class="rf-ilustra-curva" d="M164 104 L174 88 L186 80 L198 66 L208 58" pathLength="1"/>
    <circle class="rf-ilustra-ponto" cx="208" cy="58" r="4"/>
  </svg>`;

export const htmlVazio = () => `
  <div class="rf-boasvindas">
    ${ILUSTRACAO}
    <h3>Solte aqui a planilha de renda fixa da XP</h3>
    <p>Em qualquer lugar desta aba. Em segundos, a maior taxa de cada prazo e categoria, e a mensagem pronta para o WhatsApp.</p>
    <ol class="rf-passos">
      <li><b>1</b><span>Exporte da XP<small>a planilha de produtos de renda fixa</small></span></li>
      <li><b>2</b><span>Solte nesta aba<small>lida aqui, sem sair do navegador</small></span></li>
      <li><b>3</b><span>Copie a mensagem<small>e cole no WhatsApp do cliente</small></span></li>
    </ol>
    <button type="button" class="copy-btn btn-primario rf-escolher" data-acao="abrir">Escolher a planilha</button>
  </div>`;

export const htmlLendo = (nome) => `
  <div class="empty-state rf-lendo">
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

/**
 * @param {object} r o resultado do motor
 * @param {object|null} referencia a última análise salva antes de hoje, para as variações
 * @param {{trechos?: Record<string, string>}} [opcoes] os trechos da mensagem (`analise.js`): com
 *   eles, cada seção ganha o botão de copiar só ela
 */
export const htmlCartoes = (r, referencia, { trechos = {} } = {}) => htmlCartoesSemSimulador(r, referencia, { trechos }) + htmlSimulador(r);

const htmlCartoesSemSimulador = (r, referencia, { trechos = {} } = {}) => {
  const secoes = r.secoes.filter((s) => s.itens.length);
  return `
  <div class="rf-destaques">${secoes.map((secao) => htmlDestaque(secao, r)).join('')}</div>
  <div class="rf-secoes">${secoes.map((secao) => htmlSecao(secao, r, referencia, trechos)).join('')}</div>`;
};

// O alto do painel: a maior taxa de cada categoria, grande, com o prazo e o tipo. Leva à seção.
const htmlDestaque = (secao, r) => {
  const d = destaqueDaSecao(secao);
  const { prefixo, valor, sufixo } = partesDaTaxa(d);
  const emissor = r.secundario && d.emissor ? ` · ${esc(d.emissor)}` : '';
  const equivalente = secao.id === 'isentos' ? equivalenteBruto(d) : null;
  const rodape = equivalente
    ? `<span class="rf-destaque-equiv">≈ ${fmtT(equivalente.taxa)}${sufixo} num título com IR</span>`
    : htmlCurva(secao, d, { mini: true });
  return `
    <button type="button" class="rf-destaque" data-sec="${secao.id}" data-acao="ir-para" title="Ver ${NOMES[secao.id].varios}">
      <span class="rf-destaque-rotulo">${NOMES[secao.id].um}</span>
      <span class="rf-destaque-taxa">${prefixo ? `<small>${prefixo.trim()}</small>` : ''}<span class="rf-num" data-contar="${d.taxa}">${valor}</span><small>${sufixo}</small></span>
      <span class="rf-destaque-sub">${fmtP(d.prazo)} · ${esc(d.tipo)}${emissor}</span>
      ${rodape}
    </button>`;
};

const htmlSecao = (secao, r, referencia, trechos) => {
  const destaque = destaqueDaSecao(secao);
  const n = secao.itens.length;
  const copiar = trechos[secao.id]
    ? `<button type="button" class="rf-copiar-secao" data-acao="copiar-secao" data-sec="${secao.id}" title="Copiar só ${NOMES[secao.id].varios}, com o mesmo texto da mensagem">Copiar</button>`
    : '';
  return `
  <section class="rf-secao" data-sec="${secao.id}">
    <header class="rf-secao-topo">
      <div class="rf-secao-titulo"><strong>${esc(secao.titulo)}</strong><span>${UNIDADES[secao.id]} · ${n} na mensagem</span></div>
      ${copiar}
    </header>
    ${htmlCurva(secao, destaque)}
    <ol class="rf-linhas">${secao.itens.map((item, i) => htmlLinha(item, i, secao, r, referencia, destaque)).join('')}</ol>
  </section>`;
};

const htmlLinha = (item, i, secao, r, referencia, destaque) => {
  const { prefixo, valor, sufixo } = partesDaTaxa(item);
  const emissor = r.secundario && item.emissor ? `<span class="rf-emissor">${esc(item.emissor)}</span>` : '';
  const melhor = item === destaque;
  return `
    <li class="rf-linha${melhor ? ' rf-melhor' : ''}" data-i="${i}" style="--forca:${forcaDaTaxa(item, secao).toFixed(3)}"${melhor ? ' title="A maior taxa desta categoria"' : ''}>
      <span class="rf-prazo">${item.prazo}<small>${item.prazo === 1 ? 'ano' : 'anos'}</small></span>
      <span class="badge">${esc(item.tipo)}</span>
      <span class="rf-ativo">${emissor}<span title="${esc(item.ativo)}">${esc(item.ativo)}</span></span>
      <span class="rf-taxa">
        <span class="rf-taxa-valor">${prefixo ? `<span class="rf-taxa-pre">${prefixo.trim()}</span> ` : ''}<span class="rf-taxa-num">${valor}</span><span class="rf-taxa-suf">${sufixo}</span></span>
        ${htmlDelta(item, secao.id, referencia)}
      </span>
      ${secao.id === 'isentos' ? htmlEquivalencia(item, r.secoes) : ''}
      <span class="rf-forca" aria-hidden="true"></span>
    </li>`;
};

// O isento comparado com um título com IR: a taxa equivalente e, havendo, o da mensagem no mesmo prazo.
// A alíquota sai como se fala: 22,5%, 20%, 17,5%, 15%.
const fmtIR = (ir) => String(ir).replace('.', ',');
const htmlEquivalencia = (item, secoes) => {
  const eq = equivalenteBruto(item);
  if (!eq) return '';
  const { sufixo } = partesDaTaxa(item);
  const tributado = tributadoDoMesmoPrazo(item, secoes);
  const comparacao = !tributado
    ? ''
    : eq.taxa > tributado.taxa
      ? ` <b class="rf-supera">rende mais que o ${esc(tributado.tipo)} de ${fmtP(item.prazo)} (${fmtT(tributado.taxa)}${sufixo})</b>`
      : ` <span class="rf-perde">o ${esc(tributado.tipo)} de ${fmtP(item.prazo)} paga ${fmtT(tributado.taxa)}${sufixo}</span>`;
  const conta = `${fmtT(item.taxa)} ÷ (1 − ${fmtIR(eq.ir)}%), com ${item.dias} dias até o vencimento`;
  return `<span class="rf-equivale" title="A taxa que um título com IR precisaria pagar para render o mesmo: ${conta}.">≈ ${fmtT(eq.taxa)}${sufixo} num título com IR <small>(IR de ${fmtIR(eq.ir)}%)</small>${comparacao}</span>`;
};

/**
 * A curva de taxa × prazo da seção. Só quando todos os itens usam a mesma unidade. A grande leva os
 * prazos embaixo e a maior taxa escrita; cada ponto tem o `data-i` da linha dele, e passar o mouse
 * numa acende a outra (index.js). A mini vai no destaque.
 */
const htmlCurva = (secao, destaque, { mini = false } = {}) => {
  const itens = secao.itens;
  if (secao.id === 'isentos' || itens.length < 2) return '';
  if (new Set(itens.map((it) => it.indexador)).size > 1) return '';

  const [L, A] = mini ? [120, 30] : [360, 92];
  const [mx, mt, mb] = mini ? [4, 4, 4] : [18, 20, 24];
  const prazos = itens.map((it) => it.prazo);
  const taxas = itens.map((it) => it.taxa);
  const [pMin, pMax, tMin, tMax] = [Math.min(...prazos), Math.max(...prazos), Math.min(...taxas), Math.max(...taxas)];
  const base = A - mb;
  const x = (p) => mx + ((p - pMin) / (pMax - pMin)) * (L - 2 * mx);
  const y = (t) => (tMax === tMin ? (mt + base) / 2 : mt + (1 - (t - tMin) / (tMax - tMin)) * (base - mt));
  const pontos = itens.map((it) => [x(it.prazo).toFixed(1), y(it.taxa).toFixed(1)]);
  const linha = pontos.map(([px, py], k) => `${k ? 'L' : 'M'}${px} ${py}`).join(' ');
  const [primeiro, ultimo] = [pontos[0], pontos[pontos.length - 1]];
  const area = `${linha} L${ultimo[0]} ${base} L${primeiro[0]} ${base} Z`;
  const descricao = itens.map((it) => `${fmtP(it.prazo)}: ${fmtT(it.taxa)}`).join(', ');
  const gradiente = `rf-degrade-${secao.id}${mini ? '-mini' : ''}`;

  const marcas = itens
    .map((it, j) => {
      const { prefixo, valor, sufixo } = partesDaTaxa(it);
      const [px, py] = pontos[j];
      const maior = it === destaque ? ' class="rf-ponto-maior"' : '';
      return `<circle cx="${px}" cy="${py}" r="${mini ? 2.2 : 3.4}" data-i="${j}"${maior}><title>${fmtP(it.prazo)}: ${prefixo}${valor}${sufixo}</title></circle>`;
    })
    .join('');

  // Na grande: a linha de base, os prazos embaixo e a maior taxa escrita sobre o ponto dela.
  let extras = '';
  if (!mini) {
    const iMaior = itens.indexOf(destaque);
    const [qx, qy] = pontos[iMaior] ?? pontos[0];
    const ancora = Number(qx) > L - 40 ? 'end' : Number(qx) < 40 ? 'start' : 'middle';
    extras =
      `<line class="rf-eixo-linha" x1="${mx}" y1="${base}" x2="${L - mx}" y2="${base}"/>` +
      itens.map((it, j) => `<text class="rf-eixo" x="${pontos[j][0]}" y="${A - 6}" text-anchor="middle">${it.prazo}a</text>`).join('') +
      `<text class="rf-rotulo-maior" x="${qx}" y="${Number(qy) - 9}" text-anchor="${ancora}">${fmtT(destaque.taxa)}${partesDaTaxa(destaque).sufixo.trim()}</text>`;
  }

  return `<svg class="rf-curva${mini ? ' rf-curva-mini' : ''}" viewBox="0 0 ${L} ${A}" role="img" aria-label="Curva por prazo — ${descricao}"><defs><linearGradient id="${gradiente}" x1="0" y1="0" x2="0" y2="1"><stop offset="0"/><stop offset="1"/></linearGradient></defs><path class="rf-area" d="${area}" fill="url(#${gradiente})"/>${extras}<path class="rf-traco" d="${linha}" pathLength="1"/>${marcas}</svg>`;
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

/**
 * A mensagem como chega no WhatsApp do cliente: um celular com a conversa, e ao lado os números dela e
 * os botões de copiar uma categoria só.
 *
 * @param {string} texto a mensagem, como o Copiar a leva
 * @param {{trechos?: Record<string, string>}} [opcoes]
 */
export const htmlMensagem = (texto, { trechos = {} } = {}) => {
  const limpo = texto.trimEnd();
  const ids = Object.keys(trechos);
  const chips = ids
    .map((id) => `<button type="button" class="rf-chip" data-acao="copiar-secao" data-sec="${id}" title="Copiar só ${NOMES[id].varios}">${NOMES[id].um}</button>`)
    .join('');
  return `
  <div class="rf-zap">
    <div class="rf-celular">
      <div class="rf-celular-topo"><span class="rf-avatar" aria-hidden="true"></span><span><strong>Cliente</strong><small>WhatsApp</small></span></div>
      <div class="rf-conversa">
        <div class="rf-bolha"><div class="rf-bolha-texto">${mensagemEmHTML(limpo)}</div><span class="rf-bolha-hora" aria-hidden="true">agora <i>✓✓</i></span></div>
      </div>
    </div>
    <aside class="rf-zap-lado">
      <p class="rf-nota">É exatamente este texto que o botão Copiar coloca na área de transferência.</p>
      <dl class="rf-zap-numeros">
        <div><dt>linhas</dt><dd>${limpo.split('\n').length}</dd></div>
        <div><dt>caracteres</dt><dd>${limpo.length}</dd></div>
        <div><dt>categorias</dt><dd>${ids.length}</dd></div>
      </dl>
      ${chips ? `<div class="rf-zap-trechos"><span>Copiar uma categoria só</span><div>${chips}</div></div>` : ''}
    </aside>
  </div>`;
};

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
      <div class="rf-funil-rotulo"><span>${rotulo}</span><span class="rf-funil-pct">${fmtPct(pct)}</span><b class="rf-num" data-contar="${valor}" data-inteiro>${numero(valor)}</b></div>
      <div class="rf-funil-trilho"><div class="rf-funil-barra" style="width:${pct.toFixed(2)}%"></div></div>
    </div>`;
    })
    .join('');
};

/**
 * @param {object} r o resultado do motor
 * @param {boolean[]} abertos quais dos dois quadros estavam abertos, para não fechá-los ao reprocessar
 * @param {Record<string, string>} [textos] o texto de cada descarte, com o PU das regras do mercado
 */
export const htmlDetalhesFunil = (r, abertos, textos = MOTIVOS_DESCARTE) => {
  const t = r.totais;
  const motivos = Object.entries(r.descartes)
    .filter(([, n]) => n > 0)
    .map(([motivo, n]) => [textos[motivo], n])
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

/* ── O simulador de pré-fixado (21/10/2026, simulador.js) ─────────────────────────────── */

/** Os títulos que dá para simular: os pré, e os isentos pré, com os dias até o vencimento. */
export const opcoesDoSimulador = (r) =>
  r.secoes
    .flatMap((s) => s.itens.map((item) => ({ item, isento: s.id === 'isentos' })))
    .filter(({ item }) => item.indexador === 'PRE' && item.dias > 0);

const rotuloDaOpcao = ({ item, isento }) =>
  `${item.prazo === 1 ? '1 ano' : `${item.prazo} anos`} · ${item.tipo} ${fmtTaxa(item.taxa)}% a.a.${isento ? ' (isento)' : ''}`;

export const htmlSimulador = (r) => {
  const opcoes = opcoesDoSimulador(r);
  if (!opcoes.length) return '';
  return `
  <details class="rf-simulador" data-rf-simulador>
    <summary><span class="rf-simulador-titulo">Simular um pré-fixado</span><span class="rf-nota">quanto vira no vencimento, antes e depois do IR</span></summary>
    <div class="rf-simulador-corpo">
      <label class="rf-simulador-campo"><span>Título</span>
        <select data-sim="titulo">${opcoes.map((opcao, i) => `<option value="${i}">${esc(rotuloDaOpcao(opcao))}</option>`).join('')}</select>
      </label>
      <label class="rf-simulador-campo"><span>Valor aplicado (R$)</span><input data-sim="valor" inputmode="decimal" placeholder="10.000,00" autocomplete="off" /></label>
      <div class="rf-simulador-resultado" data-sim="resultado"><p class="rf-nota">Digite o valor.</p></div>
    </div>
    <p class="rf-nota">Estimativa: taxa ao ano em 252 dias úteis, IR pela tabela regressiva sobre o rendimento. Não entram IOF (até 30 dias), custódia nem o PU do dia no secundário.</p>
  </details>`;
};

const reais = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtTaxa = (t) => t.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** O resultado da simulação, ou o que falta para ela. */
export const htmlResultadoDaSimulacao = (sim, { diasUteis, diasCorridos }) =>
  sim
    ? `<dl class="rf-simulador-numeros">
        <div><dt>No vencimento, bruto</dt><dd>${reais(sim.bruto)}</dd></div>
        <div><dt>Rendimento</dt><dd>${reais(sim.rendimento)}</dd></div>
        <div><dt>IR (${String(sim.aliquota).replace('.', ',')}%)</dt><dd>${sim.ir ? `− ${reais(sim.ir)}` : 'isento'}</dd></div>
        <div class="rf-simulador-liquido"><dt>Líquido</dt><dd>${reais(sim.liquido)}</dd></div>
        <div><dt>Taxa líquida</dt><dd>≈ ${fmtTaxa(sim.taxaLiquida)}% a.a.</dd></div>
      </dl>
      <p class="rf-nota">${diasCorridos} dias corridos, ${diasUteis} dias úteis até o vencimento.</p>`
    : '<p class="rf-nota">Digite o valor.</p>';
