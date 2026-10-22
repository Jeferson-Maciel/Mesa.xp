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
import { NOMES_DOS_GRUPOS, destinoDaBoleta, diaDe, diaEHora, hora, estoqueDaOrdem, fichaDeExecucao, pedeAtencao, prazoMaisUrgente, quantoParaExecutar, situacaoDoPrazo } from '../../comum/fila/regras.js';
import { quantoFalta } from '../../comum/horarios.js';


export const PASTAS = [
  {
    id: 'executar',
    titulo: 'Aprovação e execução',
    estados: ['respondeu', 'aprovado'],
    vazio: 'Nada para aprovar e executar agora.'
  },
  { id: 'enviados', titulo: 'Enviados', estados: ['enviado'], vazio: 'Nenhum e-mail esperando o cliente.' },
  { id: 'executados', titulo: 'Executados', estados: ['executado'], vazio: 'Nada executado neste dia.' },
  { id: 'cancelados', titulo: 'Cancelados', estados: ['cancelado'], vazio: 'Nenhum pedido cancelado.' }
];

export const pastaDoEstado = (estado) => PASTAS.find((p) => p.estados.includes(estado))?.id ?? 'enviados';

const OPERACAO = { C: 'compra', V: 'venda' };

/*
 * Uma ordem, para executar: o lado, o ativo e, em destaque, a quantidade que o e-mail aprovado levou —
 * as cotas da conversão na compra em R$, a posição na venda do total (pedido do operador em
 * 21/10/2026: "executar com base nas cotas") —, com o valor pedido e o estoque embaixo, menores.
 */
