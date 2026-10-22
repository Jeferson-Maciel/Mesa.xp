/**
 * As regras do Renda Fixa, configuráveis na própria tela (decidido com o usuário em 21/10/2026: "todas
 * as configurações e regras que utilizamos modificáveis no site, sem login, no navegador de cada um").
 * Uma configuração para cada mercado — a emissão primária e o secundário.
 *
 * O padrão reproduz o RendaFixa Pro original, com uma exceção decidida pelo usuário: a taxa é procurada
 * só nas colunas de taxa (Tax.Mín, Tax.Máx, Taxa, Rentabilidade). O original, com a coluna de taxa
 * vazia, lia qualquer célula com "%" da linha, e o ROA virava taxa na mensagem do cliente; esse jeito
 * segue disponível (`taxaFora: 'qualquer-celula'`), e é com ele que os goldens provam o porte fiel.
 *
 * Funções puras: a tela (`telaDasRegras.js`) e o motor (`motor.js`) as usam; o navegador guarda a
 * configuração em `regrasSalvas.js`.
 */

export const MERCADOS = ['primario', 'secundario'];
export const SECOES = ['pre', 'pos', 'ipca', 'isentos'];
export const MARCADORES = ['prazo', 'tipo', 'taxa', 'emissor'];

const BASE = {
  filtros: {
    puMaximo: 1300,
    descartarQualificado: true,
    descartarProfissional: true,
    descartarLiquidezDiaria: true,
    taxaFora: 'colunas-de-taxa'
  },
  // Os prazos, em anos cheios, que entram na mensagem.
  prazos: { pre: [1, 2, 3, 4, 5], pos: [2, 4, 6], ipca: [1, 2, 3] },
  isentos: { tipos: ['LCA', 'LCI', 'LCD', 'CRI', 'CRA'], pre: [1, 2, 3], cdi: [2], ipca: [2] },
  // Para achar o emissor no nome do ativo, quando a planilha não tem a coluna.
  bancos: [
    'XP', 'BTG', 'ITAU', 'ITAÚ', 'BRADESCO', 'SANTANDER', 'SAFRA', 'BMG', 'DAYCOVAL', 'MASTER', 'PINE', 'C6', 'ABC', 'OMNI',
    'ORIGINAL', 'PAN', 'SOFISA', 'FIBRA', 'BARI', 'BRB', 'INTER', 'MERCANTIL', 'MAXIMA', 'MÁXIMA', 'PAULISTA', 'VOTORANTIM',
    'BV', 'CAIXA', 'MODAL', 'SICOOB', 'SICREDI', 'AGIBANK', 'SOCINAL', 'PERNAMBUCANAS', 'DIGIMAIS', 'FACTA'
  ],
  mensagem: {
    cabecalho: '*Oportunidades de RENDA FIXA hoje!* ⭐',
    titulos: {
      pre: '*Taxas pré fixadas:*',
      pos: '*Taxas Pós-fixadas:*',
      ipca: '*Taxas IPCA+:*',
      isentos: '*LCAs/LCIs ISENTA DE IR*'
    },
    linhas: {
      pre: '-> {prazo} - {tipo} {taxa}% a.a.{emissor}',
      posCdiMais: '-> {prazo} - {tipo} CDI + {taxa}% a.a.{emissor}',
      posCdi: '-> {prazo} - {tipo} {taxa}% CDI{emissor}',
      ipca: '-> {prazo} - {tipo} IPCA + {taxa}% a.a.{emissor}',
      isentoPre: '-> {prazo} – {tipo} {taxa}% a.a.{emissor}',
      isentoCdiMais: '-> {prazo} – {tipo} CDI +{taxa}%{emissor}',
      isentoCdi: '-> {prazo} – {tipo} {taxa}% CDI{emissor}',
      isentoIpca: '-> {prazo} – {tipo} IPCA +{taxa}%{emissor}'
    },
    mostrarEmissor: false,
    casas: 2,
    tirarZeros: true,
    prazoUm: '1 ano',
    prazoVarios: '{n} anos',
    ordem: ['pre', 'pos', 'ipca', 'isentos'],
    rodape: ''
  },
  avancado: {
    // O tipo pelo nome por extenso (sem acento, em minúsculas; "|" separa jeitos de escrever). Vem antes
    // da sigla, e na ordem: "Letra de Crédito do Desenvolvimento" contém "lc".
    tiposPorNome: [
      ['certificado de deposito bancario', 'CDB'],
      ['letra de credito do agronegocio', 'LCA'],
      ['letra de credito imobiliari', 'LCI'],
      ['letra de credito do desenvolvimento', 'LCD'],
      ['letra financeira', 'LF'],
      ['letra de cambio', 'LC'],
      ['certificado de recebiveis imobiliarios|certificados de recebiveis imobiliarios', 'CRI'],
      ['certificado de recebiveis do agronegocio|certificados de recebiveis do agronegocio', 'CRA'],
      ['debenture', 'DEBÊNTURE']
    ],
    siglas: ['CDB', 'LCA', 'LCI', 'LCD', 'LF', 'CRI', 'CRA', 'LC'],
    // O nome do cabeçalho de cada coluna, sem acento e em minúsculas. "trecho" = contém; "=texto" = igual;
    // "^texto" = começa com; "trecho -outro" = contém o trecho e não contém o outro. Várias colunas que
    // casam: vale a última; na taxa, a primeira (e as outras de taxa, na procura da taxa vazia).
    colunas: {
      tipo: ['tipo', 'ativo', 'produto', '=ticker'],
      instrumento: ['instrumento'],
      taxa: ['tax.min', 'tax.max', 'taxa', 'rentabilidade'],
      indexador: ['indexador', 'indice', 'remuneracao', 'benchmark', 'referencia'],
      vencimento: ['vencimento', 'prazo', 'vertice'],
      liquidez: ['liquidez', 'carencia'],
      emissor: ['emissor', 'banco', 'instituicao', 'contraparte'],
      emissao: ['=data de emissao', 'emissao -taxa'],
      pu: ['=p.u', '=pu', 'unitario', 'p.u.'],
      publico: ['publico', 'alvo', 'destinatario', 'investidor'],
      isento: ['^isento', 'isencao']
    },
    palavrasDoCabecalho: ['taxa', 'ativo', 'instrumento', 'vencimento', 'rentabilidade', 'juros']
  }
};

