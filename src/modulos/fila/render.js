/**
 * O HTML da Fila do dia: funções puras, sem DOM, testadas em `render.test.js`.
 *
 * Desde 21/10/2026 (conversa do usuário com um colega: "me acostumei com o e-mail limpo"), a Fila é
 * uma caixa de entrada com pastas, e não um quadro de colunas. À vista fica só **Aprovação e
 * execução** — o que o cliente respondeu, ou que o operador marcou como aprovado, e falta executar. Os
 * **Enviados** (aguardando o cliente) e os **Executados** ficam em pastas, abertas só para mudar ou
 * conferir alguma coisa. O fluxo: e-mail enviado → aprovação e execução.
 *
 * Tudo que vem do pedido (nome do cliente, ativo, a resposta dele) passa por `esc`. As regras ficam em
 * `src/comum/fila/regras.js`; aqui só a apresentação.
 */

import { esc } from '../../ui/html.js';
import { NOMES_DOS_GRUPOS, diaDe, fichaDeExecucao, linkDaBoleta, pedeAtencao, prazoMaisUrgente, situacaoDoPrazo } from '../../comum/fila/regras.js';
import { quantoFalta } from '../../comum/horarios.js';

const hora = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const diaEHora = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');

export const PASTAS = [
  {
    id: 'executar',
    titulo: 'Aprovação e execução',
    estados: ['respondeu', 'aprovado'],
    vazio: 'Nada para aprovar e executar agora. Quando o cliente responder um e-mail, o pedido aparece aqui.'
  },
  { id: 'enviados', titulo: 'Enviados', estados: ['enviado'], vazio: 'Nenhum e-mail esperando o cliente.' },
  { id: 'executados', titulo: 'Executados', estados: ['executado'], vazio: 'Nada executado neste dia.' },
  { id: 'cancelados', titulo: 'Cancelados', estados: ['cancelado'], vazio: 'Nenhum pedido cancelado.' }
];

export const pastaDoEstado = (estado) => PASTAS.find((p) => p.estados.includes(estado))?.id ?? 'enviados';

const OPERACAO = { C: 'compra', V: 'venda' };

// O resumo de uma ordem: o lado, o ativo e o quanto, curto.
const resumoDaOrdem = (o, grupo) => {
  const quanto = o.total && !o.quantidade && !o.financeiro
    ? 'total'
    : o.quantidade
      ? `${o.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}${o.fundoId ? ' cotas' : ''}`
      : o.financeiro
        ? o.financeiro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '';
  const lado = grupo === 'tesouro' ? 'aplica' : grupo === 'tesouro-resgate' ? 'resgata' : OPERACAO[o.operacao] ?? '';
  return `<li><span class="fl-op fl-op-${o.operacao === 'V' ? 'v' : 'c'}">${esc(lado)}</span><span class="fl-ativo" title="${esc(o.ativo)}">${esc(o.ativo)}</span><span class="fl-quanto">${esc(quanto)}</span></li>`;
};

/** O prazo que pede atenção, como chip: âmbar perto, vermelho vencido. */
export const htmlPrazo = (pedido, agora) => {
  const prazo = prazoMaisUrgente(pedido, agora);
  if (!prazo) return '';
  const situacao = situacaoDoPrazo(prazo, agora);
  const texto = situacao === 'vencido' ? `${prazo.rotulo} ${diaEHora(prazo.ate)} — passou` : `${prazo.rotulo} ${diaEHora(prazo.ate)} · ${quantoFalta(prazo.ate - agora)}`;
  return `<span class="fl-prazo" data-situacao="${situacao}" title="${esc(pedido.prazos.map((p) => `${p.rotulo} ${diaEHora(p.ate)}`).join(' · '))}">${esc(texto)}</span>`;
};

const botao = (acao, rotulo, { estado = null, tipo = '', titulo = '' } = {}) =>
  `<button type="button" class="fl-botao${tipo ? ` fl-${tipo}` : ''}" data-acao="${acao}"${estado ? ` data-estado="${estado}"` : ''}${titulo ? ` title="${esc(titulo)}"` : ''}>${rotulo}</button>`;
