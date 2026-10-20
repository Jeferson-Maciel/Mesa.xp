import { formatarCotas } from '../secundario/venda.js';
import { formatarFinanceiro } from '../util/dinheiro.js';
import { esc } from '../util/html.js';

/**
 * Última etapa do pipeline: da solicitação conferida ao texto que o operador copia.
 *
 * Os formatadores **não decidem nada**. Recebem dados já validados e apenas os escrevem no
 * literal exato que cada destino espera — o corpo do e-mail, ou o TSV que vai ser colado numa
 * planilha. A única regra que aplicam é a que não depende de julgamento: preço ausente vira
 * `A mercado` (invariante 4).
 *
 * Os literais são a especificação em `docs/FORMATOS-DE-SAIDA.md`. Um ponto-e-vírgula a mais
 * quebra o padrão do e-mail; um espaço no lugar de um TAB quebra a colagem no Excel.
 */

const OBSERVACOES =
  'Observações importantes: Toda solicitação lançada no sistema antes do leilão de encerramento ' +
  'sofrerá tentativa de processamento no mesmo dia. Toda solicitação lançada após o leilão de ' +
  'encerramento sofrerá tentativa de processamento no próximo dia útil.';

const POR_EXTENSO = { C: 'Compra', V: 'Venda' };

const precoDe = (ordem) => ordem.preco ?? 'A mercado';

const porFinanceiro = (ordem) => ordem.financeiro !== null && ordem.financeiro !== undefined;

/**
 * Fundo cetipado pedido em R$, já convertido em cotas pela planilha do secundário: o e-mail de fundo
 * leva a quantidade (decisão do operador, 05/10/2026). A conversão foi feita e mostrada no cartão
 * antes daqui (`core/secundario`); este formatador só a escreve.
 */
const cotasDoSecundario = (ordem) => {
  const sec = ordem.secundario;
  return sec?.situacao === 'pronto' && sec.porValor && sec.cotas > 0 ? sec.cotas : null;
};

/**
 * Corpo de um ativo no e-mail: quatro linhas consecutivas, sem linha em branco entre elas.
 * A segunda linha é `Quantidade` ou `Valor`, nunca as duas (invariante 2).
 */
const blocoDeAtivo = (ordem) => {
  const cotas = cotasDoSecundario(ordem);
  const valor =
    cotas !== null
      ? 'Quantidade: ' + cotas + ';'
      : porFinanceiro(ordem)
        ? 'Valor: ' + formatarFinanceiro(ordem.financeiro) + ';'
        : 'Quantidade: ' + ordem.quantidade + ';';

  return [
    'Ativo: ' + ordem.ativo + ';',
    valor,
    'Preço: ' + precoDe(ordem),
    'Operação: ' + (POR_EXTENSO[ordem.operacao] ?? '')
  ].join('\n');
};

/**
 * O que vem antes e depois do corpo, igual nos dois e-mails. A ordem e a auditoria diferem só
 * no corpo: blocos de texto numa, a tabela do Lote Simples na outra.
 *
 * A saudação leva o nome completo do cliente quando o robô o trouxe do Hub (`solicitacao.cliente`,
 * já com as maiúsculas arrumadas — decidido com o operador em 07/10/2026); sem ele, "Cliente".
 */
const molduraDoEmail = (solicitacao) => {
  const varias = solicitacao.ordens.length > 1;

  return {
    abertura: [
      `Prezado(a) ${solicitacao.cliente?.nome || 'Cliente'},`,
      '',
      'Conforme conversado, gostaria de realizar ' +
        (varias ? 'as ordens abaixo' : 'a ordem abaixo') +
        ' na conta XP ' +
        solicitacao.conta +
        ':'
    ],
    fecho: [
      OBSERVACOES,
      '',
      'Aguardo confirmação para realizar ' + (varias ? 'as ordens' : 'a ordem') + '.',
      '',
      'Att,'
    ]
  };
};

/**
 * @param {object} solicitacao
 * @returns {string} o e-mail pronto para copiar
 */
export const formatarEmail = (solicitacao) => {
  const { abertura, fecho } = molduraDoEmail(solicitacao);
  return [...abertura, '', solicitacao.ordens.map(blocoDeAtivo).join('\n\n'), '', ...fecho].join('\n');
};

