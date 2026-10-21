import { limparLinha } from './limparEntrada.js';

/**
 * O texto colado, linha a linha, com o que aconteceu com cada uma: lida, descartada (com o motivo do
 * parser — ficou para fazer na mão) ou ignorada (o ruído do grupo: a confirmação da mesa, a menção,
 * o telefone). A linha em branco fica como está. O operador confere de uma olhada que nada do pedido
 * ficou de fora — "nada é descartado em silêncio".
 *
 * @param {string} texto  o texto colado, como veio
 * @param {Array<{descartadas?: Array<{linha: string, motivo: string}>}>} solicitacoes  o que o parser fez dele
 * @returns {Array<{original: string, situacao: 'lida'|'descartada'|'ignorada'|'vazia', motivo: string|null, carimbo: boolean}>}
 */
export const marcarTexto = (texto, solicitacoes = []) => {
  const descartes = new Map();
  for (const s of solicitacoes) for (const d of s.descartadas ?? []) if (!descartes.has(d.linha)) descartes.set(d.linha, d.motivo);

  return String(texto ?? '')
    .split(/\r?\n/)
    .map((original) => {
      const { linha, ruido, carimbo } = limparLinha(original);
      if (!linha) return { original, situacao: 'vazia', motivo: null, carimbo };
      if (ruido) return { original, situacao: 'ignorada', motivo: ruido, carimbo };
      if (descartes.has(linha)) return { original, situacao: 'descartada', motivo: descartes.get(linha), carimbo };
      return { original, situacao: 'lida', motivo: null, carimbo };
    });
};

/** Quantas de cada: o resumo do alto. */
export const contarMarcas = (marcas) => ({
  lidas: marcas.filter((m) => m.situacao === 'lida').length,
  descartadas: marcas.filter((m) => m.situacao === 'descartada').length,
  ignoradas: marcas.filter((m) => m.situacao === 'ignorada').length
});
