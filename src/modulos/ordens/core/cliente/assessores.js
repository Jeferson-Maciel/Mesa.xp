/**
 * A planilha dos assessores: de onde sai o e-mail do assessor responsável, que vai em cópia no
 * e-mail da ordem.
 *
 * O Hub dá o código do assessor (`A51847`) e o nome dele; a planilha liga o código ao e-mail. É a
 * aba "Contatos" da planilha da mesa, baixada e carregada na Mesa (decisão do operador em
 * 07/10/2026). Ela tem duas colunas de código ("Código" e "Código em uso"), um segundo "Nome" mais à
 * direita, e-mails "-" e linhas que não são pessoas ("Argentum Digital"): só fica a linha com
 * e-mail válido, e o primeiro "Nome" é o que vale.
 *
 * Achar o assessor nunca é palpite: pelo código, ou pelo nome escrito igual (sem ligar para acento
 * e maiúscula). Dois e-mails para o mesmo assessor é dúvida, e dúvida fica sem cópia.
 */

export class ErroDosAssessores extends Error {}

/** Sem acento, sem maiúscula e com um espaço só entre as palavras. */
export const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const EMAIL = /^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/;

/** @returns {string|null} o e-mail em minúsculas, ou null se não for um e-mail só */
export const emailValido = (texto) => {
  const email = String(texto ?? '').trim().toLowerCase();
  return EMAIL.test(email) ? email : null;
};

/** @returns {string|null} o código no formato do Hub (`A51847`), ou null */
export const codigoDoAssessor = (texto) => {
  const codigo = String(texto ?? '').trim().toUpperCase();
  return /^A\d+$/.test(codigo) ? codigo : null;
};

// A caixa de seleção do Status sai como TRUE/FALSE (ou VERDADEIRO/FALSO, na planilha em português).
// Vazio não diz nada, e conta como ativo.
const ativo = (celula) => !/^(false|falso|0|nao)$/.test(normalizar(celula));

/**
 * @param {Array<Array<unknown>>} linhas  a aba da planilha, linha a linha
 * @returns {Array<{nome: string, email: string, codigos: string[], ativo: boolean}>}
 */
export const lerAssessores = (linhas) => {
  const cabecalho = (linha) => linha.map(normalizar);
  const iCabecalho = linhas
    .slice(0, 10)
    .findIndex((l) => cabecalho(l).includes('nome') && cabecalho(l).some((c) => c === 'email' || c === 'e-mail'));
  if (iCabecalho < 0) {
    throw new ErroDosAssessores('Não achei as colunas Nome e Email: é a aba Contatos da planilha dos assessores?');
  }

  const colunas = cabecalho(linhas[iCabecalho]);
  const iNome = colunas.indexOf('nome');
  const iEmail = colunas.findIndex((c) => c === 'email' || c === 'e-mail');
  const iStatus = colunas.indexOf('status');
  const iCodigos = colunas.flatMap((c, i) => (c === 'codigo em uso' || c === 'codigo' ? [i] : []));
  if (iCodigos.length === 0) throw new ErroDosAssessores('Não achei a coluna "Código em uso" na planilha dos assessores.');

  const assessores = [];
  for (const linha of linhas.slice(iCabecalho + 1)) {
    const email = emailValido(linha[iEmail]);
    if (!email) continue;
    assessores.push({
      nome: String(linha[iNome] ?? '').trim(),
      email,
      codigos: [...new Set(iCodigos.map((i) => codigoDoAssessor(linha[i])).filter(Boolean))],
      ativo: iStatus < 0 || ativo(linha[iStatus])
    });
  }
  if (assessores.length === 0) throw new ErroDosAssessores('A planilha dos assessores não tem nenhum e-mail.');
  return assessores;
};

/**
 * O arquivo baixado da planilha: o .xlsx inteiro, com todas as abas, ou o .csv da aba Contatos. A aba
 * que vale é a primeira com Nome, Email e o código do assessor — a Contatos, se ela estiver lá.
 *
 * @param {ArrayBuffer|Uint8Array} dados
 * @param {typeof import('../../../../vendor/xlsx.full.min.js')} XLSX  injetado, como no secundário
 */
export const lerPlanilhaDosAssessores = (dados, XLSX) => {
  // O .csv do Google vem em UTF-8 sem marca, e o SheetJS o leria como Latin-1 ("CÃ³digo"): o que não
  // é .xlsx (zip, PK) nem .xls (D0 CF) é lido como texto UTF-8.
  const bytes = dados instanceof Uint8Array ? dados : new Uint8Array(dados);
  const binario = (bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0xd0 && bytes[1] === 0xcf);
  const livro = binario ? XLSX.read(bytes, { type: 'array' }) : XLSX.read(new TextDecoder('utf-8').decode(bytes), { type: 'string' });
  const abas = [...livro.SheetNames].sort((a, b) => (normalizar(b) === 'contatos') - (normalizar(a) === 'contatos'));
  let erro = null;
  for (const aba of abas) {
    try {
      return lerAssessores(XLSX.utils.sheet_to_json(livro.Sheets[aba], { header: 1, raw: false, defval: '' }));
    } catch (e) {
      if (!(e instanceof ErroDosAssessores)) throw e;
      erro ??= e;
    }
  }
  throw erro ?? new ErroDosAssessores('A planilha dos assessores está vazia.');
};

/**
 * Um assessor para os candidatos: o mesmo e-mail em todos, ou um só entre os ativos.
 * @returns {{nome: string, email: string}|null}
 */
const umSo = (candidatos) => {
  for (const grupo of [candidatos, candidatos.filter((a) => a.ativo)]) {
    const emails = [...new Set(grupo.map((a) => a.email))];
    if (emails.length === 1) return grupo.find((a) => a.email === emails[0]);
  }
  return null;
};

/**
 * @param {Array<{nome: string, email: string, codigos: string[], ativo: boolean}>|null} assessores
 * @param {{codigo?: string|null, nome?: string|null}} assessor  o que o Hub disse
 * @returns {{email: string, nome: string, peloNome?: boolean} | {motivo: 'sem-planilha'|'sem-assessor'|'fora-da-planilha'|'ambiguo'}}
 */
export const acharAssessor = (assessores, { codigo = null, nome = null }) => {
  if (!codigo && !normalizar(nome)) return { motivo: 'sem-assessor' };
  if (!assessores?.length) return { motivo: 'sem-planilha' };

  const porCodigo = codigo ? assessores.filter((a) => a.codigos.includes(codigo)) : [];
  const porNome = porCodigo.length === 0 && normalizar(nome) ? assessores.filter((a) => normalizar(a.nome) === normalizar(nome)) : [];
  const candidatos = porCodigo.length > 0 ? porCodigo : porNome;
  if (candidatos.length === 0) return { motivo: 'fora-da-planilha' };

  const achado = umSo(candidatos);
  if (!achado) return { motivo: 'ambiguo' };
  return porCodigo.length > 0 ? { email: achado.email, nome: achado.nome } : { email: achado.email, nome: achado.nome, peloNome: true };
};