/**
 * A auditoria de venda de fundo do secundário, no modelo que o operador trouxe em 20/10/2026 e que o
 * cliente aprova: sem preço e sem as observações do leilão, com "Operação: Venda;" (com
 * ponto-e-vírgula) e, depois de cada ativo, "Condições:" com o print da cotação. O fecho é "atte,".
 * O plural segue os outros e-mails (decisão do operador).
 *
 * A quantidade de uma venda do total é a posição disponível que o robô leu na boleta (`o.venda`),
 * com as 8 casas do campo da boleta quando é fracionada (`123,45678910`).
 *
 * Devolve as partes, na ordem, para o texto e o HTML saírem iguais: `{texto}` é uma linha;
 * `{cotacao: ordem}` é o lugar do print daquela ordem, que só o HTML preenche.
 */
const partesDaVenda = (solicitacao) => {
  const varias = solicitacao.ordens.length > 1;
  const linha = (texto) => ({ texto });

  return [
    linha(`Prezado(a) ${solicitacao.cliente?.nome || 'Cliente'},`),
    linha(
      'Conforme conversado, gostaria de realizar ' +
        (varias ? 'as ordens abaixo' : 'a ordem abaixo') +
        ` na conta XP ${solicitacao.conta}, conforme condições abaixo:`
    ),
    linha(''),
    ...solicitacao.ordens.flatMap((o) => [
      linha('Ativo: ' + o.ativo + ';'),
      linha('Quantidade: ' + formatarCotas(o.venda?.quantidade ?? o.quantidade) + ';'),
      linha('Operação: Venda;'),
      linha(''),
      linha('Condições:'),
      { cotacao: o },
      linha('')
    ]),
    linha('atte,')
  ];
};

/** @returns {string} a auditoria de venda em texto: o lugar dos prints fica vazio. */
export const formatarEmailVenda = (solicitacao) =>
  partesDaVenda(solicitacao)
    .filter((p) => 'texto' in p)
    .map((p) => p.texto)
    .join('\n');

/**
 * @param {object} solicitacao
 * @param {{prints?: Map<object, string>}} [opcoes]  o print (data URL de imagem) de cada ordem
 * @returns {string} a auditoria de venda em HTML, com cada print logo abaixo de "Condições:"
 */
export const formatarEmailVendaHtml = (solicitacao, { prints = new Map() } = {}) => {
  const html = [];
  for (const parte of partesDaVenda(solicitacao)) {
    if ('texto' in parte) {
      html.push(esc(parte.texto));
      continue;
    }
    const print = prints.get(parte.cotacao);
    if (print && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(print)) {
      html[html.length - 1] += `<br><img src="${print}" alt="Cotação de ${esc(parte.cotacao.ativo)}" style="max-width:100%">`;
    }
  }
  return '<div>' + html.join('<br>') + '</div>';
};

/**
 * A aplicação no Tesouro Direto, no modelo que o operador trouxe em 20/10/2026 (assunto "Confirmação
 * aplicação Tesouro Direto"): por valor em R$, com o título, a taxa e o vencimento como a lista do
 * Hub os mostra, lida na hora pelo robô (\`ordem.tesouroDoHub\`). Os espaços no fim das linhas do modelo
 * colado não entram; as duas linhas em branco antes e depois dos títulos, sim. Plural como os outros.
 */
export const formatarEmailTesouro = (solicitacao) => {
  const varias = solicitacao.ordens.length > 1;
  const blocos = solicitacao.ordens.map((o) => {
    const titulo = o.tesouroDoHub?.titulo ?? {};
    return [
      'Título: ' + (titulo.nome ?? o.ativo) + ';',
      'Taxa: ' + (titulo.taxa ?? '') + ';',
      'Vencimento: ' + (titulo.vencimento ?? '') + ';',
      'Valor a ser aplicado: ' + formatarFinanceiro(o.financeiro)
    ].join('\n');
  });

  return [
    `Prezado(a) ${solicitacao.cliente?.nome || 'Cliente'},`,
    '',
    'Conforme conversado, gostaria de realizar ' +
      (varias ? 'as ordens' : 'a ordem') +
      ` para a aplicação no Tesouro Direto abaixo na conta XP ${solicitacao.conta}:`,
    '',
    '',
    blocos.join('\n\n'),
    '',
    '',
    'Observação importante: O valor financeiro total da aplicação e o PU de compra dependem da cotação atual do mercado.',
    '',
    'Aguardo confirmação para realizar ' + (varias ? 'as ordens' : 'a ordem') + '.',
    '',
    'Att,'
  ].join('\n');
};

