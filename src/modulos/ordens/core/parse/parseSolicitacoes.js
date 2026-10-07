import { limparEntrada } from '../texto/limparEntrada.js';
import { analisarTicker, temFormatoDeTicker } from '../validate/ticker.js';
import { fundoPeloTicker, procurarFundo } from '../validate/fundo.js';
import { lerPreco, lerValor } from './valores.js';

/**
 * Segunda etapa do pipeline: das linhas limpas às solicitações estruturadas.
 *
 * A linha com o número da conta abre uma **nova solicitação**. Normalmente vem uma conta por
 * bloco colado, mas o grupo às vezes emenda duas, e misturar a conta de um cliente com o ativo
 * de outro é o pior erro que este sistema poderia cometer — daí a separação ser estrutural, e
 * não um detalhe do formatador.
 *
 * O que não dá para transformar em ordem completa não é chutado: vai para `descartadas` com o
 * motivo, e aparece no preview como linha a tratar na mão.
 *
 * @typedef {object} Ordem
 * @property {string} ativo
 * @property {import('../validate/ticker.js').DiagnosticoDeTicker} ticker
 * @property {'C'|'V'|null} operacao
 * @property {number|null} quantidade
 * @property {number|null} financeiro
 * @property {boolean} quantidadeSolta  a quantidade veio de um número sem unidade (`3.000`), e
 *   não de `3.000 cotas` — numa cesta em reais, é a linha que pode ter perdido os centavos
 * @property {string|null} preco  literal digitado, ou null quando não informado
 * @property {string} linha       a linha de origem, para o operador conferir
 *
 * @typedef {object} Solicitacao
 * @property {string|null} conta
 * @property {Ordem[]} ordens
 * @property {Array<{linha: string, motivo: string}>} descartadas
 * @property {{email: boolean, auditoria: boolean, lote: boolean, twap: boolean}} saidas
 * @property {{inicial: string, final: string}|null} horario
 */

/** Fim de palavra que respeita acento: o `\b` do JS não conhece o `ç` nem o `í`. */
const FIM = '(?![a-zà-ÿ0-9])';
const INICIO = '(?:^|[^a-zà-ÿ0-9])';

const tickersDe = (linha) => [
  ...new Set(
    linha
      .split(/[\s\-–—:;,()[\]]+/)
      .filter(temFormatoDeTicker)
      .map((t) => t.toUpperCase())
  )
];

/* ── Conta ────────────────────────────────────────────────────────────────────────────── */

const NUMERO_DE_CONTA = String.raw`(\d{5,8})(?!\d|[.,]\d)`;

const CONTA_ROTULADA = new RegExp(
  INICIO +
    String.raw`(?:cliente|conta\s*xp|conta|c\/c|cc|c[oó]d(?:igo)?\.?(?:\s*(?:do\s*)?cliente)?|xp)` +
    String.raw`\s*(?:n[º°o]\.?\s*)?[:\-]?\s*` +
    NUMERO_DE_CONTA,
  'i'
);

/** O número no começo da linha, com o que vier depois dele: nome do cliente ou contexto. */
const CONTA_NA_FRENTE = new RegExp('^' + NUMERO_DE_CONTA + String.raw`\s*(?:[-–—:]\s*)?(\D.*)?$`);

/** `10000 cotas`, `50000 reais cada`: cinco dígitos seguidos de unidade são valor, não conta. */
const UNIDADE_NO_INICIO = new RegExp(
  String.raw`^(?:reais|cotas?|a[çc][õo]es|pap[ée]is|qtd|qtds|qntds?|quantidades?|unidades?|milh[õo]es|milh[ãa]o|mil|mi|k|m|cada)` +
    FIM,
  'i'
);

const limparResto = (resto) => resto.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '');

/**
 * Lê a conta de uma linha, com o que sobrou dela.
 *
 * O resto não é descartado: `7000002 - compra via email` traz a operação e o formato do pedido
 * inteiro. Quando é só o nome do cliente (`80000005 - Fulana`), ele não entra na saída.
 *
 * @returns {{conta: string, resto: string}|null}
 */
