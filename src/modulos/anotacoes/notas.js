/**
 * As anotações em si: a forma de uma anotação, etiquetas, links, ordem, filtros e busca.
 * Funções puras, sem DOM, testadas em `notas.test.js`.
 *
 * Uma anotação:
 * ```
 * { id, titulo, texto, etiquetas: string[], lembrete: { data, hora, avisado? } | null,
 *   concluida, concluidaEm, fixada, anexos: [{ id, nome, tipo, tamanho, criadoEm }],
 *   criadaEm, atualizadaEm }   // datas de criação e edição em milissegundos
 * ```
 * Os arquivos dos anexos (os prints) não moram na anotação: ficam à parte no repositório, e a
 * anotação guarda só a ficha deles.
 */

import { estadoDaNota, momentoDoLembrete } from './lembretes.js';

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
  atualizadaEm: agora
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
  const linha = texto.replace(/\s+/g, ' ').trim();
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

const PESO = { vencida: 0, fixada: 1, hoje: 2, pendente: 3, livre: 4, resolvida: 5 };

/**
 * Vencidas no topo (a mais antiga primeiro), depois as fixadas, depois as de hoje e as pendentes
 * pela data do lembrete, depois o resto pela edição mais recente. Resolvidas por último.
 */
export const ordenarNotas = (notas, agora = new Date()) => {
  const grupo = (n) => {
    const estado = estadoDaNota(n, agora);
    if (estado === 'vencida' || estado === 'resolvida') return PESO[estado];
    return n.fixada ? PESO.fixada : PESO[estado];
  };
  return [...notas].sort((a, b) => {
    const [ga, gb] = [grupo(a), grupo(b)];
    if (ga !== gb) return ga - gb;
    if (a.lembrete && b.lembrete && ga !== PESO.resolvida) return momentoDoLembrete(a.lembrete) - momentoDoLembrete(b.lembrete);
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
  todas: (estado) => estado !== 'resolvida',
  lembretes: (estado) => estado === 'pendente' || estado === 'hoje',
  vencidas: (estado) => estado === 'vencida',
  resolvidas: (estado) => estado === 'resolvida'
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
  const total = { todas: 0, lembretes: 0, vencidas: 0, resolvidas: 0 };
  for (const n of notas) {
    const estado = estadoDaNota(n, agora);
    for (const [nome, passa] of Object.entries(FILTROS)) if (passa(estado)) total[nome]++;
  }
  return total;
};
