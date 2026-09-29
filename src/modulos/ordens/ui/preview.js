import { analisarTicker, temFormatoDeTicker } from '../core/validate/ticker.js';
import { procurarFundo } from '../core/validate/fundo.js';
import { formatarFinanceiro, lerFinanceiro } from '../core/util/dinheiro.js';
import { esc, renderSaidas } from './saidas.js';

/**
 * O preview editável: a comporta entre o que o parser entendeu e o que vai ser gerado.
 *
 * Nenhuma saída sai direto do parser. O parser **propõe**, esta tabela mostra campo a campo o
 * que ele propôs, o operador corrige o que estiver errado, e só então os formatadores rodam
 * sobre os dados confirmados. É o que transforma um palpite do parser num dado conferido por
 * quem responde pela ordem.
 *
 * Editar um campo re-renderiza os diagnósticos e as saídas, mas **não** a tabela: refazer a
 * tabela a cada tecla tiraria o foco do campo no meio da digitação.
 */

const rotuloDeClasse = {
  acao: 'Ação',
  fii: 'FII',
  bdr: 'BDR',
  etf: 'ETF',
  fundo: 'Fundo',
  fiagro: 'Fiagro',
  outros: 'B3'
};

/**
 * Selo ao lado do ativo: a classe quando ele é reconhecido, o alerta quando não é.
 *
 * Cada classe tem seu próprio matiz (ver "Cores de classe de ativo" no CSS), o que deixa um BDR
 * saltar no meio de uma lista de FIIs. O suspeito e o desconhecido ficam com os únicos tons
 * quentes da coluna, para continuarem sendo o que a varredura encontra primeiro.
 *
 * Uma ordem traz `ticker` **ou** `fundo`, nunca os dois: fundo cetipado não tem código.
 */
const selo = (ordem) => {
  const { ticker, fundo } = ordem;

  if (fundo) {
    if (fundo.situacao === 'exato') return '<span class="selo ok classe-cetipado">Fundo</span>';
    if (fundo.situacao === 'ambiguo') return '<span class="selo suspeito">escolha</span>';
    return '<span class="selo desconhecido">confirme</span>';
  }

  if (!ticker) return '';

  if (ticker.situacao === 'conhecido' || ticker.situacao === 'variante') {
    const classe = ticker.classe ?? 'outros';
    return `<span class="selo ok classe-${classe}">${rotuloDeClasse[classe] ?? 'B3'}</span>`;
  }
  if (ticker.situacao === 'parecido') return '<span class="selo suspeito">suspeito</span>';
  return '<span class="selo desconhecido">fora da lista</span>';
};

/**
 * Candidatos de fundo, clicáveis, logo abaixo do nome.
 *
 * Sem isto o bloqueio de nome ambíguo seria um beco sem saída: ele não é confirmável de
 * propósito — confirmar não decide qual dos três XP Habitat o cliente pediu —, então o operador
 * precisa de um jeito de escolher. Clicar num candidato é esse jeito.
 */
const candidatosDeFundo = (ordem) => {
  const candidatos = ordem.fundo?.candidatos ?? [];
  if (candidatos.length === 0) return '';

  return `<div class="candidatos">${candidatos
    .map(
      (c) =>
        `<button type="button" class="candidato" data-campo="ativo" data-valor="${esc(c.nome)}">${esc(c.nome)}</button>`
    )
    .join('')}</div>`;
};

const porFinanceiro = (ordem) => ordem.financeiro !== null && ordem.financeiro !== undefined;

/**
 * Qtd ou R$, do jeito que o controle mostra. O tipo escolhido no controle fica guardado em
 * `ordem.tipo`, porque ele precisa sobreviver ao campo vazio: numa linha nova, ou com o campo de
 * reais apagado para redigitar, não há valor de onde deduzir o tipo — e deduzir errado mandava o
 * que o operador digitasse em seguida para a quantidade.
 */