const icone = (acao, simbolo, titulo, { estado = null, classe = '' } = {}) =>
  `<button type="button" class="fl-icone${classe ? ` ${classe}` : ''}" data-acao="${acao}"${estado ? ` data-estado="${estado}"` : ''} title="${esc(titulo)}" aria-label="${esc(titulo)}">${simbolo}</button>`;

const boletasDe = (pedido) =>
  pedido.ordens
    .map((o) => [o, linkDaBoleta(o, pedido.conta, pedido.grupo)])
    .filter(([, link]) => link)
    .map(([o, link]) => `<a class="fl-boleta" href="${esc(link)}" target="_blank" rel="noopener" title="Abrir a boleta de ${esc(o.ativo)} no Hub">Boleta ${esc(o.ativo.split(' ')[0])}</a>`)
    .join('');

const quandoFoi = (pedido, estado) => [...pedido.historico].reverse().find((h) => h.estado === estado)?.em ?? null;

const cabecaDoCartao = (pedido, agora) => {
  const cliente = pedido.cliente?.nome
    ? `<span class="fl-cliente" title="${esc(pedido.cliente.email ?? '')}">${esc(pedido.cliente.nome)}</span>`
    : '<span class="fl-cliente fl-sem">cliente não identificado</span>';
  const outroDia = pedido.dia !== diaDe(agora) ? `<span class="fl-outro-dia" title="E-mail enviado em ${diaEHora(pedido.criadoEm)}">de ${diaEHora(pedido.criadoEm).split(' ')[0]}</span>` : '';
  return `
    <header class="fl-cartao-topo">
      <span class="fl-conta">${esc(pedido.conta)}</span>
      ${cliente}
      <span class="fl-grupo">${esc(NOMES_DOS_GRUPOS[pedido.grupo] ?? pedido.grupo)}</span>
      ${outroDia}
      <span class="fl-hora" title="E-mail enviado às ${hora(pedido.criadoEm)}">enviado ${hora(pedido.criadoEm)}</span>
    </header>`;
};

/**
 * Um pedido de Aprovação e execução: a resposta do cliente em destaque, as ordens, o prazo, e o que
 * fazer — a ficha, a boleta, executado. "Não aprovou" volta para os Enviados.
 */
const cartaoParaExecutar = (pedido, agora) => {
  const aprovadoEm = pedido.estado === 'aprovado' ? quandoFoi(pedido, 'aprovado') : null;
  const resposta = pedido.resposta
    ? `<blockquote class="fl-resposta"><span>${esc(pedido.resposta.previa || '(sem prévia)')}</span><cite>${esc(pedido.resposta.de ?? 'o cliente')} respondeu às ${hora(pedido.resposta.em)}</cite></blockquote>`
    : `<p class="fl-aprovado">Aprovado por você${aprovadoEm ? ` às ${hora(aprovadoEm)}` : ''}, sem resposta pelo e-mail.</p>`;
  return `
  <article class="fl-cartao fl-cartao-executar${pedeAtencao(pedido, agora) ? ' fl-atencao' : ''}" data-id="${esc(pedido.id)}" data-grupo="${esc(pedido.grupo)}" data-estado="${esc(pedido.estado)}">
    ${cabecaDoCartao(pedido, agora)}
    ${resposta}
    <ul class="fl-ordens">${pedido.ordens.map((o) => resumoDaOrdem(o, pedido.grupo)).join('')}</ul>
    ${htmlPrazo(pedido, agora)}
    <footer class="fl-cartao-acoes">
      ${botao('ficha', 'Ficha de execução')}
      ${boletasDe(pedido)}
      ${botao('estado', 'Executado', { estado: 'executado', tipo: 'primario', titulo: 'Executei no Hub: vai para os Executados' })}
      <span class="fl-mais">
        ${icone('email', '✉', 'Ver o e-mail que saiu')}
        ${icone('anotar', '✎', 'Criar uma anotação deste pedido')}
        ${icone('estado', '↩', 'Não aprovou: volta para os Enviados', { estado: 'enviado' })}
        ${icone('estado', '×', 'Cancelar o pedido', { estado: 'cancelado', classe: 'fl-cancelar' })}
      </span>
    </footer>
  </article>`;
};