const resumoDaOrdem = (o, pedido) => {
  const { principal, detalhes, ativo } = quantoParaExecutar(pedido, o);
  const sem = detalhes.includes('sem as cotas no e-mail');
  const notas = [...detalhes.filter((d) => d !== 'sem as cotas no e-mail'), estoqueDaOrdem(pedido, o), sem ? 'sem as cotas no e-mail' : null].filter(Boolean);
  const lado = pedido.grupo === 'tesouro' ? 'aplica' : pedido.grupo === 'tesouro-resgate' ? 'resgata' : OPERACAO[o.operacao] ?? '';
  return `<li><span class="fl-op fl-op-${o.operacao === 'V' ? 'v' : 'c'}">${esc(lado)}</span><span class="fl-ativo" title="${esc(ativo)}">${esc(ativo)}</span><span class="fl-quanto"><b${sem ? ' class="fl-sem-cotas"' : ''}>${esc(principal)}</b>${notas.length ? `<small>${esc(notas.join(' · '))}</small>` : ''}</span></li>`;
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

/*
 * As boletas do pedido: botões que pedem ao robô a boleta certa, numa aba do Hub à vista (robô 1.10.0).
 * Um por fundo (o lado e a conta do pedido); no Tesouro, um só — o Tesouro do cliente, na aplicação, ou
 * a posição dele, no resgate. A bolsa se executa pelo lote.
 */
const boletasDe = (pedido, { classe = 'fl-boleta' } = {}) => {
  if (pedido.grupo.startsWith('tesouro')) {
    const rotulo = pedido.grupo === 'tesouro-resgate' ? 'Posição no Tesouro' : 'Tesouro do cliente';
    return destinoDaBoleta(pedido.ordens[0] ?? {}, pedido.conta, pedido.grupo)
      ? `<button type="button" class="${classe}" data-acao="boleta" data-indice="0" title="O robô abre o Tesouro Direto no Hub, já com o cliente da conta ${esc(pedido.conta)}">${rotulo}</button>`
      : '';
  }
  return pedido.ordens
    .map((o, i) => [o, i, destinoDaBoleta(o, pedido.conta, pedido.grupo)])
    .filter(([, , destino]) => destino)
    .map(([o, i]) => `<button type="button" class="${classe}" data-acao="boleta" data-indice="${i}" title="O robô abre no Hub a boleta de ${o.operacao === 'V' ? 'venda' : 'compra'} de ${esc(o.ativo)} para a conta ${esc(pedido.conta)}">Boleta ${esc(o.ativo.split(' ')[0])}</button>`)
    .join('');
};

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
 * fazer — Aprovou (quem lê a resposta e aprova é o operador), o lote ou a ficha, a boleta, executado.
 * "Não aprovou" volta para os Enviados.
 */
const cartaoParaExecutar = (pedido, agora) => {
  const aprovadoEm = pedido.estado === 'aprovado' ? quandoFoi(pedido, 'aprovado') : null;
  const resposta = pedido.resposta
    ? `<blockquote class="fl-resposta"><span>${esc(pedido.resposta.previa || '(sem prévia)')}</span><cite>${esc(pedido.resposta.de ?? 'o cliente')} respondeu às ${hora(pedido.resposta.em)}</cite></blockquote>${aprovadoEm ? `<p class="fl-aprovado">Aprovado por você às ${hora(aprovadoEm)}.</p>` : ''}`
    : `<p class="fl-aprovado">Aprovado por você${aprovadoEm ? ` às ${hora(aprovadoEm)}` : ''}, sem resposta pelo e-mail.</p>`;
  return `
  <article class="fl-cartao fl-cartao-executar${pedeAtencao(pedido, agora) ? ' fl-atencao' : ''}" data-id="${esc(pedido.id)}" data-grupo="${esc(pedido.grupo)}" data-estado="${esc(pedido.estado)}">
    ${cabecaDoCartao(pedido, agora)}
    ${resposta}
    <ul class="fl-ordens">${pedido.ordens.map((o) => resumoDaOrdem(o, pedido)).join('')}</ul>
    ${htmlPrazo(pedido, agora)}
    <footer class="fl-cartao-acoes">
      ${pedido.estado === 'respondeu' ? botao('estado', 'Aprovou', { estado: 'aprovado', titulo: 'Li a resposta: o cliente aprovou (a hora fica na ficha)' }) : ''}
      ${pedido.grupo === 'bolsa' ? botao('lote', 'Gerar lote', { titulo: 'O Lote Simples e o Lote TWAP deste pedido, com as quantidades do e-mail aprovado' }) : botao('ficha', 'Ficha de execução')}
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

/*
 * Aprovação e execução em tabela (Fase 3, Q34): uma linha por pedido, para quem tem muitos de uma vez. À
 * vista, o que se faz em cada um — Aprovou, o lote ou a ficha, a boleta e Executado —; o resto (ver o
 * e-mail, anotar, não aprovou, cancelar) num menu "…" na linha.
 */
const linhaDaTabela = (pedido, agora) => {
  const aprovadoEm = pedido.estado === 'aprovado' ? quandoFoi(pedido, 'aprovado') : null;
  const resposta = pedido.resposta
    ? `<span class="fl-tabela-resposta" title="${esc(pedido.resposta.previa ?? '')}">${esc(pedido.resposta.previa || '(sem prévia)')}</span><small>${esc(pedido.resposta.de ?? 'o cliente')} · ${hora(pedido.resposta.em)}</small>`
    : `<span class="fl-tabela-resposta">sem resposta pelo e-mail</span>`;
  const aprovado = aprovadoEm ? `<small>aprovado por você às ${hora(aprovadoEm)}</small>` : '';
  return `
    <tr class="fl-tabela-linha${pedeAtencao(pedido, agora) ? ' fl-atencao' : ''}" data-id="${esc(pedido.id)}" data-grupo="${esc(pedido.grupo)}" data-estado="${esc(pedido.estado)}">
      <td class="fl-tabela-quem"><span class="fl-conta">${esc(pedido.conta)}</span><span class="fl-cliente${pedido.cliente?.nome ? '' : ' fl-sem'}">${esc(pedido.cliente?.nome ?? 'cliente não identificado')}</span><small>${esc(NOMES_DOS_GRUPOS[pedido.grupo] ?? pedido.grupo)}</small></td>
      <td><ul class="fl-ordens">${pedido.ordens.map((o) => resumoDaOrdem(o, pedido)).join('')}</ul></td>
      <td class="fl-tabela-dito">${resposta}${aprovado}</td>
      <td>${htmlPrazo(pedido, agora)}</td>
      <td class="fl-tabela-acoes">
        ${pedido.estado === 'respondeu' ? botao('estado', 'Aprovou', { estado: 'aprovado', titulo: 'Li a resposta: o cliente aprovou (a hora fica na ficha)' }) : ''}
        ${pedido.grupo === 'bolsa' ? botao('lote', 'Gerar lote', { titulo: 'O Lote Simples e o Lote TWAP deste pedido, com as quantidades do e-mail aprovado' }) : botao('ficha', 'Ficha')}
        ${boletasDe(pedido)}
        ${botao('estado', 'Executado', { estado: 'executado', tipo: 'primario', titulo: 'Executei no Hub: vai para os Executados' })}
        <details class="fl-menu">
          <summary class="fl-menu-botao" title="Mais ações" aria-label="Mais ações">…</summary>
          <div class="fl-menu-itens">
            <button type="button" data-acao="email">Ver o e-mail</button>
            <button type="button" data-acao="anotar">Anotar</button>
            <button type="button" data-acao="estado" data-estado="enviado">Não aprovou</button>
            <button type="button" class="fl-cancelar" data-acao="estado" data-estado="cancelado">Cancelar o pedido</button>
          </div>
        </details>
      </td>
    </tr>`;
};

const htmlTabela = (pedidos, agora) => `
  <div class="fl-tabela-rolagem">
    <table class="fl-tabela">
      <thead><tr><th>Conta</th><th>Ordens</th><th>Resposta</th><th>Prazo</th><th><span class="fl-oculto">Ações</span></th></tr></thead>
      <tbody>${pedidos.map((p) => linhaDaTabela(p, agora)).join('')}</tbody>
    </table>
  </div>`;

/**
 * O conteúdo da pasta aberta. Em Aprovação e execução, em cartões ou em tabela (`vista`, a chave
 * Cartões / Tabela, lembrada no navegador).
 */
export const htmlLista = (pedidos, pasta, agora = Date.now(), { vista = 'cartoes' } = {}) => {
  const definicao = PASTAS.find((p) => p.id === pasta) ?? PASTAS[0];
  const daPasta = pedidos.filter((p) => definicao.estados.includes(p.estado));
  if (!daPasta.length) return `<p class="fl-vazio">${definicao.vazio}</p>`;
  if (definicao.id === 'executar') {
    // Os que pedem atenção primeiro (o prazo perto), depois por ordem de chegada da resposta.
    const ordenados = [...daPasta].sort((a, b) => Number(pedeAtencao(b, agora)) - Number(pedeAtencao(a, agora)) || (a.resposta?.em ?? a.atualizadoEm) - (b.resposta?.em ?? b.atualizadoEm));
    if (vista === 'tabela') return htmlTabela(ordenados, agora);
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
  const boletas = boletasDe(pedido, { classe: 'copy-btn' });
  return `
    <pre class="fl-ficha-texto">${esc(fichaDeExecucao(pedido, agora))}</pre>
    <div class="fl-ficha-acoes">
      <button type="button" class="copy-btn btn-primario" data-acao="copiar-ficha">Copiar a ficha</button>
      ${boletas}
    </div>
    <p class="fl-nota">Confira na boleta antes de enviar.</p>`;
};

/* ── O lote de um pedido de bolsa ─────────────────────────────────────────────────────── */

// O TSV numa tabela, para conferir de olho antes de copiar (o que vai para a área de transferência é
// o TSV, como o Ordens o gera).
const htmlTabelaDoTsv = (tsv) => {
  const [cabeca, ...linhas] = tsv.trimEnd().split('\n').map((l) => l.split('\t'));
  return `<div class="fl-tsv"><table><thead><tr>${cabeca.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${linhas
    .map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
};

/**
 * "Gerar lote" (21/10/2026: "o botão gera a ordem lote TWAP ou lote, para executarmos"): o Lote Simples
 * e o Lote TWAP do pedido, com as quantidades do e-mail aprovado (`ordensDoLote`), cada um com o seu
 * Copiar; o que não cabe no lote, e a ficha do pedido embaixo.
 *
 * @param {object} pedido
 * @param {{simples: string|null, twap: string|null, fora: string[], semSimples: string[]}} lotes
 */
export const htmlLote = (pedido, { simples, twap, fora, semSimples, misto = false }, agora = Date.now()) => {
  const semHorario = !pedido.horario?.inicial && !pedido.horario?.final;
  const secao = (titulo, formato, tsv, nota) => `
    <section class="fl-lote" data-formato="${formato}">
      <header class="fl-lote-topo">
        <h3>${titulo}</h3>
        ${tsv ? `<button type="button" class="copy-btn btn-primario" data-acao="copiar-lote" data-formato="${formato}">Copiar ${titulo}</button>` : ''}
      </header>
      ${tsv ? htmlTabelaDoTsv(tsv) : ''}
      ${nota ? `<p class="fl-nota">${nota}</p>` : ''}
    </section>`;
  const emReais = `${esc(semSimples.join(', '))} ${semSimples.length > 1 ? 'estão' : 'está'} em R$`;
  // Misturado (22/10/2026): as em R$ vão no TWAP, o resto no Simples; cada lote diz o que leva.
  const notaDoSimples = simples ? (misto ? `${emReais}: vai no Lote TWAP.` : '') : semSimples.length ? `O Lote Simples não tem coluna de financeiro: ${emReais}. Use o Lote TWAP.` : 'Nenhuma ordem para o lote.';
  const notaDoTwap = [misto ? 'Só o que está em R$; o resto vai no Lote Simples.' : '', twap && semHorario ? 'O pedido não disse o horário: as colunas de hora saem vazias.' : ''].filter(Boolean).join(' ');
  return `
    ${secao('Lote Simples', 'simples', simples, notaDoSimples)}
    ${secao('Lote TWAP', 'twap', twap, notaDoTwap)}
    ${fora.length ? `<p class="fl-nota">Fora do lote (não são ticker): ${esc(fora.join(', '))}.</p>` : ''}
    <details class="fl-lote-ficha"><summary>A ficha do pedido</summary><pre class="fl-ficha-texto">${esc(fichaDeExecucao(pedido, agora))}</pre></details>
    <p class="fl-nota">Quantidades do e-mail aprovado.</p>`;
};
