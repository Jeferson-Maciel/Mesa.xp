/**
 * Da planilha à matriz que o motor lê.
 *
 * É o caminho do `handleFile` original: só a primeira aba, datas como `Date` e cada linha como
 * uma lista de células (`header: 1`). O SheetJS chega por parâmetro para os testes lerem as
 * planilhas com a mesma cópia vendorizada que vai no build.
 *
 * A leitura acontece inteira no navegador: a planilha nunca sai da máquina do assessor.
 *
 * @param {ArrayBuffer | Uint8Array} dados o conteúdo do arquivo
 * @param {typeof import('../../vendor/xlsx.full.min.js')} XLSX
 * @returns {{ aba: string, rows: unknown[][] }}
 */
export const lerPlanilha = (dados, XLSX) => {
  const workbook = XLSX.read(dados, { type: 'array', cellDates: true });
  const aba = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[aba], { header: 1 });
  return { aba, rows };
};