const tipoDe = (ordem) => ordem.tipo ?? (porFinanceiro(ordem) ? 'financeiro' : 'quantidade');

const valorVisivel = (ordem) =>
  porFinanceiro(ordem) ? formatarFinanceiro(ordem.financeiro) : (ordem.quantidade ?? '');

/** A linha que o botão + acrescenta: tudo em branco, para o operador preencher. */
const ordemVazia = () => ({
  ativo: '',
  ticker: null,
  fundo: null,
  operacao: null,
  quantidade: null,
  financeiro: null,
  quantidadeSolta: false,
  preco: null,
  numerosSobrando: [],
  linha: ''
});

/**
 * Controle segmentado: as opções ficam todas à vista, com a escolhida preenchida.
 *
 * Substitui os `<select>` que havia aqui. Num `<select>` fechado só a opção atual aparece, o
 * que obriga a abrir cada linha para conferir uma cesta — e conferir a cesta inteira de relance
 * é justamente o que o preview existe para permitir.
 */
const segmentado = (campo, opcoes, atual) => `
  <div class="segmentado" role="group">
    ${opcoes
      .map(({ valor, texto, tom }) => {
        const classes = ['seg', tom, valor === atual ? 'ativo' : null].filter(Boolean).join(' ');
        return `
      <button type="button" class="${classes}"
              data-campo="${campo}" data-valor="${esc(valor)}"
              aria-pressed="${valor === atual}">${esc(texto)}</button>`;
      })
      .join('')}
  </div>`;

/**
 * O que a linha revela ao pousar o mouse: o nome por extenso do papel, quando o sabemos, e o
 * texto de onde ela foi lida. Num sistema que existe para não adivinhar, poder ver a origem de
 * cada campo vale mais que qualquer enfeite.
 */
const origemDaLinha = (ordem) =>
  [ordem.ticker?.nome, ordem.linha ? 'Lido de: ' + ordem.linha : null].filter(Boolean).join('\n');

const linha = (ordem, i) => `
  <tr data-ordem="${i}" title="${esc(origemDaLinha(ordem))}">
    <td class="col-ativo">
      <input class="campo campo-ativo" value="${esc(ordem.ativo)}"
             size="${Math.min(Math.max(String(ordem.ativo ?? '').length, 8), 30)}" />
      ${selo(ordem)}
      ${candidatosDeFundo(ordem)}
    </td>
    <td>
      ${segmentado(
        'operacao',
        [
          { valor: 'C', texto: 'Compra', tom: 'compra' },
          { valor: 'V', texto: 'Venda', tom: 'venda' }
        ],
        ordem.operacao
      )}
    </td>
    <td class="col-valor">
      ${segmentado(
        'tipo',
        [
          { valor: 'quantidade', texto: 'Qtd' },
          { valor: 'financeiro', texto: 'R$' }
        ],
        tipoDe(ordem)
      )}
      <input class="campo campo-valor" value="${esc(valorVisivel(ordem))}" size="11"
             placeholder="${tipoDe(ordem) === 'financeiro' ? 'R$ 0,00' : '0'}" />
    </td>
    <td><input class="campo campo-preco" value="${esc(ordem.preco ?? '')}" placeholder="A mercado" size="10" /></td>
    <td><button class="btn-remover" title="Remover esta ordem" aria-label="Remover ${esc(ordem.ativo)}">&times;</button></td>
  </tr>`;

/**
 * Retrato da cesta, para conferir de relance contra o que o cliente pediu.
 *
 * Soma o financeiro, que é um número com significado — a exposição total em reais. **Não** soma
 * quantidades: 100 PETR4 mais 50 VALE3 não são 150 de coisa alguma, e um número desses no topo
 * do cartão convidaria a conferir a ordem contra um total que não quer dizer nada.
 *
 * @returns {{ativos: number, operacao: 'C'|'V'|'misto'|null, financeiro: number|null,
 *            ordensComFinanceiro: number}}
 */