const lerConta = (linha) => {
  const rotulada = linha.match(CONTA_ROTULADA);
  if (rotulada) return { conta: rotulada[1], resto: limparResto(linha.replace(rotulada[0], ' ')) };

  const naFrente = linha.match(CONTA_NA_FRENTE);
  if (!naFrente) return null;

  // `10000 - PETR4` começa com cinco dígitos e é uma ordem: lido como conta, abria uma solicitação
  // nova e o PETR4 sumia sem ir para os descartes.
  const resto = limparResto(naFrente[2] ?? '');
  if (UNIDADE_NO_INICIO.test(resto) || tickersDe(resto).length > 0) return null;

  return { conta: naFrente[1], resto };
};

/** Linha de ordem que começa com um número do tamanho de uma conta. */
const NUMERO_DE_CONTA_NA_FRENTE = new RegExp('^' + NUMERO_DE_CONTA);

/* ── Operação ─────────────────────────────────────────────────────────────────────────── */

const PALAVRAS_DE_COMPRA = new RegExp(
  INICIO +
    String.raw`(?:compra[rs]?|comprem?|compro|comprando|aquisi[çc][ãa]o|aplica[çc][ãa]o|aplicar|aplique|aportes?|aportar)` +
    FIM,
  'i'
);

const PALAVRAS_DE_VENDA = new RegExp(
  INICIO + String.raw`(?:vend[ae]r?|vendas|vendo|vendam|vendendo|resgat(?:e|es|ar)|sa[íi]das?)` + FIM,
  'i'
);

/**
 * A letra solta `C`/`V` só conta como token inteiro: sem isso, o `C` de `COIN11` viraria compra
 * e o `V` de `VALE3` viraria venda.
 */
const LETRA_DE_COMPRA = new RegExp(INICIO + 'c' + FIM, 'i');
const LETRA_DE_VENDA = new RegExp(INICIO + 'v' + FIM, 'i');

/**
 * As operações mencionadas num texto. Mais de uma é ambiguidade, e quem chama não escolhe.
 *
 * `letraSolta: false` é para a linha da conta, onde vem o nome do cliente: o `V` de
 * `Carlos V. Silva` não pode virar venda.
 *
 * @returns {Set<'C'|'V'>}
 */
const operacoesDe = (texto, { letraSolta = true } = {}) => {
  const operacoes = new Set();
  if (PALAVRAS_DE_COMPRA.test(texto) || (letraSolta && LETRA_DE_COMPRA.test(texto))) operacoes.add('C');
  if (PALAVRAS_DE_VENDA.test(texto) || (letraSolta && LETRA_DE_VENDA.test(texto))) operacoes.add('V');
  return operacoes;
};

/** @returns {'C'|'V'|null} a operação, ou null quando nenhuma — ou as duas — aparecem. */
const unica = (operacoes) => (operacoes.size === 1 ? [...operacoes][0] : null);

/* ── Ativo ────────────────────────────────────────────────────────────────────────────── */

const ESCALA = String.raw`(?:milh[õo]es|milh[ãa]o|mil|mi|k|m)`;
const UNIDADE = String.raw`(?:reais|cotas?|a[çc][õo]es|pap[ée]is|qtd\.?|qtds|qntds|quantidades?)`;
const ROTULO_DE_VALOR = String.raw`(?:(?:valor|financeiro|vlr)\s*(?:de\s*)?[:=]?\s*)?`;

/** Um pedaço de linha que é só valor: `R$ 50.000,00`, `1000 cotas`, `3 mil`, `valor 3.000`. */
const SO_VALOR = new RegExp(
  '^' + ROTULO_DE_VALOR + String.raw`(?:R\$\s*)?[\d.,]+(?:\s*${ESCALA})?(?:\s*${UNIDADE})?(?:\s*\([^)]*\))?$`,
  'i'
);

