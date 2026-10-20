import {
  formatarAuditoria,
  formatarAuditoriaHtml,
  formatarEmail,
  formatarEmailVenda,
  formatarEmailVendaHtml,
  formatarLoteSimples,
  formatarLoteTwap
} from '../core/format/formatadores.js';
import { ROTULOS_DOS_GRUPOS, grupoDaOrdem, gruposDe, indiceNaSolicitacao, recorte } from '../core/format/grupos.js';
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

// O título de cada saída: o grupo fica no cabeçalho da seção dele.
const tituloDa = (formato) => ROTULOS[formato];

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
  // Sem formato escolhido, ou sem ordem nenhuma, a área é a de sempre: o secundário e o que falta.
  if (formatos.length === 0) {
    return renderSecundario(solicitacao) + '<div class="empty-state pequeno"><p>Escolha um formato de saída acima.</p></div>';
  }
  if ((solicitacao.ordens ?? []).length === 0) {
    return formatos
      .map((formato) => {
        const pendentes = pendentesDe(validar(solicitacao, formato), confirmados, 'bolsa');
        return renderBloqueado(formato, pendentes, confirmados, { solicitacao, parte: solicitacao, grupo: 'bolsa', varios: false });
      })
      .join('');
  }
  return renderPorGrupo(solicitacao, formatos, confirmados, { prints });
};

/**
 * Uma seção por grupo de e-mail (bolsa, fundos comprados, fundos vendidos), cada uma com o que é
 * dela: a conta do secundário ou a venda, os avisos das ordens dela e as saídas. O operador confere
 * e copia um grupo de cada vez, de cima para baixo, como o pedido do operador em 20/10/2026.
 */
const renderPorGrupo = (solicitacao, formatos, confirmados, { prints }) => {

  // Os avisos não dependem do formato escolhido. Os de uma ordem vão para a seção do grupo dela; os
  // da solicitação (linhas descartadas, fundos de outro dia), para o topo.
  const avisos = validar(solicitacao, formatos.includes('email') ? 'email' : formatos[0]).filter((d) => d.nivel === 'aviso');
  const avisoNaTela = (d) => renderDiagnostico(d, false, { indiceOrdem: d.indiceOrdem });
  const gerais = avisos.filter((d) => d.indiceOrdem === null || d.indiceOrdem === undefined);
  const doGrupo = (grupo) =>
    avisos.filter((d) => Number.isInteger(d.indiceOrdem) && solicitacao.ordens[d.indiceOrdem] && grupoDaOrdem(solicitacao.ordens[d.indiceOrdem]) === grupo);

  const grupos = gruposDe(solicitacao);
  const saidaDoGrupo = (formato, grupo) => {
    const parte = recorte(solicitacao, grupo, formato);
    if (parte.ordens.length === 0) return '';
    const pendentes = pendentesDe(validar(parte, formato), confirmados, grupo);
    if (pendentes.length > 0) return renderBloqueado(formato, pendentes, confirmados, { solicitacao, parte, grupo, varios: true });
    return renderSaida(formato, saidaDe(parte, formato, { prints }), parte, grupo, true);
  };

  const secao = (grupo) => {
    const ordens = recorte(solicitacao, grupo).ordens.length;
    const info =
      grupo === 'fundos-compra' ? renderSecundario(solicitacao, { so: 'compra' }) : grupo === 'fundos-venda' ? renderSecundario(solicitacao, { so: 'venda' }) : '';
    const doFormato = formatos.filter((f) => f === 'email' || grupo === 'bolsa');
    const saidas = doFormato.map((f) => saidaDoGrupo(f, grupo)).join('');
    const semEmail =
      grupo !== 'bolsa' && !formatos.includes('email')
        ? '<p class="saida-nota">Os fundos saem na Ordem por e-mail: marque-a nos formatos de saída.</p>'
        : '';
    return `
    <section class="grupo-saidas" data-grupo="${grupo}">
      <header class="grupo-cabeca">
        <span class="grupo-nome">${ROTULOS_DOS_GRUPOS[grupo]}</span>
        <span class="grupo-conta">${ordens} ${ordens === 1 ? 'ordem' : 'ordens'}</span>
      </header>
      ${info}${doGrupo(grupo).map(avisoNaTela).join('')}${saidas}${semEmail}
    </section>`;
  };

  // Tabela, lote ou TWAP num pedido sem bolsa: dizem por que não saem.
  const semBolsa = grupos.includes('bolsa') ? '' : formatos.filter((f) => f !== 'email').map(renderSemBolsa).join('');

  return gerais.map(avisoNaTela).join('') + grupos.map(secao).join('') + semBolsa;
};
