/**
 * O Tesouro Direto no Ordens: reconhecer o título no pedido e achá-lo na lista do Hub.
 *
 * Decidido com o operador em 20/10/2026. A aplicação vai num e-mail próprio ("Confirmação aplicação
 * Tesouro Direto"), **por valor em R$**, com o título, a taxa e o vencimento da lista do Hub lida na
 * hora pelo robô (a taxa muda ao longo do dia: o Prefixado 2029 passou de 12,58% para 12,63% em
 * minutos). Nada é convertido em títulos — o modelo avisa que o PU e o valor final dependem da cotação.
 *
 * A lista vista no Hub de verdade (`/new/renda-fixa/#/produtos/tesouro-direto`, que só aparece com um
 * cliente escolhido) vem de `rede-treasury/v1/customers/<conta>/available-assets`, em `data.items[]`:
 *
 *   codeBonds 212 · descTypeBond "LFT" · nickname "Tesouro Selic 2031" ·
 *   expirateDate "2031-03-01T00:00:00-03:00" · profitability "SELIC + 0,0992 %" (já como o Hub mostra)
 *   · buyValue 20043.37 · minimumInvestmentValue 200.43 · descIndex "SELIC" · riskScore 1
 *
 * Uma conta não habilitada responde com erro ("já existe outra conta XP Inc atrelada ao CPF").
 *
 * Como o assessor escreve (o pedido real de 20/10 e as variações combinadas): "Tesouro Selic 2031",
 * "LFT", "Selic 2031", "Pré 2029", "IPCA+ 2045 juros semestrais", "NTN-B 2045", "Renda+ 2065",
 * "Educa+ 2030". Sem o vencimento, vale o único título daquele tipo na lista, com aviso (decisão do
 * operador); com mais de um, o operador escolhe.
 */

/** As espécies de título, pelo nome que o Tesouro dá a eles. */
const ESPECIES = [
  ['selic', /\bselic\b/i],
  ['prefixado-juros', /prefixado\s+com\s+juros/i],
  ['prefixado', /prefixado/i],
  ['ipca-juros', /ipca\+?\s+com\s+juros/i],
  ['ipca', /ipca/i],
  ['educa', /educa\+/i],
  ['renda', /renda\+/i],
  ['reserva', /reserva/i]
];

/** @returns {string|null} a espécie do título pelo nome do Hub ("Tesouro Selic 2031" → "selic") */
export const especieDoNome = (nome) => ESPECIES.find(([, padrao]) => padrao.test(String(nome ?? '')))?.[0] ?? null;

// Os códigos técnicos, que o assessor também usa.
const CODIGOS = [
  [/\bntn-?b\s*1\b/i, { especies: ['educa', 'renda'] }],
  [/\bntn-?b\s+principal\b/i, { especies: ['ipca'] }],
  [/\bntn-?b\b/i, { especies: ['ipca-juros'] }],
  [/\bntn-?f\b/i, { especies: ['prefixado-juros'] }],
  [/\bltn\b/i, { especies: ['prefixado'] }],
  [/\blft\b/i, { especies: ['selic'] }]
];

const COM_JUROS = /com\s+juros|juros\s+semestrais|\bsemestral/i;
const SEM_JUROS = /sem\s+juros|principal/i;
const ANO = /\b(20\d\d)\b/;
const PALAVRA_TESOURO = /\btesouro\b/i;

/** Os tipos escritos por extenso: o que cada palavra pode ser. */
const TIPOS = [
  [/\bselic\b/i, ['selic']],
  // O `\b` do JS não vê o "é" como letra: "Pré" precisa do fim de palavra que respeita acento.
  [/\bprefixad[oa]\b|\bpr[ée](?![a-zà-ÿ])/i, ['prefixado', 'prefixado-juros']],
  [/\bipca\b\+?/i, ['ipca', 'ipca-juros']],
  [/\beduca\s*\+/i, ['educa']],
  [/\brenda\s*\+/i, ['renda']],
  [/\breserva\b/i, ['reserva']]
];