/** Um pedido de pasta (Enviados, Executados, Cancelados): uma linha, como na lista de e-mails. */
const linhaDaPasta = (pedido, pasta, agora) => {
  const ativos = pedido.ordens.map((o) => o.ativo).join(', ');
  const executadoEm = pasta === 'executados' ? quandoFoi(pedido, 'executado') : null;
  const acoes = {
    enviados: `${botao('estado', 'Aprovou', { estado: 'aprovado', titulo: 'O cliente aprovou por outro canal: vai para Aprovação e execução' })}
      ${icone('email', '✉', 'Ver o e-mail que saiu')}${icone('anotar', '✎', 'Criar uma anotação deste pedido')}${icone('estado', '×', 'Cancelar o pedido', { estado: 'cancelado', classe: 'fl-cancelar' })}`,
    executados: `${icone('ficha', '☰', 'Ver a ficha de execução')}${icone('email', '✉', 'Ver o e-mail que saiu')}${icone('anotar', '✎', 'Criar uma anotação deste pedido')}${botao('estado', 'Desfazer', { estado: 'aprovado', titulo: 'Ainda não foi executado: volta para Aprovação e execução' })}`,
    cancelados: `${icone('email', '✉', 'Ver o e-mail que saiu')}${botao('estado', 'Reabrir', { estado: 'enviado', titulo: 'Volta para os Enviados' })}`
  }[pasta];
  return `
  <article class="fl-linha${pasta === 'enviados' && pedeAtencao(pedido, agora) ? ' fl-atencao' : ''}" data-id="${esc(pedido.id)}" data-grupo="${esc(pedido.grupo)}" data-estado="${esc(pedido.estado)}">
    <span class="fl-conta">${esc(pedido.conta)}</span>
    <span class="fl-cliente${pedido.cliente?.nome ? '' : ' fl-sem'}">${esc(pedido.cliente?.nome ?? 'cliente não identificado')}</span>
    <span class="fl-grupo">${esc(NOMES_DOS_GRUPOS[pedido.grupo] ?? pedido.grupo)}</span>
    <span class="fl-ativos" title="${esc(ativos)}">${esc(ativos)}</span>
    <span class="fl-quando">${executadoEm ? `executado ${hora(executadoEm)}` : `enviado ${pedido.dia !== diaDe(agora) ? diaEHora(pedido.criadoEm) : hora(pedido.criadoEm)}`}</span>
    ${pasta === 'enviados' ? htmlPrazo(pedido, agora) : ''}
    <span class="fl-linha-acoes">${acoes}</span>
  </article>`;
};

/** A navegação das pastas, com quantos há em cada uma; a de Enviados avisa do prazo perto. */
export const htmlPastas = (pedidos, pastaAtual, agora = Date.now()) =>
  PASTAS.filter((p) => p.id !== 'cancelados' || pedidos.some((x) => x.estado === 'cancelado') || pastaAtual === 'cancelados')
    .map((p) => {
      const daPasta = pedidos.filter((x) => p.estados.includes(x.estado));
      const alerta = p.id === 'enviados' && daPasta.some((x) => pedeAtencao(x, agora));
      return `<button type="button" class="fl-pasta${p.id === pastaAtual ? ' ativa' : ''}" data-pasta="${p.id}" aria-pressed="${p.id === pastaAtual}"${alerta ? ' title="Há e-mail esperando o cliente com o prazo perto"' : ''}>
        <span class="fl-pasta-nome">${p.titulo}</span>${alerta ? '<span class="fl-pasta-alerta" aria-hidden="true"></span>' : ''}<b>${daPasta.length}</b>
      </button>`;
    })
    .join('');

