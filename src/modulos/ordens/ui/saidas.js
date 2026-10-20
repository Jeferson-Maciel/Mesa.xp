import {
  formatarAuditoria,
  formatarAuditoriaHtml,
  formatarEmail,
  formatarEmailVenda,
  formatarEmailVendaHtml,
  formatarLoteSimples,
  formatarLoteTwap
} from '../core/format/formatadores.js';
import { ROTULOS_DOS_GRUPOS, gruposDe, indiceNaSolicitacao, recorte } from '../core/format/grupos.js';
import { esc } from '../core/util/html.js';
import { validar } from '../core/validate/validar.js';
import { renderSecundario } from './secundario.js';

export { esc };

/**
 * Renderiza, para uma solicitação, os diagnósticos e as saídas de cada formato escolhido.
 *
 * A comporta está aqui: enquanto houver bloqueio não confirmado, o lugar da saída é ocupado
 * pelo bloqueio. O operador não copia por engano algo que o sistema não tem certeza de estar
 * certo — ele vê primeiro o que precisa olhar, e confirma se for o caso.
 */

// A auditoria aparece na tela como "E-mail em tabela", que é como o operador a chama. No código ela
// segue `auditoria`: é o mesmo formato, e "auditar" no pedido continua marcando ela.
export const ROTULOS = {
  email: 'Ordem por e-mail',
  auditoria: 'E-mail em tabela',
  lote: 'Lote Simples',
  twap: 'Lote TWAP'
};

const GERADORES = {
  email: formatarEmail,
  auditoria: formatarAuditoria,
  lote: formatarLoteSimples,
  twap: formatarLoteTwap
};

/**
 * Formatos que também saem em HTML. A auditoria só chega ao Outlook como tabela se for colada
 * como HTML; o texto com TAB vai junto, para onde HTML não entra.
 */
const GERADORES_HTML = {
  auditoria: formatarAuditoriaHtml
};

/**
 * A saída de um formato para uma parte da solicitação (o grupo). A venda de fundo tem o modelo dela,
 * a auditoria de venda; o HTML dela leva o print de cada cotação, quando há (`prints`).
 */
const saidaDe = (parte, formato, { prints } = {}) => {
  if (formato === 'email' && parte.grupo === 'fundos-venda') {
    return { texto: formatarEmailVenda(parte), html: prints?.size ? formatarEmailVendaHtml(parte, { prints }) : null };
  }
  return {
    texto: GERADORES[formato](parte),
    html: GERADORES_HTML[formato]?.(parte) ?? null
  };
};

/**
 * O grupo a que uma saída se refere. O e-mail sai um por grupo; a tabela, o lote e o TWAP, só de
 * bolsa. Sem grupo dito (chamadas antigas), vale o primeiro que a solicitação tem.
 */
const grupoDaSaida = (solicitacao, formato, grupo) =>
  formato === 'email' ? (grupo ?? gruposDe(solicitacao)[0] ?? 'bolsa') : 'bolsa';

/** A chave de uma confirmação: o código do bloqueio, no grupo em que foi confirmado. */
export const chaveDaConfirmacao = (grupo, codigo) => `${grupo}:${codigo}`;

/**
 * Bloqueios que ainda seguram a saída. Uma confirmação só conta para o que é confirmável: a
 * comporta não pode depender de o botão estar escondido.
 */
const confirmado = (d, confirmados, grupo) => confirmados.has(chaveDaConfirmacao(grupo, d.codigo)) || confirmados.has(d.codigo);

const pendentesDe = (diagnosticos, confirmados, grupo) =>
  diagnosticos.filter((d) => d.nivel === 'bloqueio' && !(d.confirmavel && confirmado(d, confirmados, grupo)));

/**
 * @returns {{texto: string, html: string|null}|null} a saída de um formato, ou null enquanto
 * ele estiver bloqueado.
 */
export const gerar = (solicitacao, formato, confirmados, { grupo = null, prints } = {}) => {
  const doGrupo = grupoDaSaida(solicitacao, formato, grupo);
  const parte = recorte(solicitacao, doGrupo, formato);
  if (parte.ordens.length === 0) return null;
  if (pendentesDe(validar(parte, formato), confirmados, doGrupo).length > 0) return null;

  try {
    return saidaDe(parte, formato, { prints });
  } catch {
    return null;
  }
};