const EM_REAIS = new RegExp(String.raw`R\$\s*[\d.,]+(?:\s*${ESCALA}${FIM})?(?:\s*\([^)]*\))?`, 'gi');

/** Valor no fim da linha, sem traço antes: só com unidade, escala ou centavos, que nome não tem. */
const VALOR_NO_FIM = new RegExp(
  String.raw`\s+${ROTULO_DE_VALOR}\d[\d.,]*(?:\s*${ESCALA}${FIM})?\s*${UNIDADE}${FIM}\s*$` +
    String.raw`|\s+\d[\d.,]*\s*${ESCALA}${FIM}\s*$` +
    String.raw`|\s+\d+(?:\.\d{3})*,\d{2}\s*$`,
  'i'
);

/**
 * Isola o nome do fundo numa linha, tirando a operação da frente e o valor do fim.
 *
 * Aqui **não** dá para limpar número solto como se faz com ticker: nome de fundo carrega dígito
 * no meio — `XP CDI 99 FOF Private Jun/27 FII RL` perderia o 99 e o 27 e não bateria com nada.
 * Por isso o corte é por posição: só cai o trecho final que é *inteiramente* um valor.
 */
const textoDoAtivo = (linha) => {
  const semOperacao = linha.replace(/^\s*([CV])\s*[-–—]\s*/i, '');
  const semReais = semOperacao.replace(EM_REAIS, ' ');

  const partes = semReais.split(/\s*[-–—]\s*/);
  while (partes.length > 1 && SO_VALOR.test(partes[partes.length - 1].trim())) partes.pop();

  return partes
    .join(' - ')
    .replace(VALOR_NO_FIM, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-–—:;,]+$/, '')
    .trim();
};

/* ── Contexto do bloco ────────────────────────────────────────────────────────────────── */

/** Linha que dá contexto ao bloco (operação, formato, valor global) e não descreve um ativo. */
const ehLinhaDeContexto = (linha) =>
  (operacoesDe(linha).size > 0 && !/\d/.test(linha)) ||
  /\b(?:via|e-?mail|twap|lote|audit\w*|cada|total)\b/i.test(linha) ||
  /^[\d\s.,:/-]*$/.test(linha);

const HORARIO = /(\d{1,2})(?::(\d{2})|h(\d{2})?)/gi;

/**
 * Lê um intervalo de horário para o TWAP. Exige **dois** horários na linha, porque um horário
 * solto é ambíguo demais para virar `Hora Inicial` de uma ordem real.
 */
const lerHorario = (linha) => {
  const achados = [...linha.matchAll(HORARIO)].map(([, hora, minComDoisPontos, minComH]) => {
    const minutos = minComDoisPontos ?? minComH ?? '00';
    return String(hora).padStart(2, '0') + ':' + minutos.padStart(2, '0');
  });

  return achados.length >= 2 ? { inicial: achados[0], final: achados[1] } : null;
};

/**
 * "Via email" marca os dois e-mails, o de texto e o em tabela: o operador copia o que o cliente
 * usa. "Auditar" marca só a tabela.
 *
 * Com fundo cetipado na cesta, "via email" não marca a tabela: o operador decidiu que fundo não
 * entra nela, e marcá-la só mostraria um bloqueio que não se confirma. "Auditar", escrito com
 * todas as letras, marca mesmo assim — ali o bloqueio é a resposta honesta ao que foi pedido.
 */
const lerSaidas = (texto, { temFundo }) => {
  const email = /\be-?mails?\b/i.test(texto);
  const auditoria = /\bauditar|auditoria\b/i.test(texto);

  return {
    email: email && !auditoria,
    auditoria: auditoria || (email && !temFundo),
    lote: /\blote\b/i.test(texto),
    twap: /\btwap\b/i.test(texto)
  };
};