export const resumo = (solicitacao) => {
  const ordens = solicitacao.ordens ?? [];
  const operacoes = new Set(ordens.map((o) => o.operacao).filter(Boolean));
  const comFinanceiro = ordens.filter(porFinanceiro);

  return {
    ativos: ordens.length,
    operacao: operacoes.size === 1 ? [...operacoes][0] : operacoes.size > 1 ? 'misto' : null,
    financeiro: comFinanceiro.length > 0 ? comFinanceiro.reduce((t, o) => t + o.financeiro, 0) : null,
    ordensComFinanceiro: comFinanceiro.length
  };
};

const NOME_DA_OPERACAO = { C: 'Compra', V: 'Venda', misto: 'Compra e venda' };

const faixaDeResumo = (solicitacao) => {
  const { ativos, operacao, financeiro, ordensComFinanceiro } = resumo(solicitacao);
  if (ativos === 0) return '';

  const fichas = [`<span class="ficha">${ativos} ativo${ativos > 1 ? 's' : ''}</span>`];

  if (operacao) {
    const tom = operacao === 'C' ? 'compra' : operacao === 'V' ? 'venda' : 'misto';
    fichas.push(`<span class="ficha ${tom}">${NOME_DA_OPERACAO[operacao]}</span>`);
  }

  if (financeiro !== null) {
    // Quando o financeiro não cobre a cesta inteira, o total diz de quantas ordens ele é —
    // um total parcial apresentado como total seria uma conferência contra o número errado.
    const cobertura = ordensComFinanceiro < ativos ? ` de ${ordensComFinanceiro} ordens` : '';
    fichas.push(`<span class="ficha valor">${formatarFinanceiro(financeiro)}${cobertura}</span>`);
  }

  return `<div class="resumo">${fichas.join('')}</div>`;
};

const descartadas = (lista) =>
  lista.length === 0
    ? ''
    : `<details class="descartadas">
        <summary>${lista.length} linha(s) não viraram ordem — fazer na mão</summary>
        <ul>${lista.map((d) => `<li><code>${esc(d.linha)}</code> <span>${esc(d.motivo)}</span></li>`).join('')}</ul>
      </details>`;

const horario = (solicitacao, mostrar) => {
  if (!mostrar) return '';
  const { inicial = '', final = '' } = solicitacao.horario ?? {};
  return `
    <div class="horario">
      <label>Hora inicial <input class="campo campo-hora-inicial" value="${esc(inicial)}" placeholder="vazio" size="6" /></label>
      <label>Hora final <input class="campo campo-hora-final" value="${esc(final)}" placeholder="vazio" size="6" /></label>
      <span class="meta-counter">vazio = a planilha decide; o sistema não inventa horário</span>
    </div>`;
};

/** Monta o cartão inteiro de uma solicitação. */
export const renderCartao = (solicitacao, indice, formatos, confirmados) => `
  <section class="panel solicitacao" data-solicitacao="${indice}">
    <div class="panel-header-row">
      <h2 class="panel-title">
        Conta XP
        <input class="campo campo-conta" value="${esc(solicitacao.conta ?? '')}" placeholder="informe" size="10" />
      </h2>
      ${faixaDeResumo(solicitacao)}
    </div>

    <div class="table-container">
      <table class="preview">
        <thead>
          <tr><th>Ativo</th><th>Operação</th><th>Valor</th><th>Preço</th><th></th></tr>
        </thead>
        <tbody>${solicitacao.ordens.map(linha).join('')}</tbody>
      </table>
    </div>
    <button type="button" class="btn-adicionar" data-campo="adicionar-ordem" data-valor="">+ Adicionar ativo</button>

    ${horario(solicitacao, formatos.includes('twap'))}
    ${descartadas(solicitacao.descartadas ?? [])}

    <div class="area-saidas">${renderSaidas(solicitacao, formatos, confirmados)}</div>
  </section>`;

