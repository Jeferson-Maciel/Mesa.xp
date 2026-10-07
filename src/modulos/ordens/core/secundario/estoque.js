import { normalizar } from '../validate/fundo.js';

/**
 * Os fundos do secundário, lidos como estoque do dia. Chegam de dois jeitos, com os mesmos campos:
 *
 * - a **captura do favorito do Hub** (`.json`): a resposta da API da prateleira, inteira, com a
 *   hora em que foi baixada. É a única que traz o deságio mínimo do cliente
 *   (`treasuryMinimumPurchaseDiscount`), de onde sai o ROA máximo, e a corretagem
 *   (`percentageComission`) de cada fundo;
 * - a **exportação "Todos os fundos"** (`.xlsx`), que é um recorte da mesma resposta, sem esses dois.
 *
 * É daqui que saem o PU, os deságios, o estoque e a aplicação mínima de cada fundo. Nada disso é
 * guardado no código: muda ao longo do próprio dia (o XPHF11 saiu com 5,75% de deságio numa
 * exportação de 05/10 e estava em 5,50% na boleta horas depois). Por isso o estoque carregado leva
 * junto a hora em que foi tirado do Hub.
 *
 * O deságio (`secondaryPurchaseDiscount`) é o **deságio máximo** da boleta, o que a barra do ROA
 * divide; o deságio mínimo é o que fica para o cliente com a barra no fim. Conferido em quatro
 * boletas (Riza, XPHF11, CPHF11 e IMOV11) — ver `secundario.js`.
 *
 * `treasuryMinimumBuyCost` **não é lido**. Parecia o ROA (0,50 no IMOV11), mas no Riza vem 0,00
 * com a barra indo até 1% na boleta, e nos fundos de deságio zero vem 0,50 sem barra nenhuma.
 *
 * A XP manda os números como **texto** no padrão brasileiro (`"1.072,28"`, `"-0,50"`, `"N/D"`),
 * e o PU com duas casas, embora o Hub calcule com mais. As casas que vieram ficam registradas: é
 * delas que sai a margem que mantém a conversão de R$ em cotas abaixo do valor pedido.
 */

/** Arquivo que não é nem a captura nem a exportação: a mensagem vai para a tela como está. */
export class ErroDoEstoque extends Error {}

/** Os campos que todo fundo tem de trazer, pelo nome que a XP dá a eles. */
const COLUNAS = {
  nome: 'fundName',
  aplicacaoMinima: 'minimalInitialInvestment',
  pu: 'unityPrice',
  estoque: 'stockOfTreasuryQuotas',
  desagio: 'secondaryPurchaseDiscount'
};

/** Os que só a captura do Hub traz. Faltando, ficam sem valor — nunca zero. */
const DO_HUB = {
  desagioMinimo: 'treasuryMinimumPurchaseDiscount',
  corretagem: 'percentageComission'
};

/** `XPHF11 - XP Hedge Fund`, `TGRI – TG Renda…`: a mesma regra de `scripts/atualizar-fundos.mjs`. */
const TICKER_NO_NOME = /^([A-Z]{4}\d{0,2})\s*[–-]\s*(.+)$/;

/**
 * `"1.072,28"` → 1072.28, `"-0,50"` → -0.5, `"N/D"` → null. Uma célula que já chegue como número
 * passa direto.
 *
 * @returns {number|null}
 */