/** `compra R$ 10.000,00 cada` — um valor que vale para cada ativo listado abaixo. */
const lerValorGlobal = (linha) => {
  if (!/\bcada\b|\bpor\s+ativo\b/i.test(linha)) return null;

  // O horário do TWAP (`das 10h às 15h`) não pode entrar na conta dos números da linha.
  const valor = lerValor(linha.replace(HORARIO, ' '));
  return valor.quantidade === null && valor.financeiro === null ? null : valor;
};

/**
 * Os cabeçalhos de operação do bloco ("Venda:", "COMPRA", "C"), cada um com a sua posição.
 * Um cabeçalho que diz as duas coisas ("compra e venda") fica com `operacao: null`.
 */
const lerCabecalhos = (bloco) => {
  const cabecalhos = [];
  const registrar = (posicao, operacoes) => {
    if (operacoes.size > 0) cabecalhos.push({ posicao, operacao: unica(operacoes) });
  };

  if (bloco.restoDaConta) registrar(-1, operacoesDe(bloco.restoDaConta, { letraSolta: false }));

  bloco.linhas.forEach((linha, posicao) => {
    if (tickersDe(linha).length === 0 && ehLinhaDeContexto(linha)) registrar(posicao, operacoesDe(linha));
  });

  return cabecalhos;
};

/**
 * A operação que vale para uma linha sem operação própria: a do cabeçalho logo acima dela.
 *
 * Sem cabeçalho acima, vale a do bloco — desde que o bloco só diga uma. Antes era sempre a
 * primeira palavra encontrada no texto inteiro, e `Venda:` / `XPML11` / `Compra:` / `BTLG11`
 * saía com as duas como compra.
 */
const operacaoDaSecao = (cabecalhos, posicao) => {
  const acima = cabecalhos.filter((c) => c.posicao < posicao).at(-1);
  if (acima) return acima.operacao;

  const distintas = new Set(cabecalhos.map((c) => c.operacao));
  return distintas.size === 1 ? [...distintas][0] : null;
};

/* ── Linha a linha ────────────────────────────────────────────────────────────────────── */

const semValor = (v) => v.quantidade === null && v.financeiro === null;

/**
 * Classifica uma linha do bloco: `ativo` (ticker ou nome de fundo), `valor` (só o valor, sem
 * ativo: `R$ 16.000,00`, `100 cotas`), ou null para contexto e linha vazia.
 *
 * O valor sozinho é lido antes do contexto de propósito: `16.000,00` numa linha só tem cara de
 * linha de contexto, e era pulado em silêncio.
 */
const lerLinha = (linha) => {
  const tickers = tickersDe(linha);
  const ticker = tickers[0] ?? null;

  if (!ticker && /\d/.test(linha) && SO_VALOR.test(linha.trim())) {
    return { tipo: 'valor', linha, valor: lerValor(linha) };
  }

  // Tirar o identificador antes de ler número evita que o `11` de `IVVB11`, ou o `99` de
  // `XP CDI 99 FOF`, virem quantidade.
  const nomeDoFundo = ticker ? null : textoDoAtivo(linha);
  if (!ticker && (ehLinhaDeContexto(linha) || !nomeDoFundo)) return null;

  const resto = ticker ? linha.replace(new RegExp(ticker, 'gi'), ' ') : linha.replace(nomeDoFundo, ' ');

  // Preço antes do valor: em `PETR4 100 a R$ 39,50` o `R$` é preço unitário, e lido primeiro
  // ele não é confundido com o valor financeiro da ordem.
  const { preco, trecho: trechoPreco } = lerPreco(resto);
  const semPreco = trechoPreco ? resto.replace(trechoPreco, ' ') : resto;

  return { tipo: 'ativo', linha, tickers, ticker, nomeDoFundo, resto, preco, semPreco, proprio: lerValor(semPreco) };
};

