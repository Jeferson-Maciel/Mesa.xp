/**
 * "Usar este modelo": os marcadores de um post da base (o `CLIENTE` da saudação, os `XXXXX` da conta,
 * do ativo, do valor…) viram campos, e o texto sai preenchido para copiar ou abrir no Outlook.
 * Funções puras, testadas em `modelo.test.js`.
 *
 * - O nome de cada campo vem do texto antes do marcador, na mesma linha: `Ativo: XXX;` é "Ativo",
 *   `Valor a ser resgatado: XXX` é "Valor a ser resgatado", `na conta XP XXXXX` é "Conta XP".
 * - O cliente e a conta são um campo só cada, mesmo que apareçam mais de uma vez (o post da venda
 *   traz o modelo de fundos e o de ações, cada um com a conta).
 * - O campo deixado em branco sai como o marcador, à vista: nada é inventado no lugar dele.
 */

const MARCADOR = /\bCLIENTE\b|X{3,}/g;

const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

const rotuloDe = (antes) => {
  const limpo = antes.replace(/[\s:;,.\-–—(]+$/, '').trim();
  if (/conta(?:\s+XP)?$/i.test(limpo)) return 'Conta XP';
  if (!limpo) return 'Campo';
  // "Valor a ser resgatado: XXX": o rótulo é o trecho inteiro antes dos dois-pontos, desde o começo
  // da linha ou do ";" de antes. Sem dois-pontos logo antes, as últimas palavras ("Preço: R$ XXX").
  if (/:\s*$/.test(antes)) {
    const trecho = limpo.split(/[;:]/).pop().trim();
    if (trecho) return capitalizar(trecho.split(/\s+/).slice(-5).join(' '));
  }
  return capitalizar(limpo.split(/\s+/).slice(-3).join(' ').replace(/:\s*R\$$/, ' (R$)'));
};

// Cada marcador do texto, com a chave do campo dele: a mesma leitura serve aos campos e ao preencher.
const marcadoresDe = (texto) => {
  const lista = [];
  const vezes = new Map();
  let i = 0;
  for (const m of texto.matchAll(MARCADOR)) {
    if (m[0] === 'CLIENTE') {
      lista.push({ m, chave: 'cliente', rotulo: 'Nome do cliente' });
      continue;
    }
    const rotulo = rotuloDe(texto.slice(texto.lastIndexOf('\n', m.index - 1) + 1, m.index));
    if (rotulo === 'Conta XP') {
      lista.push({ m, chave: 'conta', rotulo });
      continue;
    }
    const n = (vezes.get(rotulo) ?? 0) + 1;
    vezes.set(rotulo, n);
    lista.push({ m, chave: `campo-${i++}`, rotulo: n > 1 ? `${rotulo} (${n})` : rotulo });
  }
  return lista;
};

/**
 * @param {string} texto
 * @returns {Array<{chave: string, rotulo: string, marcador: string}>} na ordem do texto, sem repetir a chave
 */
export const camposDoModelo = (texto) => {
  const campos = [];
  for (const { m, chave, rotulo } of marcadoresDe(String(texto ?? ''))) {
    if (!campos.some((c) => c.chave === chave)) campos.push({ chave, rotulo, marcador: m[0] });
  }
  return campos;
};

export const temMarcadores = (texto) => camposDoModelo(texto).length > 0;

/**
 * O texto em pedaços: o fixo, o preenchido e o que falta — o texto final é a junção deles, e a
 * prévia pinta cada um.
 *
 * @param {string} texto
 * @param {Record<string, string>} valores  pela chave do campo
 * @returns {{pedacos: Array<{texto: string, tipo: 'fixo'|'preenchido'|'falta'}>, texto: string, faltam: number}}
 */
export const preencherModelo = (texto, valores = {}) => {
  const fonte = String(texto ?? '');
  const pedacos = [];
  const faltando = new Set();
  let ultimo = 0;
  for (const { m, chave } of marcadoresDe(fonte)) {
    if (m.index > ultimo) pedacos.push({ texto: fonte.slice(ultimo, m.index), tipo: 'fixo' });
    const valor = String(valores[chave] ?? '').trim();
    if (valor) pedacos.push({ texto: valor, tipo: 'preenchido' });
    else {
      pedacos.push({ texto: m[0], tipo: 'falta' });
      faltando.add(chave);
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < fonte.length) pedacos.push({ texto: fonte.slice(ultimo), tipo: 'fixo' });
  return { pedacos, texto: pedacos.map((p) => p.texto).join(''), faltam: faltando.size };
};
