/**
 * A data escrita no meio da frase — "ligar pro cliente amanhã às 14h" — lida como lembrete, como o
 * Todoist faz na entrada rápida. Funções puras, testadas em `dataNatural.test.js`.
 *
 * A leitura só **propõe**: a tela mostra o trecho reconhecido num selo, e a pessoa tira com um
 * clique antes de criar a anotação. E ela é conservadora onde errar é fácil:
 *
 * - dia do mês solto não conta. "Estorno **do dia 25**" diz quando o estorno aconteceu, e é
 *   justamente como a mesa escreve o título; só vale depois de uma palavra de prazo — "até dia 25",
 *   "lembrar dia 5", "prazo 10/10", "vence 15/10";
 * - "segunda via" não é segunda-feira; "as 3 notas" não é três horas — hora sem "h" só com o
 *   "às" acentuado ("às 14").
 */

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

// Minúsculo e sem acento, caractere por caractere: as posições achadas valem no texto original.
const dobrar = (texto) => {
  let saida = '';
  for (const ch of texto) {
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    saida += base.length === ch.length ? base : ch;
  }
  return saida;
};

const doisDigitos = (n) => String(n).padStart(2, '0');
const chave = (d) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
const somarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Data válida de verdade (31/02 não existe), ou null.
const dataValida = (ano, mes, dia) => {
  const d = new Date(ano, mes - 1, dia);
  return d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia ? d : null;
};

/**
 * @returns {{ lembrete: { data: string, hora: string | null }, trechos: Array<[number, number]> } | null}
 *   `trechos`: onde, no texto original, está o que foi lido — para realçar e para tirar do título.
 */