/**
 * O resgate no Tesouro Direto, no modelo que o operador trouxe em 20/10/2026 (assunto "Confirmação
 * resgate Tesouro Direto"): o título e o vencimento da posição do cliente, lida pelo robô
 * (`ordem.resgateDoHub`), e o valor a ser resgatado — o pedido, ou, no total, o valor disponível. Sem
 * taxa, uma linha em branco entre as partes, e o fecho "atte,". Plural como os outros.
 */
export const formatarEmailResgateTesouro = (solicitacao) => {
  const varias = solicitacao.ordens.length > 1;
  const blocos = solicitacao.ordens.map((o) => {
    const rg = o.resgateDoHub;
    const valor = rg?.situacao === 'pronto' ? rg.valor : o.financeiro;
    return [
      'Título: ' + (rg?.posicao?.nome ?? o.ativo) + ';',
      'Vencimento: ' + (rg?.posicao?.vencimento ?? '') + ';',
      'Valor a ser resgatado: ' + (valor === null || valor === undefined ? '' : formatarFinanceiro(valor))
    ].join('\n');
  });

  return [
    `Prezado(a) ${solicitacao.cliente?.nome || 'Cliente'},`,
    '',
    'Conforme conversado, gostaria de realizar ' +
      (varias ? 'as ordens para os resgates' : 'a ordem para o resgate') +
      ` no Tesouro Direto abaixo na conta XP ${solicitacao.conta}:`,
    '',
    blocos.join('\n\n'),
    '',
    'Observação importante: O valor financeiro total do resgate e o PU de venda dependem da cotação atual do mercado.',
    '',
    'Aguardo confirmação para realizar ' + (varias ? 'os resgates' : 'o resgate') + '.',
    '',
    'atte,'
  ].join('\n');
};

const tsv = (cabecalho, linhas) =>
  [cabecalho.join('\t'), ...linhas.map((l) => l.join('\t'))].join('\n') + '\n';

/** Células do Lote Simples, o TSV que é colado na planilha da XP. */
const tabelaLoteSimples = (solicitacao) => ({
  cabecalho: ['Estratégia', 'Cliente', 'Ativo', 'C/V', 'Preço', 'Qtd. Total'],
  linhas: solicitacao.ordens.map((o) => [
    'Simples',
    solicitacao.conta,
    o.ativo,
    o.operacao,
    precoDe(o),
    String(o.quantidade)
  ])
});

/** @returns {string} TSV do Lote Simples, pronto para colar na planilha */
export const formatarLoteSimples = (solicitacao) => {
  const { cabecalho, linhas } = tabelaLoteSimples(solicitacao);
  return tsv(cabecalho, linhas);
};

/**
 * As tabelas do e-mail: Ativo, C/V, Preço e a coluna de valor, que diz o tipo do valor.
 *
 * É o Lote Simples **sem `Estratégia` e sem `Cliente`** (pedido do operador em 30/09): o e-mail vai
 * para o cliente, "Simples" é coisa da planilha da XP, e a conta já está na frase de abertura. O
 * Lote Simples em TSV continua com as duas, porque a planilha precisa delas.
 *
 * Cesta por quantidade termina em `Qtd. Total`; em reais, em `Financeiro`. Cesta mista vira
 * **duas tabelas**, a de financeiro primeiro — decisão do operador, no lugar de uma tabela só com
 * uma coluna vazia em cada linha. Dentro de cada uma, os ativos seguem a ordem do pedido
 * (invariante 9).
 *
 * @returns {Array<{cabecalho: string[], linhas: string[][]}>}
 */