export const lerNumero = (celula) => {
  if (typeof celula === 'number') return Number.isFinite(celula) ? celula : null;

  const texto = String(celula ?? '').trim();
  if (!/^-?[\d.]+(,\d+)?$/.test(texto)) return null;

  const valor = Number(texto.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(valor) ? valor : null;
};

/** Quantas casas decimais a célula trouxe: `"9,32"` → 2. */
const casasDe = (celula) => {
  const texto = typeof celula === 'number' ? String(celula).replace('.', ',') : String(celula ?? '');
  return texto.includes(',') ? texto.split(',')[1].length : 0;
};

/** A chave que liga a linha da planilha ao fundo da prateleira e ao teto de ROA anotado. */
export const chaveDoFundo = (nome) => normalizar(nome);

/**
 * @typedef {object} FundoDoEstoque
 * @property {string} nome  sem o ticker da frente
 * @property {string|null} ticker
 * @property {number|null} pu
 * @property {number} casasDoPu
 * @property {number|null} desagio  em %, o máximo da boleta (todo para o cliente com o ROA
 *   zerado); negativo é ágio
 * @property {number|null} desagioMinimo  em %, o do cliente com o ROA no máximo; só na captura
 * @property {number|null} corretagem  em %, a máxima; só na captura do Hub
 * @property {string|null} id  o código do fundo no Hub, o da rota da boleta; só na captura
 * @property {string|null} dataDaCota  'AAAA-MM-DD', o dia do PU; só na captura. O preço exato da
 *   cota, que só a boleta mostra, vale para este dia
 * @property {number|null} estoque  cotas disponíveis
 * @property {number|null} aplicacaoMinima  em reais
 */

/** Um fundo, de uma linha com os campos da XP por nome. */
const fundoDe = (linha) => {
  const bruto = String(linha[COLUNAS.nome]).trim();
  const encontrado = bruto.match(TICKER_NO_NOME);

  const dataDaCota = String(linha.quotaDate ?? '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

  return {
    id: typeof linha.id === 'string' && linha.id ? linha.id : null,
    dataDaCota,
    nome: encontrado ? encontrado[2].trim() : bruto,
    ticker: encontrado ? encontrado[1] : null,
    pu: lerNumero(linha[COLUNAS.pu]),
    casasDoPu: casasDe(linha[COLUNAS.pu]),
    desagio: lerNumero(linha[COLUNAS.desagio]),
    desagioMinimo: lerNumero(linha[DO_HUB.desagioMinimo]),
    corretagem: lerNumero(linha[DO_HUB.corretagem]),
    estoque: lerNumero(linha[COLUNAS.estoque]),
    aplicacaoMinima: lerNumero(linha[COLUNAS.aplicacaoMinima])
  };
};

const temNome = (linha) => String(linha?.[COLUNAS.nome] ?? '').trim() !== '';

/**
 * @param {unknown[][]} rows  a primeira aba, linha a linha (`header: 1`)
 * @returns {FundoDoEstoque[]}
 * @throws {ErroDoEstoque} quando faltam colunas: provavelmente não é a exportação de fundos do Hub
 */
export const lerEstoque = (rows) => {
  const cabecalho = (rows[0] ?? []).map((c) => String(c ?? '').trim());

  const faltando = Object.values(COLUNAS).filter((coluna) => !cabecalho.includes(coluna));
  if (faltando.length > 0) {
    throw new ErroDoEstoque(
      `A planilha não tem as colunas ${faltando.join(', ')}. Use a exportação "Todos os fundos" do Hub.`
    );
  }

  return rows
    .slice(1)
    .map((linha) => Object.fromEntries(cabecalho.map((coluna, i) => [coluna, linha?.[i]])))
    .filter(temNome)
    .map(fundoDe);
};

/**
 * O arquivo que o favorito do Hub baixa, ou a resposta que o robô do Hub entrega já como objeto.
 * Também serve a resposta da API salva à mão (sem a hora da captura): aí a hora fica por conta de
 * quem carrega, pela data do arquivo.
 *
 * @param {string|object} entrada  o conteúdo do .json, ou a resposta já lida
 * @returns {{capturadaEm: string|null, fundos: FundoDoEstoque[]}}
 * @throws {ErroDoEstoque} quando não é a resposta da prateleira do secundário
 */
export const lerCapturaDoHub = (entrada) => {
  let captura = entrada;
  if (typeof entrada !== 'object' || entrada === null) {
    try {
      captura = JSON.parse(String(entrada).replace(/^\uFEFF/, ''));
    } catch {
      throw new ErroDoEstoque('O arquivo não é a captura do favorito do Hub: não consegui lê-lo como JSON.');
    }
  }

  if (!Array.isArray(captura?.data)) {
    throw new ErroDoEstoque('O arquivo não é a captura do favorito do Hub: falta a lista de fundos.');
  }

  const linhas = captura.data.filter(temNome);
  if (linhas.length === 0) {
    const semNome = captura.data.length > 0;
    throw new ErroDoEstoque(
      semNome
        ? `A captura do Hub não tem o campo ${COLUNAS.nome}: a resposta do Hub mudou de formato.`
        : 'A captura do Hub veio com nenhum fundo. Abra a Prateleira e clique no favorito de novo.'
    );
  }

  const capturadaEm = typeof captura.capturadaEm === 'string' && !Number.isNaN(Date.parse(captura.capturadaEm))
    ? captura.capturadaEm
    : null;

  return { capturadaEm, fundos: linhas.map(fundoDe) };
};

/**
 * Lê o arquivo. O SheetJS chega por parâmetro, como no Renda Fixa, para os testes usarem a mesma
 * cópia vendorizada que vai no build.
 *
 * @param {ArrayBuffer|Uint8Array} dados
 * @param {typeof import('../../../../vendor/xlsx.full.min.js')} XLSX
 */
export const lerPlanilhaDoSecundario = (dados, XLSX) => {
  const livro = XLSX.read(dados, { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(livro.Sheets[livro.SheetNames[0]], { header: 1, raw: true, defval: null });
  return lerEstoque(rows);
};

/**
 * A linha do fundo pedido. Pelo nome, que é como a prateleira e a planilha se encontram em 145
 * dos 149 fundos de 05/10; pelo ticker quando o nome não bate.
 *
 * @param {FundoDoEstoque[]} fundos
 * @param {{nome: string, ticker: string|null}} fundo  o fundo da prateleira
 * @returns {FundoDoEstoque|null}
 */
export const procurarNoEstoque = (fundos, fundo) => {
  const chave = chaveDoFundo(fundo.nome);
  return (
    fundos.find((f) => chaveDoFundo(f.nome) === chave) ??
    (fundo.ticker ? fundos.find((f) => f.ticker === fundo.ticker) : null) ??
    null
  );
};
