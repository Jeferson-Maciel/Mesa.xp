/**
 * Datas do Calendário.
 *
 * Um dia é sempre a chave `YYYY-MM-DD` no fuso LOCAL, gerada por `chaveDoDia`. Nunca
 * `toISOString()`: ele converte para UTC, e às 21h de Brasília já é o dia seguinte — o registro
 * de quarta cairia na quinta. Um teste varre o módulo atrás de `toISOString`.
 *
 * As contas de dia usam o calendário local (`new Date(ano, mes, dia + n)`), nunca milissegundos:
 * somar 24h atravessa mal uma virada de horário de verão, se o Brasil voltar a ter uma.
 */

export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const dois = (n) => String(n).padStart(2, '0');

/** @returns {string} `YYYY-MM-DD` no fuso local. */
export const chaveDoDia = (data) => `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;

/** @returns {Date} a meia-noite local do dia da chave. */
export const diaDaChave = (chave) => {
  const [ano, mes, dia] = chave.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
};

export const somarDias = (data, n) => new Date(data.getFullYear(), data.getMonth(), data.getDate() + n);

export const mesmoDia = (a, b) => chaveDoDia(a) === chaveDoDia(b);

/** @returns {Date} a segunda-feira (meia-noite local) da semana da data; domingo fecha a semana. */
export const segundaDaSemana = (data) => {
  const dia = data.getDay();
  return somarDias(data, dia === 0 ? -6 : 1 - dia);
};

/** @returns {Date[]} segunda a sexta. */
export const diasUteis = (segunda) => [0, 1, 2, 3, 4].map((n) => somarDias(segunda, n));

/** O que a visão Semana busca no banco: de segunda a domingo, como o app original. */
export const intervaloDaSemana = (segunda) => ({ inicio: chaveDoDia(segunda), fim: chaveDoDia(somarDias(segunda, 6)) });

/** O que o Histórico busca: o mês inteiro com sete dias de folga de cada lado. */
export const intervaloDoMes = (ano, mes) => ({
  inicio: chaveDoDia(new Date(ano, mes, 1 - 7)),
  fim: chaveDoDia(new Date(ano, mes + 1, 0 + 7))
});

/** @returns {Date[][]} os dias úteis do mês, agrupados por semana. */
export const semanasDoMes = (ano, mes) => {
  const semanas = new Map();
  for (let d = new Date(ano, mes, 1); d.getMonth() === mes; d = somarDias(d, 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const chave = chaveDoDia(segundaDaSemana(d));
    if (!semanas.has(chave)) semanas.set(chave, []);
    semanas.get(chave).push(d);
  }
  return [...semanas.values()];
};

const curto = (data) => `${data.getDate()} ${MESES[data.getMonth()].slice(0, 3)}`;

/** "28 Set — 2 Out 2026", da segunda à sexta. */
export const rotuloDaSemana = (segunda) => {
  const sexta = somarDias(segunda, 4);
  return `${curto(segunda)} — ${curto(sexta)} ${sexta.getFullYear()}`;
};

export const rotuloCurto = curto;
