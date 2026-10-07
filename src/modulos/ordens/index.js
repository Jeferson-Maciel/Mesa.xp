import XLSX from '../../vendor/xlsx.full.min.js';
import { ErroDosAssessores, lerPlanilhaDosAssessores } from './core/cliente/assessores.js';
import { clienteParaOEmail, lerClienteDoRobo } from './core/cliente/cliente.js';
import { parseSolicitacoes } from './core/parse/parseSolicitacoes.js';
import { ErroDoEstoque, chaveDoFundo, lerCapturaDoHub, lerPlanilhaDoSecundario } from './core/secundario/estoque.js';
import { LIMITE_DA_COTACAO_MIN, secundarioDaOrdem } from './core/secundario/secundario.js';
import { lerPercentual } from './core/util/dinheiro.js';
import * as guardadoDosAssessores from './platform/assessores.js';
import { copiar, colar } from './platform/clipboard.js';
import { enderecoDoFavorito } from './platform/favoritoDoHub.js';
import { ErroDoRobo, VERSAO_DO_ROBO, criarRoboHub, scriptDoRobo } from './platform/roboHub.js';
import * as historico from './platform/historico.js';
import { abrirNoOutlook, enderecoDoEmail } from './platform/outlook.js';
import * as guardado from './platform/secundario.js';
import { renderCliente } from './ui/cliente.js';
import { aplicarEdicao, renderCartao } from './ui/preview.js';
import { formatarTempos } from './ui/tempos.js';
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
    textoOriginal: '',
    // Os fundos do secundário e os tetos de ROA anotados sobrevivem ao recarregar a página.
    estoque: guardado.carregarEstoque(),
    tetos: guardado.carregarTetos(),
    // O preço exato da cota de cada fundo, trazido da boleta pelo robô do Hub.
    cotas: guardado.carregarCotas(),
    // O cliente de cada conta, trazido da ficha do Hub pelo robô: nome, e-mail e assessor. Fica só na
    // memória desta página, nunca guardado (decisão do operador em 07/10/2026).
    clientes: new Map(),
    // A planilha dos assessores, carregada à mão: liga o código do assessor ao e-mail dele.
    assessores: guardadoDosAssessores.carregar()
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
    mostrarEstoque(); // a página pode ter ficado aberta de um dia para o outro

    estado.solicitacoes = solicitacoes;
    estado.confirmados = solicitacoes.map(() => new Set());
    estado.textoOriginal = texto;
    estado.escolhaManual = null;

    aplicarDeteccao(solicitacoes);
    render();
    encenar();

    if (ignoradas.length > 0) {
      aviso(`${ignoradas.length} linha(s) do WhatsApp descartadas (carimbo, menção ou confirmação).`);
    }

    // Pedido com compra de fundo: o robô do Hub traz a cotação do momento, se a que está aqui já
    // tem mais de 2 minutos. Sem o robô, segue com o que foi carregado.
    const temCompraDeFundo = solicitacoes.some((s) => s.ordens.some((o) => o.fundo?.situacao === 'exato' && o.operacao === 'C'));
    const idade = estado.estoque ? Date.now() - new Date(estado.estoque.exportadaEm) : Infinity;
    // Depois da cotação, o preço exato da cota de cada fundo pedido em R$, que só a boleta mostra.
    if (temCompraDeFundo && robo.presente) {
      comecarRodada(solicitacoes);
      const cotacao = idade > 2 * 60 * 1000 ? atualizarCotacoes({ automatico: true }) : Promise.resolve();
      cotacao.then(() => buscarPrecosExatos()).then(() => fecharRodada());
    }

    // Ao mesmo tempo, noutra aba do robô, o cliente de cada conta: nome, e-mail e assessor.
    buscarClientes(solicitacoes.map((s) => s.conta));
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

  /**
   * O que os fundos do secundário dizem de cada ordem, refeito antes de cada render: a conversão
   * depende do valor, do fundo, do ROA escolhido, do teto e dos fundos carregados — qualquer um deles
   * pode ter acabado de mudar. O validador e o e-mail leem o resultado em `ordem.secundario`.
   */
  function calcularSecundario(solicitacoes) {
    const contexto = { estoque: estado.estoque, tetos: estado.tetos, cotas: estado.cotas, hoje: new Date() };
    for (const s of solicitacoes) {
      // O ROA máximo ou o zerado é escolhido para a solicitação inteira, nos botões de copiar.
      for (const ordem of s.ordens) ordem.secundario = secundarioDaOrdem(ordem, { ...contexto, semRoa: s.semRoa === true });
    }
  }

  /**
   * O cliente da conta, como o cartão e o e-mail o usam: refeito a cada render, porque a conta pode
   * ter acabado de ser editada — o nome de um cliente nunca fica no e-mail de outra conta — e a
   * planilha dos assessores pode ter acabado de chegar.
   */
  function clienteDe(conta) {
    const registro = estado.clientes.get(String(conta ?? ''));
    if (!registro || registro.situacao !== 'achado') return registro ?? null;
    return { situacao: 'achado', ...clienteParaOEmail(registro.dados, estado.assessores?.lista ?? null) };
  }

  function render() {
    calcularSecundario(estado.solicitacoes);
    for (const s of estado.solicitacoes) s.cliente = clienteDe(s.conta);
    const temAlgo = estado.solicitacoes.length > 0;
    vazio.hidden = temAlgo;

    container.innerHTML = estado.solicitacoes
      .map((s, i) => renderCartao(s, i, formatosDe(i), estado.confirmados[i]))
      .join('');
  }

  // Uma análise nova entra em cena — cartão, linhas e saídas em sequência (ordens.css). Editar o
  // cartão depois refaz o HTML, mas não repete a entrada: ela seria um piscar a cada clique.
  let fimDaCena = null;
  function encenar() {
    container.classList.remove('entrando');
    void container.offsetWidth; // recomeça a animação quando se analisa duas vezes seguidas
    container.classList.add('entrando');
    clearTimeout(fimDaCena);
    fimDaCena = setTimeout(() => container.classList.remove('entrando'), 1600);
  }

  // Refaz a linha do cliente e as saídas de um cartão, sem tocar na tabela em que se digita.
  function renderSaidasDe(indice) {
    const cartao = container.querySelector(`[data-solicitacao="${indice}"] .area-saidas`);
    if (!cartao) return;
    const solicitacao = estado.solicitacoes[indice];
    calcularSecundario([solicitacao]);
    solicitacao.cliente = clienteDe(solicitacao.conta);
    container.querySelector(`[data-solicitacao="${indice}"] .area-cliente`).innerHTML = renderCliente(solicitacao.cliente);
    cartao.innerHTML = renderSaidas(solicitacao, formatosDe(indice), estado.confirmados[indice]);
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

    // A conta corrigida, ao sair do campo: o cliente dela vem do Hub. A cada tecla, não.
    if (campo === 'conta' && e.type === 'change') buscarClientes([estado.solicitacoes[iSolicitacao].conta]);
  }

  container.addEventListener('click', async (e) => {
    const iSolicitacao = indiceDo(e.target, 'solicitacao');
    if (iSolicitacao === null) return;
    const solicitacao = estado.solicitacoes[iSolicitacao];

    // Controles segmentados (Compra/Venda, Qtd/R$). Aqui o cartão inteiro é refeito sem custo:
    // nenhum campo de texto está em foco quando se clica num deles.
    const segmento = e.target.closest('[data-campo]');
    // O conserto do bloqueio de cotação velha não edita a ordem: pede uma cotação nova ao robô.
    if (segmento?.dataset.campo === 'atualizar-cotacoes') return atualizarCotacoes();
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

    // Abrir no Outlook: um e-mail novo no Outlook na web, com o assunto e o texto à vista, o cliente
    // no Para e o assessor em cópia, quando o robô e a planilha os trouxeram. O texto que cabe no
    // endereço não é copiado — a área de transferência pode estar guardando algo que a pessoa vai
    // colar. A tabela, e o texto longo demais, vão copiados para colar no corpo.
    let outlookBotao = e.target.closest('[data-outlook]');
    if (outlookBotao) {
      const formato = outlookBotao.dataset.outlook;

      // Refeita antes, como no Copiar: a conta, o cliente e a idade da cotação são os de agora.
      renderSaidasDe(iSolicitacao);
      outlookBotao = container.querySelector(`[data-solicitacao="${iSolicitacao}"] [data-outlook="${formato}"]`);

      const saida = gerar(solicitacao, formato, estado.confirmados[iSolicitacao]);
      if (!saida) return aviso('Resolva os bloqueios antes de abrir o e-mail.');

      const cliente = solicitacao.cliente?.situacao === 'achado' ? solicitacao.cliente : null;
      const enderecos = { para: cliente?.email ?? null, cc: cliente?.assessor.email ?? null };
      const comCorpo = saida.html ? null : enderecoDoEmail({ ...enderecos, corpo: saida.texto });
      if (!comCorpo && !(await copiar(saida.texto, saida.html))) {
        return aviso('Não consegui copiar o e-mail para colar no Outlook.', { tipo: 'erro' });
      }
      if (!abrirNoOutlook(comCorpo ?? enderecoDoEmail(enderecos))) {
        return aviso('O navegador bloqueou a janela do Outlook: permita janelas pop-up para esta página.', { tipo: 'erro' });
      }

      // O aviso diz o que ficou de fora do e-mail, para a pessoa completar no Outlook.
      const faltou = [
        !enderecos.para && (solicitacao.cliente?.situacao === 'buscando' ? 'o cliente ainda não tinha chegado do Hub' : 'sem o e-mail do cliente'),
        enderecos.para && !enderecos.cc && 'sem o assessor em cópia'
      ].filter(Boolean);
      const resto = faltou.length ? ` — ${faltou.join('; ')}` : '';
      if (comCorpo) aviso(`E-mail aberto no Outlook${resto}.`);
      else if (saida.html) aviso(`Outlook aberto: cole o e-mail com a tabela no corpo (Ctrl+V)${resto}.`);
      else aviso(`O texto é longo para ir junto: cole-o no corpo do e-mail (Ctrl+V)${resto}.`);

      if (outlookBotao) {
        outlookBotao.classList.add('copiado');
        setTimeout(() => outlookBotao.classList.remove('copiado'), 1600);
      }
      historico.registrar({
        conta: solicitacao.conta,
        ativos: solicitacao.ordens.map((o) => o.ativo),
        formato: ROTULOS[formato],
        textoOriginal: estado.textoOriginal
      });
      return atualizarContadorHistorico();
    }

    let copiarBotao = e.target.closest('[data-copiar]');
    if (copiarBotao) {
      const formato = copiarBotao.dataset.copiar;
      const { roa } = copiarBotao.dataset;

      // Fundo no secundário: o botão escolhe o ROA do e-mail inteiro. A área é refeita antes de
      // copiar — com a conta e a idade da cotação de agora, porque a página pode ter ficado aberta
      // —, para o texto à vista ser o copiado; o botão novo é que recebe o visto.
      if (roa) aplicarEdicao(solicitacao, roa === 'zerado' ? 'roa-zerado' : 'roa-maximo', '');
      renderSaidasDe(iSolicitacao);
      copiarBotao = container.querySelector(
        `[data-solicitacao="${iSolicitacao}"] [data-copiar="${formato}"]${roa ? `[data-roa="${roa}"]` : ''}`
      );

      const saida = gerar(solicitacao, formato, estado.confirmados[iSolicitacao]);
      if (!saida) return aviso('Resolva os bloqueios antes de copiar.');

      const ok = await copiar(saida.texto, saida.html);
      const comRoa = roa ? (roa === 'zerado' ? ', com ROA zerado' : ', com ROA máximo') : '';
      aviso(ok ? `${ROTULOS[formato]} copiado${comRoa}.` : 'Não consegui copiar.');
      if (ok && copiarBotao) {
        copiarBotao.classList.add('copiado');
        setTimeout(() => copiarBotao.classList.remove('copiado'), 1600);
      }

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

  /* ── Secundário ───────────────────────────────────────────────────────────────────────── */

  // O teto do ROA é anotado no cartão e vale para o fundo, não para a ordem: fica guardado com o
  // deságio do dia, para o aviso de teto antigo saber quando o deságio mudou. Grava ao sair do
  // campo (`change`), não a cada tecla — a área refeita tiraria o foco no meio da digitação.
  container.addEventListener('change', (e) => {
    const campo = e.target.closest('.campo-teto');
    if (!campo) return;

    const iSolicitacao = indiceDo(campo, 'solicitacao');
    const ordem = estado.solicitacoes[iSolicitacao]?.ordens[indiceDo(campo, 'ordem')];
    const fundo = ordem?.secundario?.fundo;
    if (!fundo) return;

    const chave = chaveDoFundo(fundo.nome);
    const teto = lerPercentual(campo.value);

    if (campo.value.trim() === '') {
      delete estado.tetos[chave];
    } else if (teto === null) {
      aviso('ROA máximo inválido — use um número como 0,50.', { tipo: 'erro' });
      return;
    } else {
      estado.tetos[chave] = { teto, desagio: fundo.desagio, em: new Date().toISOString().slice(0, 10) };
    }

    guardado.salvarTetos(estado.tetos);
    // O mesmo fundo pode estar em outros cartões: todos passam a usar o teto novo.
    render();
  });

  const statusDoEstoque = $('estoque-status');

  function mostrarEstoque() {
    const { estoque } = estado;
    if (!estoque) {
      statusDoEstoque.textContent = 'nenhum arquivo carregado';
      statusDoEstoque.classList.remove('antiga');
      $('estado-cotacao').dataset.estado = 'vazio';
      return;
    }

    const exportada = new Date(estoque.exportadaEm);
    const deHoje = exportada.toDateString() === new Date().toDateString();
    const dia = exportada.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const hora = exportada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const origem = estoque.origem === 'hub' ? 'captura do Hub' : 'planilha';
    const fundos = `${estoque.fundos.length} fundos`;

    // A idade conta para o e-mail de fundo em R$ (LIMITE_DA_COTACAO_MIN), por isso fica à vista.
    const minutos = Math.floor((Date.now() - exportada) / 60000);
    const idade = minutos < 1 ? 'agora' : minutos < 120 ? `há ${minutos} min` : `há ${Math.floor(minutos / 60)} h`;
    statusDoEstoque.textContent = deHoje
      ? `${origem} das ${hora}, ${idade} · ${fundos}`
      : `${origem} de ${dia} às ${hora} · ${fundos} · não é de hoje`;
    statusDoEstoque.classList.toggle('antiga', !deHoje || minutos > LIMITE_DA_COTACAO_MIN);
    $('estado-cotacao').dataset.estado = deHoje && minutos <= LIMITE_DA_COTACAO_MIN ? 'pronto' : 'atencao';
  }
  setInterval(mostrarEstoque, 30000);

  // Dois arquivos servem: a captura do favorito do Hub (.json, com o ROA de cada fundo) e a
  // exportação "Todos os fundos" (.xlsx, sem ele).
  async function carregarPlanilha(arquivo) {
    const doHub = /\.json$/i.test(arquivo.name) || arquivo.type === 'application/json';
    try {
      // Sem a hora da captura, a data do arquivo baixado é a hora em que ele saiu do Hub.
      const dataDoArquivo = new Date(arquivo.lastModified || Date.now()).toISOString();
      const { capturadaEm, fundos } = doHub
        ? lerCapturaDoHub(await arquivo.text())
        : { capturadaEm: null, fundos: lerPlanilhaDoSecundario(await arquivo.arrayBuffer(), XLSX) };

      estado.estoque = {
        arquivo: arquivo.name,
        exportadaEm: capturadaEm ?? dataDoArquivo,
        origem: doHub ? 'hub' : 'planilha',
        fundos
      };
      guardado.salvarEstoque(estado.estoque);
      mostrarEstoque();
      render();
      aviso(doHub ? `Fundos do Hub carregados: ${fundos.length}, com o ROA de cada um.` : `Planilha do secundário carregada: ${fundos.length} fundos.`);
    } catch (erro) {
      aviso(erro instanceof ErroDoEstoque ? erro.message : 'Não consegui ler o arquivo do secundário.', { tipo: 'erro' });
    }
  }

  // O favorito é levado para a barra de favoritos arrastando; clicado aqui, ele rodaria na Mesa,
  // não no Hub. O endereço entra por código: a marcação estática não aponta para nada.
  const favorito = $('favorito-hub');
  favorito.href = enderecoDoFavorito();
  favorito.addEventListener('click', (e) => {
    e.preventDefault();
    aviso('Arraste o 📥 para a barra de favoritos e use-o no Hub, na Prateleira do secundário.');
  });

  /* ── Robô do Hub ──────────────────────────────────────────────────────────────────────── */

  // O robô roda no Tampermonkey: quando a Mesa pede, ele atualiza a Prateleira na aba do Hub e
  // devolve a resposta do próprio Hub. Sem ele, a Mesa segue com o 📥 e a planilha.
  const robo = criarRoboHub();
  // O que o robô está buscando agora, para o painel dizer; vazio quando não está.
  let buscando = '';
  const statusDoRobo = $('robo-status');
  const btnAtualizarCotacoes = $('btn-atualizar-cotacoes');
  const btnCopiarRobo = $('btn-copiar-robo');
  const btnCopiarTempos = $('btn-copiar-tempos');

  /*
   * A medição de uma rodada — da colagem ao último preço exato —, para achar onde vão os segundos.
   * A Mesa anota os passos dela; no fim, pede ao robô os da aba dele e as chamadas do Hub, e
   * "Copiar tempos" entrega a linha do tempo inteira. Nada do cliente entra (ver ui/tempos.js).
   */
  let rodada = null;
  let ultimoRelatorio = '';
  const anotar = (passo, extra = {}) => rodada?.mesa.push({ em: Date.now(), passo, ...extra });

  // A rodada começa pela colagem ou pelo clique em "Atualizar cotações" (`passo`).
  function comecarRodada(solicitacoes, passo = 'colou') {
    const fundos = solicitacoes.flatMap((s) => s.ordens).filter((o) => o.fundo?.situacao === 'exato' && o.operacao === 'C').length;
    rodada = { inicio: Date.now(), mesa: [], nomes: {} };
    anotar(passo, { fundos });
  }

  async function fecharRodada() {
    if (!rodada) return;
    const fechada = rodada;
    rodada = null;
    const doRobo = await robo.pedirRegistro(fechada.inicio);
    ultimoRelatorio = formatarTempos({ ...fechada, versao: robo.versao, robo: doRobo });
    btnCopiarTempos.hidden = false;
    console.info(ultimoRelatorio);
  }

  // O carregamento à mão (arquivo e favorito 📥) fica recolhido quando há robô, e aberto sem ele.
  const manual = $('secundario-manual');
  let roboVisto = null;

  function mostrarRobo() {
    const desatualizado = robo.presente && robo.versao !== VERSAO_DO_ROBO;
    const [texto, estadoDoRobo] = !robo.presente
      ? ['não instalado', 'vazio']
      : buscando
        ? [buscando, 'buscando']
        : desatualizado
          ? [`versão ${robo.versao} instalada — copie a ${VERSAO_DO_ROBO}`, 'atencao']
          : robo.hub?.robo
            ? ['pronto · aba 🤖 do Hub aberta', 'pronto']
            : ['pronto · abre a aba 🤖 do Hub quando precisar', 'vazio'];
    statusDoRobo.textContent = texto;
    $('estado-robo').dataset.estado = estadoDoRobo;
    if (roboVisto !== robo.presente) {
      roboVisto = robo.presente;
      manual.open = !robo.presente;
    }
    statusDoRobo.classList.toggle('antiga', desatualizado);
    statusDoRobo.classList.toggle('buscando', Boolean(buscando));
    btnAtualizarCotacoes.hidden = !robo.presente;
    btnAtualizarCotacoes.disabled = Boolean(buscando);
    btnCopiarRobo.hidden = robo.presente && !desatualizado;
  }

  /** Toda captura que o robô traz — pedida pela Mesa ou feita à mão no Hub — vira o estoque do dia. */
  function usarCapturaDoRobo({ capturadaEm, resposta }) {
    if (estado.estoque && new Date(estado.estoque.exportadaEm) >= new Date(capturadaEm)) return;
    try {
      const { fundos } = lerCapturaDoHub(resposta);
      estado.estoque = { arquivo: 'robô do Hub', exportadaEm: capturadaEm, origem: 'hub', fundos };
    } catch (erro) {
      aviso(erro instanceof ErroDoEstoque ? erro.message : 'O robô trouxe do Hub uma resposta que não reconheço.', { tipo: 'erro' });
      return;
    }
    guardado.salvarEstoque(estado.estoque);
    mostrarEstoque();
    render();
  }

  // Enquanto a cotação não chega, o bloco do Secundário de cada cartão diz que ela está a caminho.
  function marcarBusca(texto) {
    buscando = texto;
    for (const s of estado.solicitacoes) s.buscandoCotacao = Boolean(texto);
    mostrarRobo();
    render();
  }

  /** O preço exato de um fundo, com a hora em que foi lido: serve a qualquer pedido enquanto vale. */
  function guardarCota({ fundoId, valor, dataDaCota, em = Date.now() }) {
    estado.cotas[fundoId] = { valor, dataDaCota, em };
    guardado.salvarCotas(estado.cotas);
  }

  /**
   * O preço exato da cota de cada fundo pedido em R$ que não tem um válido — de até 10 minutos, do
   * mesmo dia de cota e do mesmo PU da Prateleira (`secundario.js`) —, só onde ele
   * pode mudar as cotas, que abrir a boleta custa segundos. O robô abre as boletas uma atrás da
   * outra, na aba dele, para a conta do pedido, e traz só o preço; cada um entra no cartão assim que
   * chega (`aoReceberCota`). Sem ele, as cotas seguem pela conta conservadora, que nunca passa do
   * pedido.
   */
  async function buscarPrecosExatos() {
    // Robô de outra versão: o painel já pede a cópia nova, e um robô velho deixaria a Mesa esperando.
    if (buscando || !robo.presente || robo.versao !== VERSAO_DO_ROBO || estado.estoque?.origem !== 'hub') return;

    const pedidos = [];
    const dispensados = new Set();
    for (const s of estado.solicitacoes) {
      if (!/^\d{5,8}$/.test(String(s.conta ?? ''))) continue;
      for (const o of s.ordens) {
        const sec = o.secundario;
        const fundo = sec?.fundo;
        if (!sec?.porValor || sec.puExato || !fundo?.id || !fundo.dataDaCota) continue;
        if (pedidos.some((p) => p.fundoId === fundo.id)) continue;
        if (rodada) rodada.nomes[fundo.id] = o.ativo;
        if (sec.precoExatoMuda) pedidos.push({ fundoId: fundo.id, conta: s.conta, nome: o.ativo });
        else dispensados.add(fundo.id);
      }
    }
    for (const fundoId of dispensados) {
      if (!pedidos.some((p) => p.fundoId === fundoId)) anotar('dispensou o preço', { fundoId });
    }
    if (pedidos.length === 0) return;

    marcarBusca('buscando o preço exato da cota…');
    anotar('pediu os preços', { fundoIds: pedidos.map((p) => p.fundoId) });
    const anotados = new Set();
    const anotarResultado = ({ fundoId, erro }) => {
      anotados.add(fundoId);
      anotar(erro ? 'não recebeu o preço' : 'recebeu o preço', erro ? { fundoId, motivo: erro.codigo } : { fundoId });
    };
    const resultados = await robo.pedirCotas({ itens: pedidos, aoChegar: anotarResultado });
    for (const r of resultados) if (!anotados.has(r.fundoId)) anotarResultado(r);
    marcarBusca('');

    const falharam = resultados.filter((r) => r.erro);
    if (falharam.length > 0) {
      const nomes = falharam.map((r) => pedidos.find((p) => p.fundoId === r.fundoId)?.nome ?? 'um fundo');
      aviso(
        `Não consegui o preço exato de ${nomes.join(', ')} na boleta do Hub: ${falharam[0].erro.message}. ` +
          'O e-mail está certo: as cotas saem pela conta arredondada (≈) e podem ficar umas abaixo do máximo.',
        { tipo: 'erro' }
      );
    }
  }

  async function atualizarCotacoes({ automatico = false } = {}) {
    if (buscando) return;
    if (!robo.presente) {
      if (!automatico) aviso('Sem o robô do Hub: instale-o (Copiar robô) ou carregue os fundos pelo 📥.');
      return;
    }

    marcarBusca('buscando cotações no Hub…');
    anotar('pediu a cotação');
    try {
      const { capturadaEm } = await robo.pedirCotacao();
      anotar('recebeu a cotação');
      const hora = new Date(capturadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      aviso(`Cotações do Hub atualizadas às ${hora}.`);
    } catch (erro) {
      anotar('não recebeu a cotação', { motivo: erro instanceof ErroDoRobo ? erro.codigo : 'erro' });
      aviso(
        erro instanceof ErroDoRobo && erro.codigo === 'sem-resposta'
          ? 'O Hub não respondeu em 30 s. Veja se a aba do Hub está aberta, logada e na Prateleira.'
          : 'Não consegui atualizar as cotações.',
        { tipo: 'erro' }
      );
    } finally {
      marcarBusca('');
    }
  }

  /* ── O cliente e o assessor ───────────────────────────────────────────────────────────── */

  // O cliente chegou (ou falhou): só a linha dele e as saídas dos cartões dessa conta são refeitas.
  function mostrarCliente(conta) {
    estado.solicitacoes.forEach((s, i) => {
      if (String(s.conta ?? '') === conta) renderSaidasDe(i);
    });
  }

  /**
   * O cliente de cada conta, pelo robô: ele abre a ficha no Hub, na aba de clientes dele, e traz só
   * o nome, o e-mail e o assessor. Uma conta por vez — a aba é uma só —, e a que já veio nesta página
   * não é pedida de novo. Sem o robô, ou com outra versão dele, o e-mail segue com "Cliente".
   */
  let filaDeClientes = Promise.resolve();
  function buscarClientes(contas) {
    if (!robo.presente || robo.versao !== VERSAO_DO_ROBO) return;
    for (const conta of new Set(contas.map((c) => String(c ?? '')))) {
      if (!/^\d{5,8}$/.test(conta) || ['buscando', 'achado'].includes(estado.clientes.get(conta)?.situacao)) continue;
      estado.clientes.set(conta, { situacao: 'buscando' });
      mostrarCliente(conta);
      filaDeClientes = filaDeClientes.then(async () => {
        try {
          const dados = lerClienteDoRobo(await robo.pedirCliente(conta), conta);
          estado.clientes.set(conta, dados ? { situacao: 'achado', dados } : { situacao: 'falhou', motivo: 'o Hub trouxe a ficha de outra conta' });
        } catch (erro) {
          estado.clientes.set(conta, { situacao: 'falhou', motivo: erro instanceof ErroDoRobo ? erro.message : 'não consegui ler a ficha no Hub' });
        }
        mostrarCliente(conta);
      });
    }
  }

  const statusDosAssessores = $('assessores-status');

  function mostrarAssessores() {
    const { assessores } = estado;
    $('estado-assessores').dataset.estado = assessores ? 'pronto' : 'vazio';
    if (!assessores) {
      statusDosAssessores.textContent = 'não carregada — o assessor fica sem cópia';
      return;
    }
    const dia = new Date(assessores.carregadaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const quantos = assessores.lista.length;
    statusDosAssessores.textContent = `${quantos} ${quantos === 1 ? 'assessor' : 'assessores'} · ${assessores.arquivo}, de ${dia}`;
  }

  /** @returns {Promise<boolean>} se o arquivo era a planilha dos assessores */
  async function carregarAssessores(arquivo, { soSeFor = false } = {}) {
    try {
      const lista = lerPlanilhaDosAssessores(await arquivo.arrayBuffer(), XLSX);
      estado.assessores = { arquivo: arquivo.name, carregadaEm: new Date().toISOString(), lista };
      guardadoDosAssessores.salvar(estado.assessores);
      mostrarAssessores();
      render();
      aviso(`Planilha dos assessores carregada: ${lista.length} com e-mail.`);
      return true;
    } catch (erro) {
      if (!soSeFor) aviso(erro instanceof ErroDosAssessores ? erro.message : 'Não consegui ler a planilha dos assessores.', { tipo: 'erro' });
      return false;
    }
  }

  const arquivoDosAssessores = $('arquivo-assessores');
  $('btn-assessores').addEventListener('click', () => arquivoDosAssessores.click());
  arquivoDosAssessores.addEventListener('change', () => {
    const arquivo = arquivoDosAssessores.files[0];
    arquivoDosAssessores.value = '';
    if (arquivo) carregarAssessores(arquivo);
  });
  mostrarAssessores();

  robo.aoMudar(mostrarRobo);
  robo.aoReceberCaptura(usarCapturaDoRobo);
  // O preço visto numa boleta que alguém abriu no Hub também fica, enquanto valer.
  robo.aoReceberCota((cota) => {
    guardarCota(cota);
    render();
  });
  btnAtualizarCotacoes.addEventListener('click', () => {
    comecarRodada(estado.solicitacoes, 'atualizou');
    atualizarCotacoes()
      .then(() => buscarPrecosExatos())
      .then(() => fecharRodada());
  });
  btnCopiarTempos.addEventListener('click', async () => {
    const ok = await copiar(ultimoRelatorio);
    aviso(ok ? 'Tempos copiados: é só colar na conversa.' : 'Não consegui copiar os tempos.');
  });
  btnCopiarRobo.addEventListener('click', async () => {
    const ok = await copiar(scriptDoRobo);
    aviso(ok ? 'Robô copiado: cole no Tampermonkey, em + (novo script), e salve.' : 'Não consegui copiar o robô.');
  });

  const arquivoDoEstoque = $('arquivo-estoque');
  $('btn-estoque').addEventListener('click', () => arquivoDoEstoque.click());
  arquivoDoEstoque.addEventListener('change', () => {
    const arquivo = arquivoDoEstoque.files[0];
    arquivoDoEstoque.value = '';
    if (arquivo) carregarPlanilha(arquivo);
  });

  // Arrastar a planilha para a aba também carrega — em qualquer ponto dela, para um arquivo solto
  // fora do painel não ser aberto pelo navegador no lugar da ferramenta. O Renda Fixa tem o
  // arrastar dele, que só vale com a aba dele à vista.
  const painelEntrada = $('painel-entrada');
  const temArquivo = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');
  secao.addEventListener('dragover', (e) => {
    if (!temArquivo(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    painelEntrada.classList.add('arrastando');
  });
  secao.addEventListener('dragleave', (e) => {
    if (!secao.contains(e.relatedTarget)) painelEntrada.classList.remove('arrastando');
  });
  secao.addEventListener('drop', async (e) => {
    if (!temArquivo(e)) return;
    e.preventDefault();
    painelEntrada.classList.remove('arrastando');
    const arquivo = e.dataTransfer.files[0];
    if (!arquivo) return;
    // O .csv só pode ser a planilha dos assessores, e o .json só a captura do Hub. O .xlsx pode ser
    // um ou outro: a dos assessores tem Nome, Email e o código do assessor.
    if (/\.csv$/i.test(arquivo.name)) return carregarAssessores(arquivo);
    if (/\.xlsx?$/i.test(arquivo.name) && (await carregarAssessores(arquivo, { soSeFor: true }))) return;
    carregarPlanilha(arquivo);
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
  mostrarEstoque();
  mostrarRobo();
  render();
};
