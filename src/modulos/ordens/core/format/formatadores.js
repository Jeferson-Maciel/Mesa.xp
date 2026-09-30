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
 * Corpo de um ativo no e-mail: quatro linhas consecutivas, sem linha em branco entre elas.
 * A segunda linha é `Quantidade` ou `Valor`, nunca as duas (invariante 2).
 */
const blocoDeAtivo = (ordem) => {
  const valor = porFinanceiro(ordem)
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
 */
const molduraDoEmail = (solicitacao) => {
  const varias = solicitacao.ordens.length > 1;

  return {
    abertura: [
      'Prezado(a) Cliente,',
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
