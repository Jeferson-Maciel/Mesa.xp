import { chaveDoDia } from './dia.js';

/**
 * Dias úteis da B3: sem sábado, domingo, feriado nacional e os dois dias sem pregão do fim do ano
 * (24/12 e 31/12).
 *
 * A cotação de venda de fundo e o print dela valem **um dia útil** a partir da hora em que foram
 * tirados (decidido com o operador em 20/10/2026): o print sai da boleta na hora, e o cliente tem
 * até o mesmo horário do dia útil seguinte para aprovar.
 *
 * Os feriados móveis saem da Páscoa, calculada (algoritmo de Meeus/Jones/Butcher): Carnaval (segunda
 * e terça, 48 e 47 dias antes), Sexta-feira Santa (2 antes) e Corpus Christi (60 depois). Assim a
 * regra vale para qualquer ano, sem lista para atualizar. Consciência Negra (20/11) é nacional desde
 * 2024. Feriado municipal ou estadual não fecha a B3 para este fim e fica de fora.
 *
 * Tudo pela data local (`AAAA-MM-DD`), nunca por `toISOString()`.
 */

const FIXOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-24', '12-25', '12-31'];

const chave = chaveDoDia;

/** @returns {Date} o domingo de Páscoa do ano, à meia-noite local */
export const pascoa = (ano) => {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
};

const feriadosDoAno = new Map();
const feriados = (ano) => {
  if (!feriadosDoAno.has(ano)) {
    const p = pascoa(ano);
    const mais = (dias) => chave(new Date(p.getFullYear(), p.getMonth(), p.getDate() + dias));
    feriadosDoAno.set(ano, new Set([...FIXOS.map((md) => `${ano}-${md}`), mais(-48), mais(-47), mais(-2), mais(60)]));
  }
  return feriadosDoAno.get(ano);
};

/** @returns {boolean} se a B3 abre neste dia */
export const ehDiaUtil = (data) => {
  const semana = data.getDay();
  return semana !== 0 && semana !== 6 && !feriados(data.getFullYear()).has(chave(data));
};

/**
 * O mesmo horário no próximo dia útil: até quando vale uma cotação tirada em `momento`.
 *
 * @param {Date|number} momento
 * @returns {Date}
 */
export const umDiaUtilDepois = (momento) => {
  const inicio = new Date(momento);
  const dia = new Date(inicio);
  do {
    dia.setDate(dia.getDate() + 1);
  } while (!ehDiaUtil(dia));
  return dia;
};