const copiar = (valor) => JSON.parse(JSON.stringify(valor));

/** As regras padrão de um mercado: a mesma base; no secundário, o emissor na mensagem e o cabeçalho dele. */
export const regrasPadrao = (mercado) => {
  const regras = copiar(BASE);
  if (mercado === 'secundario') {
    regras.mensagem.mostrarEmissor = true;
    regras.mensagem.cabecalho = '*Oportunidades de RENDA FIXA hoje!* ⭐ (MERCADO SECUNDÁRIO)';
  }
  return regras;
};

/** As regras do RendaFixa Pro original (a taxa em qualquer célula com "%"): com elas, os goldens. */
export const regrasDoOriginal = (mercado) => {
  const regras = regrasPadrao(mercado);
  regras.filtros.taxaFora = 'qualquer-celula';
  return regras;
};

/* ── Os rótulos de cada regra, para a tela e para as diferenças ────────────────────────── */

export const ROTULOS = {
  'filtros.puMaximo': 'PU máximo (R$)',
  'filtros.descartarQualificado': 'Descartar investidor qualificado',
  'filtros.descartarProfissional': 'Descartar investidor profissional',
  'filtros.descartarLiquidezDiaria': 'Descartar liquidez diária',
  'filtros.taxaFora': 'Coluna de taxa vazia',
  'prazos.pre': 'Prazos das pré-fixadas',
  'prazos.pos': 'Prazos das pós-fixadas',
  'prazos.ipca': 'Prazos das IPCA+',
  'isentos.tipos': 'Tipos isentos',
  'isentos.pre': 'Prazos dos isentos pré-fixados',
  'isentos.cdi': 'Prazos dos isentos em CDI',
  'isentos.ipca': 'Prazos dos isentos IPCA+',
  bancos: 'Bancos conhecidos',
  'mensagem.cabecalho': 'Cabeçalho da mensagem',
  'mensagem.titulos.pre': 'Título das pré-fixadas',
  'mensagem.titulos.pos': 'Título das pós-fixadas',
  'mensagem.titulos.ipca': 'Título das IPCA+',
  'mensagem.titulos.isentos': 'Título dos isentos',
  'mensagem.linhas.pre': 'Linha pré-fixada',
  'mensagem.linhas.posCdiMais': 'Linha pós CDI +',
  'mensagem.linhas.posCdi': 'Linha pós % do CDI',
  'mensagem.linhas.ipca': 'Linha IPCA+',
  'mensagem.linhas.isentoPre': 'Linha isento pré-fixado',
  'mensagem.linhas.isentoCdiMais': 'Linha isento CDI +',
  'mensagem.linhas.isentoCdi': 'Linha isento % do CDI',
  'mensagem.linhas.isentoIpca': 'Linha isento IPCA+',
  'mensagem.mostrarEmissor': 'Mostrar o emissor',
  'mensagem.casas': 'Casas da taxa',
  'mensagem.tirarZeros': 'Tirar o ",00"',
  'mensagem.prazoUm': 'Prazo de 1 ano',
  'mensagem.prazoVarios': 'Prazo de vários anos',
  'mensagem.ordem': 'Ordem das seções',
  'mensagem.rodape': 'Rodapé',
  'avancado.tiposPorNome': 'Tipo pelo nome',
  'avancado.siglas': 'Siglas',
  'avancado.colunas.tipo': 'Coluna do tipo',
  'avancado.colunas.instrumento': 'Coluna do instrumento',
  'avancado.colunas.taxa': 'Colunas de taxa',
  'avancado.colunas.indexador': 'Coluna do indexador',
  'avancado.colunas.vencimento': 'Coluna do vencimento',
  'avancado.colunas.liquidez': 'Coluna da liquidez',
  'avancado.colunas.emissor': 'Coluna do emissor',
  'avancado.colunas.emissao': 'Coluna da data de emissão',
  'avancado.colunas.pu': 'Coluna do PU',
  'avancado.colunas.publico': 'Coluna do público',
  'avancado.colunas.isento': 'Coluna de isento',
  'avancado.palavrasDoCabecalho': 'Palavras do cabeçalho'
};

