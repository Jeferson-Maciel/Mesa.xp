import { lerFinanceiro } from '../util/dinheiro.js';

/**
 * Decide se um número na linha é **quantidade**, **financeiro** ou **preço**, e devolve junto o
 * trecho de texto que consumiu.
 *
 * O trecho não é um detalhe: é ele que permite ao parser saber o que **sobrou** na linha. Um
 * número que ninguém explicou é ambiguidade, e ambiguidade aqui vira bloqueio — não silêncio.
 * Sem essa contabilidade, `PETR4 100 a 39,50` saía como ordem a mercado porque o 39,50 era
 * descartado sem que nada notasse.
 *
 * Confundir quantidade com financeiro é o erro mais caro do sistema (invariante 2), então a
 * decisão entre os dois é explícita e exclusiva, na ordem abaixo — a primeira que casar vence:
 *
 *   `R$ 3.000`, `R$ 3 mil`              → financeiro
 *   `3 mil`, `20k`, `1M`                → financeiro; quantidade se vier `cotas`/`ações` depois
 *   `valor 3.000`, `3.000 reais`        → financeiro
 *   `3.000,00` sozinho na linha         → financeiro: quantidade não tem centavos
 *   qualquer outro número               → quantidade
 *
 * A regra dos centavos só vale quando o número é o único do trecho. Em `PETR4 100 39,50` o 39,50
 * tanto pode ser o preço quanto o valor da ordem, e escolher ali seria adivinhar: o 100 vira
 * quantidade e o 39,50 sobra, para o parser bloquear.
 *
 * O texto que chega aqui já vem **sem o ticker e sem o preço**, senão o `11` de `IVVB11` ou o
 * `39,50` de um preço virariam quantidade.
 */

const NUMERO = String.raw`\d[\d.]*(?:,\d+)?`;

/** Fim de palavra que respeita acento: o `\b` do JS não conhece o `ç` nem o `õ`. */
const FIM = String.raw`(?![a-zà-ÿ0-9])`;

const ESCALA = String.raw`(?:milh[õo]es|milh[ãa]o|mil|mi|k|m)${FIM}`;

const PALAVRA_DE_QUANTIDADE = String.raw`(?:cotas?|a[çc][õo]es|a[çc][ãa]o|pap[ée]is|qtd\.?|qtds|qntds?|quantidades?|unidades?)${FIM}`;

const EM_REAIS = new RegExp(String.raw`R\$\s*(${NUMERO})(?:\s*(${ESCALA}))?`, 'i');
const ESCALADO = new RegExp(String.raw`(${NUMERO})\s*(${ESCALA})(?:\s*(reais|${PALAVRA_DE_QUANTIDADE}))?`, 'i');
const ROTULADO = new RegExp(String.raw`\b(?:valor|financeiro|vlr)\s*(?:de\s*)?[:=\-]?\s*(?:de\s*)?(${NUMERO})`, 'i');
const COM_REAIS = new RegExp(String.raw`(${NUMERO})\s*reais${FIM}`, 'i');
const COM_CENTAVOS = /^\d{1,3}(?:\.\d{3})*,\d{2}$|^\d+,\d{2}$/;
const QUANTIDADE_EXPLICITA = new RegExp(String.raw`(?:^|[^a-zà-ÿ0-9])${PALAVRA_DE_QUANTIDADE}`, 'i');

const MULTIPLICADOR = { k: 1e3, mil: 1e3, m: 1e6, mi: 1e6, milhao: 1e6, milhoes: 1e6 };

