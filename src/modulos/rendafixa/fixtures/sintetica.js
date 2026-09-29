/**
 * Planilha sintética no formato da exportação da XP ("Produtos de Renda Fixa – Emissão Bancária",
 * 34 colunas), para os testes de golden que rodam sem as exportações reais.
 *
 * As exportações reais ficam fora do git (o repositório é público); esta aqui é inventada linha a
 * linha para passar por todas as regras do motor: as quatro categorias, % do CDI × CDI + spread,
 * isentos dentro e fora dos prazos, o mercado secundário com o emissor tirado do nome, os bloqueios
 * de público e cada motivo de descarte. Emissores e taxas são fictícios.
 *
 * O formato das células imita o que o SheetJS devolve da planilha real: vencimento como Date à
 * meia-noite de Brasília (03:00 UTC), taxa como texto ("IPC-A + 7,45%"), célula vazia como
 * `undefined` e Data de Emissão como " " no primário.
 */

const CABECALHO = [
  'Ativo', 'Ticker', 'Instrumento', 'Indexador', 'Juros', 'Primeira Data de Juros', 'Amortização',
  'Primeira Data de Amortização', 'Isento', 'Rating', 'Risco', 'Vencimento', 'Tax.Mín', 'Tax.Máx',
  'Tax.Máx - Digital', 'Tax.Máx - Exclusive', 'Tax.Máx - Signature', 'Tax.Máx - Unique',
  'Tax.Máx - Private', 'ROA E. Aprox.', 'GrossUp Tax.Mín', 'GrossUp Tax.Máx',
  'GrossUp Tax.Máx - Digital', 'GrossUp Tax.Máx - Exclusive', 'GrossUp Tax.Máx - Signature',
  'GrossUp Tax.Máx - Unique', 'GrossUp Tax.Máx - Private', 'Taxa de Emissão', 'Data de Emissão',
  'Público', 'GrossDown Tax.Mín', 'GrossDown Tax.Máx', 'Carência', 'Qtd Mín.'
];

const INSTRUMENTO = {
  CDB: 'CERTIFICADO DE DEPÓSITO BANCÁRIO',
  LCA: 'LETRA DE CRÉDITO DO AGRONEGÓCIO',
  LCI: 'LETRA DE CRÉDITO IMOBILIÁRIO',
  LCD: 'LETRA DE CRÉDITO DO DESENVOLVIMENTO',
  LF: 'LETRA FINANCEIRA',
  CRA: 'CERTIFICADO DE RECEBÍVEIS DO AGRONEGÓCIO'
};

/** Meia-noite em Brasília, como o SheetJS entrega a célula de data da XP. */
const dia = (iso) => new Date(`${iso}T03:00:00.000Z`);

const linha = ({ ativo, ticker, instrumento, indexador, isento = 'N', vencimento, taxa, taxaMax, roa = '1,10%', emissao = ' ', publico = 'Investidor Geral', carencia = 30 }) => {
  const celulas = new Array(CABECALHO.length);
  celulas[0] = ativo;
  celulas[1] = ticker;
  celulas[2] = instrumento ?? INSTRUMENTO[ticker] ?? '';
  celulas[3] = indexador;
  celulas[4] = 'Vencimento';
  celulas[8] = isento;
  celulas[9] = 'brAA';
  celulas[11] = vencimento;
  celulas[12] = taxa;
  celulas[13] = taxaMax ?? taxa;
  celulas[19] = roa;
  celulas[27] = '';
  celulas[28] = emissao;
  celulas[29] = publico;
  celulas[32] = carencia;
  celulas[33] = 1;
  return celulas;
};

