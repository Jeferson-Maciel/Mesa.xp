/**
 * As anotações em si: a forma de uma anotação, etiquetas, links, ordem, filtros e busca.
 * Funções puras, sem DOM, testadas em `notas.test.js`.
 *
 * Uma anotação:
 * ```
 * { id, titulo, texto, etiquetas: string[], lembrete: { data, hora, avisado? } | null,
 *   concluida, concluidaEm, fixada, anexos: [{ id, nome, tipo, tamanho, criadoEm }],
 *   criadaEm, atualizadaEm, excluidaEm }   // datas em milissegundos; excluidaEm: na lixeira
 * ```
 * Os arquivos dos anexos (os prints) não moram na anotação: ficam à parte no repositório, e a
 * anotação guarda só a ficha deles.
 */

import { chaveDoDia, estadoDaNota, momentoDoLembrete } from './lembretes.js';

export const LIMITES = { titulo: 200, texto: 100_000, etiqueta: 40, etiquetas: 20, anexo: 15 * 1024 * 1024 };

export const novaNota = (id, agora = Date.now()) => ({
  id,
  titulo: '',
  texto: '',
  etiquetas: [],
  lembrete: null,
  concluida: false,
  concluidaEm: null,
  fixada: false,
  anexos: [],
  criadaEm: agora,
  atualizadaEm: agora,
  excluidaEm: null
});

/** Nada escrito, nada anexado, nada marcado: uma anotação nova abandonada, que pode sumir. */
export const estaVazia = (n) => !n.titulo.trim() && !n.texto.trim() && n.anexos.length === 0 && n.etiquetas.length === 0 && !n.lembrete;

const primeiraLinha = (texto) =>
  String(texto ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean) ?? '';

/** O título, ou a primeira linha do texto quando não há título — como no bloco de notas. */
export const tituloVisivel = (n) => n.titulo.trim() || primeiraLinha(n.texto).slice(0, 120) || 'Sem título';

/** O texto numa linha só, sem repetir a linha que já apareceu como título. */
export const trechoDe = (n, limite = 160) => {
  let texto = String(n.texto ?? '').trim();
  if (!n.titulo.trim()) texto = texto.slice(texto.indexOf(primeiraLinha(texto)) + primeiraLinha(texto).length);
  // As tarefas aparecem como caixinhas no trecho, e não como "[ ]" e "[x]".
  const linha = texto
    .replace(/^(\s*(?:[-*]\s*)?)\[ \]\s?/gm, '$1☐ ')
    .replace(/^(\s*(?:[-*]\s*)?)\[[xX]\]\s?/gm, '$1☑ ')
    .replace(/\s+/g, ' ')
    .trim();
  return linha.length > limite ? linha.slice(0, limite).trimEnd() + '…' : linha;
};

/* ── Etiquetas ────────────────────────────────────────────────────────────────────────── */

const limparEtiqueta = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITES.etiqueta);

/** Acrescenta a etiqueta, se ela tiver texto e ainda não estiver lá (sem ligar para maiúsculas). */
export const adicionarEtiqueta = (etiquetas, texto) => {
  const nova = limparEtiqueta(texto);
  if (!nova || etiquetas.length >= LIMITES.etiquetas) return etiquetas;
  if (etiquetas.some((e) => e.toLocaleLowerCase('pt-BR') === nova.toLocaleLowerCase('pt-BR'))) return etiquetas;
  return [...etiquetas, nova];
};