const renderDiagnostico = (d, jaConfirmado, { grupo = 'bolsa', indiceOrdem = null } = {}) => {
  const classe = d.nivel === 'bloqueio' ? 'alert-danger' : 'alert-warning';
  const pendente = d.nivel === 'bloqueio' && !jaConfirmado;
  const confirmado = jaConfirmado;

  // O conserto de um clique vem antes do confirmar: é o caminho do caso comum. Ele usa o mesmo
  // `data-campo` dos controles do preview, e cai em `aplicarEdicao` como qualquer edição. O que é
  // de uma ordem só leva o índice dela na solicitação (`data-ordem`).
  const naOrdem = indiceOrdem === null || indiceOrdem === undefined || indiceOrdem < 0 ? '' : ` data-ordem="${indiceOrdem}"`;
  const consertos = pendente ? (d.acoes ?? (d.acao ? [d.acao] : [])) : [];
  const conserto = consertos
    .map((a) => `<button class="btn-confirmar" data-campo="${esc(a.campo)}" data-valor=""${naOrdem}>${esc(a.rotulo)}</button>`)
    .join('');
  const confirmar =
    pendente && d.confirmavel
      ? `<button class="btn-confirmar" data-confirmar="${esc(d.codigo)}" data-grupo="${esc(grupo)}">Confirmar e gerar</button>`
      : '';
  const botoes = conserto || confirmar ? `<span class="acoes-alerta">${conserto}${confirmar}</span>` : '';
  const marca = confirmado ? '<span class="confirmado">confirmado</span>' : '';

  return `<div class="alert ${classe}"><span>${esc(d.mensagem)}</span>${marca}${botoes}</div>`;
};

/**
 * Fundo pedido em R$ no secundário: o ROA muda as cotas do e-mail. A escolha é feita na hora de
 * copiar, com um botão por cenário, e vale para a solicitação inteira; o texto à vista é sempre o
 * do cenário escolhido, que é o último copiado. Sem teto, o máximo não tem conta e também conta
 * como diferente: o botão leva ao bloqueio que explica o que falta.
 */
const roaMudaOEmail = (solicitacao) =>
  (solicitacao.ordens ?? []).some((o) => {
    const cenarios = o.secundario?.cenarios;
    return cenarios && o.secundario.porValor && cenarios.maximo?.cotas !== cenarios.zerado.cotas;
  });

const botoesDeCopiar = (formato, solicitacao, grupo) => {
  if (formato !== 'email' || !roaMudaOEmail(solicitacao)) {
    return `<button class="copy-btn" data-copiar="${formato}" data-grupo="${grupo}">Copiar</button>`;
  }

  const zerado = solicitacao.semRoa === true;
  const botao = (roa, rotulo, escolhido) =>
    `<button class="copy-btn${escolhido ? ' escolhido' : ''}" data-copiar="${formato}" data-roa="${roa}" aria-pressed="${escolhido}" data-grupo="${grupo}">Copiar · ${rotulo}</button>`;

  return `<div class="copiar-roa" role="group" aria-label="Copiar com qual ROA adicional">${botao('maximo', 'ROA máximo', !zerado)}${botao('zerado', 'ROA zerado', zerado)}</div>`;
};

/**
 * Os dois e-mails abrem também no Outlook na web, com o assunto da confirmação e o texto no
 * endereço. O endereço só leva texto puro: a tabela vai em texto, com TAB entre as colunas, e não
 * em grade — em grade, só pelo Copiar. No fundo do secundário, vai o cenário à vista, o do último
 * ROA escolhido.
 */
const DICAS_DO_OUTLOOK = {
  email: 'Abre um e-mail novo no Outlook na web, com o assunto “Confirmação de ordem” e este texto',
  auditoria: 'Abre um e-mail novo no Outlook na web, com o assunto “Confirmação de ordem” e a tabela em texto. Para a tabela em grade, use o Copiar'
};

const botaoDoOutlook = (formato, grupo) =>
  DICAS_DO_OUTLOOK[formato]
    ? `<button class="copy-btn btn-outlook" data-outlook="${formato}" title="${DICAS_DO_OUTLOOK[formato]}" data-grupo="${grupo}">Abrir no Outlook</button>`
    : '';