/**
 * Casa cada valor sozinho numa linha com o ativo logo acima dele, quando esse ativo não trouxe
 * valor na própria linha: `Riza Malls` / `R$ 16.000,00`.
 *
 * Um valor sem ativo logo acima cancela o casamento do bloco inteiro. Ele é o sinal de que o
 * bloco não segue o padrão nome-e-valor-embaixo — o caso perigoso é o valor vir **acima** do nome,
 * e aí casar de cima para baixo daria a cada fundo o valor do fundo seguinte. Um valor errado
 * num fundo certo é o tipo de erro que ninguém pega conferindo; um descarte, todo mundo vê.
 *
 * @returns {{pares: Map<number, {linha: string, valor: object}>, cancelado: boolean}} os pares,
 *   pela posição do ativo
 */
const casarValores = (leituras) => {
  const pares = new Map();
  let cancelado = false;

  leituras.forEach((leitura, posicao) => {
    if (leitura?.tipo !== 'valor') return;

    const acima = leituras[posicao - 1];
    const livre = acima?.tipo === 'ativo' && acima.tickers.length <= 1 && semValor(acima.proprio);
    if (livre) pares.set(posicao - 1, leitura);
    else cancelado = true;
  });

  return cancelado ? { pares: new Map(), cancelado } : { pares, cancelado };
};

const solicitacaoVazia = (conta) => ({
  conta,
  ordens: [],
  descartadas: [],
  saidas: { email: false, auditoria: false, lote: false, twap: false },
  horario: null,
  restoDaConta: null,
  valorGlobal: null,
  linhas: []
});

/**
 * @param {string} texto  o que o operador colou, cru
 * @returns {{solicitacoes: Solicitacao[], ignoradas: Array<{linha: string, motivo: string}>}}
 */