export const NOMES_DAS_SECOES = { pre: 'Pré-fixadas', pos: 'Pós-fixadas', ipca: 'IPCA+', isentos: 'Isentos' };

/** Lê e escreve uma regra pelo caminho ("mensagem.titulos.pre"). */
export const valorDe = (regras, caminho) => caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), regras);
export const comValor = (regras, caminho, valor) => {
  const nova = copiar(regras);
  const partes = caminho.split('.');
  let alvo = nova;
  for (const k of partes.slice(0, -1)) alvo = alvo[k];
  alvo[partes.at(-1)] = valor;
  return nova;
};

/* ── A validação ───────────────────────────────────────────────────────────────────────── */

const ehAno = (n) => Number.isInteger(n) && n >= 1 && n <= 50;
const listaDeAnos = (lista) => Array.isArray(lista) && lista.every(ehAno);
const listaDeTextos = (lista, { vazia = true } = {}) =>
  Array.isArray(lista) && (vazia || lista.length > 0) && lista.every((t) => typeof t === 'string' && t.trim() !== '');
const marcadoresDe = (modelo) => [...String(modelo).matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);

/**
 * O que está errado nas regras, por caminho. Nada é trocado em silêncio: com erro, a tela não salva e
 * mostra o motivo, e vale a última regra boa.
 *
 * @returns {Record<string, string>} caminho → motivo
 */
