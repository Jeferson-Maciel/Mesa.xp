import { esc } from '../../../ui/html.js';

/**
 * Um item da gaveta do histórico do Ordens. Desde a Fase 3 (21/10/2026), com o selo de cada cartão que
 * o e-mail criou na Fila — esperando o cliente, respondeu, aprovado, executado, cancelado —, que leva
 * ao cartão; e o Reabrir diz quando volta com as correções do cartão (`correcoes.js`).
 */

const NA_FILA = { enviado: 'Esperando o cliente', respondeu: 'O cliente respondeu', aprovado: 'Aprovado', executado: 'Executado', cancelado: 'Cancelado' };

/**
 * @param {object} e  a entrada do histórico (`platform/historico.js`)
 * @param {Map<string, object>} pedidosPorId  os cartões da Fila deste navegador
 */
export const htmlItemDoHistorico = (e, pedidosPorId) => {
  const quando = new Date(e.quando);
  const cartoes = (e.pedidos ?? []).map((id) => pedidosPorId.get(id)).filter(Boolean);
  const variasContas = new Set(cartoes.map((p) => p.conta)).size > 1;
  const selos = cartoes
    .map(
      (p) =>
        `<button type="button" class="history-fila" data-fila="${esc(p.id)}" data-estado="${esc(p.estado)}" title="Ver o cartão na Fila do dia">${variasContas ? `${esc(p.conta)} · ` : ''}${esc(NA_FILA[p.estado] ?? p.estado)}</button>`
    )
    .join('');
  const comCorrecoes = Boolean(e.correcoes?.solicitacoes?.length);
  return `
    <div class="history-item" data-id="${esc(e.id)}">
      <div class="history-item-header">
        <span class="badge">${esc(e.formato)}</span>
        <span class="history-time">${quando.toLocaleDateString('pt-BR')} ${quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="history-item-body">
        <div class="history-client-row"><span class="history-client">Conta ${esc(e.conta)}</span></div>
        <div class="history-tickers">${esc((e.ativos ?? []).join(', '))}</div>
        ${selos ? `<div class="history-selos">${selos}</div>` : ''}
      </div>
      <div class="history-actions">
        <button class="btn-history-load" data-reabrir="${esc(e.id)}"${comCorrecoes ? ' title="Volta com o que você corrigiu no cartão: valores, linhas removidas, confirmações"' : ''}>${comCorrecoes ? 'Reabrir com as correções' : 'Reabrir'}</button>
        <button class="btn-history-delete" data-remover="${esc(e.id)}">&times;</button>
      </div>
    </div>`;
};
