import { ehDiaUtil } from './diasUteis.js';

/**
 * Os horários de mercado que a mesa olha o dia todo, num lugar só: a faixa de horários do topo e os
 * prazos da Fila do dia leem daqui. Horários de Brasília, conferidos em 21/10/2026; quando a B3 ou a
 * XP mudarem um deles, muda-se aqui, e só aqui.
 *
 * - O pregão da B3: o leilão de encerramento começa às 16h55; o que for lançado depois disso só é
 *   processado no próximo dia útil (a observação do e-mail de ordem, `docs/FORMATOS-DE-SAIDA.md`).
 * - O Estoque clientes do secundário: a intenção que não casar até as 14h é cancelada (a boleta).
 * - O secundário da XP opera até as 16h30 (`highSecondaryOperationTime` da captura da Prateleira).
 * - O Tesouro Direto, das 9h30 às 18h (`core/tesouro`).
 */
export const HORARIOS = {
  pregao: { abre: '10:00', leilao: '16:55', fecha: '17:00' },
  estoqueClientes: { ate: '14:00' },
  secundario: { ate: '16:30' },
  tesouro: { abre: '09:30', fecha: '18:00' }
};

const minutosDe = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const minutosDoDia = (data) => data.getHours() * 60 + data.getMinutes();
const naHora = (dia, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m, 0, 0);
};

/**
 * A próxima vez que o relógio marca `hhmm` num dia útil, a partir de `em`: hoje, se ainda não deu a
 * hora e hoje tem pregão; senão, no próximo dia útil.
 */
export const proximoHorario = (em, hhmm, ehUtil = ehDiaUtil) => {
  const data = new Date(em);
  if (ehUtil(data) && minutosDoDia(data) < minutosDe(hhmm)) return naHora(data, hhmm);
  const dia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  do dia.setDate(dia.getDate() + 1);
  while (!ehUtil(dia));
  return naHora(dia, hhmm);
};

/** "1h12", "35 min", "agora". */
export const quantoFalta = (ms) => {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h}h${String(resto).padStart(2, '0')}` : `${h}h`;
};

/**
 * Cada horário do dia, como a faixa o mostra: o nome, a situação (`aberto`, `perto` — falta meia
 * hora ou menos —, `fechado`) e o texto. `proximo` é o que fecha primeiro entre os abertos: é o que
 * a faixa mostra de longe.
 *
 * @param {Date} agora
 * @returns {{itens: Array<{id: string, nome: string, situacao: 'aberto'|'perto'|'fechado', texto: string, fechaEm: Date|null}>, proximo: object|null}}
 */
export const faixaDeHorarios = (agora = new Date(), ehUtil = ehDiaUtil) => {
  const util = ehUtil(agora);
  const agoraMin = minutosDoDia(agora);
  const janela = (id, nome, abre, fecha, textos) => {
    if (!util) return { id, nome, situacao: 'fechado', texto: textos.semPregao, fechaEm: null };
    if (abre && agoraMin < minutosDe(abre)) return { id, nome, situacao: 'fechado', texto: textos.antes(quantoFalta(naHora(agora, abre) - agora)), fechaEm: null };
    if (agoraMin >= minutosDe(fecha)) return { id, nome, situacao: 'fechado', texto: textos.depois, fechaEm: null };
    const fechaEm = naHora(agora, fecha);
    const falta = fechaEm - agora;
    return { id, nome, situacao: falta <= 30 * 60000 ? 'perto' : 'aberto', texto: textos.durante(quantoFalta(falta)), fechaEm };
  };

  const pregao = (() => {
    const { abre, leilao, fecha } = HORARIOS.pregao;
    if (util && agoraMin >= minutosDe(leilao) && agoraMin < minutosDe(fecha)) {
      return { id: 'pregao', nome: 'B3', situacao: 'perto', texto: 'leilão de encerramento', fechaEm: naHora(agora, fecha) };
    }
    return janela('pregao', 'B3', abre, leilao, {
      semPregao: 'sem pregão hoje',
      antes: (falta) => `abre em ${falta}`,
      durante: (falta) => `leilão em ${falta}`,
      depois: 'encerrado: ordens no próximo dia útil'
    });
  })();

  const itens = [
    pregao,
    janela('estoque-clientes', 'Estoque clientes', null, HORARIOS.estoqueClientes.ate, {
      semPregao: 'fechado hoje',
      durante: (falta) => `casa até as 14h · ${falta}`,
      depois: 'encerrado hoje'
    }),
    janela('secundario', 'Secundário XP', null, HORARIOS.secundario.ate, {
      semPregao: 'fechado hoje',
      durante: (falta) => `até as 16h30 · ${falta}`,
      depois: 'encerrado hoje'
    }),
    janela('tesouro', 'Tesouro', HORARIOS.tesouro.abre, HORARIOS.tesouro.fecha, {
      semPregao: 'fechado hoje',
      antes: (falta) => `abre em ${falta}`,
      durante: (falta) => `até as 18h · ${falta}`,
      depois: 'fechado: no próximo dia útil'
    })
  ];
  const abertos = itens.filter((i) => i.fechaEm).sort((a, b) => a.fechaEm - b.fechaEm);
  return { itens, proximo: abertos[0] ?? null };
};