const multiplicadorDe = (escala) =>
  escala
    ? MULTIPLICADOR[escala.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')]
    : 1;

/** `1,5` × mil sem o ruído de ponto flutuante (1,1 × 1000 dá 1100.0000000000002). */
const escalar = (numero, escala) => Math.round(lerFinanceiro(numero) * multiplicadorDe(escala) * 100) / 100;

const NADA = { quantidade: null, financeiro: null, trecho: '', quantidadeSolta: false };

const financeiro = (valor, trecho) =>
  valor === null || Number.isNaN(valor) ? NADA : { quantidade: null, financeiro: valor, trecho, quantidadeSolta: false };

/**
 * @param {string} texto  a linha sem o identificador do ativo e sem o preço
 * @returns {{quantidade: number|null, financeiro: number|null, trecho: string,
 *            quantidadeSolta: boolean}}  `quantidadeSolta` diz que a quantidade veio de um número
 *   sem unidade nenhuma — o caso que a cesta mista precisa conferir.
 */
export const lerValor = (texto) => {
  if (typeof texto !== 'string' || !texto.trim()) return NADA;

  const emReais = texto.match(EM_REAIS);
  if (emReais) return financeiro(escalar(emReais[1], emReais[2]), emReais[0]);

  // A escala não diz a unidade: `3 mil` é dinheiro, `3 mil cotas` é quantidade. Sem unidade vale
  // financeiro, como o `20k` sempre valeu.
  const escalado = texto.match(ESCALADO);
  if (escalado) {
    const valor = escalar(escalado[1], escalado[2]);
    const emCotas = escalado[3] && !/^reais$/i.test(escalado[3]);
    return emCotas
      ? { quantidade: Math.round(valor), financeiro: null, trecho: escalado[0], quantidadeSolta: false }
      : financeiro(valor, escalado[0]);
  }

  const rotulado = texto.match(ROTULADO) ?? texto.match(COM_REAIS);
  if (rotulado) return financeiro(lerFinanceiro(rotulado[1]), rotulado[0]);

  const numeros = texto.match(new RegExp(NUMERO, 'g')) ?? [];
  if (numeros.length === 0) return NADA;

  if (numeros.length === 1 && COM_CENTAVOS.test(numeros[0])) {
    return financeiro(lerFinanceiro(numeros[0]), numeros[0]);
  }

  // Quantidade é inteira: o ponto é separador de milhar e o que vier depois da vírgula cai fora.
  const quantidade = parseInt(numeros[0].replace(/\./g, '').split(',')[0], 10);
  return Number.isFinite(quantidade)
    ? {
        quantidade,
        financeiro: null,
        trecho: numeros[0],
        quantidadeSolta: !QUANTIDADE_EXPLICITA.test(texto)
      }
    : NADA;
};

/**
 * Formas de escrever um preço que aparecem de verdade nas mensagens.
 *
 * O `a`/`por` solto exige centavos (`a 39,50`) de propósito: sem isso, `a 100` seria lido como
 * preço quando pode ser quantidade. Número ambíguo não é adivinhado aqui — ele sobra na linha e
 * o parser bloqueia pedindo que o operador diga o que é.
 */
const PADROES_DE_PRECO = [
  /(?:^|[\s\-–—])[aà]\s*mercado\b/i,
  /pre[cç]o\s*[:\-]?\s*(?:R\$\s*)?\d[\d.]*(?:,\d+)?/i,
  /\blimite\s*[:\-]?\s*(?:R\$\s*)?\d[\d.]*(?:,\d+)?/i,
  /@\s*(?:R\$\s*)?\d[\d.]*(?:,\d+)?/,
  /\b(?:a|por)\s+(?:R\$\s*)?\d[\d.]*,\d+\b/i
];

const SO_O_NUMERO = /\d[\d.]*(?:,\d+)?/;

/**
 * Lê o preço da linha inteira.
 *
 * Devolve `preco: null` na ausência, em vez de já aplicar "A mercado", para que o chamador saiba
 * a diferença entre *não informado* e *informado como a mercado*.
 *
 * @returns {{preco: string|null, trecho: string}} o preço **exatamente como digitado**
 *   (invariante 4) ou 'A mercado', e o trecho que o produziu.
 */
export const lerPreco = (linha) => {
  if (typeof linha !== 'string') return { preco: null, trecho: '' };

  for (const padrao of PADROES_DE_PRECO) {
    const achado = linha.match(padrao);
    if (!achado) continue;

    const trecho = achado[0].replace(/^[\s\-–—]+/, '');
    if (/mercado/i.test(trecho)) return { preco: 'A mercado', trecho };

    return { preco: trecho.match(SO_O_NUMERO)[0], trecho };
  }

  return { preco: null, trecho: '' };
};