export const validarRegras = (regras) => {
  const erros = {};
  const erro = (caminho, motivo) => {
    erros[caminho] ??= motivo;
  };
  if (!regras || typeof regras !== 'object') return { '': 'configuração vazia' };
  const { filtros = {}, prazos = {}, isentos = {}, mensagem = {}, avancado = {} } = regras;

  if (!(typeof filtros.puMaximo === 'number' && Number.isFinite(filtros.puMaximo) && filtros.puMaximo > 0)) erro('filtros.puMaximo', 'um valor em reais, maior que zero');
  for (const chave of ['descartarQualificado', 'descartarProfissional', 'descartarLiquidezDiaria']) {
    if (typeof filtros[chave] !== 'boolean') erro(`filtros.${chave}`, 'ligado ou desligado');
  }
  if (!['colunas-de-taxa', 'qualquer-celula'].includes(filtros.taxaFora)) erro('filtros.taxaFora', 'uma das duas opções');

  for (const secao of ['pre', 'pos', 'ipca']) if (!listaDeAnos(prazos[secao])) erro(`prazos.${secao}`, 'anos inteiros de 1 a 50, separados por vírgula');
  if (!Array.isArray(isentos.tipos) || !isentos.tipos.every((t) => /^[A-ZÀ-Ú]{2,12}$/.test(t))) erro('isentos.tipos', 'siglas em maiúsculas, separadas por vírgula');
  for (const sub of ['pre', 'cdi', 'ipca']) if (!listaDeAnos(isentos[sub])) erro(`isentos.${sub}`, 'anos inteiros de 1 a 50, separados por vírgula');
  if (!listaDeTextos(regras.bancos)) erro('bancos', 'um banco por linha');

  if (typeof mensagem.cabecalho !== 'string') erro('mensagem.cabecalho', 'um texto');
  for (const secao of SECOES) if (typeof mensagem.titulos?.[secao] !== 'string') erro(`mensagem.titulos.${secao}`, 'um texto');
  for (const [chave, modelo] of Object.entries(BASE.mensagem.linhas)) {
    const linha = mensagem.linhas?.[chave];
    if (typeof linha !== 'string' || !linha.trim()) erro(`mensagem.linhas.${chave}`, `um modelo, como "${modelo}"`);
    else if (!marcadoresDe(linha).includes('taxa')) erro(`mensagem.linhas.${chave}`, 'o modelo precisa do {taxa}');
    else {
      const desconhecido = marcadoresDe(linha).find((m) => !MARCADORES.includes(m));
      if (desconhecido !== undefined) erro(`mensagem.linhas.${chave}`, `marcador desconhecido: {${desconhecido}} (use ${MARCADORES.map((m) => `{${m}}`).join(', ')})`);
    }
  }
  if (typeof mensagem.mostrarEmissor !== 'boolean') erro('mensagem.mostrarEmissor', 'ligado ou desligado');
  if (!(Number.isInteger(mensagem.casas) && mensagem.casas >= 0 && mensagem.casas <= 4)) erro('mensagem.casas', 'de 0 a 4');
  if (typeof mensagem.tirarZeros !== 'boolean') erro('mensagem.tirarZeros', 'ligado ou desligado');
  if (typeof mensagem.prazoUm !== 'string' || !mensagem.prazoUm.trim()) erro('mensagem.prazoUm', 'um texto, como "1 ano"');
  if (typeof mensagem.prazoVarios !== 'string' || !mensagem.prazoVarios.includes('{n}')) erro('mensagem.prazoVarios', 'um texto com {n}, como "{n} anos"');
  if (!Array.isArray(mensagem.ordem) || [...mensagem.ordem].sort().join() !== [...SECOES].sort().join()) erro('mensagem.ordem', 'as quatro seções, cada uma uma vez');
  if (typeof mensagem.rodape !== 'string') erro('mensagem.rodape', 'um texto');

  const pares = avancado.tiposPorNome;
  if (!Array.isArray(pares) || !pares.every((p) => Array.isArray(p) && p.length === 2 && String(p[0]).trim() && /^\S+$/.test(String(p[1]).trim()))) {
    erro('avancado.tiposPorNome', 'uma linha por tipo: "trecho do nome = SIGLA"');
  }
  if (!listaDeTextos(avancado.siglas, { vazia: false }) || !avancado.siglas.every((s) => /^[A-Za-z]{1,10}$/.test(s))) erro('avancado.siglas', 'siglas de letras, separadas por vírgula');
  for (const campo of Object.keys(BASE.avancado.colunas)) {
    const obrigatoria = ['taxa', 'vencimento'].includes(campo);
    if (!listaDeTextos(avancado.colunas?.[campo], { vazia: !obrigatoria })) erro(`avancado.colunas.${campo}`, obrigatoria ? 'ao menos um nome de coluna' : 'nomes de coluna, separados por vírgula');
  }
  if (!listaDeTextos(avancado.palavrasDoCabecalho, { vazia: false })) erro('avancado.palavrasDoCabecalho', 'ao menos uma palavra');
  return erros;
};

/**
 * As regras salvas por cima do padrão: o que falta (uma regra nova numa versão nova da Mesa) vem do
 * padrão, e o que sobra é ignorado. Se o resultado não for válido, volta o padrão, com `corrompidas`.
 */