/**
 * O título de Tesouro que uma linha pede, ou null quando ela não é de Tesouro.
 *
 * É de Tesouro a linha que diz "Tesouro", ou um código (LFT, LTN, NTN-B, NTN-F), ou um tipo com o ano
 * (`Selic 2031`, `Pré 2029`). Quem chama confere antes se o nome não é de um fundo da prateleira — há
 * fundos com "Prefixado" e "Renda+" no nome.
 *
 * @returns {null | {especies: string[], ano: number|null, texto: string}}
 *   `especies`: as espécies possíveis (vazio é "qualquer uma", quando só disse "Tesouro Direto")
 */
export const pedidoDeTesouro = (linha) => {
  const texto = String(linha ?? '');
  const ano = Number(texto.match(ANO)?.[1]) || null;

  let especies = null;
  for (const [padrao, { especies: doCodigo }] of CODIGOS) {
    if (padrao.test(texto)) {
      especies = doCodigo;
      break;
    }
  }
  if (!especies) {
    const tipo = TIPOS.find(([padrao]) => padrao.test(texto));
    if (tipo) especies = tipo[1];
  }

  const ehTesouro = PALAVRA_TESOURO.test(texto) || (especies && (CODIGOS.some(([p]) => p.test(texto)) || ano));
  if (!ehTesouro) return null;

  especies = especies ?? [];
  // "com juros" e "sem juros" decidem entre o IPCA+ e o Prefixado de cada tipo.
  if (COM_JUROS.test(texto)) especies = especies.filter((e) => e.endsWith('-juros') || !['ipca', 'prefixado'].includes(e));
  else if (SEM_JUROS.test(texto)) especies = especies.filter((e) => !e.endsWith('-juros'));

  return { especies, ano, texto: texto.trim() };
};

/**
 * O título como o assessor o escreveu, sem o resto da linha: "Aplicar 10 mil no Tesouro Prefixado
 * 2029" → "Tesouro Prefixado 2029"; "C - IPCA+ 2045 juros semestrais 5k" → "IPCA+ 2045 juros
 * semestrais". É o que o cartão mostra no campo do ativo.
 */
export const nomeDoTitulo = (linha) => {
  const achado = String(linha ?? '').match(
    /(?:tesouro\s+(?:direto\s+)?)?(?:selic|prefixad[oa]|pr[ée](?![a-zà-ÿ])|ipca\b\+?|educa\s*\+|renda\s*\+(?:\s*aposentadoria\s+extra)?|reserva|lft|ltn|ntn-?b\s*1|ntn-?b(?:\s+principal)?|ntn-?f)(?:[^\d\n]*?\b20\d\d\b)?(?:\s+(?:com\s+juros(?:\s+semestrais)?|juros\s+semestrais|principal))?|tesouro\s+direto/i
  );
  return (achado?.[0] ?? String(linha ?? '')).replace(/\s+/g, ' ').trim();
};

/**
 * Tira da linha as palavras do título — o tipo, o código, o ano, "com juros" —, para ler o valor e a
 * operação do que sobra: senão o 2031 de "Selic 2031" vira quantidade.
 */
export const semOTitulo = (linha) =>
  String(linha ?? '')
    .replace(/\btesouro\s+direto\b|\btesouro\b/gi, ' ')
    .replace(/\bntn-?b\s*1\b|\bntn-?b\s+principal\b|\bntn-?[bf]\b|\bltn\b|\blft\b/gi, ' ')
    .replace(/\bselic\b|\bprefixad[oa]\b|\bpr[ée](?![a-zà-ÿ])|\bipca\b\+?|\beduca\s*\+|\brenda\s*\+|\breserva\b/gi, ' ')
    .replace(/\bcom\s+juros(\s+semestrais)?\b|\bjuros\s+semestrais\b|\bsem\s+juros\b|\bprincipal\b|\bsemestral\b/gi, ' ')
    .replace(/\baposentadoria\s+extra\b/gi, ' ')
    .replace(/\b20\d\d\b/g, ' ');

