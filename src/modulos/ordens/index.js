import XLSX from '../../vendor/xlsx.full.min.js';
import { ErroDosAssessores, lerPlanilhaDosAssessores } from './core/cliente/assessores.js';
import { clienteParaOEmail, lerClienteDoRobo } from './core/cliente/cliente.js';
import { parseSolicitacoes } from './core/parse/parseSolicitacoes.js';
import { separarConta } from './core/texto/separarConta.js';
import { juntarPrateleira } from './core/validate/fundo.js';
import { ErroDoEstoque, chaveDoFundo, lerCapturaDoHub, lerPlanilhaDoSecundario } from './core/secundario/estoque.js';
import { ASSUNTOS_DOS_GRUPOS, ROTULOS_DOS_GRUPOS, gruposDe, recorte } from './core/format/grupos.js';
import { lerPosicoesDoHub, lerTitulosDoHub, resgateDaOrdem, tesouroDaOrdem } from './core/tesouro/tesouro.js';
import { chaveDaBoleta, lerBoletaDoHub } from './core/secundario/boletaDoHub.js';
import { LIMITE_DA_COTACAO_MIN, secundarioDaOrdem } from './core/secundario/secundario.js';
import { vendaDaOrdem } from './core/secundario/venda.js';
import { ehDiaUtil, umDiaUtilDepois } from '../../comum/diasUteis.js';
import { lerPercentual } from './core/util/dinheiro.js';
import * as guardadoDosAssessores from './platform/assessores.js';
import { copiar, colar } from './platform/clipboard.js';
import { enderecoDoFavorito } from './platform/favoritoDoHub.js';
import { ErroDoRobo, VERSAO_DO_ROBO, criarRoboHub, scriptDoRobo } from './platform/roboHub.js';
import * as historico from './platform/historico.js';
import { abrirNoOutlook, enderecoDoEmail } from '../../comum/outlook.js';
import * as guardado from './platform/secundario.js';
import { renderCliente } from './ui/cliente.js';
import { aplicarEdicao, renderCartao } from './ui/preview.js';
import { formatarTempos } from './ui/tempos.js';
import { ROTULOS, chaveDaConfirmacao, esc, gerar, renderSaidas } from './ui/saidas.js';
import { aviso } from '../../ui/avisos.js';
import { aoMudarAFila, avisarMudancaNaFila } from '../../comum/fila/eventos.js';
import { contasConhecidas, diaDe, registrarEnvio, repetidosHoje } from '../../comum/fila/regras.js';
import { filaDaPagina } from '../../comum/fila/repositorio.js';
import { registrarServico } from '../../comum/servicos.js';
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
    assessores: guardadoDosAssessores.carregar(),
    // As boletas do secundário lidas pelo robô (`core/secundario/boletaDoHub.js`): as de venda trazem a
    // posição do cliente, e por isso ficam só na memória desta página, como o cliente.
    boletas: {},
    // Os prints da cotação de venda, tirados pelo robô na boleta: valem um dia útil, e também ficam
    // só na memória da página.
    prints: new Map(),
    // A lista do Tesouro Direto de cada conta, lida pelo robô no Hub, com a hora: a taxa muda ao longo
    // do dia. Só na memória da página.
    tesouro: new Map(),
    // A posição de cada conta no Tesouro, para o resgate (robô 1.7.0). Também só na memória.
    posicoesTesouro: new Map(),
    // A Fila do dia (src/comum/fila): os pedidos de hoje, para o aviso de pedido repetido, e as contas
    // que já passaram por ela ou pelo histórico, para o de conta nova.
    fila: { hoje: [], contas: new Set() },
    contasDoHistorico: new Set(historico.listar().map((e) => String(e.conta)))
  };

  // Os fundos da prateleira guardada entram no catálogo dos nomes, junto com a lista gerada: fundo
  // novo é reconhecido sem esperar `npm run fundos:update` (core/validate/fundo.js).
  juntarPrateleira(estado.estoque?.fundos);

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
    'Ticker suspeito': '1234567\nCOMPRA\nKCNR11 100',
    // Um de cada grupo de e-mail (20/10/2026): bolsa, fundos comprados, fundos vendidos, e o misto.
    'Bolsa · compra e venda': '1234567\nvia email\nV KLBN11 674qtds\nC VULC3 R$ 11.800,00',
    'Fundos · Estoque clientes':
      '1234567\nvia email\nCompras\nIMOV11 - Navi Hedge Fund    R$20.000,00 (Estoque cliente)\nXPHF11 - XP Hedge Fund    R$10.000,00 (Estoque cliente o que for possível)',
    'Fundos · venda':
      '1234567\nvia email\nVendas | Quantidade Total\nRiza Malls Feeder FII RL\nTG Renda Urbana Feeder FII RL\n\nV 590qtds XP Habitat Renda Imobiliária II Feeder FII RL',
    'Tesouro · aplicação': '1234567\nvia email\nCompra\nTesouro Selic 2031 R$ 2.000,00\nComprar 5k\nTesouro Prefixado 2029',
    'Tesouro · resgate': '1234567\nvia email\nResgate\nTesouro Selic 2031 R$ 5.000,00\nTesouro Selic 2029 total',
    'Pedido misto':
      '1234567\nvia email\n\nV KLBN11 674qtds\nC VULC3 R$ 11.800,00\n\nVendas | Quantidade Total\nPAAG11 - Pátria Crédito Agrícola FiAgro\nBGR Galpões Logísticos I Feeder FII\n\nCompras\nAZ Quest Panorama Data Centers FII RL    R$50.000,00\nIMOV11 - Navi Hedge Fund    R$52.832,35 (Estoque cliente)\nBrio Renda Mais FII RL    R$52.000,00'
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
    // A Fila de hoje relida: a página pode ter virado o dia aberta. Refaz o cartão quando chega.
    carregarFila();

    if (ignoradas.length > 0) {
      aviso(`${ignoradas.length} linha(s) do WhatsApp descartadas (carimbo, menção ou confirmação).`);
    }

    // Pedido com fundo do secundário: o robô do Hub traz a cotação do momento, se a que está aqui já
    // tem mais de 2 minutos. Sem o robô, segue com o que foi carregado.
    const temFundo = solicitacoes.some((s) => s.ordens.some((o) => o.fundo?.situacao === 'exato'));
    const idade = estado.estoque ? Date.now() - new Date(estado.estoque.exportadaEm) : Infinity;
    // Depois da cotação, o preço exato da cota de cada fundo pedido em R$, que só a boleta mostra, e
    // as boletas de venda (a posição) e do Estoque clientes.
    if (temFundo && robo.presente) {
      comecarRodada(solicitacoes);
      const cotacao = idade > 2 * 60 * 1000 ? atualizarCotacoes({ automatico: true }) : Promise.resolve();
      cotacao
        .then(() => buscarPrecosExatos())
        .then(() => buscarBoletas())
        .then(() => fecharRodada());
    }

    // Ao mesmo tempo, noutra aba do robô, o cliente de cada conta: nome, e-mail e assessor.
    buscarClientes(solicitacoes.map((s) => s.conta));
    // E noutra, a lista do Tesouro de cada conta com aplicação, e a posição de cada uma com resgate.
    buscarTesouroDe(solicitacoes);
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
    const hoje = new Date();
    const contexto = { estoque: estado.estoque, tetos: estado.tetos, cotas: estado.cotas, boletas: estado.boletas, hoje };
    for (const s of solicitacoes) {
      for (const ordem of s.ordens) {
        // O ROA máximo ou o zerado é escolhido para a solicitação inteira, nos botões de copiar.
        ordem.secundario = secundarioDaOrdem(ordem, { ...contexto, semRoa: s.semRoa === true });
        // A venda: a posição e a cotação da boleta de venda, pela conta do cartão.
        ordem.venda = vendaDaOrdem(ordem, { estoque: estado.estoque, boletas: estado.boletas, conta: s.conta, hoje });
        ordem.print = printValido(s.conta, ordem, hoje);
        // O Tesouro: o título da lista do Hub lida para a conta, com a taxa e o vencimento.
        ordem.tesouroDoHub = tesouroDaOrdem(ordem, { lista: estado.tesouro.get(String(s.conta ?? '')), hoje, ehDiaUtil });
        // O resgate: o título na posição do cliente, e o valor disponível.
        ordem.resgateDoHub = resgateDaOrdem(ordem, { lista: estado.posicoesTesouro.get(String(s.conta ?? '')), hoje, ehDiaUtil });
      }
      s.prints = printsDa(s);
      anotarFila(s);
    }
  }

  /* ── A Fila do dia ──────────────────────────────────────────────────────────────────── */

  // Quantas contas o navegador precisa conhecer para o aviso de conta nova valer: antes disso toda
  // conta seria "nova", e o aviso que aparece sempre é o aviso que ninguém lê.
  const CONTAS_PARA_AVISAR = 15;
  const filaRepo = filaDaPagina();

  async function carregarFila() {
    try {
      const todos = await filaRepo.listarTodos();
      const hoje = diaDe(Date.now());
      estado.fila = { hoje: todos.filter((p) => p.dia === hoje), contas: contasConhecidas(todos) };
      if (estado.solicitacoes.length > 0) render();
    } catch {
      // Sem IndexedDB o Ordens segue sem a Fila; o motivo aparece na aba Fila.
    }
  }

  /**
   * O que a Fila diz de cada ordem: o pedido igual de hoje que já saiu (fora os que nasceram desta
   * solicitação), e se a conta nunca passou por este navegador. O validador lê `ordem.repetidoHoje` e
   * `solicitacao.contaNova`.
   */
  function anotarFila(s) {
    const proprios = s.naFila ?? new Set();
    const outros = estado.fila.hoje.filter((p) => !proprios.has(p.id));
    for (const ordem of s.ordens) {
      const pronta = s.conta && ordem.ativo?.trim() && ordem.operacao;
      ordem.repetidoHoje = (pronta && repetidosHoje(s.conta, [ordem], outros)[0]) || null;
    }
    const conhecidas = new Set([...estado.fila.contas, ...estado.contasDoHistorico]);
    s.contaNova = Boolean(s.conta) && conhecidas.size >= CONTAS_PARA_AVISAR && !conhecidas.has(String(s.conta));
  }

  // A ordem como o cartão da Fila a guarda: o que o e-mail pediu, e o id do fundo para a boleta.
  const ordemNaFila = (o) => ({
    ativo: o.ativo,
    operacao: o.operacao,
    quantidade: o.quantidade ?? null,
    financeiro: o.financeiro ?? null,
    total: o.total === true,
    preco: o.preco ?? null,
    estoque: o.estoque ?? null,
    fundoId: o.venda?.fundoId ?? o.secundario?.fundo?.id ?? null
  });

  /**
   * O e-mail saiu (copiado ou aberto no Outlook): o pedido entra na Fila do dia, aguardando o cliente.
   * Só os e-mails, que vão para o cliente; os lotes são do back office.
   */
  async function registrarNaFila(solicitacao, iSolicitacao, formato, grupo, texto) {
    if (formato !== 'email' && formato !== 'auditoria') return;
    if (!/^\d{5,8}$/.test(String(solicitacao.conta ?? ''))) return;
    const doGrupo = grupo ?? 'bolsa';
    const parte = recorte(solicitacao, doGrupo, formato);
    if (parte.ordens.length === 0) return;
    const cliente = solicitacao.cliente?.situacao === 'achado' ? solicitacao.cliente : null;
    const validades = parte.ordens.map((o) => o.print?.validaAte?.getTime?.()).filter(Number.isFinite);
    const confirmados = estado.confirmados[iSolicitacao] ?? new Set();
    try {
      const pedido = registrarEnvio(
        estado.fila.hoje,
        {
          conta: solicitacao.conta,
          cliente: cliente ? { nome: cliente.nome ?? null, email: cliente.email ?? null } : null,
          assessor: cliente?.assessor?.email ? { nome: cliente.assessor.nome ?? null, email: cliente.assessor.email } : null,
          grupo: doGrupo,
          formato,
          assunto: (formato === 'email' && ASSUNTOS_DOS_GRUPOS[grupo]) || 'Confirmação de ordem',
          ordens: parte.ordens.map(ordemNaFila),
          texto,
          em: Date.now(),
          validadeDaCotacao: validades.length ? Math.min(...validades) : null
        },
        {
          novo: confirmados.has(chaveDaConfirmacao(doGrupo, 'repetido-hoje')) || confirmados.has('repetido-hoje'),
          proprios: solicitacao.naFila ?? new Set()
        }
      );
      await filaRepo.salvar(pedido);
      (solicitacao.naFila ??= new Set()).add(pedido.id);
      estado.fila.hoje = [...estado.fila.hoje.filter((p) => p.id !== pedido.id), pedido];
      estado.fila.contas.add(pedido.conta);
      avisarMudancaNaFila('ordens');
    } catch (erro) {
      aviso(`O e-mail saiu, mas não entrou na Fila do dia: ${erro.message}`, { tipo: 'erro' });
    }
  }

  aoMudarAFila((origem) => origem !== 'ordens' && carregarFila());
  carregarFila();

  /* ── Os prints da cotação de venda ──────────────────────────────────────────────────── */

  // Um print é da conta, do fundo e da quantidade: o total, ou a quantidade escrita.
  const chaveDoPrint = (conta, ordem) => `${ordem.venda?.fundoId}|${conta}|${ordem.total ? 'total' : ordem.quantidade}`;
  const mesmoNumero = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-7;

  /**
   * O print de uma venda, se ainda vale: até o mesmo horário do próximo dia útil (decisão do operador
   * em 20/10/2026), e com a quantidade que a venda tem agora — a posição pode ter mudado.
   */
  function printValido(conta, ordem, hoje = new Date()) {
    if (!ordem.venda || ordem.venda.situacao !== 'pronto') return null;
    const print = estado.prints.get(chaveDoPrint(conta, ordem));
    if (!print || hoje > print.validaAte) return null;
    const esperada = ordem.total ? ordem.venda.quantidade : ordem.quantidade;
    return mesmoNumero(print.quantidade, esperada) ? print : null;
  }

  // O print de cada venda, para o e-mail em HTML: ordem → imagem.
  const printsDa = (s) => new Map(s.ordens.filter((o) => o.print).map((o) => [o, o.print.png]));

  /**
   * Os prints que faltam numa solicitação, pelo robô: ele abre a boleta de venda, preenche a
   * quantidade, abre o detalhe da operação, confere a quantidade e tira o print. Cada um entra no
   * cartão assim que sai.
   *
   * @returns {Promise<string[]>} os motivos dos que não saíram
   */
  async function garantirPrints(solicitacao) {
    // Os prints vencidos saem da memória: são imagens, e a página fica aberta por dias.
    for (const [chave, print] of estado.prints) if (Date.now() > print.validaAte) estado.prints.delete(chave);
    calcularSecundario([solicitacao]);
    const faltam = solicitacao.ordens.filter(
      (o) => o.venda?.situacao === 'pronto' && o.venda.condicoes?.aberta && o.venda.quantidade > 0 && !o.print && !o.buscandoPrint
    );
    if (faltam.length === 0 || !/^\d{5,8}$/.test(String(solicitacao.conta ?? ''))) return [];
    // Sem o robô certo, o print não sai — e isso fica à vista em vermelho, não só no aviso do cartão.
    if (!robo.presente || robo.versao !== VERSAO_DO_ROBO) {
      const motivo = !robo.presente
        ? 'o robô do Hub não está instalado nesta página'
        : `o robô instalado é a versão ${robo.versao}, e a Mesa precisa da ${VERSAO_DO_ROBO} — use "Copiar robô" e cole no Tampermonkey`;
      aviso(`Sem o print da venda: ${motivo}.`, { tipo: 'erro' });
      for (const o of faltam) o.printFalhou = motivo;
      return [motivo];
    }

    for (const o of faltam) o.buscandoPrint = true;
    marcarBusca('tirando os prints na boleta…');
    anotar('pediu os prints', { quantos: faltam.length });
    const motivos = [];
    await robo.pedirPrints({
      itens: faltam.map((o) => ({ fundoId: o.venda.fundoId, conta: solicitacao.conta, quantidade: o.total ? null : o.quantidade })),
      aoChegar: (r) => {
        const o = faltam[r.indice];
        o.buscandoPrint = false;
        // O motivo da falha fica no cartão, ao lado da venda, até o próximo print.
        o.printFalhou = r.png ? null : (r.erro?.message ?? 'o print não saiu');
        if (r.png) {
          estado.prints.set(chaveDoPrint(solicitacao.conta, o), { png: r.png, quantidade: r.quantidade, em: r.em, validaAte: umDiaUtilDepois(r.em) });
        } else motivos.push(`${o.ativo}: ${o.printFalhou}`);
        render();
      }
    });
    for (const o of faltam) o.buscandoPrint = false;
    marcarBusca('');
    if (motivos.length > 0) aviso(`Sem o print de ${motivos.join('; ')}.`, { tipo: 'erro' });
    return motivos;
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
    // E a lista do Tesouro da conta nova, quando o cartão tem Tesouro.
    if (campo === 'conta' && e.type === 'change') {
      const s = estado.solicitacoes[iSolicitacao];
      buscarClientes([s.conta]);
      buscarTesouroDe([s]);
    }
  }

  container.addEventListener('click', async (e) => {
    const iSolicitacao = indiceDo(e.target, 'solicitacao');
    if (iSolicitacao === null) return;
    const solicitacao = estado.solicitacoes[iSolicitacao];

    // Controles segmentados (Compra/Venda, Qtd/R$). Aqui o cartão inteiro é refeito sem custo:
    // nenhum campo de texto está em foco quando se clica num deles.
    const segmento = e.target.closest('[data-campo]');
    // O conserto do bloqueio de cotação velha não edita a ordem: pede uma cotação nova ao robô. O
    // do Estoque clientes sem a boleta lida pede a boleta.
    if (segmento?.dataset.campo === 'atualizar-cotacoes') return atualizarCotacoes();
    if (segmento?.dataset.campo === 'cotar-estoque-clientes') return buscarBoletas({ forcar: true });
    if (segmento?.dataset.campo === 'tirar-prints') return garantirPrints(solicitacao);
    if (segmento?.dataset.campo === 'separar-conta') return separarContaColada(segmento.dataset.valor);
    if (segmento?.dataset.campo === 'ler-tesouro')
      return buscarTesouro([solicitacao.conta], { forcar: true, leitura: segmento.dataset.valor === 'posicoes' ? 'posicoes' : 'lista' });
    if (segmento) {
      aplicarEdicao(solicitacao, segmento.dataset.campo, segmento.dataset.valor, indiceDo(segmento, 'ordem'));
      render();

      // A linha nova do botão + já recebe o cursor no campo do ativo.
      if (segmento.dataset.campo === 'adicionar-ordem') {
        container.querySelector(`[data-solicitacao="${iSolicitacao}"] tbody tr:last-child .campo-ativo`)?.focus();
      }
      // Trocar de estoque, ou voltar ao total da posição, pede a boleta que a conta nova usa.
      if (['estoque-clientes', 'estoque-xp', 'usar-posicao', 'operacao'].includes(segmento.dataset.campo)) buscarBoletas();
      return;
    }

    const remover = e.target.closest('.btn-remover');
    if (remover) {
      solicitacao.ordens.splice(indiceDo(remover, 'ordem'), 1);
      return render();
    }

    // A confirmação vale para o grupo do e-mail em que foi dada (bolsa, fundos comprados, vendidos).
    const confirmar = e.target.closest('[data-confirmar]');
    if (confirmar) {
      estado.confirmados[iSolicitacao].add(chaveDaConfirmacao(confirmar.dataset.grupo ?? 'bolsa', confirmar.dataset.confirmar));
      return renderSaidasDe(iSolicitacao);
    }

    // Abrir no Outlook: um e-mail novo no Outlook na web, com o assunto e o texto à vista, o cliente
    // no Para e o assessor em cópia, quando o robô e a planilha os trouxeram. O endereço só leva
    // texto puro: o E-mail em tabela vai com a tabela em texto, com TAB entre as colunas (decidido
    // com o operador em 09/10/2026). O texto que cabe no endereço não é copiado — a área de
    // transferência pode estar guardando algo que a pessoa vai colar. O longo demais vai copiado,
    // com a tabela em grade, para colar no corpo.
    let outlookBotao = e.target.closest('[data-outlook]');
    if (outlookBotao) {
      const formato = outlookBotao.dataset.outlook;
      const grupo = outlookBotao.dataset.grupo ?? null;

      // Refeita antes, como no Copiar: a conta, o cliente e a idade da cotação são os de agora.
      renderSaidasDe(iSolicitacao);
      outlookBotao = container.querySelector(`[data-solicitacao="${iSolicitacao}"] [data-outlook="${formato}"]${grupo ? `[data-grupo="${grupo}"]` : ''}`);

      const saida = gerar(solicitacao, formato, estado.confirmados[iSolicitacao], { grupo });
      if (!saida) return aviso('Resolva os bloqueios antes de abrir o e-mail.');

      const cliente = solicitacao.cliente?.situacao === 'achado' ? solicitacao.cliente : null;
      const enderecos = { para: cliente?.email ?? null, cc: cliente?.assessor.email ?? null };
      const assunto = (formato === 'email' && ASSUNTOS_DOS_GRUPOS[grupo]) || undefined;
      const comCorpo = enderecoDoEmail({ ...enderecos, corpo: saida.texto, assunto });

      // Com o robô, o corpo em HTML entra no e-mail aberto: os prints da venda (tirados agora, se
      // faltam) e a tabela em grade. A janela abre já, no clique — senão o navegador a bloqueia —, e o
      // robô no Outlook espera o HTML. Sem o robô, fica o corpo de texto do endereço.
      const comRobo = robo.presente && robo.versao === VERSAO_DO_ROBO && comCorpo;
      const comPrints = comRobo && formato === 'email' && grupo === 'fundos-venda';
      const comGrade = comRobo && formato === 'auditoria' && saida.html;
      // A taxa do Tesouro lida há mais de 2 minutos: o e-mail abre já, e o robô põe nele o texto com a
      // taxa de agora, assim que a lista chegar.
      // No resgate, a posição: o valor disponível muda com o PU.
      const leitura = leituraDoGrupo(grupo);
      const listaDoTesouro = leitura && (leitura === 'posicoes' ? estado.posicoesTesouro : estado.tesouro).get(String(solicitacao.conta ?? ''));
      const comTaxaNova = comRobo && formato === 'email' && leitura && (!listaDoTesouro || Date.now() - listaDoTesouro.em > 2 * 60 * 1000);
      const reserva = comPrints || comGrade || comTaxaNova ? robo.reservarOutlook({ texto: saida.texto, inicio: saida.texto.split('\n')[0] }) : null;
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
      if (reserva) {
        aviso(
          `E-mail aberto no Outlook${resto}. ${
            comPrints
              ? 'O robô vai pôr os prints da cotação no corpo.'
              : comTaxaNova
                ? `O robô vai pôr ${leitura === 'posicoes' ? 'a posição' : 'a taxa'} do Tesouro de agora no corpo.`
                : 'O robô vai pôr a tabela em grade no corpo.'
          }`
        );
        (async () => {
          const semPrint = comPrints ? await garantirPrints(solicitacao) : [];
          if (comTaxaNova) await buscarTesouro([solicitacao.conta], { idadeMaxima: 2, leitura });
          calcularSecundario([solicitacao]);
          const comHtml = gerar(solicitacao, formato, estado.confirmados[iSolicitacao], { grupo });
          // O Tesouro é texto: vai como HTML de linhas, com a taxa de agora.
          const html = comHtml?.html ?? (comTaxaNova && comHtml ? '<div>' + esc(comHtml.texto).split('\n').join('<br>') + '</div>' : null);
          if (html) reserva.mandar(html);
          else reserva.cancelar();
          const r = await reserva.resposta;
          if (r.ok) {
            aviso(
              comPrints && semPrint.length > 0
                ? 'O corpo está no e-mail, mas sem o print de cada venda que falhou: cole-o abaixo de "Condições:".'
                : comPrints
                ? 'Os prints da cotação estão no e-mail, abaixo de "Condições:". Confira e envie.'
                : comTaxaNova
                  ? `O e-mail do Tesouro está com ${leitura === 'posicoes' ? 'a posição' : 'a taxa'} de agora. Confira e envie.`
                  : 'A tabela em grade está no e-mail. Confira e envie.'
            );
          }
          else if (r.motivo !== 'cancelado') {
            aviso(
              `O robô não pôs o corpo em HTML no Outlook (${r.motivo}). Use o Copiar deste e-mail e cole no corpo com Ctrl+V.`,
              { tipo: 'erro' }
            );
          }
        })();
      } else if (comCorpo) {
        // Sem o robô certo, o print não vem — e o motivo aparece em vermelho.
        if (formato === 'email' && grupo === 'fundos-venda') garantirPrints(solicitacao);
        aviso(`E-mail aberto no Outlook${resto}.${formato === 'email' && grupo === 'fundos-venda' ? ' Cole o print de cada cotação abaixo de "Condições:".' : ''}`);
      } else aviso(`O texto é longo para ir junto: cole-o no corpo do e-mail (Ctrl+V)${resto}.`);

      if (outlookBotao) {
        outlookBotao.classList.add('copiado');
        setTimeout(() => outlookBotao.classList.remove('copiado'), 1600);
      }
      historico.registrar({
        conta: solicitacao.conta,
        ativos: recorte(solicitacao, grupo ?? 'bolsa', formato).ordens.map((o) => o.ativo),
        formato: rotuloNoHistorico(solicitacao, formato, grupo),
        textoOriginal: estado.textoOriginal
      });
      estado.contasDoHistorico.add(String(solicitacao.conta));
      registrarNaFila(solicitacao, iSolicitacao, formato, grupo, saida.texto);
      return atualizarContadorHistorico();
    }

    let copiarBotao = e.target.closest('[data-copiar]');
    if (copiarBotao) {
      const formato = copiarBotao.dataset.copiar;
      const { roa } = copiarBotao.dataset;
      const grupo = copiarBotao.dataset.grupo ?? null;

      // Fundo no secundário: o botão escolhe o ROA do e-mail inteiro. A área é refeita antes de
      // copiar — com a conta e a idade da cotação de agora, porque a página pode ter ficado aberta
      // —, para o texto à vista ser o copiado; o botão novo é que recebe o visto.
      if (roa) aplicarEdicao(solicitacao, roa === 'zerado' ? 'roa-zerado' : 'roa-maximo', '');
      if (formato === 'email' && grupo === 'fundos-venda') await garantirPrints(solicitacao);
      if (formato === 'email' && leituraDoGrupo(grupo)) await buscarTesouro([solicitacao.conta], { idadeMaxima: 2, leitura: leituraDoGrupo(grupo) });
      renderSaidasDe(iSolicitacao);
      copiarBotao = container.querySelector(
        `[data-solicitacao="${iSolicitacao}"] [data-copiar="${formato}"]${roa ? `[data-roa="${roa}"]` : ''}${grupo ? `[data-grupo="${grupo}"]` : ''}`
      );

      const saida = gerar(solicitacao, formato, estado.confirmados[iSolicitacao], { grupo });
      if (!saida) return aviso('Resolva os bloqueios antes de copiar.');

      const ok = await copiar(saida.texto, saida.html);
      const comRoa = roa ? (roa === 'zerado' ? ', com ROA zerado' : ', com ROA máximo') : '';
      aviso(ok ? `${rotuloNoHistorico(solicitacao, formato, grupo)} copiado${comRoa}.` : 'Não consegui copiar.');
      if (ok && copiarBotao) {
        copiarBotao.classList.add('copiado');
        setTimeout(() => copiarBotao.classList.remove('copiado'), 1600);
      }

      if (ok) {
        historico.registrar({
          conta: solicitacao.conta,
          ativos: recorte(solicitacao, grupo ?? 'bolsa', formato).ordens.map((o) => o.ativo),
          formato: rotuloNoHistorico(solicitacao, formato, grupo),
          textoOriginal: estado.textoOriginal
        });
        estado.contasDoHistorico.add(String(solicitacao.conta));
        registrarNaFila(solicitacao, iSolicitacao, formato, grupo, saida.texto);
        atualizarContadorHistorico();
      }
    }
  });

  function rotuloNoHistorico(solicitacao, formato, grupo) {
    const varios = gruposDe(solicitacao).length > 1;
    return formato === 'email' && grupo && varios ? `${ROTULOS[formato]} · ${ROTULOS_DOS_GRUPOS[grupo]}` : ROTULOS[formato];
  }

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
      juntarPrateleira(estado.estoque.fundos);
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
  // A ponte é uma só na página: a Fila (as respostas no Outlook) e a Prateleira de fundos a pegam daqui.
  registrarServico('robo', robo);
  registrarServico('versaoDoRobo', VERSAO_DO_ROBO);
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
    juntarPrateleira(estado.estoque.fundos);
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

  /** Uma boleta lida pelo robô: guardada para a conta do pedido, e o preço exato dela serve a todos. */
  function guardarBoleta(bruta, conta) {
    const lida = lerBoletaDoHub(bruta);
    if (!lida) return;
    // As vencidas saem da memória: têm a posição do cliente, e a página fica aberta por dias.
    for (const [chave, boleta] of Object.entries(estado.boletas)) if (Date.now() > umDiaUtilDepois(boleta.em)) delete estado.boletas[chave];
    estado.boletas[chaveDaBoleta(lida.fundoId, lida.lado, conta)] = lida;
    if (lida.valorDaCota && lida.dataDaCota) guardarCota({ fundoId: lida.fundoId, valor: lida.valorDaCota, dataDaCota: lida.dataDaCota, em: lida.em });
  }

  /**
   * As boletas que a conta precisa e que ainda não foram lidas (ou já venceram), pelo robô:
   *  - a de **venda** de cada fundo vendido, para a posição do cliente e as modalidades do dia — vale
   *    um dia útil (`venda.js`);
   *  - a de **compra** de cada fundo pedido no Estoque clientes, para o estoque dele agora — vale 10
   *    minutos, como a cotação.
   * Abrir a boleta não digita nada. `forcar` lê de novo mesmo as que valem (o conserto "Cotar na
   * boleta").
   */
  async function buscarBoletas({ forcar = false } = {}) {
    if (!robo.presente || robo.versao !== VERSAO_DO_ROBO || !estado.estoque) return;
    calcularSecundario(estado.solicitacoes);

    const pedidos = [];
    const jaPedido = new Set();
    const pedir = (fundoId, conta, lado, ordem) => {
      const chave = chaveDaBoleta(fundoId, lado, conta);
      if (jaPedido.has(chave)) return;
      jaPedido.add(chave);
      pedidos.push({ fundoId, conta, lado, ordens: [ordem] });
    };
    for (const s of estado.solicitacoes) {
      if (!/^\d{5,8}$/.test(String(s.conta ?? ''))) continue;
      for (const o of s.ordens) {
        if (o.venda?.fundoId && (forcar || o.venda.situacao === 'sem-boleta')) pedir(o.venda.fundoId, s.conta, 'vender', o);
        const sec = o.secundario;
        if (sec?.modalidade === 'clientes' && sec.fundo?.id && (forcar || sec.p2p?.origem !== 'boleta')) pedir(sec.fundo.id, s.conta, 'comprar', o);
      }
    }
    if (pedidos.length === 0) return;

    for (const p of pedidos) for (const o of p.ordens) o.buscandoVenda = true;
    marcarBusca('lendo as boletas no Hub…');
    anotar('pediu as boletas', { quantas: pedidos.length });
    const resultados = await robo.pedirBoletas({
      itens: pedidos.map(({ fundoId, conta, lado }) => ({ fundoId, conta, lado })),
      aoChegar: (r) => {
        if (r.boleta) guardarBoleta(r.boleta, pedidos[r.indice].conta);
        for (const o of pedidos[r.indice].ordens) o.buscandoVenda = false;
        render();
      }
    });
    for (const p of pedidos) for (const o of p.ordens) o.buscandoVenda = false;
    marcarBusca('');

    const falharam = resultados.filter((r) => r?.erro);
    if (falharam.length > 0) {
      aviso(
        `Não consegui ler ${falharam.length === 1 ? 'uma boleta' : `${falharam.length} boletas`} no Hub: ${falharam[0].erro.message}. ` +
          'A venda segue sem a posição conferida, e o Estoque clientes pelo da Prateleira.',
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

  /*
   * "Separar: <conta> é outra conta": a conta do pedido seguinte veio colada no fim de uma linha. A
   * quebra de linha volta ao texto colado, e o pedido é lido de novo — o que foi editado nos cartões
   * se perde, e por isso o aviso pede para conferir.
   */
  function separarContaColada(conta) {
    const texto = separarConta(estado.textoOriginal, conta);
    if (texto === null) return aviso(`Não achei ${conta} no fim de uma linha do texto colado.`, { tipo: 'erro' });
    entrada.value = texto;
    analisar();
    aviso(`${conta} virou outro pedido, com o que vinha abaixo dele. Confira os cartões.`);
  }

  /* ── O Tesouro Direto ─────────────────────────────────────────────────────────────────── */

  /**
   * A lista do Tesouro de cada conta, pelo robô (1.6.0): ele escolhe o cliente na página de Produtos →
   * Tesouro Direto do Hub, na aba dele, e traz os títulos — a taxa e o vencimento de agora — ou o erro
   * do Hub (conta não habilitada). Uma conta por vez. `forcar` lê de novo a que já veio; sem ele, só a
   * que ainda não veio ou tem mais de `idadeMaxima` minutos.
   */
  //
  // Com `leitura: 'posicoes'` (robô 1.7.0), a posição da conta no Tesouro, para o resgate: o robô vai a
  // Posições → Tesouro Direto e traz os títulos que o cliente tem, com o disponível.
  let filaDoTesouro = Promise.resolve();
  function buscarTesouro(contas, { forcar = false, idadeMaxima = 10, leitura = 'lista' } = {}) {
    if (!robo.presente || robo.versao !== VERSAO_DO_ROBO) return Promise.resolve();
    const posicoes = leitura === 'posicoes';
    const lidas = posicoes ? estado.posicoesTesouro : estado.tesouro;
    const pedidas = [...new Set(contas.map((c) => String(c ?? '')))].filter((conta) => {
      if (!/^\d{5,8}$/.test(conta)) return false;
      const lida = lidas.get(conta);
      return forcar || !lida || Date.now() - lida.em > idadeMaxima * 60 * 1000;
    });
    for (const conta of pedidas) {
      marcarTesouro(conta, true, posicoes);
      filaDoTesouro = filaDoTesouro.then(async () => {
        try {
          const resposta = await robo.pedirTesouro(conta, { leitura });
          lidas.set(
            conta,
            resposta.erro
              ? { erro: resposta.erro, em: Date.now() }
              : posicoes
                ? { posicoes: lerPosicoesDoHub(resposta.posicoes), em: Date.now() }
                : { titulos: lerTitulosDoHub(resposta.itens), em: Date.now() }
          );
        } catch (falha) {
          const motivo = posicoes ? 'o robô não trouxe a posição no Tesouro' : 'o robô não trouxe a lista do Tesouro';
          lidas.set(conta, { erro: falha instanceof ErroDoRobo ? falha.message : motivo, em: Date.now() });
        }
        marcarTesouro(conta, false, posicoes);
      });
    }
    return filaDoTesouro;
  }

  // A lista de cada conta com aplicação no Tesouro, e a posição de cada uma com resgate.
  function buscarTesouroDe(solicitacoes) {
    const com = (resgate) => solicitacoes.filter((s) => s.ordens.some((o) => o.tesouro && (o.operacao === 'V') === resgate)).map((s) => s.conta);
    buscarTesouro(com(false));
    buscarTesouro(com(true), { leitura: 'posicoes' });
  }

  // O e-mail do Tesouro que lê o Hub na hora de sair: a aplicação, a lista; o resgate, a posição.
  const leituraDoGrupo = (grupo) => (grupo === 'tesouro' ? 'lista' : grupo === 'tesouro-resgate' ? 'posicoes' : null);

  function marcarTesouro(conta, buscando, resgate = false) {
    estado.solicitacoes.forEach((s, i) => {
      if (String(s.conta ?? '') !== conta) return;
      for (const o of s.ordens) if (o.tesouro && (o.operacao === 'V') === resgate) o.buscandoTesouro = buscando;
      renderSaidasDe(i);
    });
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
