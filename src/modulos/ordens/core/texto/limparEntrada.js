/**
 * Primeira etapa do pipeline: reduz o texto colado às linhas que podem virar ordem.
 *
 * A entrada real vem colada crua do grupo de WhatsApp onde as ordens são enviadas, com carimbo
 * de hora, nome ou telefone do remetente, e as respostas de confirmação da mesa no meio.
 *
 * O carimbo é o descarte mais importante de todos: `[13:46, 21/09/2026]` contém um horário, e um
 * horário lido daí viraria `Hora Inicial` de uma ordem TWAP — um dado inventado dentro de uma
 * ordem real. Ele morre aqui, antes que qualquer parser o veja.
 *
 * Nada é descartado em silêncio: o que sai vai para `ignoradas`, com o motivo, para aparecer no
 * preview.
 */

/** `[13:46, 21/09/2026] Paulo Mendes:` ou `[14:03, 21/09/2026] +55 11 5555-0101:` */
const CARIMBO_WHATSAPP = /^\[\d{1,2}:\d{2}(?::\d{2})?,?\s*[^\]]*\]\s*[^:]{0,60}?:\s*/;

const RUIDO = [
  { padrao: /^(?:e-?mail|push|ordem|ordens)?\s*envia[dr]o[s]?(?:\s+(?:mesa|para\s+a\s+mesa|hub))?\.?$/i, motivo: 'confirmação da mesa' },
  { padrao: /^envia[dr]o[s]?\s+mesa\.?$/i, motivo: 'confirmação da mesa' },
  // Menção começa com @ e o nome vem solto depois ('@Paulo Mendes @~Rafael Berwaldt').
  // Linha de ordem nunca abre com @, então a âncora inicial basta.
  { padrao: /^@[^\d]*$/, motivo: 'menção a participante do grupo' },
  { padrao: /^\+?\d{2}\s?\d{2}\s?\d{4,5}-?\d{4}$/, motivo: 'número de telefone' }
];

/**
 * Negrito (`*`) e itálico (`_`) do WhatsApp. O tachado (`~`) fica: riscar costuma ser cancelar, e
 * tirá-lo transformaria um cancelamento numa ordem.
 */
const FORMATACAO = /[*_]+/g;

/**
 * Numeração e marcador de lista: `1. `, `2) `, `• `, `- `. O ponto exige espaço depois, senão o
 * `1.000` de `1.000 PETR4` perderia o milhar; número seguido de traço (`10 - PETR4`) é quantidade
 * e não é tocado.
 */
const MARCADOR_DE_LISTA = /^(?:\d{1,2}(?:\.\s+|\)\s*)|[•·▪◦‣●○■□►▶➤→\-–—]\s+)/;

/**
 * @param {string|null|undefined} texto
 * @returns {{linhas: string[], ignoradas: Array<{linha: string, motivo: string}>}}
 */
export const limparEntrada = (texto) => {
  if (typeof texto !== 'string') return { linhas: [], ignoradas: [] };

  const linhas = [];
  const ignoradas = [];

  for (const original of texto.split(/\r?\n/)) {
    const semCarimbo = original
      .replace(CARIMBO_WHATSAPP, '')
      .replace(FORMATACAO, '')
      .trim()
      .replace(MARCADOR_DE_LISTA, '')
      .trim();
    if (!semCarimbo) continue;

    const ruido = RUIDO.find(({ padrao }) => padrao.test(semCarimbo));
    if (ruido) {
      ignoradas.push({ linha: semCarimbo, motivo: ruido.motivo });
      continue;
    }

    linhas.push(semCarimbo);
  }

  return { linhas, ignoradas };
};