const tabelasDoEmail = (solicitacao) => {
  const tabela = (ordens, coluna, valor) => ({
    cabecalho: ['Ativo', 'C/V', 'Preço', coluna],
    linhas: ordens.map((o) => [o.ativo, o.operacao, precoDe(o), valor(o)])
  });

  const emReais = solicitacao.ordens.filter(porFinanceiro);
  const emQuantidade = solicitacao.ordens.filter((o) => !porFinanceiro(o));

  const tabelas = [
    emReais.length > 0 ? tabela(emReais, 'Financeiro', (o) => formatarFinanceiro(o.financeiro)) : null,
    emQuantidade.length > 0 ? tabela(emQuantidade, 'Qtd. Total', (o) => String(o.quantidade)) : null
  ].filter(Boolean);

  return tabelas.length > 0 ? tabelas : [tabela([], 'Qtd. Total', () => '')];
};

/**
 * @returns {string} o e-mail em tabela, em texto: o e-mail com as tabelas em TSV no corpo.
 *
 * Vai junto com o HTML, para onde HTML não entra. O TSV termina em quebra de linha, e por isso há
 * duas linhas em branco depois de cada tabela — exatamente como no exemplo que o operador trouxe.
 */
export const formatarAuditoria = (solicitacao) => {
  const { abertura, fecho } = molduraDoEmail(solicitacao);
  const corpo = tabelasDoEmail(solicitacao)
    .map(({ cabecalho, linhas }) => tsv(cabecalho, linhas))
    .join('\n\n');
  return [...abertura, '', corpo, '', ...fecho].join('\n');
};

// Grade simples, como "Todas as bordas" no Excel. Nada de fonte, fundo ou negrito: o operador cola
// no Outlook na web, que dá ao que chega sem fonte a fonte da própria mensagem — declarar uma foi o
// que fez a tabela destoar do resto do e-mail. `<td>` também no cabeçalho, porque `<th>` sai em
// negrito e centralizado por padrão.
const CELULA = 'border:1px solid #000000;padding:1px 6px;text-align:left;white-space:nowrap';

/**
 * @returns {string} a auditoria em HTML: o mesmo e-mail de `formatarAuditoria`, com as tabelas em
 * grade no lugar do TSV. Mesmas células, na mesma ordem. Entre duas tabelas, duas linhas em branco.
 */
export const formatarAuditoriaHtml = (solicitacao) => {
  const { abertura, fecho } = molduraDoEmail(solicitacao);

  const linha = (valores) =>
    '<tr>' + valores.map((v) => `<td style="${CELULA}">${esc(v)}</td>`).join('') + '</tr>';

  const tabelas = tabelasDoEmail(solicitacao)
    .map(
      ({ cabecalho, linhas }) =>
        '<table style="border-collapse:collapse">' + [cabecalho, ...linhas].map(linha).join('') + '</table>'
    )
    .join('<br><br>');

  const texto = (partes) => partes.map(esc).join('<br>');

  return '<div>' + texto(abertura) + '<br><br>' + tabelas + '<br>' + texto(fecho) + '</div>';
};

/**
 * @returns {string} TSV do Lote TWAP.
 *
 * As duas formas de preencher são exclusivas: por quantidade, `Financeiro` fica vazio; por
 * financeiro, `Qtd. Total` fica vazio. `Preço Would` e as horas só saem preenchidas com
 * informação explícita (invariante 11).
 */
export const formatarLoteTwap = (solicitacao) => {
  const horario = solicitacao.horario ?? { inicial: '', final: '' };

  return tsv(
    [
      'Estratégia',
      'Cliente',
      'Ativo',
      'C/V',
      'Qtd. Total',
      'Financeiro',
      'Preço',
      'Preço Would',
      'Hora Inicial',
      'Hora Final'
    ],
    solicitacao.ordens.map((o) => [
      'TWAP',
      solicitacao.conta,
      o.ativo,
      o.operacao,
      porFinanceiro(o) ? '' : String(o.quantidade),
      porFinanceiro(o) ? formatarFinanceiro(o.financeiro) : '',
      precoDe(o),
      '',
      horario.inicial,
      horario.final
    ])
  );
};
