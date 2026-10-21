import { contarMarcas } from '../core/texto/marcarTexto.js';
import { esc } from '../core/util/html.js';

/**
 * O painel "O que foi lido do texto", embaixo da caixa da solicitação: cada linha colada com o que
 * aconteceu com ela (core/texto/marcarTexto.js). Fechado por padrão; o resumo diz se há o que olhar.
 *
 * @param {ReturnType<import('../core/texto/marcarTexto.js').marcarTexto>} marcas
 * @returns {{resumo: string, html: string, temProblema: boolean}}
 */
export const renderTextoLido = (marcas) => {
  const { lidas, descartadas, ignoradas } = contarMarcas(marcas);
  const partes = [
    `${lidas} ${lidas === 1 ? 'linha lida' : 'linhas lidas'}`,
    descartadas && `${descartadas} ${descartadas === 1 ? 'descartada' : 'descartadas'}, para fazer na mão`,
    ignoradas && `${ignoradas} ${ignoradas === 1 ? 'ignorada' : 'ignoradas'}`
  ].filter(Boolean);
  const html = marcas
    .map((m) => {
      const notas = [m.motivo, m.carimbo && m.situacao !== 'vazia' ? 'carimbo do WhatsApp tirado' : null].filter(Boolean);
      return `<li class="texto-lido-linha" data-situacao="${m.situacao}"><span class="texto-lido-texto">${esc(m.original) || '&nbsp;'}</span>${notas.length ? `<span class="texto-lido-motivo">${esc(notas.join(' · '))}</span>` : ''}</li>`;
    })
    .join('');
  return { resumo: `O que foi lido do texto: ${partes.join(' · ')}`, html, temProblema: descartadas > 0 };
};
