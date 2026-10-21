/**
 * A chave local do dia, `AAAA-MM-DD`, de uma data ou de um momento (ms). Nunca `toISOString()`: às
 * 21h de Brasília ele já dá o dia seguinte. Uma só para a Mesa inteira — a Fila, os dias úteis, os
 * Fundos, o Renda Fixa e as Anotações.
 *
 * @param {Date|number} momento
 * @returns {string}
 */
export const chaveDoDia = (momento) => {
  const d = momento instanceof Date ? momento : new Date(momento);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