// O título de cada saída diz o grupo quando o e-mail sai em mais de um.
const tituloDa = (formato, grupo, varios) =>
  formato === 'email' && varios
    ? `${ROTULOS[formato]} <span class="grupo-da-saida" data-grupo="${grupo}">${ROTULOS_DOS_GRUPOS[grupo]}</span>`
    : ROTULOS[formato];

// O HTML vem do formatador, que já escapou cada valor digitado. Mostrá-lo montado deixa o operador
// conferir a grade como ela vai chegar no e-mail.
const renderSaida = (formato, { texto, html }, solicitacao, grupo = 'bolsa', varios = false) => `
  <div class="saida" data-formato="${formato}" data-grupo="${grupo}">
    <div class="panel-header-row">
      <h3 class="panel-title">${tituloDa(formato, grupo, varios)}</h3>
      <div class="acoes-saida">${botoesDeCopiar(formato, solicitacao, grupo)}${botaoDoOutlook(formato, grupo)}</div>
    </div>
    ${
      html
        ? `<div class="output-box output-tabela">${html}</div>`
        : `<pre class="output-box">${esc(texto)}</pre>`
    }
  </div>`;

const renderBloqueado = (formato, pendentes, confirmados, { solicitacao, parte, grupo, varios }) => `
  <div class="saida bloqueada" data-formato="${formato}" data-grupo="${grupo}">
    <div class="panel-header-row">
      <h3 class="panel-title">${tituloDa(formato, grupo, varios)}</h3>
      <span class="meta-counter">bloqueado</span>
    </div>
    ${pendentes
      .map((d) => renderDiagnostico(d, confirmado(d, confirmados, grupo), { grupo, indiceOrdem: indiceNaSolicitacao(solicitacao, parte, d.indiceOrdem) }))
      .join('')}
  </div>`;

// Tabela, lote ou TWAP pedidos num pedido só de fundos: eles vão nos e-mails de fundos.
const renderSemBolsa = (formato) => `
  <div class="saida vazia" data-formato="${formato}">
    <div class="panel-header-row">
      <h3 class="panel-title">${ROTULOS[formato]}</h3>
      <span class="meta-counter">sem ordem de bolsa</span>
    </div>
    <p class="saida-nota">Os fundos cetipados vão nos e-mails de fundos: ${ROTULOS[formato]} é só de bolsa.</p>
  </div>`;

/**
 * @param {object} solicitacao
 * @param {string[]} formatos  os formatos marcados pelo operador
 * @param {Set<string>} confirmados  códigos de bloqueio já confirmados nesta solicitação
 * @returns {string} HTML da área de diagnósticos e saídas
 */
export const renderSaidas = (solicitacao, formatos, confirmados, { prints } = {}) => {
  // O bloco do secundário vem antes das saídas e não depende do formato: é a conta que o e-mail
  // vai usar, e mora aqui porque esta área é refeita a cada tecla no cartão.
  const secundario = renderSecundario(solicitacao);

  if (formatos.length === 0) {
    return secundario + '<div class="empty-state pequeno"><p>Escolha um formato de saída acima.</p></div>';
  }

  // Os avisos não dependem do formato escolhido, então são mostrados uma vez só. Os de e-mail cobrem
  // o secundário e a venda, que só o e-mail usa.
  const avisos = validar(solicitacao, formatos.includes('email') ? 'email' : formatos[0]).filter((d) => d.nivel === 'aviso');

  // O e-mail sai um por grupo (bolsa, fundos comprados, fundos vendidos); o resto, só de bolsa.
  const grupos = gruposDe(solicitacao);
  const varios = grupos.length > 1;
  const saidas = formatos.flatMap((formato) => (formato === 'email' ? grupos.map((g) => [formato, g]) : [[formato, 'bolsa']]));

  const blocos = saidas.map(([formato, grupo]) => {
    const parte = recorte(solicitacao, grupo, formato);
    if (parte.ordens.length === 0) return formato === 'email' ? '' : renderSemBolsa(formato);

    const pendentes = pendentesDe(validar(parte, formato), confirmados, grupo);
    if (pendentes.length > 0) return renderBloqueado(formato, pendentes, confirmados, { solicitacao, parte, grupo, varios });

    return renderSaida(formato, saidaDe(parte, formato, { prints }), parte, grupo, varios);
  });

  return (
    secundario +
    avisos.map((d) => renderDiagnostico(d, false, { indiceOrdem: d.indiceOrdem })).join('') +
    blocos.join('')
  );
};