export const LINHAS_SINTETICAS = [
  // Um aviso acima do cabeçalho, como o logo e o rodapé de algumas exportações.
  ['Relatório de produtos — dados fictícios para teste'],
  CABECALHO,

  // Pré-fixados, 1 a 6 anos (o 6 fica fora da mensagem) e um empate no 2 (vence o primeiro).
  linha({ ativo: 'CDB BANCO ALFA S.A. - SET/2027', ticker: 'CDB', indexador: 'PRÉ', vencimento: dia('2027-09-23'), taxa: '14,20%' }),
  linha({ ativo: 'CDB BANCO BETA - SET/2028', ticker: 'CDB', indexador: 'PRÉ', vencimento: dia('2028-09-22'), taxa: '14,30%' }),
  linha({ ativo: 'CDB GAMA - SET/2028', ticker: 'CDB', indexador: 'PRÉ', vencimento: dia('2028-09-25'), taxa: '14,30%' }),
  linha({ ativo: 'CDB DELTA - SET/2029', ticker: 'CDB', indexador: 'PRÉ', vencimento: dia('2029-09-24'), taxa: '14,55%' }),
  linha({ ativo: 'LF BANCO EPSILON S/A - SET/2030', ticker: 'LF', indexador: 'PRÉ', vencimento: dia('2030-09-23'), taxa: '14,555%' }),
  linha({ ativo: 'CDB ZETA - SET/2031', ticker: 'CDB', indexador: 'PRÉ', vencimento: dia('2031-09-22'), taxa: '14,60%' }),
  linha({ ativo: 'CDB ETA - SET/2032', ticker: 'CDB', indexador: 'PRÉ', vencimento: dia('2032-09-23'), taxa: '15,00%' }),

  // Pós: % do CDI tem prioridade sobre CDI + spread no mesmo prazo; no 6 só há CDI + spread.
  linha({ ativo: 'CDB TETA - SET/2028', ticker: 'CDB', indexador: 'CDI', vencimento: dia('2028-09-22'), taxa: '105% CDI' }),
  linha({ ativo: 'CDB IOTA - SET/2028', ticker: 'CDB', indexador: 'CDI +', vencimento: dia('2028-09-22'), taxa: 'CDI + 1,20%' }),
  linha({ ativo: 'CDB KAPA - SET/2030', ticker: 'CDB', indexador: 'CDI', vencimento: dia('2030-09-23'), taxa: '106,5% CDI' }),
  linha({ ativo: 'CDB LAMBDA - SET/2032', ticker: 'CDB', indexador: 'CDI +', vencimento: dia('2032-09-23'), taxa: 'CDI + 0,80%' }),
  linha({ ativo: 'CDB MI - SET/2029', ticker: 'CDB', indexador: 'CDI', vencimento: dia('2029-09-24'), taxa: '110% CDI' }),

  // IPCA+ (escrito IPC-A, como na XP), 1 a 3 anos e um 4 fora da mensagem.
  linha({ ativo: 'CDB BANCO NI S.A. - SET/2027', ticker: 'CDB', indexador: 'IPC-A', vencimento: dia('2027-09-23'), taxa: 'IPC-A + 6,60%' }),
  linha({ ativo: 'CDB XI - SET/2028', ticker: 'CDB', indexador: 'IPC-A', vencimento: dia('2028-09-22'), taxa: 'IPC-A + 8,40%' }),
  linha({ ativo: 'CDB OMICRON - SET/2029', ticker: 'CDB', indexador: 'IPC-A', vencimento: dia('2029-09-24'), taxa: 'IPC-A + 8,15%' }),
  linha({ ativo: 'CDB PI - SET/2030', ticker: 'CDB', indexador: 'IPC-A', vencimento: dia('2030-09-23'), taxa: 'IPC-A + 9,00%' }),

  // Isentos: pré até 3 anos; CDI e IPCA só no vértice de 2 anos. LCA, LCI e LCD disputam juntas.
  linha({ ativo: 'LCA RO - SET/2027', ticker: 'LCA', indexador: 'PRÉ', vencimento: dia('2027-09-23'), taxa: '10,95%' }),
  linha({ ativo: 'LCI SIGMA - SET/2028', ticker: 'LCI', indexador: 'PRÉ', vencimento: dia('2028-09-22'), taxa: '11,83%' }),
  linha({ ativo: 'LCD TAU - SET/2028', ticker: 'LCD', indexador: 'PRÉ', vencimento: dia('2028-09-22'), taxa: '11,50%' }),
  linha({ ativo: 'LCA UPSILON - SET/2029', ticker: 'LCA', indexador: 'PRÉ', vencimento: dia('2029-09-24'), taxa: '12,12%' }),
  linha({ ativo: 'LCA FI - SET/2030', ticker: 'LCA', indexador: 'PRÉ', vencimento: dia('2030-09-23'), taxa: '12,50%' }),
  linha({ ativo: 'LCA CHI - SET/2028', ticker: 'LCA', indexador: 'CDI', vencimento: dia('2028-09-22'), taxa: '89% CDI' }),
  linha({ ativo: 'LCA PSI - SET/2029', ticker: 'LCA', indexador: 'CDI', vencimento: dia('2029-09-24'), taxa: '95% CDI' }),
  linha({ ativo: 'LCI OMEGA - SET/2028', ticker: 'LCI', indexador: 'IPC-A', vencimento: dia('2028-09-22'), taxa: 'IPC-A + 5,20%' }),
  // Isento pela coluna, não pelo tipo.
  linha({ ativo: 'CDB ISENTO - SET/2027', ticker: 'CDB', indexador: 'PRÉ', isento: 'S', vencimento: dia('2027-09-23'), taxa: '11,00%' }),

  // Bloqueados: público restrito.
  linha({ ativo: 'CDB RESTRITO - SET/2028', ticker: 'CDB', indexador: 'PRÉ', vencimento: dia('2028-09-22'), taxa: '18,00%', publico: 'Investidor Qualificado' }),
  linha({ ativo: 'LF PROFISSIONAL - SET/2029', ticker: 'LF', indexador: 'PRÉ', vencimento: dia('2029-09-24'), taxa: '19,00%', publico: 'Investidor Profissional' }),

  // Descartes.
  linha({ ativo: 'CDB DIARIO - SET/2028', ticker: 'CDB', indexador: 'CDI', vencimento: dia('2028-09-22'), taxa: '100% CDI', carencia: 'Diária' }),
  // Sem taxa em célula nenhuma. Com o ROA preenchido, o motor original leria o ROA como taxa
  // (ver docs/ROADMAP.md); a linha seguinte registra esse comportamento.
  linha({ ativo: 'CDB SEM TAXA - SET/2028', ticker: 'CDB', indexador: 'PRÉ', vencimento: dia('2028-09-22'), taxa: '', taxaMax: '', roa: '' }),
  linha({ ativo: 'CDB SO ROA - SET/2031', ticker: 'CDB', indexador: 'PRÉ', vencimento: dia('2031-09-22'), taxa: '', taxaMax: '' }),
  linha({ ativo: 'CDB QUEBRADO - JAN/2028', ticker: 'CDB', indexador: 'PRÉ', vencimento: dia('2028-01-15'), taxa: '16,00%' }),
  linha({ ativo: 'CDB CURTO - JAN/2027', ticker: 'CDB', indexador: 'PRÉ', vencimento: dia('2027-01-15'), taxa: '16,00%' }),
  linha({ ativo: 'NTN-B 2028', ticker: 'NTNB', instrumento: 'TÍTULO PÚBLICO', indexador: 'IPC-A', vencimento: dia('2028-09-22'), taxa: 'IPC-A + 9,90%' }),
  // Sem Tax.Mín: o motor procura qualquer célula com "%" na linha (aqui, a Tax.Máx).
  linha({ ativo: 'CDB SO MAXIMA - SET/2029', ticker: 'CDB', indexador: 'PRÉ', vencimento: dia('2029-09-24'), taxa: undefined, taxaMax: '14,70%' }),

  // Mercado secundário: Data de Emissão preenchida. O emissor sai do nome do ativo.
  linha({ ativo: 'CDB BANCO DIGIMAIS S.A. - SET/2028', ticker: '26I1CDB8XR3', instrumento: 'CERTIFICADO DE DEPÓSITO BANCÁRIO', indexador: 'CDI', vencimento: dia('2028-09-22'), taxa: '121% CDI', emissao: dia('2024-09-20') }),
  linha({ ativo: 'CDB MASTER S/A - SET/2027', ticker: 'CDB', indexador: 'PRÉ', vencimento: dia('2027-09-23'), taxa: '15,40%', emissao: dia('2023-09-21') }),
  linha({ ativo: 'CDB PINE - SET/2029', ticker: 'CDB', indexador: 'IPC-A', vencimento: dia('2029-09-24'), taxa: 'IPC-A + 7,85%', emissao: dia('2022-09-26') }),
  linha({ ativo: 'LCD BNDES - SET/2028', ticker: '26I1LCD8XR3', instrumento: 'LETRA DE CRÉDITO DO DESENVOLVIMENTO', indexador: 'CDI +', vencimento: dia('2028-09-22'), taxa: 'CDI + 0,50%', emissao: dia('2025-09-22') }),
  linha({ ativo: 'CDB FIBRA - SET/2030', ticker: 'CDB', indexador: 'CDI +', vencimento: dia('2030-09-23'), taxa: 'CDI + 1,10%', emissao: dia('2024-09-23') }),

  // Linha vazia no meio, como sobra de formatação.
  []
];