/** Uma das cinco cores de etiqueta (anotacoes.css), sempre a mesma para o mesmo nome. */
export const corDaEtiqueta = (nome) => {
  let h = 0;
  for (const ch of String(nome).toLocaleLowerCase('pt-BR')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 5;
};

/** As etiquetas usadas, com quantas anotações cada uma tem, em ordem alfabética. */
export const etiquetasEmUso = (notas) => {
  const porNome = new Map();
  for (const n of notas) {
    if (n.excluidaEm) continue;
    for (const e of n.etiquetas) {
      const chave = e.toLocaleLowerCase('pt-BR');
      const atual = porNome.get(chave);
      porNome.set(chave, { nome: atual?.nome ?? e, total: (atual?.total ?? 0) + 1 });
    }
  }
  return [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
};

/* ── Links ────────────────────────────────────────────────────────────────────────────── */

/**
 * Os links do texto, para virar botões clicáveis embaixo da anotação. Só http e https: um
 * `javascript:` colado no texto nunca vira link.
 */
export const extrairLinks = (texto) => {
  const achados = String(texto ?? '').match(/\bhttps?:\/\/[^\s<>"']+/gi) ?? [];
  const limpos = achados.map((url) => {
    let u = url.replace(/[.,;:!?]+$/, '');
    // Um ")" no fim só é do link se ele abriu um "(" — senão é o parêntese da frase.
    while (u.endsWith(')') && (u.match(/\(/g)?.length ?? 0) < (u.match(/\)/g)?.length ?? 0)) u = u.slice(0, -1);
    return u;
  });
  return [...new Set(limpos)];
};

/* ── Ordem, filtros e busca ───────────────────────────────────────────────────────────── */

const PESO = { vencida: 0, fixada: 1, hoje: 2, pendente: 3, livre: 4, resolvida: 5, excluida: 6 };

/**
 * Vencidas no topo (a mais antiga primeiro), depois as fixadas, depois as de hoje e as pendentes
 * pela data do lembrete, depois o resto pela edição mais recente. Resolvidas por último.
 */
export const ordenarNotas = (notas, agora = new Date()) => {
  const grupo = (n) => {
    const estado = estadoDaNota(n, agora);
    if (estado === 'vencida' || estado === 'resolvida' || estado === 'excluida') return PESO[estado];
    return n.fixada ? PESO.fixada : PESO[estado];
  };
  return [...notas].sort((a, b) => {
    const [ga, gb] = [grupo(a), grupo(b)];
    if (ga !== gb) return ga - gb;
    if (a.lembrete && b.lembrete && ga !== PESO.resolvida) return momentoDoLembrete(a.lembrete) - momentoDoLembrete(b.lembrete);
    if (ga === PESO.excluida) return (b.excluidaEm ?? 0) - (a.excluidaEm ?? 0);
    if (ga === PESO.resolvida) return (b.concluidaEm ?? 0) - (a.concluidaEm ?? 0);
    return b.atualizadaEm - a.atualizadaEm;
  });
};

// Minúsculo e sem acento: "relatorio" acha "relatório".
const dobrar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const FILTROS = {
  todas: (estado) => estado !== 'resolvida' && estado !== 'excluida',
  lembretes: (estado) => estado === 'pendente' || estado === 'hoje',
  vencidas: (estado) => estado === 'vencida',
  resolvidas: (estado) => estado === 'resolvida',
  lixeira: (estado) => estado === 'excluida'
};

/**
 * @param {object[]} notas
 * @param {{ filtro?: keyof FILTROS, etiqueta?: string, termo?: string }} criterios
 */
export const filtrarNotas = (notas, { filtro = 'todas', etiqueta = '', termo = '' } = {}, agora = new Date()) => {
  const passa = FILTROS[filtro] ?? FILTROS.todas;
  const alvoEtiqueta = etiqueta.toLocaleLowerCase('pt-BR');
  const alvo = dobrar(termo.trim());
  return ordenarNotas(
    notas.filter((n) => {
      if (!passa(estadoDaNota(n, agora))) return false;
      if (alvoEtiqueta && !n.etiquetas.some((e) => e.toLocaleLowerCase('pt-BR') === alvoEtiqueta)) return false;
      if (alvo && !dobrar(`${n.titulo}\n${n.texto}\n${n.etiquetas.join(' ')}`).includes(alvo)) return false;
      return true;
    }),
    agora
  );
};

/** Quantas anotações cada filtro mostra. */
export const contagens = (notas, agora = new Date()) => {
  const total = { todas: 0, lembretes: 0, vencidas: 0, resolvidas: 0, lixeira: 0 };
  for (const n of notas) {
    const estado = estadoDaNota(n, agora);
    for (const [nome, passa] of Object.entries(FILTROS)) if (passa(estado)) total[nome]++;
  }
  return total;
};

/* ── Checklist ──────────────────────────────────────────────────────────────────────────
   A lista de tarefas mora no próprio texto, como texto: "[ ] pedir o estorno", "[x] anexar o print".
   Assim ela vai no backup e no "Copiar texto" como está, e a tela a mostra com caixinhas. */

const ITEM = /^(\s*(?:[-*]\s*)?)\[( |x|X)\]\s?(.*)$/;

/** @returns {{ linha: number, feito: boolean, texto: string }[]} */
export const lerChecklist = (texto) =>
  String(texto ?? '')
    .split('\n')
    .map((l, linha) => {
      const m = ITEM.exec(l);
      return m ? { linha, feito: m[2] !== ' ', texto: m[3].trim() } : null;
    })
    .filter(Boolean);

/** Marca ou desmarca o item da linha; linha que não é item fica como está. */
export const alternarItem = (texto, linha) => {
  const linhas = String(texto ?? '').split('\n');
  const m = ITEM.exec(linhas[linha] ?? '');
  if (!m) return texto;
  linhas[linha] = `${m[1]}[${m[2] === ' ' ? 'x' : ' '}]${linhas[linha].slice(m[1].length + 3)}`;
  return linhas.join('\n');
};

export const progressoChecklist = (texto) => {
  const itens = lerChecklist(texto);
  return { feitos: itens.filter((i) => i.feito).length, total: itens.length };
};

/* ── Agenda ─────────────────────────────────────────────────────────────────────────────
   Como o "Planejado" do Microsoft To Do: o que venceu, hoje, amanhã, os próximos 7 dias, depois, e
   o que não tem lembrete. Só os grupos com alguma anotação. */

const GRUPOS = [
  ['vencidas', 'Vencidas'],
  ['hoje', 'Hoje'],
  ['amanha', 'Amanhã'],
  ['semana', 'Próximos 7 dias'],
  ['depois', 'Mais adiante'],
  ['sem-lembrete', 'Sem lembrete'],
  ['resolvidas', 'Resolvidas']
];

export const agruparPorPrazo = (notas, agora = new Date()) => {
  const hoje = chaveDoDia(agora);
  const amanha = chaveDoDia(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1));
  const semana = chaveDoDia(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 7));
  const grupoDe = (n) => {
    const estado = estadoDaNota(n, agora);
    if (estado === 'resolvida' || estado === 'excluida') return 'resolvidas';
    if (estado === 'vencida') return 'vencidas';
    if (!n.lembrete) return 'sem-lembrete';
    if (n.lembrete.data === hoje) return 'hoje';
    if (n.lembrete.data === amanha) return 'amanha';
    return n.lembrete.data <= semana ? 'semana' : 'depois';
  };
  const porGrupo = new Map(GRUPOS.map(([id]) => [id, []]));
  for (const n of ordenarNotas(notas, agora)) porGrupo.get(grupoDe(n)).push(n);
  for (const [id, lista] of porGrupo) {
    if (id !== 'sem-lembrete' && id !== 'resolvidas') lista.sort((a, b) => momentoDoLembrete(a.lembrete) - momentoDoLembrete(b.lembrete));
  }
  return GRUPOS.map(([id, titulo]) => ({ id, titulo, notas: porGrupo.get(id) })).filter((g) => g.notas.length);
};

/* ── Lixeira ────────────────────────────────────────────────────────────────────────────
   Excluir leva para a lixeira; ela guarda por 30 dias, como o "Apagados recentemente" do Apple
   Notes, e depois apaga de vez. */

export const DIAS_NA_LIXEIRA = 30;

export const paraApagarDeVez = (notas, agora = new Date(), dias = DIAS_NA_LIXEIRA) =>
  notas.filter((n) => n.excluidaEm && agora.getTime() - n.excluidaEm > dias * 86_400_000).map((n) => n.id);

/* ── Rascunho ───────────────────────────────────────────────────────────────────────────
   O editor trabalha numa cópia (o rascunho); nada muda na anotação gravada até Salvar. */

/** O que se edita no editor. O `avisado` do lembrete é do vigia, não da pessoa. */
export const camposDe = (n) => ({
  titulo: n.titulo,
  texto: n.texto,
  etiquetas: [...n.etiquetas],
  lembrete: n.lembrete ? { data: n.lembrete.data, hora: n.lembrete.hora ?? null } : null
});

const igual = (campo, a, b) => {
  if (campo === 'etiquetas') return a.length === b.length && a.every((e, i) => e === b[i]);
  if (campo === 'lembrete') return (!a && !b) || Boolean(a && b && a.data === b.data && (a.hora ?? null) === (b.hora ?? null));
  return a === b;
};

const CAMPOS = ['titulo', 'texto', 'etiquetas', 'lembrete'];

export const mesmosCampos = (a, b) => CAMPOS.every((c) => igual(c, a[c], b[c]));

/**
 * A anotação a gravar: vale o que a pessoa mudou desde que abriu; o que ela não mexeu vem do que
 * está gravado agora (o alerta pode ter adiado o lembrete enquanto ela editava o texto).
 */
export const mesclarAoSalvar = ({ original, rascunho, atual }) => {
  const nota = { ...atual, etiquetas: [...atual.etiquetas] };
  for (const c of CAMPOS) if (!igual(c, original[c], rascunho[c])) nota[c] = c === 'etiquetas' ? [...rascunho[c]] : rascunho[c];
  return nota;
};