export const juntarComPadrao = (salvas, mercado) => {
  const juntar = (base, por) => {
    if (Array.isArray(base) || base === null || typeof base !== 'object') return por === undefined ? base : por;
    return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, juntar(v, por?.[k])]));
  };
  return juntar(regrasPadrao(mercado), salvas && typeof salvas === 'object' ? salvas : {});
};

export const completarRegras = (salvas, mercado) => {
  if (!salvas || typeof salvas !== 'object') return { regras: regrasPadrao(mercado), corrompidas: false };
  const regras = juntarComPadrao(salvas, mercado);
  return Object.keys(validarRegras(regras)).length ? { regras: regrasPadrao(mercado), corrompidas: true } : { regras, corrompidas: false };
};

/* ── As diferenças para o padrão (o selo, e o que muda ao colar) ───────────────────────── */

const achatar = (regras) => Object.fromEntries(Object.keys(ROTULOS).map((caminho) => [caminho, valorDe(regras, caminho)]));

/** O valor de uma regra como a pessoa o lê. */
export const textoDoValor = (caminho, valor) => {
  if (typeof valor === 'boolean') return valor ? 'ligado' : 'desligado';
  if (caminho === 'filtros.taxaFora') return valor === 'qualquer-celula' ? 'qualquer célula com %' : 'só nas colunas de taxa';
  if (caminho === 'filtros.puMaximo') return Number(valor).toLocaleString('pt-BR');
  if (caminho === 'mensagem.ordem') return (valor ?? []).map((s) => NOMES_DAS_SECOES[s] ?? s).join(', ');
  if (caminho === 'avancado.tiposPorNome') return `${(valor ?? []).length} tipos`;
  if (caminho === 'bancos') return `${(valor ?? []).length} bancos`;
  if (Array.isArray(valor)) return valor.join(', ');
  const t = String(valor ?? '');
  return t === '' ? '(vazio)' : t.length > 60 ? `${t.slice(0, 57)}…` : t;
};

/**
 * O que difere entre duas configurações de um mercado, regra a regra.
 *
 * @returns {Array<{caminho: string, rotulo: string, de: string, para: string}>}
 */
export const diferencas = (de, para) => {
  const a = achatar(de);
  const b = achatar(para);
  return Object.keys(ROTULOS)
    .filter((caminho) => JSON.stringify(a[caminho]) !== JSON.stringify(b[caminho]))
    .map((caminho) => ({ caminho, rotulo: ROTULOS[caminho], de: textoDoValor(caminho, a[caminho]), para: textoDoValor(caminho, b[caminho]) }));
};

export const diferencasDoPadrao = (regras, mercado) => diferencas(regrasPadrao(mercado), regras);

/* ── Copiar e colar a configuração (sem login, entre colegas) ──────────────────────────── */

const CABECA = 'MESA XP · Renda Fixa · regras v1';

/** O texto para mandar a um colega: os dois mercados juntos. */
export const textoDaConfiguracao = (config) => `${CABECA}\n${JSON.stringify({ primario: config.primario, secundario: config.secundario })}`;

/**
 * A configuração colada: os dois mercados, completados e validados. Erro com o motivo se o texto não
 * for uma configuração da Mesa, ou se alguma regra for inválida.
 *
 * @returns {{primario: object, secundario: object}}
 */
export const lerConfiguracao = (texto) => {
  const t = String(texto ?? '');
  const inicio = t.indexOf('{');
  if (!t.includes(CABECA) || inicio < 0) throw new Error('Isto não é uma configuração do Renda Fixa da Mesa: copie de novo pelo "Copiar configuração".');
  let dados;
  try {
    dados = JSON.parse(t.slice(inicio));
  } catch {
    throw new Error('A configuração chegou cortada: copie de novo e cole o texto inteiro.');
  }
  const config = {};
  for (const mercado of MERCADOS) {
    if (!dados?.[mercado] || typeof dados[mercado] !== 'object') throw new Error('A configuração não traz os dois mercados: copie de novo pelo "Copiar configuração".');
    const regras = juntarComPadrao(dados[mercado], mercado);
    const erros = validarRegras(regras);
    if (Object.keys(erros).length) {
      const [caminho, motivo] = Object.entries(erros)[0];
      throw new Error(`A configuração tem uma regra inválida (${mercado === 'secundario' ? 'secundário' : 'primário'}, ${ROTULOS[caminho] ?? caminho}): ${motivo}.`);
    }
    config[mercado] = regras;
  }
  return config;
};
