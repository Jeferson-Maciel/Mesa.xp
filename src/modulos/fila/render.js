/**
 * O HTML da Fila do dia: funções puras, sem DOM, testadas em `render.test.js`.
 *
 * Tudo que vem do pedido (nome do cliente, ativo, a resposta dele) passa por `esc`. As regras ficam em
 * `src/comum/fila/regras.js`; aqui só a apresentação.
 */

import { esc } from '../../ui/html.js';
import { COLUNAS, NOMES_DOS_GRUPOS, diaDe, fichaDeExecucao, linkDaBoleta, pedeAtencao, prazoMaisUrgente, situacaoDoPrazo } from '../../comum/fila/regras.js';
import { quantoFalta } from '../../comum/horarios.js';

const hora = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const diaEHora = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');

const OPERACAO = { C: 'compra', V: 'venda' };

// O resumo de uma ordem no cartão: o ativo e o quanto, curto.
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

const BOTOES = {
  enviado: [['aprovado', 'Aprovou', 'primario']],
  respondeu: [['aprovado', 'Aprovou', 'primario'], ['enviado', 'Não aprovou ainda', '']],
  aprovado: [['ficha', 'Ficha de execução', ''], ['executado', 'Executei', 'primario']],
  executado: [['aprovado', 'Desfazer', '']]
};

/** Um cartão da Fila. */
export const htmlCartao = (pedido, agora = Date.now()) => {
  const cliente = pedido.cliente?.nome ? `<span class="fl-cliente" title="${esc(pedido.cliente.email ?? '')}">${esc(pedido.cliente.nome)}</span>` : '<span class="fl-cliente fl-sem">cliente não identificado</span>';
  const resposta = pedido.resposta
    ? `<blockquote class="fl-resposta"><span>${esc(pedido.resposta.previa || '(sem prévia)')}</span><cite>${esc(pedido.resposta.de ?? '')} · ${hora(pedido.resposta.em)}</cite></blockquote>`
    : '';
  const boletas = pedido.estado === 'aprovado'
    ? pedido.ordens
        .map((o) => [o, linkDaBoleta(o, pedido.conta, pedido.grupo)])
        .filter(([, link]) => link)
        .map(([o, link]) => `<a class="fl-boleta" href="${esc(link)}" target="_blank" rel="noopener" title="Abrir a boleta de ${esc(o.ativo)} no Hub">Boleta ${esc(o.ativo.split(' ')[0])}</a>`)
        .join('')
    : '';
  const botoes = (BOTOES[pedido.estado] ?? [])
    .map(([acao, rotulo, tipo]) => `<button type="button" class="fl-botao${tipo ? ` fl-${tipo}` : ''}" data-acao="${acao === 'ficha' ? 'ficha' : 'estado'}" data-estado="${acao}">${rotulo}</button>`)
    .join('');
  return `
  <article class="fl-cartao${pedeAtencao(pedido, agora) ? ' fl-atencao' : ''}" data-id="${esc(pedido.id)}" data-grupo="${esc(pedido.grupo)}" data-estado="${esc(pedido.estado)}" draggable="true">
    <header class="fl-cartao-topo">
      <span class="fl-conta">${esc(pedido.conta)}</span>
      ${cliente}
      ${pedido.dia !== diaDe(agora) ? `<span class="fl-outro-dia" title="E-mail enviado em ${diaEHora(pedido.criadoEm)}">de ${diaEHora(pedido.criadoEm).split(' ')[0]}</span>` : ''}
      <span class="fl-hora" title="E-mail enviado às ${hora(pedido.criadoEm)}">${hora(pedido.criadoEm)}</span>
    </header>
    <span class="fl-grupo">${esc(NOMES_DOS_GRUPOS[pedido.grupo] ?? pedido.grupo)}</span>
    <ul class="fl-ordens">${pedido.ordens.map((o) => resumoDaOrdem(o, pedido.grupo)).join('')}</ul>
    ${htmlPrazo(pedido, agora)}
    ${resposta}
    <footer class="fl-cartao-acoes">
      ${botoes}
      ${boletas}
      <span class="fl-mais">
        <button type="button" class="fl-icone" data-acao="email" title="Ver o e-mail que saiu" aria-label="Ver o e-mail que saiu">✉</button>
        <button type="button" class="fl-icone" data-acao="anotar" title="Criar uma anotação deste pedido" aria-label="Criar uma anotação deste pedido">✎</button>
        ${pedido.estado !== 'executado' ? '<button type="button" class="fl-icone fl-cancelar" data-acao="estado" data-estado="cancelado" title="Cancelar o pedido" aria-label="Cancelar o pedido">×</button>' : ''}
      </span>
    </footer>
  </article>`;
};

const VAZIOS = {
  enviado: 'Os e-mails copiados ou abertos no Outlook entram aqui.',
  respondeu: 'Com o Outlook aberto, o robô traz aqui as respostas dos clientes.',
  aprovado: 'O que o cliente aprovou e falta executar.',
  executado: 'O que já foi feito hoje.'
};

/** As quatro colunas do quadro. */
export const htmlQuadro = (pedidos, agora = Date.now()) =>
  COLUNAS.map(({ estado, titulo }) => {
    const daColuna = pedidos.filter((p) => p.estado === estado);
    return `
    <section class="fl-coluna" data-estado="${estado}" aria-label="${titulo}">
      <header class="fl-coluna-topo"><span>${titulo}</span><b>${daColuna.length}</b></header>
      <div class="fl-cartoes" data-soltar="${estado}">
        ${daColuna.length ? daColuna.map((p) => htmlCartao(p, agora)).join('') : `<p class="fl-vazio">${VAZIOS[estado]}</p>`}
      </div>
    </section>`;
  }).join('');

export const htmlCancelados = (pedidos, agora = Date.now()) => {
  const cancelados = pedidos.filter((p) => p.estado === 'cancelado');
  if (!cancelados.length) return '';
  return `
  <details class="fl-cancelados">
    <summary>${cancelados.length} ${cancelados.length === 1 ? 'cancelado' : 'cancelados'}</summary>
    <div class="fl-cartoes">${cancelados.map((p) => htmlCartao(p, agora).replace('</footer>', '<button type="button" class="fl-botao" data-acao="estado" data-estado="enviado">Reabrir</button></footer>')).join('')}</div>
  </details>`;
};

/** Os números do dia, no alto. */
export const htmlNumeros = (pedidos, agora = Date.now()) => {
  const conta = (estado) => pedidos.filter((p) => p.estado === estado).length;
  const atencao = pedidos.filter((p) => pedeAtencao(p, agora)).length;
  const itens = [
    ['enviado', 'aguardando', conta('enviado')],
    ['respondeu', 'responderam', conta('respondeu')],
    ['aprovado', 'a executar', conta('aprovado')],
    ['executado', 'executados', conta('executado')]
  ];
  return `${itens.map(([estado, rotulo, n]) => `<span class="fl-numero" data-estado="${estado}"><b>${n}</b> ${rotulo}</span>`).join('')}${atencao ? `<span class="fl-numero fl-numero-atencao"><b>${atencao}</b> pedem atenção</span>` : ''}`;
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