/**
 * Aplica no modelo a edição de um campo do preview.
 *
 * Trocar o tipo entre quantidade e financeiro **zera o outro**: uma ordem é por quantidade ou
 * por financeiro, nunca as duas (invariante 2), e deixar o valor antigo pendurado seria o
 * caminho mais curto para os dois saírem preenchidos.
 */
export const aplicarEdicao = (solicitacao, campo, valor, indiceOrdem) => {
  if (campo === 'conta') {
    solicitacao.conta = valor.trim() || null;
    return;
  }

  // O conserto da cesta mista: a quantidade que veio de número solto (`XPML11 3.000`, numa cesta
  // em reais) passa a ser financeiro, com o mesmo número. `100 cotas`, escrito assim, fica.
  if (campo === 'tudo-em-reais') {
    for (const ordem of solicitacao.ordens) {
      if (ordem.quantidade === null || !ordem.quantidadeSolta) continue;
      ordem.financeiro = ordem.quantidade;
      ordem.quantidade = null;
      ordem.quantidadeSolta = false;
      ordem.tipo = 'financeiro';
    }
    return;
  }

  // O botão +. A linha nasce em branco — nem a operação da cesta ela herda — e segura a saída até
  // ter ativo e valor.
  if (campo === 'adicionar-ordem') {
    solicitacao.ordens.push(ordemVazia());
    return;
  }

  if (campo === 'hora-inicial' || campo === 'hora-final') {
    const atual = solicitacao.horario ?? { inicial: '', final: '' };
    const proximo = { ...atual, [campo === 'hora-inicial' ? 'inicial' : 'final']: valor.trim() };
    solicitacao.horario = proximo.inicial || proximo.final ? proximo : null;
    return;
  }

  const ordem = solicitacao.ordens[indiceOrdem];
  if (!ordem) return;

  switch (campo) {
    case 'ativo': {
      const texto = valor.trim();

      // Ticker é código e vai para maiúsculas; nome de fundo é texto e fica como está. Um
      // `toUpperCase` aqui transformaria "Riza Malls Feeder FII RL" em grito na saída.
      if (!texto) {
        ordem.ativo = '';
        ordem.ticker = null;
        ordem.fundo = null;
      } else if (temFormatoDeTicker(texto)) {
        ordem.ativo = texto.toUpperCase();
        ordem.ticker = analisarTicker(ordem.ativo);
        ordem.fundo = null;
      } else {
        const busca = procurarFundo(texto);
        ordem.ativo = busca.fundo?.nome ?? texto;
        ordem.fundo = busca;
        ordem.ticker = null;
      }
      break;
    }
    case 'operacao':
      ordem.operacao = valor || null;
      break;
    case 'tipo':
      // O operador disse o que o número é: deixa de ser número solto a conferir.
      ordem.quantidadeSolta = false;
      ordem.tipo = valor === 'financeiro' ? 'financeiro' : 'quantidade';
      if (valor === 'financeiro') {
        ordem.financeiro = ordem.financeiro ?? ordem.quantidade ?? null;
        ordem.quantidade = null;
      } else {
        ordem.quantidade = ordem.quantidade ?? (ordem.financeiro === null ? null : Math.trunc(ordem.financeiro));
        ordem.financeiro = null;
      }
      break;
    case 'valor': {
      ordem.quantidadeSolta = false;
      // O tipo fica fixo antes de o valor poder ficar vazio: apagar o campo de reais para
      // redigitar mandava o número seguinte para a quantidade.
      ordem.tipo = tipoDe(ordem);
      if (ordem.tipo === 'financeiro') {
        ordem.financeiro = lerFinanceiro(valor);
      } else {
        const n = parseInt(String(valor).replace(/\D/g, ''), 10);
        ordem.quantidade = Number.isFinite(n) ? n : null;
      }
      break;
    }
    case 'preco':
      ordem.preco = valor.trim() || null;
      break;
  }
};
