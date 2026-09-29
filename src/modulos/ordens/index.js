import { parseSolicitacoes } from './core/parse/parseSolicitacoes.js';
import { copiar, colar } from './platform/clipboard.js';
import * as historico from './platform/historico.js';
import { aplicarEdicao, renderCartao } from './ui/preview.js';
import { ROTULOS, esc, gerar, renderSaidas } from './ui/saidas.js';
import { aviso } from '../../ui/avisos.js';
import './ordens.css';

/**
 * O Assistente de Ordens dentro da Mesa XP.
 *
 * Este é o antigo `src/main.js` do Ordens, inteiro, dentro de uma função: a casca chama
 * `iniciarOrdens` ao carregar a página, como antes. Mudaram só três coisas, todas da fusão —
 * o tema e os avisos de tela vêm da casca (`src/ui/`), e os atalhos de teclado só valem com a
 * aba Ordens à vista (`secao.hidden`). A marcação continua estática, no `index.html`.
 *
 * @param {HTMLElement} secao a seção `#modulo-ordens`.
 */
export const iniciarOrdens = (secao) => {
  /**
   * Ligação entre o núcleo e a tela.
   *
   * Todo o julgamento mora em `core/`; aqui só há estado de tela, eventos e render. A regra que
   * organiza o arquivo: editar um campo atualiza o modelo e re-renderiza **apenas** a área de
   * saídas do cartão — refazer a tabela a cada tecla tiraria o foco do campo sendo digitado.
   */

  const $ = (id) => document.getElementById(id);

  const entrada = $('entrada');
  const container = $('solicitacoes');
  const vazio = $('vazio');

  /**
   * `detectados` guarda o que o texto de **cada** solicitação pediu; `escolhaManual` é a
   * marcação das caixas, que vale para todas quando o operador mexe nelas.
   *
   * A separação importa: num bloco com duas contas, uma pode pedir auditoria e a outra uma ordem
   * de execução. Uma seleção só, global, geraria para o cliente da auditoria um e-mail de ordem que
   * ele não pediu — e um e-mail errado gerado é um e-mail errado que pode ser enviado.
   */
  const estado = {
    solicitacoes: [],
    confirmados: [],
    detectados: [],
    escolhaManual: null,
    textoOriginal: ''
  };

  const formatosDe = (indice) => estado.escolhaManual ?? estado.detectados[indice] ?? [];

  /* ── Exemplos (contas fictícias: nenhum dado de cliente real vive no código) ───────────── */

  const EXEMPLOS = {
    'E-mail simples': '1234567\nCOMPRA\nIVVB11 - 7 qntds\nvia email',
    'E-mail em tabela': '1234567\nAuditar via e-mail\nC - IVVB11 - 7 qntds',
    'Cesta em R$': '1234567 - compra via email\nBTLG11 - 3.000,00\nXPML11 - 3.000,00\nKNCR11 - 5.000,00',
    'Fundos, valor embaixo':
      '1234567\ncompra\nRiza Terrax Vintage FIAgro RL\nR$ 16.000,00\nAZ Quest Panorama Data Centers FII RL\nR$ 16.000,00',
    'Cesta TWAP': '1234567\ncompra R$ 10.000,00 cada twap das 10h às 15h\nPETR4\nVALE3\nABEV3',
    'Lote simples': '1234567\nVENDA lote\n100 PETR4\n50 VALE3\n200 ITUB4',
    'Duas contas': '1234567\nC\nPETR4 100\n7654321\nV\nVALE3 50',
    'Ticker suspeito': '1234567\nCOMPRA\nKCNR11 100'
  };

  $('presets').innerHTML = Object.keys(EXEMPLOS)
    .map((nome) => `<button class="preset-btn" data-exemplo="${esc(nome)}">${esc(nome)}</button>`)
    .join('');

  $('presets').addEventListener('click', (e) => {
    const botao = e.target.closest('[data-exemplo]');
    if (!botao) return;
    entrada.value = EXEMPLOS[botao.dataset.exemplo];
    analisar();
  });

  /* ── Análise ──────────────────────────────────────────────────────────────────────────── */

  function analisar() {
    const texto = entrada.value;
    if (!texto.trim()) return aviso('Cole uma solicitação para analisar.');

    const { solicitacoes, ignoradas } = parseSolicitacoes(texto);

    estado.solicitacoes = solicitacoes;
    estado.confirmados = solicitacoes.map(() => new Set());
    estado.textoOriginal = texto;
    estado.escolhaManual = null;

    aplicarDeteccao(solicitacoes);
    render();

    if (ignoradas.length > 0) {
      aviso(`${ignoradas.length} linha(s) do WhatsApp descartadas (carimbo, menção ou confirmação).`);
    }
  }

  const TODOS_FORMATOS = ['email', 'auditoria', 'lote', 'twap'];

  /**
   * A detecção por palavra-chave **pré-seleciona** os formatos, por solicitação, e as caixas
   * mostram a união do que foi detectado. Mexer numa caixa vale para todas e vence a detecção,
   * porque a palavra pode aparecer por acaso no texto do cliente.
   */

  function aplicarDeteccao(solicitacoes) {
    estado.detectados = solicitacoes.map((s) => TODOS_FORMATOS.filter((f) => s.saidas[f]));

    const uniao = TODOS_FORMATOS.filter((f) => estado.detectados.some((d) => d.includes(f)));
    $('deteccao').textContent = uniao.length
      ? 'detectado no texto: ' + uniao.map((f) => ROTULOS[f]).join(', ')
      : 'nada detectado no texto — marque o formato desejado';

    sincronizarCaixas(uniao);
  }

  function sincronizarCaixas(marcados) {
    for (const caixa of document.querySelectorAll('#formatos input')) {
      caixa.checked = marcados.includes(caixa.value);
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────────────────────── */

  function render() {
    const temAlgo = estado.solicitacoes.length > 0;
    vazio.hidden = temAlgo;

    container.innerHTML = estado.solicitacoes
      .map((s, i) => renderCartao(s, i, formatosDe(i), estado.confirmados[i]))
      .join('');
  }

  function renderSaidasDe(indice) {
    const cartao = container.querySelector(`[data-solicitacao="${indice}"] .area-saidas`);
    if (!cartao) return;
    cartao.innerHTML = renderSaidas(estado.solicitacoes[indice], formatosDe(indice), estado.confirmados[indice]);
  }

  /* ── Edição do preview ────────────────────────────────────────────────────────────────── */

  const indiceDo = (el, atributo) => {
    const alvo = el.closest(`[data-${atributo}]`);
    return alvo ? Number(alvo.dataset[atributo]) : null;
  };

  const CAMPOS = ['conta', 'ativo', 'operacao', 'tipo', 'valor', 'preco', 'hora-inicial', 'hora-final'];

  const campoDe = (el) => CAMPOS.find((c) => el.classList.contains('campo-' + c)) ?? null;

  container.addEventListener('input', tratarEdicao);
  container.addEventListener('change', tratarEdicao);

  function tratarEdicao(e) {
    const campo = e.target.classList?.contains('campo') ? campoDe(e.target) : null;
    if (!campo) return;

    const iSolicitacao = indiceDo(e.target, 'solicitacao');
    const iOrdem = indiceDo(e.target, 'ordem');
    if (iSolicitacao === null) return;

    aplicarEdicao(estado.solicitacoes[iSolicitacao], campo, e.target.value, iOrdem);

    // Trocar quantidade por financeiro muda o que a célula de valor mostra, então a linha
    // inteira precisa ser refeita — nos outros campos, refazer tiraria o foco no meio da digitação.
    if (campo === 'tipo') {
      render();
    } else {
      renderSaidasDe(iSolicitacao);
    }
  }

  container.addEventListener('click', async (e) => {
    const iSolicitacao = indiceDo(e.target, 'solicitacao');
    if (iSolicitacao === null) return;
    const solicitacao = estado.solicitacoes[iSolicitacao];

    // Controles segmentados (Compra/Venda, Qtd/R$). Aqui o cartão inteiro é refeito sem custo:
    // nenhum campo de texto está em foco quando se clica num deles.
    const segmento = e.target.closest('[data-campo]');
    if (segmento) {
      aplicarEdicao(solicitacao, segmento.dataset.campo, segmento.dataset.valor, indiceDo(segmento, 'ordem'));
      render();

      // A linha nova do botão + já recebe o cursor no campo do ativo.
      if (segmento.dataset.campo === 'adicionar-ordem') {
        container.querySelector(`[data-solicitacao="${iSolicitacao}"] tbody tr:last-child .campo-ativo`)?.focus();
      }
      return;
    }

    const remover = e.target.closest('.btn-remover');
    if (remover) {
      solicitacao.ordens.splice(indiceDo(remover, 'ordem'), 1);
      return render();
    }

    const confirmar = e.target.closest('[data-confirmar]');
    if (confirmar) {
      estado.confirmados[iSolicitacao].add(confirmar.dataset.confirmar);
      return renderSaidasDe(iSolicitacao);
    }

    const copiarBotao = e.target.closest('[data-copiar]');
    if (copiarBotao) {
      const formato = copiarBotao.dataset.copiar;
      const saida = gerar(solicitacao, formato, estado.confirmados[iSolicitacao]);
      if (!saida) return aviso('Resolva os bloqueios antes de copiar.');

      const ok = await copiar(saida.texto, saida.html);
      aviso(ok ? `${ROTULOS[formato]} copiado.` : 'Não consegui copiar.');

      if (ok) {
        historico.registrar({
          conta: solicitacao.conta,
          ativos: solicitacao.ordens.map((o) => o.ativo),
          formato: ROTULOS[formato],
          textoOriginal: estado.textoOriginal
        });
        atualizarContadorHistorico();
      }
    }
  });

  /* ── Formatos ─────────────────────────────────────────────────────────────────────────── */

  $('formatos').addEventListener('change', () => {
    // Mexer nas caixas passa a valer para todas as solicitações, sobrepondo a detecção.
    estado.escolhaManual = [...document.querySelectorAll('#formatos input:checked')].map((c) => c.value);
    render();
  });

  /* ── Entrada ──────────────────────────────────────────────────────────────────────────── */

  entrada.addEventListener('input', () => {
    const linhas = entrada.value.split('\n').filter((l) => l.trim()).length;
    $('contador-linhas').textContent = `${linhas} ${linhas === 1 ? 'linha' : 'linhas'}`;
  });

  $('btn-analisar').addEventListener('click', analisar);

  $('btn-limpar').addEventListener('click', () => {
    entrada.value = '';
    entrada.dispatchEvent(new Event('input'));
    estado.solicitacoes = [];
    render();
  });

  $('btn-colar').addEventListener('click', async () => {
    const texto = await colar();
    if (!texto) return aviso('Sem permissão para ler a área de transferência — cole com Ctrl+V.');
    entrada.value = texto;
    entrada.dispatchEvent(new Event('input'));
    analisar();
  });

  /* ── Histórico ────────────────────────────────────────────────────────────────────────── */

  const drawer = $('drawer-historico');
  const overlay = $('overlay-historico');

  const abrirHistorico = () => {
    drawer.classList.add('open');
    overlay.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    renderHistorico();
  };

  const fecharHistorico = () => {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  };

  function atualizarContadorHistorico() {
    $('contador-historico').textContent = historico.listar().length;
  }

  function renderHistorico(termo = '') {
    const itens = historico.buscar(termo);
    $('lista-historico').innerHTML = itens.length
      ? itens
          .map((e) => {
            const quando = new Date(e.quando);
            return `
              <div class="history-item" data-id="${esc(e.id)}">
                <div class="history-item-header">
                  <span class="badge">${esc(e.formato)}</span>
                  <span class="history-time">${quando.toLocaleDateString('pt-BR')} ${quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="history-item-body">
                  <div class="history-client-row"><span class="history-client">Conta ${esc(e.conta)}</span></div>
                  <div class="history-tickers">${esc((e.ativos ?? []).join(', '))}</div>
                </div>
                <div class="history-actions">
                  <button class="btn-history-load" data-reabrir="${esc(e.id)}">Reabrir</button>
                  <button class="btn-history-delete" data-remover="${esc(e.id)}">&times;</button>
                </div>
              </div>`;
          })
          .join('')
      : '<div class="empty-state pequeno"><p>Nada no histórico ainda.</p></div>';
  }

  $('btn-historico').addEventListener('click', abrirHistorico);
  $('btn-fechar-historico').addEventListener('click', fecharHistorico);
  overlay.addEventListener('click', fecharHistorico);
  $('busca-historico').addEventListener('input', (e) => renderHistorico(e.target.value));

  $('btn-limpar-historico').addEventListener('click', () => {
    if (!confirm('Apagar todo o histórico?')) return;
    historico.limpar();
    renderHistorico();
    atualizarContadorHistorico();
  });

  $('lista-historico').addEventListener('click', (e) => {
    const reabrir = e.target.closest('[data-reabrir]');
    if (reabrir) {
      const item = historico.listar().find((x) => x.id === reabrir.dataset.reabrir);
      if (!item) return;
      // Reabrir passa o texto original pelo pipeline de novo, em vez de restaurar uma
      // saída congelada: o que o operador vê é sempre o resultado das regras atuais.
      entrada.value = item.textoOriginal;
      entrada.dispatchEvent(new Event('input'));
      analisar();
      fecharHistorico();
      return;
    }

    const remover = e.target.closest('[data-remover]');
    if (remover) {
      historico.remover(remover.dataset.remover);
      renderHistorico($('busca-historico').value);
      atualizarContadorHistorico();
    }
  });

  /* ── Atalhos ──────────────────────────────────────────────────────────────────────────── */

  document.addEventListener('keydown', (e) => {
    // Com outra aba à vista, Ctrl+Enter e Alt+H são de quem está na tela, não do Ordens.
    if (secao.hidden) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      analisar();
    } else if (e.altKey && (e.key === 'h' || e.key === 'H')) {
      e.preventDefault();
      drawer.classList.contains('open') ? fecharHistorico() : abrirHistorico();
    } else if (e.key === 'Escape' && drawer.classList.contains('open')) {
      fecharHistorico();
    }
  });

  atualizarContadorHistorico();
  render();
};