/** O conteúdo da pasta aberta. */
export const htmlLista = (pedidos, pasta, agora = Date.now()) => {
  const definicao = PASTAS.find((p) => p.id === pasta) ?? PASTAS[0];
  const daPasta = pedidos.filter((p) => definicao.estados.includes(p.estado));
  if (!daPasta.length) return `<p class="fl-vazio">${definicao.vazio}</p>`;
  if (definicao.id === 'executar') {
    // Os que pedem atenção primeiro (o prazo perto), depois por ordem de chegada da resposta.
    const ordenados = [...daPasta].sort((a, b) => Number(pedeAtencao(b, agora)) - Number(pedeAtencao(a, agora)) || (a.resposta?.em ?? a.atualizadoEm) - (b.resposta?.em ?? b.atualizadoEm));
    return `<div class="fl-cartoes">${ordenados.map((p) => cartaoParaExecutar(p, agora)).join('')}</div>`;
  }
  const recentes = [...daPasta].sort((a, b) => b.atualizadoEm - a.atualizadoEm);
  return `<div class="fl-linhas">${recentes.map((p) => linhaDaPasta(p, definicao.id, agora)).join('')}</div>`;
};

const MOTIVOS = {
  'pelo-nome': 'Achada pelo nome: veio de outro endereço de e-mail. É deste pedido?',
  ambigua: 'O cliente tem mais de um pedido esperando, com o mesmo assunto: de qual é?',
  nenhum: 'Não casou com nenhum pedido aberto: é de algum destes?'
};

/**
 * As respostas que o robô viu no Outlook e não casaram sozinhas: cada uma com os cartões candidatos
 * (ou, sem candidato, os que esperam o cliente), e "Não é de pedido".
 */
export const htmlConferir = (soltas, pedidos) => {
  if (!soltas.length) return '';
  const porId = new Map(pedidos.map((p) => [p.id, p]));
  const esperando = pedidos.filter((p) => p.estado === 'enviado' || p.estado === 'respondeu');
  const itens = soltas.map((s) => {
    const candidatos = s.candidatos.length ? s.candidatos.map((id) => porId.get(id)).filter(Boolean) : esperando;
    const r = s.resposta;
    return `
    <article class="fl-solta" data-resposta="${esc(r.id)}">
      <header class="fl-cartao-topo">
        <span class="fl-conta">${esc(r.de || 'Remetente sem nome')}</span>
        <span class="fl-cliente">${esc(r.email ?? '')}</span>
        <span class="fl-hora">${hora(r.em)}</span>
      </header>
      <span class="fl-solta-assunto">${esc(r.assunto)}</span>
      <blockquote class="fl-resposta"><span>${esc(r.previa || '(sem prévia)')}</span></blockquote>
      <p class="fl-nota">${MOTIVOS[s.motivo] ?? MOTIVOS.nenhum}</p>
      <footer class="fl-cartao-acoes">
        ${candidatos
          .map((p) => `<button type="button" class="fl-botao" data-acao="atribuir" data-pedido="${esc(p.id)}">Conta ${esc(p.conta)} · ${esc(NOMES_DOS_GRUPOS[p.grupo] ?? p.grupo)} · ${hora(p.criadoEm)}</button>`)
          .join('')}
        <button type="button" class="fl-botao fl-ignorar" data-acao="ignorar">Não é de pedido</button>
      </footer>
    </article>`;
  });
  return `
    <div class="panel-header-row">
      <h2 class="panel-title">Respostas a conferir</h2>
      <span class="meta-counter">${soltas.length}</span>
    </div>
    <div class="fl-soltas">${itens.join('')}</div>`;
};

/** A ficha de execução, na janela: o texto, copiar e as boletas. */
export const htmlFicha = (pedido, agora = Date.now()) => {
  const boletas = pedido.ordens
    .map((o) => [o, linkDaBoleta(o, pedido.conta, pedido.grupo)])
    .filter(([, link]) => link)
    .map(([o, link]) => `<a class="copy-btn" href="${esc(link)}" target="_blank" rel="noopener">Abrir a boleta · ${esc(o.ativo)}</a>`)
    .join('');
  return `
    <pre class="fl-ficha-texto">${esc(fichaDeExecucao(pedido, agora))}</pre>
    <div class="fl-ficha-acoes">
      <button type="button" class="copy-btn btn-primario" data-acao="copiar-ficha">Copiar a ficha</button>
      ${boletas}
    </div>
    <p class="fl-nota">Sai do que o e-mail aprovado pediu: nada é refeito nem recalculado. Confira na boleta antes de enviar.</p>`;
};