export const parseSolicitacoes = (texto) => {
  const { linhas, ignoradas } = limparEntrada(texto);

  // 1. Quebra em solicitações, uma por conta.
  const blocos = [];
  for (const linha of linhas) {
    const achada = lerConta(linha);
    if (achada || blocos.length === 0) blocos.push(solicitacaoVazia(achada?.conta ?? null));

    const bloco = blocos[blocos.length - 1];
    if (!achada) {
      bloco.linhas.push(linha);
    } else if (/\d/.test(achada.resto)) {
      // Com número, o resto pode ser um valor ou uma ordem, e segue como linha comum para não
      // sumir calado. Sem número, é contexto ("compra via email") ou o nome do cliente.
      bloco.linhas.push(achada.resto);
    } else {
      bloco.restoDaConta = achada.resto || null;
    }
  }

  // 2. Lê o contexto de cada bloco antes das ordens: a operação e o valor que valem para todos.
  for (const bloco of blocos) {
    const contexto = [bloco.restoDaConta, ...bloco.linhas.filter((l) => tickersDe(l).length === 0)]
      .filter(Boolean)
      .join('\n');

    bloco.horario = bloco.linhas.map(lerHorario).find(Boolean) ?? null;
    bloco.valorGlobal = bloco.linhas.map(lerValorGlobal).find(Boolean) ?? null;
    const cabecalhos = lerCabecalhos(bloco);

    // 3. Lê cada linha: um ativo, um valor sozinho, ou contexto.
    const leituras = bloco.linhas.map(lerLinha);
    const { pares, cancelado } = casarValores(leituras);

    // 4. Cada linha vira uma ordem, ou um descarte justificado. Ticker e fundo cetipado são
    //    lidos na mesma passada, para a saída preservar a ordem em que foram digitados.
    for (const [posicao, leitura] of leituras.entries()) {
      if (!leitura) continue;
      const { linha } = leitura;

      if (leitura.tipo === 'valor') {
        if (pares.has(posicao - 1)) continue;
        bloco.descartadas.push({
          linha,
          motivo: cancelado
            ? 'valor numa linha sozinha, e nem todo valor do bloco tem um ativo logo acima — não dá ' +
              'para saber de qual ativo é cada um; fazer na mão'
            : 'valor numa linha sozinha, sem um ativo logo acima — fazer na mão'
        });
        continue;
      }

      const { tickers, ticker, nomeDoFundo, resto, preco, semPreco, proprio } = leitura;

      // `vender XPML11 100 e comprar BTLG11 100`: ler um só perderia o outro, e a operação da
      // linha seria a primeira palavra achada. Separar em duas é trabalho do operador.
      if (tickers.length > 1) {
        bloco.descartadas.push({
          linha,
          motivo: 'mais de um ativo na mesma linha — separe um ativo por linha'
        });
        continue;
      }

      // O valor da própria linha vale mais que o da linha de baixo, que vale mais que o `cada`.
      const par = pares.get(posicao) ?? null;
      const valor = !semValor(proprio) ? proprio : (par?.valor ?? bloco.valorGlobal ?? proprio);
      const { quantidade, financeiro } = valor;

      // Contabilidade da linha: tirado o ativo, o preço e o valor, número que sobrar é número
      // que ninguém explicou. Não dá para saber se é preço, quantidade ou ruído — e é
      // exatamente por não dar para saber que ele vira bloqueio, em vez de sumir calado.
      const sobra = proprio.trecho ? semPreco.replace(proprio.trecho, ' ') : semPreco;
      const sobraDoPar = par ? par.linha.replace(par.valor.trecho, ' ') : '';
      const numerosSobrando = (sobra + ' ' + sobraDoPar).match(/\d[\d.]*(?:,\d+)?/g) ?? [];

      if (quantidade === null && financeiro === null) {
        bloco.descartadas.push({
          linha,
          motivo: 'sem quantidade nem financeiro informado — fazer na mão'
        });
        continue;
      }

      // `1234567 - BTLG11 - 3.000,00`: o número da frente tanto pode ser a conta quanto a
      // quantidade, e lido como quantidade daria uma ordem de mais de um milhão de cotas.
      if (ticker && NUMERO_DE_CONTA_NA_FRENTE.test(linha) && numerosSobrando.length > 0) {
        bloco.descartadas.push({
          linha,
          motivo: 'começa com um número que pode ser a conta ou a quantidade — ponha a conta numa linha própria'
        });
        continue;
      }

      // O ticker de um fundo da prateleira (`VGPR11`) é o fundo, e não papel de bolsa: decisão da
      // mesa em 06/10/2026. O ativo fica como foi escrito; o nome vem junto no fundo.
      const fundoDoTicker = ticker ? fundoPeloTicker(ticker) : null;
      const fundo = fundoDoTicker ?? (ticker ? null : procurarFundo(nomeDoFundo));
      if (fundo && fundo.situacao === 'nenhum') {
        bloco.descartadas.push({
          linha,
          motivo: 'nome não encontrado na prateleira de fundos — fazer na mão'
        });
        continue;
      }

      // A operação escrita na própria linha vale mais que a da seção. Se a linha diz as duas,
      // fica sem nenhuma: a seção não desempata o que a linha deixou ambíguo.
      const propria = operacoesDe(resto);

      bloco.ordens.push({
        // Nome ambíguo fica como foi digitado: promovê-lo a um da prateleira seria escolher
        // pelo operador justamente onde ele precisa escolher.
        ativo: ticker ?? fundo.fundo?.nome ?? nomeDoFundo,
        ticker: ticker && !fundoDoTicker ? analisarTicker(ticker) : null,
        fundo,
        operacao: propria.size > 0 ? unica(propria) : operacaoDaSecao(cabecalhos, posicao),
        quantidade,
        financeiro,
        quantidadeSolta: quantidade !== null && Boolean(valor.quantidadeSolta),
        preco,
        numerosSobrando,
        linha: par ? `${linha} / ${par.linha}` : linha
      });
    }

    // Depois das ordens, porque o que se marca depende de haver fundo cetipado na cesta.
    bloco.saidas = lerSaidas(contexto, { temFundo: bloco.ordens.some((o) => o.fundo) });
  }

  const solicitacoes = blocos.map(
    ({ linhas: _linhas, restoDaConta: _resto, valorGlobal: _valor, ...s }) => s
  );
  return { solicitacoes, ignoradas };
};
