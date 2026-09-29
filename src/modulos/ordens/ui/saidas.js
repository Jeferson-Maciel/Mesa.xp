import {
  formatarAuditoria,
  formatarAuditoriaHtml,
  formatarEmail,
  formatarLoteSimples,
  formatarLoteTwap
} from '../core/format/formatadores.js';
import { esc } from '../core/util/html.js';
import { validar } from '../core/validate/validar.js';

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

const saidaDe = (solicitacao, formato) => ({
  texto: GERADORES[formato](solicitacao),
  html: GERADORES_HTML[formato]?.(solicitacao) ?? null
});

/**
 * Bloqueios que ainda seguram a saída. Uma confirmação só conta para o que é confirmável: a
 * comporta não pode depender de o botão estar escondido.
 */
const pendentesDe = (diagnosticos, confirmados) =>
  diagnosticos.filter(
    (d) => d.nivel === 'bloqueio' && !(d.confirmavel && confirmados.has(d.codigo))
  );

/**
 * @returns {{texto: string, html: string|null}|null} a saída de um formato, ou null enquanto
 * ele estiver bloqueado.
 */
export const gerar = (solicitacao, formato, confirmados) => {
  if (pendentesDe(validar(solicitacao, formato), confirmados).length > 0) return null;

  try {
    return saidaDe(solicitacao, formato);
  } catch {
    return null;
  }
};

const renderDiagnostico = (d, confirmado) => {
  const classe = d.nivel === 'bloqueio' ? 'alert-danger' : 'alert-warning';
  const pendente = d.nivel === 'bloqueio' && !confirmado;

  // O conserto de um clique vem antes do confirmar: é o caminho do caso comum. Ele usa o mesmo
  // `data-campo` dos controles do preview, e cai em `aplicarEdicao` como qualquer edição.
  const conserto =
    pendente && d.acao
      ? `<button class="btn-confirmar" data-campo="${esc(d.acao.campo)}" data-valor="">${esc(d.acao.rotulo)}</button>`
      : '';
  const confirmar =
    pendente && d.confirmavel
      ? `<button class="btn-confirmar" data-confirmar="${esc(d.codigo)}">Confirmar e gerar</button>`
      : '';
  const botoes = conserto || confirmar ? `<span class="acoes-alerta">${conserto}${confirmar}</span>` : '';
  const marca = confirmado ? '<span class="confirmado">confirmado</span>' : '';

  return `<div class="alert ${classe}"><span>${esc(d.mensagem)}</span>${marca}${botoes}</div>`;
};

// O HTML vem do formatador, que já escapou cada valor digitado. Mostrá-lo montado deixa o operador
// conferir a grade como ela vai chegar no e-mail.
const renderSaida = (formato, { texto, html }) => `
  <div class="saida" data-formato="${formato}">
    <div class="panel-header-row">
      <h3 class="panel-title">${ROTULOS[formato]}</h3>
      <button class="copy-btn" data-copiar="${formato}">Copiar</button>
    </div>
    ${
      html
        ? `<div class="output-box output-tabela">${html}</div>`
        : `<pre class="output-box">${esc(texto)}</pre>`
    }
  </div>`;

const renderBloqueado = (formato, pendentes, confirmados) => `
  <div class="saida bloqueada" data-formato="${formato}">
    <div class="panel-header-row">
      <h3 class="panel-title">${ROTULOS[formato]}</h3>
      <span class="meta-counter">bloqueado</span>
    </div>
    ${pendentes.map((d) => renderDiagnostico(d, confirmados.has(d.codigo))).join('')}
  </div>`;

/**
 * @param {object} solicitacao
 * @param {string[]} formatos  os formatos marcados pelo operador
 * @param {Set<string>} confirmados  códigos de bloqueio já confirmados nesta solicitação
 * @returns {string} HTML da área de diagnósticos e saídas
 */
export const renderSaidas = (solicitacao, formatos, confirmados) => {
  if (formatos.length === 0) {
    return '<div class="empty-state pequeno"><p>Escolha um formato de saída acima.</p></div>';
  }

  // Os avisos não dependem do formato escolhido, então são mostrados uma vez só.
  const avisos = validar(solicitacao, formatos[0]).filter((d) => d.nivel === 'aviso');

  const blocos = formatos.map((formato) => {
    const pendentes = pendentesDe(validar(solicitacao, formato), confirmados);

    if (pendentes.length > 0) return renderBloqueado(formato, pendentes, confirmados);

    return renderSaida(formato, saidaDe(solicitacao, formato));
  });

  return avisos.map((d) => renderDiagnostico(d, false)).join('') + blocos.join('');
};