/**
 * Um título da lista do Hub, lido do que o robô entregou.
 *
 * @typedef {object} TituloDoTesouro
 * @property {number} codigo   o `codeBonds`, o mesmo da rota da boleta de resgate
 * @property {string} tipo     LFT, LTN, NTN-B, NTN-B1, NTN-F
 * @property {string} nome     "Tesouro Selic 2031"
 * @property {string|null} especie
 * @property {number|null} ano  o do nome (o Educa+ 2030 vence em 2034: vale o do nome, que é o que se pede)
 * @property {string} vencimento  'DD/MM/AAAA'
 * @property {string} taxa     como o Hub mostra: "SELIC + 0,0992 %"
 * @property {number|null} pu
 * @property {number|null} minimo  a aplicação mínima, em reais
 */

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** @returns {TituloDoTesouro[]} */
export const lerTitulosDoHub = (itens) =>
  (Array.isArray(itens) ? itens : [])
    .filter((i) => i && typeof i.nickname === 'string' && i.nickname.trim())
    .map((i) => {
      const nome = i.nickname.trim();
      const data = String(i.expirateDate ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
      return {
        codigo: numero(i.codeBonds),
        tipo: String(i.descTypeBond ?? ''),
        nome,
        especie: especieDoNome(nome),
        ano: Number(nome.match(/(20\d\d)\s*$/)?.[1]) || null,
        vencimento: data ? `${data[3]}/${data[2]}/${data[1]}` : '',
        taxa: String(i.profitability ?? '').trim(),
        pu: numero(i.buyValue),
        minimo: numero(i.minimumInvestmentValue)
      };
    });

/**
 * O título da lista que o pedido pede.
 *
 * @param {ReturnType<typeof pedidoDeTesouro>} pedido
 * @param {TituloDoTesouro[]} titulos
 * @returns {{situacao: 'exato'|'unico-do-tipo'|'ambiguo'|'nenhum', titulo?: TituloDoTesouro,
 *   candidatos: TituloDoTesouro[]}}
 */
export const acharTitulo = (pedido, titulos) => {
  const doTipo = titulos.filter((t) => pedido.especies.length === 0 || pedido.especies.includes(t.especie));
  const candidatos = pedido.ano ? doTipo.filter((t) => t.ano === pedido.ano) : doTipo;

  if (candidatos.length === 1) {
    return { situacao: pedido.ano && pedido.especies.length > 0 ? 'exato' : 'unico-do-tipo', titulo: candidatos[0], candidatos };
  }
  if (candidatos.length === 0) return { situacao: 'nenhum', candidatos: [] };
  return { situacao: 'ambiguo', candidatos };
};

/** Quanto tempo a taxa lida vale para o e-mail sem ler de novo: ela muda ao longo do dia. */
export const LIMITE_DA_TAXA_MIN = 10;

/**
 * O que a lista do Hub diz de uma ordem de Tesouro.
 *
 * @param {object} ordem  com `ordem.tesouro` (o pedido) e a operação
 * @param {{lista: {titulos?: TituloDoTesouro[], erro?: string, em: number}|null|undefined, hoje?: Date}} contexto
 */
export const tesouroDaOrdem = (ordem, { lista, hoje = new Date(), ehDiaUtil = () => true }) => {
  if (!ordem.tesouro) return null;
  const foraDoHorario = !noHorarioDoTesouro(hoje, ehDiaUtil);
  if (!lista) return { situacao: 'sem-lista', foraDoHorario };
  if (lista.erro) return { situacao: /habilitad/i.test(lista.erro) ? 'nao-habilitada' : 'erro', mensagem: lista.erro, foraDoHorario };

  const minutos = Math.floor((hoje.getTime() - lista.em) / 60000);
  const achado = acharTitulo(ordem.tesouro, lista.titulos ?? []);
  if (achado.situacao === 'nenhum' || achado.situacao === 'ambiguo') return { ...achado, lidaEm: lista.em, minutos, foraDoHorario };
  return {
    situacao: 'pronto',
    titulo: achado.titulo,
    unicoDoTipo: achado.situacao === 'unico-do-tipo',
    candidatos: achado.candidatos,
    lidaEm: lista.em,
    minutos,
    foraDoHorario
  };
};

/** Se a hora é de pregão do Tesouro Direto: dia útil, das 9h30 às 18h. */
export const noHorarioDoTesouro = (hoje, ehDiaUtil) => {
  const minutos = hoje.getHours() * 60 + hoje.getMinutes();
  return ehDiaUtil(hoje) && minutos >= 9 * 60 + 30 && minutos < 18 * 60;
};