export const lerDataNatural = (texto, agora = new Date()) => {
  const original = String(texto ?? '');
  const f = dobrar(original);
  const usado = new Array(f.length).fill(false);
  const trechos = [];

  // Acha a primeira ocorrência que não se sobrepõe ao que já foi lido.
  const achar = (regex, aceitar = () => true) => {
    const global = new RegExp(regex.source, 'g');
    for (const m of f.matchAll(global)) {
      const [inicio, fim] = [m.index, m.index + m[0].length];
      if (usado.slice(inicio, fim).some(Boolean) || !aceitar(m)) continue;
      return { m, inicio, fim };
    }
    return null;
  };
  const marcar = ({ inicio, fim }) => {
    for (let i = inicio; i < fim; i++) usado[i] = true;
    trechos.push([inicio, fim]);
  };

  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  let dia = null;
  let horaExata = null; // "daqui 2 horas" já traz a hora

  // Daqui N minutos, horas, dias, semanas.
  const relativo = achar(/\b(?:daqui a|daqui|em)\s+(\d{1,3})\s*(minutos?|min|horas?|h|dias?|semanas?)\b/);
  if (relativo) {
    const n = Number(relativo.m[1]);
    const unidade = relativo.m[2];
    if (/^(min|h)/.test(unidade)) {
      const alvo = new Date(agora.getTime() + n * (unidade.startsWith('h') ? 3_600_000 : 60_000));
      dia = new Date(alvo.getFullYear(), alvo.getMonth(), alvo.getDate());
      horaExata = `${doisDigitos(alvo.getHours())}:${doisDigitos(alvo.getMinutes())}`;
    } else {
      dia = somarDias(hoje, unidade.startsWith('semana') ? n * 7 : n);
    }
    marcar(relativo);
  }

  // Data com dia do mês, só depois de uma palavra de prazo.
  if (!dia) {
    const prazo = achar(
      /\b(?:lembrar|lembrete|ate|prazo|vence|vencimento)\s+(?:(?:o|no|em)\s+)?(?:dia\s+(\d{1,2})(?:\/(\d{1,2})(?:\/(\d{4}|\d{2}))?)?|(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?)(?!\d)/
    );
    if (prazo) {
      const [, d1, m1, a1, d2, m2, a2] = prazo.m;
      const numero = Number(d1 ?? d2);
      const mes = m1 ?? m2;
      const ano = a1 ?? a2;
      let alvo = null;
      if (mes) {
        const anoCheio = ano ? (ano.length === 2 ? 2000 + Number(ano) : Number(ano)) : hoje.getFullYear();
        alvo = dataValida(anoCheio, Number(mes), numero);
        // Sem ano, uma data que já passou é a do ano que vem.
        if (alvo && !ano && alvo < hoje) alvo = dataValida(anoCheio + 1, Number(mes), numero);
      } else {
        alvo = dataValida(hoje.getFullYear(), hoje.getMonth() + 1, numero);
        if (!alvo || alvo < hoje) alvo = dataValida(hoje.getFullYear(), hoje.getMonth() + 2, numero) ?? dataValida(hoje.getFullYear() + 1, 1, numero);
      }
      if (alvo) {
        dia = alvo;
        marcar(prazo);
      } else {
        return null; // "até 31/02": a pessoa quis um prazo, mas a data não existe
      }
    }
  }

  if (!dia) {
    const depois = achar(/\bdepois de amanha\b/);
    if (depois) {
      dia = somarDias(hoje, 2);
      marcar(depois);
    }
  }
  if (!dia) {
    const amanha = achar(/\bamanha\b/);
    if (amanha) {
      dia = somarDias(hoje, 1);
      marcar(amanha);
    }
  }
  if (!dia) {
    const hojeAchado = achar(/\bhoje\b/);
    if (hojeAchado) {
      dia = hoje;
      marcar(hojeAchado);
    }
  }
  if (!dia) {
    const semana = achar(/\b(?:(?:na|no|nesta|neste|proxima|proximo)\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira|\s+feira)?\b(?!\s+via)/);
    if (semana) {
      const alvo = DIAS_DA_SEMANA.indexOf(semana.m[1]);
      const faltam = ((alvo - hoje.getDay() + 7) % 7) || 7; // o dia de hoje é o da semana que vem
      dia = somarDias(hoje, faltam);
      marcar(semana);
    }
  }

  // Hora: "14h", "9h30", "15:45", com "às" opcional; "às 14" só com o à acentuado.
  let hora = horaExata;
  if (!hora) {
    const comH = achar(/(?:\b(?:as|a partir das)\s+)?\b(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?!\d)/);
    const soAs = comH ? null : achar(/\bas\s+(\d{1,2})\b(?!\s*(?:\/|:|h|dias?|horas?|min))/, (m) => original[m.index] === 'à' || original[m.index] === 'À');
    const achado = comH ?? soAs;
    if (achado) {
      const h = Number(achado.m[1]);
      const min = Number(achado.m[2] ?? achado.m[3] ?? 0);
      if (h > 23 || min > 59) {
        if (!dia) return null;
      } else {
        hora = `${doisDigitos(h)}:${doisDigitos(min)}`;
        marcar(achado);
      }
    }
  }

  if (!dia && !hora) return null;
  if (!dia) {
    // Só a hora: hoje, se ainda não passou; senão, amanhã.
    const [h, min] = hora.split(':').map(Number);
    dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), h, min) > agora ? hoje : somarDias(hoje, 1);
  }

  return { lembrete: { data: chave(dia), hora }, trechos: trechos.sort((a, b) => a[0] - b[0]) };
};

const PENDURADAS = /(?:^|\s)(?:as|às|ate|até|para|pra|de|do|da|no|na|em|o|dia|lembrar|lembrete|prazo|vence)$/i;

/** O texto sem os trechos lidos: é o que vira o título da anotação. */
export const semOsTrechos = (texto, trechos) => {
  let resto = '';
  let ultimo = 0;
  for (const [inicio, fim] of trechos) {
    resto += texto.slice(ultimo, inicio) + ' ';
    ultimo = fim;
  }
  resto += texto.slice(ultimo);
  let limpo = resto.replace(/\s+/g, ' ').trim();
  // Palavras de ligação que ficaram soltas no fim ("ligar pro cliente às" → "ligar pro cliente").
  while (PENDURADAS.test(limpo)) limpo = limpo.replace(PENDURADAS, '').trim();
  return limpo.replace(/[\s,;:–—-]+$/, '').trim();
};
