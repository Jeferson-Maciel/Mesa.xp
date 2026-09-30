/**
 * Os lembretes das anotações: quando uma anotação fica amarela, quando fica vermelha, e o que se
 * escreve no selo dela. Funções puras, sem DOM, testadas em `lembretes.test.js`.
 *
 * Um lembrete é `{ data: 'YYYY-MM-DD', hora: 'HH:MM' | null }`, sempre no fuso local — nunca
 * `toISOString()`, que às 21h de Brasília já está no dia seguinte (a mesma regra do Calendário).
 *
 * Os estados, do jeito que a mesa pediu:
 * - `livre` — sem lembrete;
 * - `pendente` — o dia ainda não chegou: **amarelo**;
 * - `hoje` — é hoje, mas a hora marcada ainda não chegou: amarelo forte;
 * - `vencida` — chegou o dia (sem hora) ou a hora: **vermelho**, e o alerta na tela;
 * - `resolvida` — marcada como resolvida: sai do caminho, com ou sem lembrete.
 */

const doisDigitos = (n) => String(n).padStart(2, '0');

/** A chave local do dia (`YYYY-MM-DD`). */
export const chaveDoDia = (d) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;

const horaDe = (d) => `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;

/** O instante em que o lembrete vence. Sem hora, é a meia-noite do dia: o dia inteiro já é "o dia". */
export const momentoDoLembrete = ({ data, hora }) => {
  const [ano, mes, dia] = data.split('-').map(Number);
  const [h, m] = hora ? hora.split(':').map(Number) : [0, 0];
  return new Date(ano, mes - 1, dia, h, m, 0, 0);
};

const mesmoDia = (a, b) => chaveDoDia(a) === chaveDoDia(b);

const somarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());

/** @returns {'livre' | 'pendente' | 'hoje' | 'vencida' | 'resolvida'} */
export const estadoDaNota = (nota, agora = new Date()) => {
  if (nota.concluida) return 'resolvida';
  if (!nota.lembrete) return 'livre';
  const momento = momentoDoLembrete(nota.lembrete);
  if (agora >= momento) return 'vencida';
  if (mesmoDia(momento, agora)) return 'hoje';
  return 'pendente';
};

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const ddmm = (d) => `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}`;
const diasEntre = (antes, depois) =>
  Math.round((new Date(depois.getFullYear(), depois.getMonth(), depois.getDate()) - new Date(antes.getFullYear(), antes.getMonth(), antes.getDate())) / 86_400_000);

/** O texto do selo da anotação: "Lembrar amanhã às 09:00", "Venceu ontem", "Resolvida em 29/09". */
export const rotuloDoLembrete = (nota, agora = new Date()) => {
  const estado = estadoDaNota(nota, agora);
  if (estado === 'resolvida') return nota.concluidaEm ? `Resolvida em ${ddmm(new Date(nota.concluidaEm))}` : 'Resolvida';
  if (estado === 'livre') return '';

  const { hora } = nota.lembrete;
  const momento = momentoDoLembrete(nota.lembrete);
  const asHoras = hora ? ` às ${hora}` : '';
  const dias = diasEntre(agora, momento);

  if (estado === 'hoje') return `Hoje${asHoras}`;
  if (estado === 'pendente') {
    if (dias === 1) return `Lembrar amanhã${asHoras}`;
    if (dias < 7) return `Lembrar ${DIAS_CURTOS[momento.getDay()]} ${ddmm(momento)}${asHoras}`;
    return `Lembrar ${ddmm(momento)}${asHoras}`;
  }
  // vencida
  if (dias === 0) return hora ? `Venceu hoje às ${hora}` : 'Para hoje';
  if (dias === -1) return `Venceu ontem${asHoras}`;
  return `Venceu em ${ddmm(momento)} (há ${-dias} dias)`;
};

/**
 * Atalhos para marcar ou adiar um lembrete com um clique, os mesmos das ferramentas de lembrete
 * (Keep, Todoist): daqui a pouco, fim da tarde, amanhã cedo, daqui dois dias, segunda.
 */
export const ATALHOS = [
  { id: '1h', rotulo: 'Daqui 1 hora', disponivel: () => true },
  { id: 'hoje-17h', rotulo: 'Hoje às 17:00', disponivel: (agora) => agora.getHours() < 17 },
  { id: 'amanha-9h', rotulo: 'Amanhã às 09:00', disponivel: () => true },
  { id: '2-dias', rotulo: 'Em 2 dias', disponivel: () => true },
  { id: 'segunda-9h', rotulo: 'Segunda às 09:00', disponivel: () => true }
];

/** @returns {{ data: string, hora: string | null }} o lembrete do atalho, a partir de `agora`. */
export const aplicarAtalho = (id, agora = new Date()) => {
  if (id === '1h') {
    const alvo = new Date(agora.getTime() + 60 * 60_000);
    const minutos = Math.ceil(alvo.getMinutes() / 5) * 5;
    alvo.setMinutes(minutos, 0, 0);
    return { data: chaveDoDia(alvo), hora: horaDe(alvo) };
  }
  if (id === 'hoje-17h') return { data: chaveDoDia(agora), hora: '17:00' };
  if (id === 'amanha-9h') return { data: chaveDoDia(somarDias(agora, 1)), hora: '09:00' };
  if (id === '2-dias') return { data: chaveDoDia(somarDias(agora, 2)), hora: null };
  if (id === 'segunda-9h') {
    const faltam = ((8 - agora.getDay()) % 7) || 7; // numa segunda, a da semana que vem
    return { data: chaveDoDia(somarDias(agora, faltam)), hora: '09:00' };
  }
  throw new Error(`Atalho de lembrete desconhecido: ${id}`);
};

/** O próximo instante em que alguma anotação não resolvida vai vencer, para agendar o alerta. */
export const proximoMomento = (notas, agora = new Date()) => {
  let proximo = null;
  for (const n of notas) {
    if (n.concluida || !n.lembrete) continue;
    const m = momentoDoLembrete(n.lembrete);
    if (m > agora && (!proximo || m < proximo)) proximo = m;
  }
  return proximo;
};
