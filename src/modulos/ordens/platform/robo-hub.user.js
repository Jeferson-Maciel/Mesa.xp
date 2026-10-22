// ==UserScript==
// @name         Mesa XP · Robô do Hub
// @namespace    mesa-xp
// @version      1.13.0
// @updateURL    https://mesa-xp.vercel.app/robo-hub.user.js
// @downloadURL  https://mesa-xp.vercel.app/robo-hub.user.js
// @description  Quando a Mesa XP pede, atualiza a Prateleira do Mercado Secundário, lê nas boletas de compra e de venda o preço exato da cota, os estoques do fundo e, na venda, a posição do cliente, na ficha dele o nome, o e-mail e o assessor, e no Renda Fixa a lista do Tesouro Direto e a posição do cliente nele, em abas do Hub só dele, e entrega à Mesa o que o próprio Hub recebeu; no Outlook na web, põe o corpo do e-mail que a Mesa abriu e vê, na lista da caixa de entrada, as respostas dos clientes aos e-mails de confirmação. Não lê senha nem token, não abre e-mail e não envia nada.
// @match        https://hub.xpi.com.br/*
// @match        https://mesa-xp.vercel.app/*
// @match        https://outlook.cloud.microsoft/*
// @match        https://outlook.office.com/*
// @match        https://outlook.office365.com/*
// @match        https://outlook.live.com/*
// @match        file:///*/mesa-xp/dist/index.html
// @match        http://localhost/*
// @match        http://127.0.0.1/*
// @run-at       document-start
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_openInTab
// @grant        unsafeWindow
// ==/UserScript==

/*
 * O robô do Hub: as cotações do secundário no Ordens sem favorito e sem arquivo.
 *
 * O mesmo script roda em duas abas do mesmo Chrome, e elas conversam pelo armazenamento do
 * Tampermonkey (GM_setValue e GM_addValueChangeListener):
 *
 *   aba da Mesa   pede ──→ aba do robô no Hub — uma aba só dele, que ele mesmo abre:
 *                            · cotação: clica em Atualizar na Prateleira, se a lista não acabou
 *                              de chegar sozinha;
 *                            · as boletas: abre as boletas dos fundos, uma atrás da outra, para a
 *                              conta pelo endereço do próprio Hub — a de compra
 *                              (#/secundario/comprar/<fundo>/<conta>) e, desde a 1.4.0, a de venda
 *                              (#/secundario/vender/<fundo>/<conta>) —, lê a resposta de cada
 *                              pre-check e, no fim, volta para a Prateleira
 *   aba da Mesa  ←── o que o Hub respondeu, cada preço assim que chega
 *
 *   aba da Mesa   pede ──→ aba de clientes do robô no Hub — outra aba só dele (1.3.0), na Posição
 *                          Consolidada: abre a ficha do cliente pelo endereço do próprio Hub
 *                          (#/<conta em base64>) e lê a resposta de customer-info
 *   aba da Mesa  ←── só o nome, o e-mail e o assessor do cliente
 *
 *   aba da Mesa   pede ──→ o e-mail novo do Outlook na web que a Mesa acabou de abrir (1.5.0): o
 *                          robô troca o corpo de texto pelo HTML — o print de cada cotação de venda
 *                          logo abaixo de "Condições:", ou a tabela em grade —, como se fosse colado.
 *                          Não envia nada: quem confere e clica em Enviar é a pessoa
 *
 *   aba da Mesa   pede ──→ aba do Tesouro do robô no Hub (1.6.0), no módulo Renda Fixa, em Produtos →
 *                          Tesouro Direto: escolhe o cliente da conta pedida (digita a conta no
 *                          "Pesquisar cliente" e clica no resultado daquela conta, e só nele) e lê a
 *                          lista que o Hub recebe — os títulos, com a taxa e o vencimento
 *   aba da Mesa  ←── só os dados dos títulos (públicos), ou o erro do Hub (conta não habilitada)
 *
 *   aba da Mesa   pede ──→ a mesma aba do Tesouro (1.7.0), em Posições → Posição por cliente → Tesouro
 *                          Direto: escolhe o cliente do mesmo jeito e lê a posição que o Hub recebe
 *   aba da Mesa  ←── de cada título que o cliente tem, só o nome, o vencimento, a quantidade, a
 *                    bloqueada, o PU de venda e o valor bruto — para o e-mail de resgate
 *
 *   aba da Mesa   pede ──→ a caixa de entrada do Outlook na web, numa aba que a pessoa já tem aberta
 *                          (1.8.0): enquanto a Mesa tem pedido esperando o cliente, o robô olha a
 *                          lista de mensagens e, dela, só as respostas de hoje aos e-mails de
 *                          confirmação ("RE: Confirmação…") — de cada uma, o remetente, o e-mail, o
 *                          assunto, a prévia e a hora. Das outras mensagens lê só o assunto, para
 *                          saber que não são. Não clica, não abre e-mail, não marca como lido
 *   aba da Mesa  ←── as respostas, para a Fila do dia; saem do armazenamento assim que a Mesa as recebe
 *
 *   aba da Mesa   pede ──→ a boleta de um pedido da Fila do dia, para a pessoa executar (1.10.0): o
 *                          robô abre uma aba do Hub à vista e a leva até a boleta do fundo (pela
 *                          Prateleira, como na aba dele) ou, no Tesouro, escolhe o cliente (e, no
 *                          resgate, abre a aba Tesouro Direto da posição). E a larga: a quantidade,
 *                          o Próximo e o resto são da pessoa
 *
 *   São abas separadas porque a Posição Consolidada e o Renda Fixa são outros módulos do Hub: ir e voltar da Prateleira
 *   recarregaria a página inteira a cada cliente, e a Prateleira deixaria de estar pronta para a
 *   cotação. Na aba de clientes, trocar de cliente é só trocar o fim do endereço.
 *
 * Regras:
 *  - não lê senha, token nem cabeçalho, não chama a API por conta própria e não manda nada para
 *    fora do Chrome: só escuta o `fetch` do próprio app e muda a rota da aba dele;
 *  - na boleta, não digita nem clica em nada: abrir o endereço já carrega o cliente. Nunca passa da
 *    etapa 1. A exceção (1.5.0) é o print da cotação de venda, pedido pela Mesa: na boleta de venda o
 *    robô escolhe o estoque do pedido ("Estoque XP" ou "Estoque clientes", 1.9.0), preenche a
 *    quantidade (o botão "Total de cotas", ou a quantidade do pedido no campo) e abre
 *    "Visualizar mais detalhes da operação", e só isso — um clique em qualquer outra coisa é recusado
 *    (`clicarSo`), e Próximo nunca. Confere que a quantidade do painel é a pedida antes de tirar o
 *    print, apaga o campo e sai da boleta. Vai de uma boleta direto para a próxima — voltar à Prateleira entre elas custava uns
 *    4 s de desenho, mais 2 a 3 s da lista que ela baixa de novo — e volta uma vez só, no fim. Se a
 *    troca direta não disparar o pre-check, passa pela Prateleira entre as boletas, como antes;
 *  - do pre-check da boleta que ele abriu saem o preço e o dia da cota, os estoques do fundo (Estoque
 *    XP e Estoque clientes: se estão abertos, deságio, corretagem, PU e cotas disponíveis) e, só na
 *    boleta de venda, a posição do cliente naquele fundo (a quantidade, a disponível e a que já está
 *    à venda) — nada mais do cliente. A posição passa pelo armazenamento do Tampermonkey e é apagada
 *    assim que a Mesa a recebe. Da boleta que a pessoa abre, só o preço;
 *  - da ficha do cliente só saem o nome, o e-mail e o assessor (código e nome), e só para a conta
 *    pedida — nada de CPF, telefone ou patrimônio. Eles passam pelo armazenamento do Tampermonkey
 *    e são apagados assim que a Mesa os recebe; o pedido, com a conta, é apagado no fim da busca;
 *  - trabalha só na aba dele (título "🤖 Robô"). A aba em que a pessoa trabalha nunca muda de
 *    página; se a pessoa passar a usar a aba do robô, ele desiste dela e a Mesa abre outra;
 *  - o endereço da aba dele é o da Prateleira, sem nada a mais: qualquer parâmetro no endereço
 *    (`?alguma=coisa`) trava o módulo do Mercado Secundário do Hub — a página fica em branco, só
 *    com o cabeçalho, até com F5. A aba é reconhecida por um bilhete de uso único que a Mesa deixa
 *    antes de abri-la, e lembrada pelo nome da janela;
 *  - a aba dele fica em segundo plano, e o Chrome não desenha aba escondida: a boleta do Hub, que
 *    espera o desenho para carregar o cliente, parava no meio. Só nessa aba, o robô diz ao Hub que
 *    ela está à vista e mantém os quadros de desenho andando (uns por segundo, sem gastar a máquina);
 *  - uma tarefa por vez, numa fila;
 *  - anota, com a hora, cada passo da aba dele e cada chamada do Hub (só o caminho, com número
 *    longo — a conta, por exemplo — trocado por <n>), para a Mesa medir onde vão os segundos. O
 *    registro é gravado de uma vez, no fim de cada tarefa, para a medição não pesar;
 *  - a Mesa abre a aba dele assim que abre, para ela estar pronta na primeira colagem.
 *
 * Fica burro de propósito: a leitura da resposta (os campos, o "N/D", os números em pt-BR) mora
 * no Ordens, em `core/secundario/estoque.js`.
 *
 * Fonte: src/modulos/ordens/platform/robo-hub.user.js, no repositório da Mesa XP.
 */
(() => {
  'use strict';

  const VERSAO = '1.13.0';
  const BASE = 'https://hub.xpi.com.br/new/fundos-de-investimento';
  // Sem parâmetro nenhum: qualquer um trava o módulo do Mercado Secundário do Hub.
  const ABA_DO_ROBO = `${BASE}#/secundario/prateleira`;
  const NOME_DA_ABA = 'mesa-xp-robo';
  // A aba de clientes: a Posição Consolidada, onde a busca do topo do Hub leva. O cliente vai no fim
  // do endereço, como o próprio Hub o escreve: a conta em base64.
  const POSICAO = 'https://hub.xpi.com.br/new/posicao-consolidada/';
  // A aba do Tesouro (1.6.0): Produtos → Tesouro Direto, no módulo Renda Fixa. A lista só aparece com
  // um cliente escolhido na página, e o cliente não vai no endereço.
  const TESOURO = 'https://hub.xpi.com.br/new/renda-fixa/#/produtos/tesouro-direto';
  const ROTA_DO_TESOURO = '#/produtos/tesouro-direto';
  const LISTA_DO_TESOURO = /\/rede-treasury\/v\d+\/customers\/(\d+)\/available-assets(\?|$)/;
  // A posição do cliente no Tesouro (1.7.0), para o resgate: Posições → Posição por cliente, que abre
  // na aba Renda Fixa; a do Tesouro Direto é aberta no clique.
  const ROTA_DA_RENDA_FIXA = '#/posicoes/cliente/renda-fixa';
  const POSICOES_DO_TESOURO = /\/rede-treasury\/v\d+\/customers\/(\d+)\/positions(\?|$)/;
  const NOME_DA_ABA_DE_CLIENTES = 'mesa-xp-clientes';
  const rotaDoCliente = (conta) => `#/${btoa(String(conta))}`;
  const FICHA = /\/advisor-customer-consolidated-portfolio\/v\d+\/api\/customers\/(\d+)\/customer-info(\?|$)/;
  // Cada papel de aba tem o nome dela, o bilhete que a Mesa deixa antes de abri-la e a marca de que
  // pegou o pedido.
  const PAPEIS = {
    prateleira: { nome: NOME_DA_ABA, bilhete: 'abaPedida', atendendo: 'atendendo', abriuEm: 'abriuHubEm' },
    clientes: { nome: NOME_DA_ABA_DE_CLIENTES, bilhete: 'abaPedidaClientes', atendendo: 'atendendoClientes', abriuEm: 'abriuClientesEm' },
    tesouro: { nome: 'mesa-xp-tesouro', bilhete: 'abaPedidaTesouro', atendendo: 'atendendoTesouro', abriuEm: 'abriuTesouroEm' },
    // A aba do print (1.12.0): aberta à vista para cada pedido de prints, fechada no fim.
    print: { nome: 'mesa-xp-print', bilhete: 'abaPedidaPrint', atendendo: 'atendendoPrint', abriuEm: 'abriuPrintEm' }
  };
  const PRATELEIRA = '#/secundario/prateleira';
  const LISTA = /investment-funds-secondary(\?|$)/;
  const PRE_CHECK = /\/order-secondary\/pre-check(\?|$)/;
  const FUNDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const CONTA = /^\d{5,8}$/;
  const pagina = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  // Onde a Mesa XP roda publicada. Outro endereço (outro site, um domínio próprio) entra aqui e no
  // @match lá em cima.
  const MESAS_NO_AR = ['mesa-xp.vercel.app'];

  const ehOHub = () => location.hostname === 'hub.xpi.com.br';
  const ehAMesa = () =>
    (location.protocol === 'file:' && /\/mesa-xp\/dist\/index\.html$/.test(decodeURIComponent(location.pathname))) ||
    ['localhost', '127.0.0.1'].includes(location.hostname) ||
    MESAS_NO_AR.includes(location.host);

  // Uma aba só vale como viva se deu sinal nos últimos 3 minutos: o Chrome atrasa os relógios das
  // abas em segundo plano, mas não por mais que um minuto.
  const VIVA_MS = 3 * 60 * 1000;
  // Um pedido vale por um minuto: depois disso a Mesa já desistiu dele.
  const PEDIDO_MS = 60 * 1000;
  // Quanto a aba da Mesa espera a aba do robô dizer que pegou o pedido, antes de abrir outra. Uma
  // aba viva responde em menos de 1 s; ocupada desenhando a Prateleira, levou até 3 s.
  const ATENDER_MS = 3 * 1000;
  // Quanto o robô espera o pre-check da boleta, antes de desistir do preço.
  const PRE_CHECK_MS = 15 * 1000;
  // Indo de uma boleta direto para a próxima, quanto espera o pre-check novo antes de concluir que a
  // troca direta não o dispara.
  const TROCA_DIRETA_MS = 8 * 1000;
  // Quanto espera a ficha do cliente depois de trocar de cliente, antes de recarregar a página.
  const FICHA_MS = 10 * 1000;
  // Quanto a foto da boleta pode levar (1.7.1). No verificar ela sai em menos de 1 s.
  const PRINT_MS = 30 * 1000;
  // Quanto uma tarefa pode segurar a fila da aba (1.7.1): passado isso, a fila segue para a próxima,
  // para nada que trave numa aba prender os pedidos seguintes.
  const TAREFA_MS = 3 * 60 * 1000;

  /* ── Na aba do Hub ──────────────────────────────────────────────────────────────────── */

  const naAbaDoHub = () => {
    const aba = Math.random().toString(36).slice(2);

    // A visibilidade de verdade, mesmo depois de a aba do robô passar a dizer ao Hub que está à vista.
    const descritor = Object.getOwnPropertyDescriptor(pagina.Document.prototype, 'visibilityState');
    const visibilidadeReal = () => (descritor && descritor.get ? descritor.get.call(pagina.document) : document.visibilityState);
    const sinais = () => GM_getValue('abas', {});

    // A aba aberta pela versão 1.1.0 ou 1.1.1 tem `?mesaxp=robo` no endereço, e o parâmetro trava
    // o Hub: ela continua do robô, mas recarrega no endereço limpo.
    if (new URLSearchParams(location.search).has('mesaxp')) {
      pagina.name = NOME_DA_ABA;
      location.replace(BASE + (location.hash || PRATELEIRA));
      return;
    }

    // A aba é do robô se ele a abriu: a Mesa deixa um bilhete pouco antes, e a primeira aba do Hub
    // que nasce em segundo plano nos 30 segundos seguintes fica com ele (e o rasga). O nome da janela
    // guarda isso enquanto a aba existir, inclusive depois de recarregar. Cada papel tem o bilhete
    // dele, e o módulo em que a aba nasce diz qual ela pode pegar: a do robô nasce na Prateleira, a de
    // clientes na Posição Consolidada.
    // A aba de execução (1.10.0): a Mesa pediu a boleta de um pedido da Fila, e o robô abriu esta aba à
    // vista, para a pessoa. Vale para a primeira aba do Hub nova (no máximo a página em branco antes no
    // histórico) e à vista que nasce nos 30 s seguintes ao pedido — a aba do robô nasce escondida, e
    // não pega o pedido da pessoa; esta não vira aba do robô.
    let destinoDeExecucao = null;
    if (!pagina.name && pagina.history.length <= 2 && visibilidadeReal() !== 'hidden') {
      const pedidoDeExecucao = GM_getValue('abaPedidaExecucao', null);
      if (pedidoDeExecucao && Date.now() - pedidoDeExecucao.em < 30000) {
        GM_setValue('abaPedidaExecucao', null);
        destinoDeExecucao = pedidoDeExecucao.destino;
      }
    }

    /*
     * A aba do print (1.12.0). O print da venda não saía na aba do robô: ela vive escondida, e o Chrome
     * segura os relógios de uma página escondida (10 s depois de carregada, ou 5 min) em um despertar
     * por minuto — o "estrangulamento intensivo" dos relógios encadeados, desde o Chrome 88. O print é
     * feito de esperas curtas (o estoque, a quantidade, a conta, o detalhe), e com um despertar por
     * minuto não terminava; a cotação, que anda pelas respostas do Hub, não sofre. Nos passos repetidos
     * à mão numa aba à vista, em 20/10, tudo funcionava. Agora cada pedido de prints abre uma aba do Hub
     * à vista, que faz os prints e é fechada pela Mesa no fim. Vale para a primeira aba do Hub nova e à
     * vista, na Prateleira, que nasce nos 30 s seguintes ao pedido.
     */
    if (!destinoDeExecucao && !pagina.name && pagina.history.length <= 2 && visibilidadeReal() !== 'hidden' && location.pathname.startsWith('/new/fundos-de-investimento')) {
      const pedidoDoPrint = GM_getValue(PAPEIS.print.bilhete, null);
      if (pedidoDoPrint && Date.now() - pedidoDoPrint.em < 30000) {
        GM_setValue(PAPEIS.print.bilhete, null);
        pagina.name = PAPEIS.print.nome;
      }
    }

    const papelDoNome = () => Object.keys(PAPEIS).find((p) => PAPEIS[p].nome === pagina.name) ?? null;
    const papelPossivel = location.pathname.startsWith('/new/posicao-consolidada')
      ? 'clientes'
      : location.pathname.startsWith('/new/fundos-de-investimento')
        ? 'prateleira'
        : location.pathname.startsWith('/new/renda-fixa')
          ? 'tesouro'
          : null;
    if (!destinoDeExecucao && !papelDoNome() && papelPossivel && visibilidadeReal() === 'hidden') {
      const { bilhete: chave, nome } = PAPEIS[papelPossivel];
      const bilhete = GM_getValue(chave, null);
      if (bilhete && Date.now() - bilhete.em < 30000) {
        pagina.name = nome;
        GM_setValue(chave, null);
      }
    }
    const papel = papelDoNome();
    let doRobo = papel !== null;

    /*
     * A aba do robô age como se estivesse à vista. O Chrome não desenha aba em segundo plano: não
     * roda os quadros de desenho (requestAnimationFrame) e diz que ela está escondida. A boleta do
     * Hub espera os dois para carregar o cliente, e sem isso o pre-check nunca vinha. Aqui, só nesta
     * aba e antes de o Hub carregar:
     *  - document.visibilityState e document.hidden respondem "à vista", e o aviso de troca de
     *    visibilidade não chega ao Hub;
     *  - escondida de verdade, cada quadro de desenho pedido roda num relógio comum. O Chrome segura
     *    esses relógios em uma vez por segundo numa aba escondida — o bastante para a boleta andar,
     *    sem gastar a máquina com animação que ninguém vê. À vista, vale o quadro de verdade.
     */
    const agirComoAVista = () => {
      const doc = pagina.document;
      try {
        Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'visible' });
        Object.defineProperty(doc, 'hidden', { configurable: true, get: () => false });
      } catch {
        /* se o navegador não deixar, a aba segue como antes */
      }
      doc.addEventListener('visibilitychange', (evento) => evento.stopImmediatePropagation(), true);

      const quadroDeVerdade = pagina.requestAnimationFrame.bind(pagina);
      const cancelarDeVerdade = pagina.cancelAnimationFrame.bind(pagina);
      const relogios = new Map();
      let proximo = 1;
      pagina.requestAnimationFrame = (chamar) => {
        if (visibilidadeReal() !== 'hidden') return quadroDeVerdade(chamar);
        const id = -proximo++;
        relogios.set(
          id,
          setTimeout(() => {
            relogios.delete(id);
            chamar(pagina.performance.now());
          }, 16)
        );
        return id;
      };
      pagina.cancelAnimationFrame = (id) => {
        if (id >= 0) return cancelarDeVerdade(id);
        clearTimeout(relogios.get(id));
        relogios.delete(id);
      };
    };
    if (doRobo) agirComoAVista();

    const naPrateleira = () => location.hash.startsWith(PRATELEIRA);
    const naRotaDoRobo = () =>
      papel === 'clientes'
        ? location.pathname.startsWith('/new/posicao-consolidada')
        : papel === 'tesouro'
          ? location.pathname.startsWith('/new/renda-fixa')
          : naPrateleira() || /^#\/secundario\/(comprar|vender)\//.test(location.hash);
    const botao = () => document.querySelector('soma-button[aria-label="atualizar"]');

    // O título diz, na barra de abas, que esta é a aba do robô.
    const marcarTitulo = () => {
      if (doRobo && !document.title.startsWith('🤖')) document.title = `🤖 ${{ clientes: 'Clientes', tesouro: 'Tesouro', print: 'Print' }[papel] || 'Robô'} · ${document.title}`;
    };

    // O registro de tempos: o que a aba do robô fez e o que o Hub chamou, com a hora. Sem nada do
    // cliente — o passo, o código do fundo e o caminho da chamada, sem número longo. Fica na aba e
    // é gravado de uma vez — no fim de cada tarefa e antes de cada entrega à Mesa —, com os 300
    // últimos.
    let registroNovo = [];
    const gravarRegistro = () => {
      if (registroNovo.length === 0) return;
      GM_setValue('registro', [...GM_getValue('registro', []), ...registroNovo].slice(-300));
      registroNovo = [];
    };
    const registrar = (passo, extra = {}) => {
      if (!doRobo) return;
      registroNovo.push({ em: Date.now(), passo, ...extra });
      if (registroNovo.length >= 100) gravarRegistro();
    };
    const caminhoDe = (endereco) =>
      (endereco.split('/yield-rede/')[1] || endereco.replace(/^https?:\/\/[^/]+\//, '')).split('?')[0].replace(/\d{5,}/g, '<n>');

    /*
     * A ficha do cliente (customer-info), na aba de clientes do robô. Dela saem só o nome, o e-mail
     * e o assessor, e só se a ficha for da conta do endereço da chamada. Na aba em que a pessoa
     * trabalha, nada é lido. A ficha que chega sem ninguém esperando fica na memória da aba até a
     * tarefa usá-la: a aba recém-aberta já nasce na ficha pedida, às vezes antes de pegar o pedido.
     *
     * A resposta do Hub vem embrulhada: `{ output: { name, email, advisorCode, advisorName,
     * xpAccount, … } }` (conferido no Hub em 07/10; a 1.3.0 a procurava na raiz e não a achava). Se
     * vier num formato que o robô não conhece, ele diz isso à Mesa em vez de recarregar à toa, e o
     * registro anota só os nomes dos campos de fora.
     */
    let fichaVista = null;
    let esperaFicha = null;
    // A conta da última ficha que chegou nesta página: a que está na tela.
    let contaDaTela = null;
    const dadosDaFicha = (json) =>
      [json, json && json.output, json && json.data].find((d) => d && typeof d === 'object' && d.xpAccount !== undefined) || null;
    const anotarFicha = (endereco, json) => {
      const conta = (FICHA.exec(endereco) || [])[1];
      if (!doRobo || papel !== 'clientes' || !conta) return;
      const dados = dadosDaFicha(json);
      if (dados && String(dados.xpAccount) !== conta) return;
      const texto = (valor) => (typeof valor === 'string' ? valor : '');
      const ficha = dados
        ? {
            conta,
            nome: texto(dados.name),
            email: texto(dados.email),
            assessorCodigo: texto(dados.advisorCode),
            assessorNome: texto(dados.advisorName)
          }
        : { conta, erro: 'ficha-desconhecida' };
      if (dados) registrar('a ficha do cliente chegou');
      else registrar('a ficha do cliente veio num formato desconhecido', { campos: json && typeof json === 'object' ? Object.keys(json).join(', ') : typeof json });
      contaDaTela = conta;
      if (esperaFicha && esperaFicha.conta === conta) esperaFicha.resolver(ficha);
      else fichaVista = { ...ficha, em: Date.now() };
    };

    /*
     * A lista do Tesouro (1.6.0), na aba do Tesouro do robô: de cada título, só os campos dele — são
     * dados públicos, iguais para todo cliente habilitado. Uma conta não habilitada vem com a
     * mensagem do Hub, que segue para a Mesa como está.
     */
    const CAMPOS_DO_TITULO = ['codeBonds', 'descTypeBond', 'expirateDate', 'buyValue', 'minimumInvestmentValue', 'nickname', 'descIndex', 'profitability', 'indexBonds'];
    // Da posição (1.7.0), só o que o e-mail de resgate e a conferência usam: o preço médio, o valor
    // investido, o líquido e o imposto não saem do Hub.
    const CAMPOS_DA_POSICAO_NO_TESOURO = ['bondName', 'codeBonds', 'expirateDate', 'quantityBalance', 'blockedQuantity', 'sellPrice', 'grossValue'];
    const soCampos = (itens, campos) => itens.filter((i) => i && typeof i === 'object').map((i) => Object.fromEntries(campos.filter((c) => c in i).map((c) => [c, i[c]])));
    // O que chegou sem ninguém esperar fica 5 s: a lista pedida pela própria página, logo antes do pedido.
    const vistas = { lista: null, posicoes: null };
    // O que esta carga da página já leu (`lista:<conta>`, `posicoes:<conta>`): o Hub não pede de novo.
    const lidasNaPagina = new Set();
    let esperaLista = null;
    const anotarTesouro = (endereco, json) => {
      const leitura = POSICOES_DO_TESOURO.test(endereco) ? 'posicoes' : 'lista';
      const conta = ((leitura === 'posicoes' ? POSICOES_DO_TESOURO : LISTA_DO_TESOURO).exec(endereco) || [])[1];
      if (!doRobo || papel !== 'tesouro' || !conta) return;
      lidasNaPagina.add(`${leitura}:${conta}`);
      let lista;
      if (leitura === 'posicoes') {
        // A posição vem como uma lista solta (vista no Hub em 20/10/2026); embrulhada em `data`, também.
        const itens = Array.isArray(json) ? json : json && Array.isArray(json.data) ? json.data : null;
        lista = itens ? { conta, posicoes: soCampos(itens, CAMPOS_DA_POSICAO_NO_TESOURO) } : { conta, erro: String((json && (json.message || json.moreInfo)) || 'o Hub não mostrou a posição no Tesouro') };
        registrar(itens ? 'a posição no Tesouro chegou' : 'o Hub recusou a posição no Tesouro');
      } else {
        const itens = json && json.data && Array.isArray(json.data.items) ? json.data.items : null;
        lista = itens ? { conta, itens: soCampos(itens, CAMPOS_DO_TITULO) } : { conta, erro: String((json && (json.message || json.moreInfo)) || 'o Hub não mostrou a lista do Tesouro') };
        registrar(itens ? 'a lista do Tesouro chegou' : 'o Hub recusou a lista do Tesouro');
      }
      if (esperaLista && esperaLista.conta === conta && esperaLista.leitura === leitura) esperaLista.resolver(lista);
      else vistas[leitura] = { ...lista, em: Date.now() };
    };
    const doTesouro = (endereco) => LISTA_DO_TESOURO.test(endereco) || POSICOES_DO_TESOURO.test(endereco);

    // A ficha chega por XHR, não por fetch: o gancho no XHR só entra nas abas de clientes e do
    // Tesouro do robô.
    if (papel === 'clientes' || papel === 'tesouro') {
      const prototipo = pagina.XMLHttpRequest.prototype;
      const abrirXhr = prototipo.open;
      const enviarXhr = prototipo.send;
      prototipo.open = function (metodo, endereco, ...resto) {
        this.mesaxpEndereco = String(endereco);
        return abrirXhr.call(this, metodo, endereco, ...resto);
      };
      prototipo.send = function (...args) {
        const endereco = this.mesaxpEndereco || '';
        if (papel === 'tesouro' && doTesouro(endereco)) {
          this.addEventListener('load', () => {
            try {
              anotarTesouro(endereco, JSON.parse(this.responseText));
            } catch {
              /* a página segue com a resposta dela */
            }
          });
        }
        if (FICHA.test(endereco)) {
          registrar('chamada', { fase: 'ida', caminho: caminhoDe(endereco) });
          this.addEventListener('load', () => {
            registrar('chamada', { fase: 'volta', caminho: caminhoDe(endereco) });
            try {
              const tipo = this.responseType;
              anotarFicha(endereco, tipo === 'json' ? this.response : tipo === '' || tipo === 'text' ? JSON.parse(this.responseText) : null);
            } catch {
              /* a página segue com a resposta dela */
            }
          });
        }
        return enviarXhr.apply(this, args);
      };
    }

    // Do pre-check só saem estes campos, e só se forem número (ou, nas travas, verdadeiro/falso).
    const CAMPOS_DA_POSICAO = ['quotaQuantity', 'quotaQuantityAvailable', 'quotaQuantityOnSale'];
    const CAMPOS_DO_ESTOQUE = ['secondaryDiscount', 'percentageComission', 'unitaryQuotaValue', 'quotaQuantityAvailable', 'maxAmountVariationPercentage'];
    const TRAVAS = ['canOperateBuyTreasury', 'canOperateBuyPeerToPeer', 'canOperateSellTreasury', 'canOperateSellPeerToPeer'];
    const numerosDe = (origem, campos) => {
      if (!origem || typeof origem !== 'object') return null;
      const lidos = {};
      for (const campo of campos) if (typeof origem[campo] === 'number' && Number.isFinite(origem[campo])) lidos[campo] = origem[campo];
      return lidos;
    };
    const estoquesDe = (stock) => {
      if (!stock || typeof stock !== 'object') return null;
      const lidos = {};
      for (const trava of TRAVAS) if (typeof stock[trava] === 'boolean') lidos[trava] = stock[trava];
      for (const modalidade of ['treasury', 'peerToPeer']) {
        const m = stock[modalidade];
        if (m && typeof m === 'object') lidos[modalidade] = { buy: numerosDe(m.buy, CAMPOS_DO_ESTOQUE) || {}, sell: numerosDe(m.sell, CAMPOS_DO_ESTOQUE) || {} };
      }
      return lidos;
    };

    /* O gancho no fetch entra antes do app carregar: é por ele que passam a prateleira e o
       pre-check da boleta. */
    let esperaPreCheck = null;
    // Quando esta aba pediu e recebeu a lista pela última vez, e quem está esperando por ela.
    let listaPedidaEm = 0;
    let capturouEm = 0;
    let acordar = () => {};
    const original = pagina.fetch;
    pagina.fetch = async function (...args) {
      let endereco = '';
      try {
        endereco = String((args[0] && args[0].url) || args[0]);
      } catch {
        /* sem endereço, sem anotação */
      }
      const doHub = /\/yield-rede\//.test(endereco); // as chamadas da API de fundos do Hub
      if (doHub) registrar('chamada', { fase: 'ida', caminho: caminhoDe(endereco) });
      if (LISTA.test(endereco)) listaPedidaEm = Date.now();
      const resposta = await original.apply(this, args);
      if (doHub) registrar('chamada', { fase: 'volta', caminho: caminhoDe(endereco) });
      try {
        if (LISTA.test(endereco)) {
          resposta
            .clone()
            .json()
            .then((json) => {
              if (!json || !Array.isArray(json.data)) return;
              const pedido = GM_getValue('pedido', null);
              const id = pedido && Date.now() - pedido.em < PEDIDO_MS ? pedido.id : null;
              gravarRegistro();
              GM_setValue('captura', { id, capturadaEm: new Date().toISOString(), resposta: json });
              capturouEm = Date.now();
              acordar();
            })
            .catch(() => {});
        }

        // Do pre-check sai só o preço e o dia da cota do fundo — nada do cliente. Vale também
        // quando é a pessoa que abre a boleta: a Mesa guarda o preço, com a hora, por uns minutos.
        if (PRE_CHECK.test(endereco)) {
          resposta
            .clone()
            .json()
            .then((json) => {
              const fundo = json && json.fund;
              if (!fundo || !FUNDO.test(String(fundo.id)) || typeof fundo.quotaValue !== 'number') return;
              const cota = { fundoId: fundo.id, valor: fundo.quotaValue, dataDaCota: String(fundo.quotaDate || '').slice(0, 10) };
              if (esperaPreCheck && esperaPreCheck.fundoId === cota.fundoId) {
                // Da boleta que o robô abriu: os estoques do fundo e, na venda, a posição do cliente.
                const { lado } = esperaPreCheck;
                const posicao = lado === 'vender' ? numerosDe(json.customer && json.customer.balancePosition, CAMPOS_DA_POSICAO) : null;
                esperaPreCheck.resolver({ ...cota, lado, stock: estoquesDe(fundo.stock), posicao });
              } else GM_setValue('cotaVista', { ...cota, em: Date.now() });
            })
            .catch(() => {});
        }

        // A lista do Tesouro e a posição nele, por fetch.
        if (papel === 'tesouro' && doTesouro(endereco)) {
          resposta
            .clone()
            .json()
            .then((json) => anotarTesouro(endereco, json))
            .catch(() => {});
        }

        // A ficha do cliente vem por XHR hoje; se um dia vier por fetch, é lida do mesmo jeito.
        if (papel === 'clientes' && FICHA.test(endereco)) {
          resposta
            .clone()
            .json()
            .then((json) => anotarFicha(endereco, json))
            .catch(() => {});
        }
      } catch {
        /* o app do Hub segue com a resposta dele, de qualquer jeito */
      }
      return resposta;
    };

    // Cada aba do Hub diz, de tempos em tempos, se está viva, se é a do robô e se está pronta.
    const darSinal = () => {
      const abas = sinais();
      const agora = Date.now();
      for (const [chave, sinal] of Object.entries(abas)) {
        if (agora - sinal.vivo > VIVA_MS) delete abas[chave];
      }
      abas[aba] = { vivo: agora, robo: doRobo, papel: doRobo ? papel : null, prateleira: naPrateleira() && Boolean(botao()) };
      GM_setValue('abas', abas);
      marcarTitulo();
      gravarRegistro();
    };
    const sair = () => {
      gravarRegistro();
      const abas = sinais();
      delete abas[aba];
      GM_setValue('abas', abas);
    };

    // Espera `condicao()` dar alguma coisa: confere agora, a cada 300 ms e a cada lista que chega.
    const esperar = (condicao, prazo) =>
      new Promise((resolver) => {
        const limite = Date.now() + prazo;
        let relogio = null;
        const conferir = () => {
          clearTimeout(relogio);
          const achado = condicao();
          if (achado || Date.now() > limite) {
            acordar = () => {};
            return resolver(achado || null);
          }
          relogio = setTimeout(conferir, 300);
        };
        acordar = conferir;
        conferir();
      });

    const irPara = (rota) => {
      if (location.hash !== rota) location.hash = rota;
    };
    // Muda a rota e dá ao Hub a vez de trocar de tela: a mudança de endereço só chega a ele no
    // evento seguinte, e duas mudanças no mesmo instante ele veria como uma só — a Prateleira entre
    // duas boletas nem chegaria a aparecer.
    const trocarDeTela = (rota) =>
      new Promise((resolver) => {
        if (location.hash === rota) return resolver();
        const relogio = setTimeout(resolver, 1000);
        pagina.addEventListener(
          'hashchange',
          () => {
            clearTimeout(relogio);
            resolver();
          },
          { once: true }
        );
        location.hash = rota;
      });
    const naBoleta = () => /^#\/secundario\/(comprar|vender)\//.test(location.hash);
    const ondeEsta = () =>
      papel === 'clientes' ? 'ficha do cliente' : naPrateleira() ? 'Prateleira' : naBoleta() ? 'boleta' : 'outra página';

    /* ── O print da cotação de venda (1.5.0) ─────────────────────────────────────────────
       A boleta do Hub é feita de web components (Soma) com shadow DOM aberto: a busca desce por eles.
       O print é o painel do fim da etapa 1 — a caixa "Valor total da operação" e "Visualizar mais
       detalhes da operação" aberto —, que só aparece com a quantidade preenchida. É o que vai no
       e-mail de auditoria de venda, logo abaixo de "Condições:" (decidido com o operador em 20/10). */

    // A SnapDOM (src/vendor/snapdom.js, 3.2.0, MIT) entra no marcador abaixo quando a Mesa monta o
    // "Copiar robô" (roboHub.js). Só é carregada na aba do robô, no primeiro print.
    let snapdom = null;
    const carregarSnapdom = () => {
      if (snapdom) return snapdom;
      try {
        /*@@SNAPDOM@@*/
      } catch {
        /* sem a biblioteca, o print falha com o motivo */
      }
      snapdom = (typeof window !== 'undefined' && window.snapdom) || pagina.snapdom || null;
      return snapdom;
    };

    // Todos os elementos da página na ordem do documento, descendo pelos shadow roots abertos.
    const elementosDe = (raiz) => {
      const achados = [];
      const visitar = (no) => {
        if (no.nodeType === 1) achados.push(no);
        if (no.shadowRoot) for (const filho of no.shadowRoot.children) visitar(filho);
        for (const filho of no.children || []) visitar(filho);
      };
      visitar(raiz);
      return achados;
    };
    const textoProprio = (el) =>
      [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    const visivel = (el) => el.getClientRects().length > 0;
    // O valor de um rótulo: o primeiro texto depois dele que não é outro rótulo.
    const valorDoRotulo = (todos, rotulo, padrao) => {
      const i = todos.indexOf(rotulo);
      return i < 0 ? null : todos.slice(i + 1, i + 40).find((el) => padrao.test(textoProprio(el))) || null;
    };
    const paiComposto = (el) => el.parentElement || (el.parentNode && el.parentNode.host) || null;
    const ancestrais = (el) => {
      const lista = [];
      for (let a = el; a; a = paiComposto(a)) lista.push(a);
      return lista;
    };
    const ancestralComum = (a, b) => {
      const deA = new Set(ancestrais(a));
      return ancestrais(b).find((x) => deA.has(x)) || null;
    };
    // O número da tela: "54.36585" no painel, "54,36585000" no campo, "R$ 1.234,56" no total.
    const numeroDaTela = (texto) => {
      const t = String(texto || '').replace(/[^\d.,]/g, '');
      if (!t) return null;
      const brasileiro = t.includes(',');
      const n = Number(brasileiro ? t.replace(/\./g, '').replace(',', '.') : t);
      return Number.isFinite(n) ? n : null;
    };

    // O robô só clica no que está nesta lista — e no que estiver em volta do rótulo, para o clique
    // chegar ao componente. Próximo, Cancelar, Vender e a caixa de notificação ficam de fora.
    const CLIQUES_PERMITIDOS = ['Estoque XP', 'Estoque clientes', 'Total de cotas', 'Visualizar mais detalhes da operação'];
    const textoInteiro = (el) => String(el.textContent || '').replace(/\s+/g, ' ').trim();
    const clicarSo = (el, extras = []) => {
      const texto = el ? textoProprio(el) || textoInteiro(el) : '';
      if (!el || ![...CLIQUES_PERMITIDOS, ...extras].includes(texto)) return false;
      el.click();
      return true;
    };

    const preencher = (campo, texto) => {
      const definir = Object.getOwnPropertyDescriptor(pagina.HTMLInputElement.prototype, 'value').set;
      campo.focus();
      definir.call(campo, texto);
      campo.dispatchEvent(new pagina.InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: texto }));
      campo.dispatchEvent(new pagina.Event('change', { bubbles: true, composed: true }));
    };
    const campoDeQuantidade = () => {
      const campos = elementosDe(document).filter((el) => el.tagName === 'INPUT');
      return (
        campos.find((el) => /quantidade de cotas/i.test(el.placeholder || '')) ||
        campos.find((el) => /^quantidade$/i.test((el.getAttribute('aria-label') || el.name || '').trim())) ||
        null
      );
    };
    const mesmoNumero = (a, b) => a !== null && b !== null && Math.abs(a - b) < 1e-7;

    /*
     * A escolha do estoque (1.9.0): na boleta de venda do Hub, o campo de quantidade e o detalhe da
     * operação só aparecem depois de escolher "Estoque XP" ou "Estoque clientes" (visto pelo operador
     * em 21/10/2026: o print não saía porque o robô não escolhia). O rótulo é procurado pelo texto
     * exato; já escolhido (marcado como selecionado nele ou em volta), não é clicado de novo.
     */
    const ROTULOS_DO_ESTOQUE = { xp: ['Estoque XP'], clientes: ['Estoque clientes', 'Estoque Clientes', 'Estoque cliente'] };
    const SELECIONADO = /(^|[\s_-])(selected|checked|active|ativo|ativa|selecionado|selecionada)($|[\s_-])/i;
    const jaEscolhido = (el) =>
      ancestrais(el)
        .slice(0, 5)
        .some(
          (a) =>
            a.getAttribute?.('aria-checked') === 'true' ||
            a.getAttribute?.('aria-selected') === 'true' ||
            a.getAttribute?.('aria-pressed') === 'true' ||
            a.checked === true ||
            a.hasAttribute?.('checked') ||
            a.hasAttribute?.('selected') ||
            SELECIONADO.test(String(a.className || ''))
        );
    const escolherEstoque = async (modalidade) => {
      const rotulos = ROTULOS_DO_ESTOQUE[modalidade] || ROTULOS_DO_ESTOQUE.xp;
      const opcao = await esperar(() => elementosDe(document).find((el) => rotulos.includes(textoProprio(el)) && visivel(el)) || null, 8000);
      if (!opcao) {
        registrar('não achou a escolha do estoque', { modalidade });
        return modalidade === 'xp';
      }
      if (jaEscolhido(opcao)) {
        registrar('o estoque já estava escolhido', { modalidade });
        return true;
      }
      // O clique sai do rótulo e sobe até o componente; a lista fechada aceita o rótulo deste estoque.
      if (!clicarSo(opcao, rotulos)) return false;
      registrar('escolheu o estoque', { modalidade });
      await pausa(500);
      return true;
    };

    /**
     * O print de uma venda, na boleta de venda que está aberta: `quantidade` é a do pedido, ou null
     * para o total da posição; `modalidade`, o estoque pedido ('xp' ou 'clientes'); `desagio`, o do
     * estoque pedido, para conferir no painel. Devolve o PNG (data URL) e a quantidade que o painel mostrou.
     */
    const tirarPrint = async ({ quantidade, posicao, modalidade = 'xp', desagio = null }) => {
      if (!(await escolherEstoque(modalidade))) return { erro: 'sem-estoque' };
      const campo = await esperar(campoDeQuantidade, 10000);
      if (!campo) return { erro: 'sem-campo' };

      if (quantidade === null) {
        const total = await esperar(() => elementosDe(document).find((el) => textoProprio(el) === 'Total de cotas') || null, 5000);
        if (!clicarSo(total)) return { erro: 'sem-total' };
      } else {
        // A máscara do campo tem 8 casas, e os dígitos entram pela direita: 590 cotas são 59000000000.
        preencher(campo, String(Math.round(quantidade * 1e8)));
        if (!mesmoNumero(numeroDaTela(campo.value), quantidade)) preencher(campo, quantidade.toFixed(8).replace('.', ','));
      }
      const esperada = quantidade === null ? posicao : quantidade;
      registrar('preencheu a quantidade', { total: quantidade === null });

      // O total da operação deixa de ser zero quando a boleta faz a conta.
      const rotuloDoTotal = () => elementosDe(document).find((el) => textoProprio(el) === 'Valor total da operação');
      const fez = await esperar(() => {
        const todos = elementosDe(document);
        const valor = rotuloDoTotal() && valorDoRotulo(todos, rotuloDoTotal(), /^R\$/);
        return valor && numeroDaTela(textoProprio(valor)) > 0 ? valor : null;
      }, 10000);
      if (!fez) return { erro: 'sem-conta' };

      // Abre o detalhe, se estiver fechado. A opção aparece embaixo depois que a boleta faz a conta, e
      // pode demorar (1.9.0): o robô espera por ela, e clica de novo se o painel não abrir.
      const linhaDaQuantidade = () => elementosDe(document).find((el) => textoProprio(el) === 'Quantidade de cotas' && visivel(el)) || null;
      let rotuloDaQuantidade = linhaDaQuantidade();
      for (let tentativa = 0; !rotuloDaQuantidade && tentativa < 2; tentativa++) {
        const detalhe = await esperar(
          () => elementosDe(document).find((el) => textoProprio(el) === 'Visualizar mais detalhes da operação' && visivel(el)) || null,
          8000
        );
        if (!clicarSo(detalhe)) break;
        registrar('abriu o detalhe da operação');
        rotuloDaQuantidade = await esperar(linhaDaQuantidade, 4000);
      }
      if (!rotuloDaQuantidade) return { erro: 'sem-detalhe' };

      // A quantidade do painel tem de ser a esperada: sem isso, nada de print.
      const todos = elementosDe(document);
      const quantidadeNoPainel = numeroDaTela(textoProprio(valorDoRotulo(todos, rotuloDaQuantidade, /^[\d.,]+$/) || { childNodes: [] }));
      if (esperada !== null && esperada !== undefined && !mesmoNumero(quantidadeNoPainel, esperada)) {
        registrar('a quantidade do painel não bateu');
        return { erro: 'quantidade-diferente' };
      }
      // O deságio do painel, se ele o mostra, tem de ser o do estoque pedido: o outro estoque escolhido
      // daria um print com outra conta.
      const rotuloDoDesagio = todos.find((el) => /^Deságio/i.test(textoProprio(el)) && visivel(el));
      const desagioNoPainel = rotuloDoDesagio ? numeroDaTela(textoProprio(valorDoRotulo(todos, rotuloDoDesagio, /^-?[\d.,]+ ?%$/) || { childNodes: [] })) : null;
      if (typeof desagio === 'number' && desagioNoPainel !== null && Math.abs(desagioNoPainel - desagio) > 0.005) {
        registrar('o deságio do painel não é o do estoque pedido');
        preencher(campo, '');
        return { erro: 'estoque-diferente' };
      }

      // A região: da caixa do total ao último valor do detalhe, recortada no lugar exato.
      const rotulosDoTotal = todos.filter((el) => textoProprio(el) === 'Valor total da operação' && visivel(el));
      const primeiro = rotulosDoTotal[0];
      const ultimo = valorDoRotulo(todos, rotulosDoTotal[rotulosDoTotal.length - 1], /^R\$/);
      const regiao = primeiro && ultimo ? ancestralComum(primeiro, ultimo) : null;
      if (!regiao) return { erro: 'sem-regiao' };

      const biblioteca = carregarSnapdom();
      if (!biblioteca) return { erro: 'sem-snapdom' };
      // A foto tem prazo (1.7.1): numa aba escondida há muito tempo, o Chrome segura os relógios dela, e
      // uma foto que não termina prendia a fila da aba — nem a cotação andava mais.
      const tela = await Promise.race([
        biblioteca.toCanvas(regiao, { scale: 2, backgroundColor: '#ffffff' }),
        new Promise((r) => setTimeout(() => r(null), PRINT_MS))
      ]);
      if (!tela) {
        preencher(campo, '');
        registrar('a foto passou do prazo');
        return { erro: 'print-demorou' };
      }
      const caixa = regiao.getBoundingClientRect();
      const escala = tela.width / Math.max(1, caixa.width);
      const topo = Math.max(0, (primeiro.getBoundingClientRect().top - caixa.top - 28) * escala);
      const fim = Math.min(tela.height, (ultimo.getBoundingClientRect().bottom - caixa.top + 16) * escala);
      const recorte = document.createElement('canvas');
      recorte.width = tela.width;
      recorte.height = Math.max(1, Math.round(fim - topo));
      recorte.getContext('2d').drawImage(tela, 0, topo, tela.width, recorte.height, 0, 0, tela.width, recorte.height);
      const png = recorte.toDataURL('image/png');

      // O campo volta a ficar vazio: a boleta não fica preenchida na aba do robô.
      preencher(campo, '');
      registrar('tirou o print');
      return { png, quantidade: quantidadeNoPainel, em: Date.now() };
    };

    // Os prints de um pedido: as boletas de venda uma atrás da outra, e cada print segue para a Mesa
    // assim que sai.
    const lerPrints = async ({ id, itens }) => {
      const resultados = [];
      for (const [i, { fundoId, conta, quantidade, modalidade, desagio }] of itens.entries()) {
        if (naBoleta()) await passarPelaPrateleira();
        const cota = await abrirBoleta(fundoId, conta, PRE_CHECK_MS, false, 'vender');
        let resultado = { fundoId, indice: i, erro: 'sem-boleta' };
        if (cota) {
          const posicao = cota.posicao ? cota.posicao.quotaQuantityAvailable : null;
          try {
            resultado = { fundoId, indice: i, ...(await tirarPrint({ quantidade, posicao, modalidade, desagio })) };
          } catch {
            resultado = { fundoId, indice: i, erro: 'falhou-o-print' };
          }
        }
        registrar(resultado.erro ? 'o print não saiu' : 'print pronto', { fundoId, motivo: resultado.erro || null });
        resultados.push(resultado);
        gravarRegistro();
        GM_setValue('prints', { id, resultados: resultados.slice(), fim: i === itens.length - 1 });
      }
      GM_setValue('pedidoPrints', null);
      await trocarDeTela(PRATELEIRA);
      registrar('voltou à Prateleira');
    };

    /*
     * A lista do Tesouro de uma conta (1.6.0), em Produtos → Tesouro Direto, e a posição dela (1.7.0),
     * em Posições → Posição por cliente → Tesouro Direto. Escolhe o cliente — digita a conta no
     * "Pesquisar cliente" e clica no resultado "Conta XP: <conta>", e só nele — e espera a resposta que
     * o Hub pede para ele. Não abre boleta nem clica em mais nada além da aba "Tesouro Direto".
     *
     * O que o Hub de verdade faz, visto em 20/10/2026 (e por isso a 1.7.0 refez a 1.6.0):
     *  - pede a lista, e a posição, de um cliente **uma vez só por carga da página**: ir e voltar de
     *    tela, escolher o mesmo cliente de novo ou clicar em "Atualizar" não o fazem pedir outra vez.
     *    Se esta carga da página já leu a conta pedida, o robô recarrega a aba e retoma o pedido;
     *  - o cliente escolhido vale para Produtos e Posições, e continua escolhido depois de recarregar;
     *  - o resultado da busca ignora o clique que chega cedo demais: o robô espera 1,5 s e clica de
     *    novo enquanto a lista de resultados não fecha;
     *  - em Posições, a página abre na aba Renda Fixa e desfaz a troca de rota feita na carga; a posição
     *    do Tesouro é pedida no clique da aba "Tesouro Direto".
     */
    const esperarLista = (conta, leitura, prazo) =>
      new Promise((resolver) => {
        const relogio = setTimeout(() => {
          esperaLista = null;
          resolver(null);
        }, prazo);
        esperaLista = {
          conta,
          leitura,
          resolver: (lista) => {
            clearTimeout(relogio);
            esperaLista = null;
            resolver(lista);
          }
        };
      });
    const ate = (promessa, ms) => Promise.race([promessa, new Promise((r) => setTimeout(() => r(null), ms))]);
    const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

    const escolherCliente = async (conta) => {
      const busca = await esperar(
        () => elementosDe(document).find((el) => el.tagName === 'INPUT' && /pesquisar cliente/i.test(el.placeholder || el.getAttribute('aria-label') || '')),
        20000
      );
      if (!busca) return false;
      preencher(busca, conta);
      registrar('procurou o cliente');
      const resultado = await esperar(() => elementosDe(document).filter((el) => textoInteiro(el) === `Conta XP: ${conta}`).pop(), 10000);
      if (!resultado) return false;
      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        await pausa(1500);
        if (!resultado.isConnected || !visivel(resultado)) break;
        if (!clicarSo(resultado, [`Conta XP: ${conta}`])) return false;
        registrar('escolheu o cliente', { tentativa });
      }
      return true;
    };

    const abrirAbaDoTesouro = async () => {
      const aba = await esperar(
        () => elementosDe(document).find((el) => (el.tagName === 'SOMA-TAB' || el.getAttribute('role') === 'tab') && textoInteiro(el) === 'Tesouro Direto'),
        20000
      );
      if (!aba) return false;
      await pausa(1500);
      const clicou = clicarSo(aba, ['Tesouro Direto']);
      if (clicou) registrar('abriu a aba Tesouro Direto');
      return clicou;
    };

    const lerTesouro = async ({ id, conta, leitura }) => {
      const posicoes = leitura === 'posicoes';
      const tipo = posicoes ? 'posicoes' : 'lista';
      const vista = vistas[tipo];
      let lista = vista && vista.conta === conta && Date.now() - vista.em < 10000 ? vista : null;
      vistas[tipo] = null;
      if (!lista && lidasNaPagina.has(`${tipo}:${conta}`)) {
        // O Hub não pede de novo o que já pediu nesta carga: recarrega, e a página nova retoma o
        // pedido (`recarregouTesouro`). A marca de atendimento fica, para a Mesa não abrir outra aba.
        GM_setValue('recarregouTesouro', id);
        registrar('recarregou para ler de novo');
        gravarRegistro();
        location.reload();
        return;
      }
      // Uma espera só, para as tentativas: a resposta da conta pedida, quando o Hub a pedir.
      const chegando = lista ? null : esperarLista(conta, tipo, 30000);
      if (!lista) {
        // A tela certa: entrar em Produtos → Tesouro Direto pede a lista do cliente escolhido; em
        // Posições, é o clique na aba "Tesouro Direto". Se é a conta pedida, a resposta chega aqui.
        if (posicoes) {
          if (!location.hash.startsWith('#/posicoes/cliente')) await trocarDeTela(ROTA_DA_RENDA_FIXA);
          await abrirAbaDoTesouro();
        } else await trocarDeTela(ROTA_DO_TESOURO);
        lista = await ate(chegando, 3000);
      }
      if (!lista && (await escolherCliente(conta))) {
        lista = await ate(chegando, 3000);
        if (!lista && posicoes) await abrirAbaDoTesouro();
      }
      lista = lista || (await chegando);
      GM_setValue('pedidoTesouro', null);
      gravarRegistro();
      const { em: _em, ...campos } = lista || {};
      GM_setValue('tesouro', lista ? { id, leitura: tipo, ...campos } : { id, conta, leitura: tipo, erro: posicoes ? 'sem-posicoes' : 'sem-lista' });
    };

    // As tarefas do robô, uma por vez.

    // A cotação. A Prateleira que acaba de montar — a aba recém-aberta, a volta de uma boleta — pede
    // a lista sozinha: se ela chegou depois do pedido, ou está a caminho, o clique só a pediria de
    // novo. A caminho por no máximo 10 s: uma lista que não chega não segura o clique.
    const listaACaminho = () => listaPedidaEm > capturouEm && Date.now() - listaPedidaEm < 10000;
    const atualizar = async (pedido) => {
      irPara(PRATELEIRA);
      const achado = await esperar(() => (capturouEm >= pedido.em ? 'lista' : listaACaminho() ? null : botao()), 20000);
      if (achado === 'lista') return registrar('a lista veio sem clique');
      registrar(achado ? 'clicou em Atualizar' : 'não achou o botão Atualizar');
      if (achado) achado.click();
    };

    // Abre a boleta do fundo para a conta — de compra ou de venda — e espera o pre-check dele.
    const abrirBoleta = (fundoId, conta, prazo, direto, lado = 'comprar') =>
      new Promise((resolver) => {
        const relogio = setTimeout(() => {
          esperaPreCheck = null;
          resolver(null);
        }, prazo);
        esperaPreCheck = {
          fundoId,
          lado,
          resolver: (cota) => {
            clearTimeout(relogio);
            esperaPreCheck = null;
            resolver(cota);
          }
        };
        registrar('abriu a boleta', { fundoId, direto, lado });
        irPara(`#/secundario/${lado}/${fundoId}/${conta}`);
      });

    const passarPelaPrateleira = async () => {
      registrar('passou pela Prateleira');
      await trocarDeTela(PRATELEIRA);
      await esperar(() => naPrateleira() && botao(), 10000);
    };

    // Se ir de uma boleta direto para a próxima dispara o pre-check novo. Na primeira vez que não
    // disparar — saindo de uma boleta que carregou —, esta aba passa a ir pela Prateleira entre elas.
    let trocaDireta = true;

    // O preço exato das cotas: as boletas uma atrás da outra, e cada preço segue para a Mesa assim
    // que chega, sem esperar os outros.
    const lerCotas = async ({ id, itens }) => {
      const resultados = [];
      let anteriorCarregou = false;
      for (const [i, { fundoId, conta, lado }] of itens.entries()) {
        // Saindo de uma boleta que não carregou (a conta não é de um cliente, por exemplo), a troca
        // direta não diria nada: passa pela Prateleira.
        const direto = trocaDireta && naBoleta() && anteriorCarregou;
        if (naBoleta() && !direto) await passarPelaPrateleira();
        let cota = await abrirBoleta(fundoId, conta, direto ? TROCA_DIRETA_MS : PRE_CHECK_MS, direto, lado);
        if (!cota && direto) {
          trocaDireta = false;
          registrar('a troca direta não trouxe o pre-check', { fundoId });
          await passarPelaPrateleira();
          cota = await abrirBoleta(fundoId, conta, PRE_CHECK_MS, false, lado);
        }
        registrar(cota ? 'pre-check chegou' : 'pre-check não veio', { fundoId });
        anteriorCarregou = Boolean(cota);
        // O lugar do item na lista: o mesmo fundo pode vir em duas contas.
        resultados.push(cota ? { ...cota, indice: i } : { fundoId, indice: i, erro: 'sem-boleta' });
        gravarRegistro();
        GM_setValue('cotas', { id, resultados: resultados.slice(), fim: i === itens.length - 1 });
      }
      // De volta à Prateleira, uma vez só: a boleta não fica aberta, e a conta sai do endereço. A
      // Mesa já tem todos os preços; esperar a troca de tela só segura a próxima tarefa da fila.
      GM_setValue('pedidoCotas', null);
      await trocarDeTela(PRATELEIRA);
      registrar('voltou à Prateleira');
    };

    const esperarFicha = (conta, prazo) =>
      new Promise((resolver) => {
        const relogio = setTimeout(() => {
          esperaFicha = null;
          resolver(null);
        }, prazo);
        esperaFicha = {
          conta,
          resolver: (ficha) => {
            clearTimeout(relogio);
            esperaFicha = null;
            resolver(ficha);
          }
        };
      });

    // O cliente: a aba de clientes troca para a ficha da conta pedida, pelo endereço que o próprio Hub
    // usa, e espera a resposta. Sem digitar nem clicar. Recarrega a página, uma vez por pedido, quando
    // a ficha pedida já está na tela (ir para o mesmo endereço não faz o Hub pedi-la de novo) e
    // quando a troca de endereço não a trouxe; a página recarregada pega o mesmo pedido ao abrir.
    const lerCliente = async ({ id, conta }) => {
      const rota = rotaDoCliente(conta);
      const jaRecarregou = GM_getValue('recarregouPara', null) === id;
      // A marca de atendimento fica (1.7.0): a página nova retoma o pedido por `recarregouPara`, e a
      // Mesa não abre outra aba no meio da recarga.
      const recarregar = () => {
        GM_setValue('recarregouPara', id);
        registrar('recarregou a ficha do cliente');
        gravarRegistro();
        location.reload();
      };
      let ficha = fichaVista && fichaVista.conta === conta && Date.now() - fichaVista.em < PEDIDO_MS ? fichaVista : null;
      fichaVista = null;
      if (!ficha) {
        if (location.hash === rota && contaDaTela === conta && !jaRecarregou) return recarregar();
        const chegando = esperarFicha(conta, FICHA_MS);
        registrar('abriu a ficha do cliente', { troca: location.hash !== rota });
        if (location.hash !== rota) await trocarDeTela(rota);
        ficha = await chegando;
      }
      if (!ficha && !jaRecarregou) return recarregar();
      // O pedido sai do armazenamento, com a conta; o cliente fica nele só até a Mesa o receber.
      GM_setValue('pedidoCliente', null);
      gravarRegistro();
      const { em: _em, ...campos } = ficha || {};
      GM_setValue('cliente', ficha ? { id, ...campos } : { id, erro: 'sem-cliente' });
    };

    let fila = Promise.resolve();
    const vistos = new Set();
    const receber = (pedido, trabalho) => {
      if (!doRobo || !pedido || vistos.has(pedido.id) || Date.now() - pedido.em > PEDIDO_MS) return;

      // A pessoa está usando esta aba noutra página do Hub: ela deixa de ser do robô, e a Mesa,
      // sem resposta, abre outra.
      if (visibilidadeReal() === 'visible' && !naRotaDoRobo()) {
        doRobo = false;
        pagina.name = '';
        document.title = document.title.replace(/^🤖 (Robô|Clientes|Tesouro|Print) · /, '');
        darSinal();
        return;
      }
      const atendendo = PAPEIS[papel].atendendo;
      // A aba que recarregou para ler de novo (1.7.0) retoma o pedido que já era dela: a do Tesouro, e
      // a de clientes (`recarregouPara` fica, para ela não recarregar duas vezes pelo mesmo pedido).
      const retomada =
        (papel === 'tesouro' && GM_getValue('recarregouTesouro', null) === pedido.id) ||
        (papel === 'clientes' && GM_getValue('recarregouPara', null) === pedido.id);
      if (retomada && papel === 'tesouro') GM_setValue('recarregouTesouro', null);
      if (!retomada && GM_getValue(atendendo, null)?.id === pedido.id) return; // outra aba do robô já pegou

      vistos.add(pedido.id);
      GM_setValue(atendendo, { id: pedido.id, em: Date.now() });
      const tipo =
        trabalho === atualizar ? 'cotação' : trabalho === lerCliente ? 'cliente' : trabalho === lerPrints ? 'prints' : trabalho === lerTesouro ? 'tesouro' : 'preços exatos';
      registrar('pedido recebido', { tipo });
      fila = fila
        .then(() => {
          registrar('tarefa começou', { tipo, escondida: visibilidadeReal() === 'hidden', onde: ondeEsta(), botao: Boolean(botao()) });
          return Promise.race([
            trabalho(pedido),
            new Promise((r) => setTimeout(() => r(registrar('a tarefa passou do limite', { tipo })), TAREFA_MS))
          ]);
        })
        .catch(() => {})
        .then(gravarRegistro);
    };

    // Cada aba atende os pedidos do papel dela: a do robô, a cotação e as boletas; a de clientes, o
    // cliente.
    const receberCotacao = (pedido) => {
      if (papel === 'prateleira') receber(pedido, atualizar);
    };

    // Só passa o fundo e a conta na forma exata: os dois vão para o endereço da boleta.
    const receberCotas = (pedido) => {
      if (papel !== 'prateleira' || !pedido || !Array.isArray(pedido.itens)) return;
      const itens = pedido.itens
        .filter((item) => item && FUNDO.test(String(item.fundoId)) && CONTA.test(String(item.conta)))
        .map((item) => ({ fundoId: item.fundoId, conta: String(item.conta), lado: item.lado === 'vender' ? 'vender' : 'comprar' }));
      if (itens.length > 0) receber({ ...pedido, itens }, lerCotas);
    };

    // Os prints: fundo e conta na forma exata; a quantidade é número positivo, ou null para o total.
    // Só na aba do print (1.12.0), à vista: a aba do robô, escondida, não os faz mais.
    const receberPrints = (pedido) => {
      if (papel !== 'print' || !pedido || !Array.isArray(pedido.itens)) return;
      const itens = pedido.itens
        .filter((item) => item && FUNDO.test(String(item.fundoId)) && CONTA.test(String(item.conta)))
        .filter((item) => item.quantidade === null || (typeof item.quantidade === 'number' && item.quantidade > 0))
        .map((item) => ({
          fundoId: item.fundoId,
          conta: String(item.conta),
          quantidade: item.quantidade,
          modalidade: item.modalidade === 'clientes' ? 'clientes' : 'xp',
          desagio: typeof item.desagio === 'number' && Number.isFinite(item.desagio) ? item.desagio : null
        }));
      if (itens.length > 0) receber({ ...pedido, itens }, lerPrints);
    };

    // A conta vai para o endereço da ficha: só passa na forma exata.
    const receberTesouro = (pedido) => {
      if (papel !== 'tesouro' || !pedido || !CONTA.test(String(pedido.conta))) return;
      receber({ ...pedido, conta: String(pedido.conta) }, lerTesouro);
    };

    const receberCliente = (pedido) => {
      if (papel !== 'clientes' || !pedido || !CONTA.test(String(pedido.conta))) return;
      receber({ ...pedido, conta: String(pedido.conta) }, lerCliente);
    };

    /*
     * A boleta para a pessoa (1.10.0): só a leva até lá. No fundo, espera a Prateleira montar e troca a
     * rota para a boleta — o caminho que a aba do robô usa, e que funciona no Hub de verdade. No
     * Tesouro, escolhe o cliente (o mesmo "Pesquisar cliente" da aba do Tesouro) e, no resgate, abre a
     * aba Tesouro Direto da posição. Nada de quantidade, nada de Próximo: a boleta é da pessoa.
     */
    const levarAte = async (destino) => {
      if (destino.tipo === 'fundo') {
        await esperar(() => naPrateleira() && botao(), 20000);
        location.hash = `#/secundario/${destino.lado}/${destino.fundoId}/${destino.conta}`;
        return;
      }
      if (destino.tipo === 'tesouro') {
        if (destino.leitura === 'posicoes') await trocarDeTela(ROTA_DA_RENDA_FIXA);
        const escolheu = await escolherCliente(destino.conta);
        if (escolheu && destino.leitura === 'posicoes') await abrirAbaDoTesouro();
      }
    };

    const pegarPendentes = () => {
      receberCotacao(GM_getValue('pedido', null));
      receberCotas(GM_getValue('pedidoCotas', null));
      receberCliente(GM_getValue('pedidoCliente', null));
      receberTesouro(GM_getValue('pedidoTesouro', null));
      receberPrints(GM_getValue('pedidoPrints', null));
    };

    GM_addValueChangeListener('pedido', (_chave, _antigo, novo) => receberCotacao(novo));
    GM_addValueChangeListener('pedidoCotas', (_chave, _antigo, novo) => receberCotas(novo));
    GM_addValueChangeListener('pedidoCliente', (_chave, _antigo, novo) => receberCliente(novo));
    GM_addValueChangeListener('pedidoTesouro', (_chave, _antigo, novo) => receberTesouro(novo));
    GM_addValueChangeListener('pedidoPrints', (_chave, _antigo, novo) => receberPrints(novo));
    document.addEventListener('DOMContentLoaded', () => {
      darSinal();
      // A aba que o robô acabou de abrir chega depois do pedido: confere se há um esperando.
      pegarPendentes();
      if (destinoDeExecucao) levarAte(destinoDeExecucao);
    });
    pagina.addEventListener('hashchange', darSinal);
    pagina.addEventListener('pagehide', sair);
    setInterval(darSinal, 30000);
  };

  /* ── No e-mail novo do Outlook (1.5.0) ─────────────────────────────────────────────── */

  // O Outlook na web: o endereço novo do Microsoft 365, os dois antigos e o live.com.
  const ehOOutlook = () => /^outlook\.(cloud\.microsoft|office\.com|office365\.com|live\.com)$/.test(location.hostname);

  /*
   * O corpo do e-mail que a Mesa abriu, trocado pelo HTML. Só age:
   *  - no compor aberto pelo link (`/deeplink/compose`), a janela que a Mesa abre;
   *  - com o pedido da Mesa de menos de 2 minutos, que vale uma vez só;
   *  - quando o corpo já tem o começo do texto que a Mesa mandou no link — é o sinal de que este é o
   *    e-mail certo, e de que o Outlook terminou de pôr o texto nele.
   * Cola como a pessoa colaria (o evento de colar, com o HTML), e o Outlook trata as imagens e a
   * tabela como trata as dele. Nunca clica em Enviar, nem em nada.
   */
  const naAbaDoOutlook = () => {
    // O compor aberto pelo link da Mesa (`/mail/deeplink/compose`), ou o compor para onde o Outlook o
    // leve (1.12.0). Fora de um compor (a caixa de entrada, por exemplo), nada: senão a aba da caixa
    // responderia "sem corpo" ao pedido antes da aba do e-mail colar.
    if (!/\/compose(\/|$)/.test(location.pathname)) return;
    const reservado = GM_getValue('corpoParaOutlook', null);
    if (!reservado || Date.now() - reservado.em > 2 * 60 * 1000) return;
    // A Mesa abre a janela no clique, antes de os prints ficarem prontos — senão o navegador a
    // bloqueia —, e manda o HTML depois: até lá o pedido chega reservado, sem ele. Espera até 90 s.
    if (typeof reservado.html !== 'string') {
      let esperou = false;
      const relogio = setTimeout(() => {
        esperou = true;
        GM_setValue('corpoColado', { id: reservado.id, ok: false, motivo: 'sem-html', em: Date.now() });
      }, 90 * 1000);
      GM_addValueChangeListener('corpoParaOutlook', (_chave, _antigo, novo) => {
        if (esperou || !novo || novo.id !== reservado.id) return;
        if (novo.cancelado) {
          esperou = true;
          clearTimeout(relogio);
          return;
        }
        if (typeof novo.html !== 'string') return;
        esperou = true;
        clearTimeout(relogio);
        naAbaDoOutlook();
      });
      return;
    }
    const pedido = reservado;

    const responder = (ok, motivo = null) => {
      GM_setValue('corpoParaOutlook', null);
      GM_setValue('corpoColado', { id: pedido.id, ok, motivo, em: Date.now() });
    };
    const normalizar = (t) => String(t || '').replace(/\s+/g, ' ').trim();
    // O corpo pelo rótulo dele; se o Outlook mudar o rótulo (1.12.0), o campo editável que já começa
    // com o texto que a Mesa mandou — é ele, e só ele, que recebe o HTML.
    const acharCorpo = () =>
      [...document.querySelectorAll('div[role="textbox"][contenteditable="true"]')].find((el) =>
        /corpo|body|mensagem|message/i.test(el.getAttribute('aria-label') || '')
      ) ||
      [...document.querySelectorAll('[contenteditable="true"]')].find((el) => inicio && normalizar(el.innerText).startsWith(inicio)) ||
      null;

    const colar = (corpo) => {
      corpo.focus();
      const selecao = pagina.getSelection();
      const faixa = document.createRange();
      faixa.selectNodeContents(corpo);
      selecao.removeAllRanges();
      selecao.addRange(faixa);
      const dados = new pagina.DataTransfer();
      dados.setData('text/html', pedido.html);
      dados.setData('text/plain', pedido.texto || '');
      const evento = new pagina.ClipboardEvent('paste', { clipboardData: dados, bubbles: true, cancelable: true });
      corpo.dispatchEvent(evento);
      // Um editor que não trata o colar deixa o evento passar: o HTML entra pelo próprio navegador.
      if (!evento.defaultPrevented) document.execCommand('insertHTML', false, pedido.html);
    };

    const inicio = normalizar(pedido.inicio);
    let tentativas = 0;
    const tentar = () => {
      const corpo = acharCorpo();
      const pronto = corpo && (!inicio || normalizar(corpo.innerText).startsWith(inicio));
      if (!pronto) {
        if (++tentativas < 100) return setTimeout(tentar, 300);
        return responder(false, corpo ? 'outro-email' : 'sem-corpo');
      }
      try {
        colar(corpo);
      } catch {
        return responder(false, 'nao-colou');
      }
      // Confere o que entrou: as imagens e a tabela que o HTML trazia.
      setTimeout(() => {
        const queria = { imagens: (pedido.html.match(/<img\b/g) || []).length, tabelas: (pedido.html.match(/<table\b/g) || []).length };
        const tem = { imagens: corpo.querySelectorAll('img').length, tabelas: corpo.querySelectorAll('table').length };
        responder(tem.imagens >= queria.imagens && tem.tabelas >= queria.tabelas, tem.imagens < queria.imagens ? 'sem-imagens' : tem.tabelas < queria.tabelas ? 'sem-tabela' : null);
      }, 800);
    };
    tentar();
  };

  /* ── Na caixa de entrada do Outlook (1.8.0) ───────────────────────────────────────── */

  // A resposta (ou o encaminhamento) a um e-mail de confirmação da mesa; a hora que o Outlook mostra
  // nas mensagens de hoje; um endereço de e-mail.
  // O assunto de um e-mail de confirmação da mesa. Com "RE:" na frente, ou sem: no modo "conversas"
  // do Outlook na web, a linha da lista mostra o assunto da conversa sem o prefixo (visto na caixa de
  // entrada do operador em 21/10/2026 — a 1.8.0 exigia o "RE:" e não via nenhuma resposta).
  const ASSUNTO_DE_PEDIDO = /confirma[çc][ãa]o/i;
  const PREFIXO_DE_RESPOSTA = /^\s*(?:(?:re|res|resp|enc|fw|fwd|tr|aw|wg)\s*:\s*)+/i;
  // A conta do e-mail citado na resposta: "na conta XP 1234567". A prévia da linha traz o começo do
  // e-mail original, e é por ela que a Mesa liga a resposta ao pedido certo (1.9.1).
  const CONTA_CITADA = /conta\s+XP(?:\s*n[º°o]?)?\s*:?\s*(\d{5,9})/i;
  const HORA_DE_HOJE = /^(?:(?:[01]?\d|2[0-3]):[0-5]\d|\d{1,2}:[0-5]\d\s*(?:AM|PM))$/i;
  const ENDERECO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Um resumo curto e estável de um texto, para a identidade de uma resposta: a Mesa guarda os ids
  // das respostas que a pessoa disse não serem de pedido, e o id não pode levar o nome de ninguém.
  const resumo = (texto) => {
    let h = 5381;
    for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
    return h.toString(36);
  };

  /*
   * As respostas dos clientes, na lista da caixa de entrada que a pessoa deixa aberta. Só age:
   *  - fora do compor (`/deeplink/`), na janela da caixa de entrada;
   *  - enquanto a Mesa pede (`vigiaOutlook`, renovado a cada minuto enquanto há pedido esperando o
   *    cliente): com a Mesa fechada, ou sem pedido esperando, não lê nada;
   *  - na lista de mensagens que o Outlook já desenhou: não rola, não clica, não abre e-mail.
   * De cada mensagem lê o texto da linha e para no assunto, se não for de um e-mail de confirmação
   * ("Confirmação…", com ou sem "RE:"); das que são, e de hoje (com a hora, não a data), guarda o
   * remetente, o e-mail (do `title` do remetente), o assunto, a prévia, a hora e a conta citada (1.9.1:
   * "na conta XP 1234567", do começo do e-mail original que a prévia traz). Manda tudo de novo quando
   * muda, e a cada minuto, para a Mesa que acabou de abrir também saber.
   */
  const naCaixaDoOutlook = () => {
    if (location.pathname.includes('/deeplink/')) return;
    let ultima = '';
    let mandouEm = 0;
    let mexeu = true;

    const normalizarHora = (texto) => {
      const t = String(texto ?? '').replace(/[\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ').trim();
      const m24 = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t);
      if (m24) return `${m24[1].padStart(2, '0')}:${m24[2]}`;
      const m12 = /^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i.exec(t);
      if (m12) {
        let h = Number(m12[1]);
        const isPM = m12[3].toUpperCase() === 'PM';
        if (isPM && h < 12) h += 12;
        if (!isPM && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:${m12[2]}`;
      }
      return null;
    };

    const lerLinha = (item) => {
      const textoLimpo = String(item.innerText || '').replace(/[\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ');
      const linhas = textoLimpo
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const iAssunto = linhas.findIndex((l) => ASSUNTO_DE_PEDIDO.test(l));
      const conta = (String(item.textContent || '').match(CONTA_CITADA) || [])[1] || null;
      if (iAssunto < 0 && !conta) return null;

      let hora = null;
      for (const l of linhas) {
        const h = normalizarHora(l);
        if (h) {
          hora = h;
          break;
        }
      }
      if (!hora) return null;

      const email =
        [...item.querySelectorAll('[title], [data-hovercard-id], [data-email]')].map((el) => {
          const val = (el.getAttribute('title') || el.getAttribute('data-hovercard-id') || el.getAttribute('data-email') || '').trim();
          if (ENDERECO.test(val)) return val;
          const m = val.match(/[^\s<@]+@[^\s>@]+\.[^\s>@]+/);
          return m && ENDERECO.test(m[0]) ? m[0] : null;
        }).find(Boolean) || null;

      const linhaAssunto = iAssunto >= 0 ? linhas[iAssunto] : 'Confirmação de ordem';
      const indiceFim = iAssunto >= 0 ? iAssunto : 2;

      // O remetente é a última linha antes do assunto que não é hora: antes dele, a linha mostra as
      // iniciais do avatar e um ícone (uma ou duas letras).
      const de =
        linhas
          .slice(0, indiceFim)
          .reverse()
          .find((l) => !normalizarHora(l) && l.length > 2) || null;
      const previa = (iAssunto >= 0 ? linhas.slice(iAssunto + 1) : linhas)
        .filter((l) => !normalizarHora(l))
        .join(' ')
        .slice(0, 280);
      const chave = item.getAttribute('data-convid') || item.id || `${de}|${linhaAssunto}|${hora}`;
      return { id: 'r' + resumo(chave), de, email, assunto: linhaAssunto, previa, hora, conta, prefixo: PREFIXO_DE_RESPOSTA.test(linhaAssunto) };
    };

    const acharItens = () => {
      const porConvid = [...document.querySelectorAll('div[data-convid]')];
      if (porConvid.length > 0) return porConvid;
      const listas = [
        ...document.querySelectorAll(
          '[role="listbox"], [role="treegrid"], [role="feed"], [role="grid"], [aria-label*="mensagem" i], [aria-label*="message" i]'
        )
      ];
      if (listas.length > 0) {
        const itens = listas.flatMap((l) => [...l.querySelectorAll('[role="option"], [role="row"], div[data-convid]')]);
        if (itens.length > 0) return itens;
      }
      return [...document.querySelectorAll('[role="option"]')];
    };

    const temListaDeVerdade = (itens) => {
      if (itens.length > 0) return true;
      return (
        document.querySelectorAll(
          '[role="listbox"], [role="treegrid"], [role="feed"], [role="grid"], [aria-label*="mensagem" i], [aria-label*="message" i]'
        ).length > 0
      );
    };

    const olhar = (forcado = false) => {
      const vigia = GM_getValue('vigiaOutlook', null);
      if (!vigia || Date.now() > vigia.ate) return;
      const itens = acharItens();
      const listaPresente = temListaDeVerdade(itens);
      const respostas = itens.map(lerLinha).filter(Boolean);
      const agora = JSON.stringify(respostas);
      if (!forcado && agora === ultima && Date.now() - mandouEm < 60 * 1000) return;
      ultima = agora;
      mandouEm = Date.now();
      GM_setValue('outlookVigia', { em: Date.now(), lista: listaPresente, itens: itens.length, respostas });
    };

    // A lista muda (mensagem nova, a pessoa troca de pasta): olha logo, no máximo uma vez a cada 2 s.
    new MutationObserver(() => {
      mexeu = true;
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    setInterval(() => {
      if (mexeu || Date.now() - mandouEm >= 60 * 1000) {
        mexeu = false;
        olhar();
      }
    }, 2000);
    // A Mesa acabou de pedir (um e-mail acabou de sair, ou a Mesa recarregou): olha e responde já (forcado).
    GM_addValueChangeListener('vigiaOutlook', () => olhar(true));
    olhar();
  };

  /* ── Na aba da Mesa ─────────────────────────────────────────────────────────────────── */

  const naAbaDaMesa = () => {
    const enviar = (mensagem) => pagina.postMessage({ origem: 'robo-hub', ...mensagem }, '*');

    // O sinal de uma aba da versão 1.2.0 ou anterior não tem papel: era a do robô, na Prateleira.
    const papelDe = (sinal) => sinal.papel || 'prateleira';

    const estadoDoHub = () => {
      const agora = Date.now();
      const vivas = Object.values(GM_getValue('abas', {})).filter((sinal) => agora - sinal.vivo < VIVA_MS);
      const doRobo = (papel) => vivas.filter((sinal) => sinal.robo && papelDe(sinal) === papel);
      return {
        abas: vivas.length,
        robo: doRobo('prateleira').length > 0,
        prateleira: doRobo('prateleira').some((sinal) => sinal.prateleira),
        clientes: doRobo('clientes').length > 0,
        tesouro: doRobo('tesouro').length > 0
      };
    };

    const apresentar = () => enviar({ tipo: 'presente', versao: VERSAO, hub: estadoDoHub() });

    // Abre uma aba do robô em segundo plano. Se a última que abriu para o mesmo papel nunca deu
    // sinal — o Hub está deslogado, provavelmente —, espera um minuto antes de abrir outra
    // (`espera`): mais abas não ajudam. Se ela funcionou e depois sumiu (fechada, posta para dormir),
    // abre outra na hora.
    const abrirAba = (papel, endereco, { espera = 60000 } = {}) => {
      const { abriuEm: chave, bilhete } = PAPEIS[papel];
      const abriuEm = GM_getValue(chave, 0);
      const funcionou = Object.values(GM_getValue('abas', {})).some((sinal) => sinal.robo && papelDe(sinal) === papel && sinal.vivo > abriuEm);
      if (Date.now() - abriuEm < espera && !funcionou) return false;
      GM_setValue(chave, Date.now());
      GM_setValue(bilhete, { em: Date.now() });
      GM_openInTab(endereco, { active: false, insert: true });
      return true;
    };
    const abrirHub = (opcoes) => abrirAba('prateleira', ABA_DO_ROBO, opcoes);

    // A aba do print aberta por esta Mesa (1.12.0): o id do pedido e o controle do Tampermonkey.
    let abaDoPrint = null;
    const fecharAbaDoPrint = () => {
      const aberta = abaDoPrint;
      abaDoPrint = null;
      try {
        aberta?.aba?.close?.();
      } catch {
        /* a pessoa já a fechou */
      }
    };

    // Sem aba do papel viva, abre uma. Com ela, espera o aviso de que ela pegou o pedido: a aba
    // pode ter sido fechada há pouco, ou posta para dormir pelo Chrome, e ainda contar como viva
    // pelo último sinal.
    const encaminhar = (chave, pedido, papel = 'prateleira', endereco = ABA_DO_ROBO) => {
      GM_setValue(chave, pedido);
      const abrir = () => abrirAba(papel, endereco);
      if (!estadoDoHub()[{ clientes: 'clientes', tesouro: 'tesouro' }[papel] || 'robo']) return abrir();
      // Só se este pedido ainda espera e ninguém o pegou (1.7.0): o que já terminou, ou foi trocado por
      // um mais novo — que tem a conferência dele —, não abre aba. Até a 1.6.0, um pedido atendido em
      // menos de 3 s, seguido de outro, abria uma aba à toa: a marca de atendimento já era a do outro.
      setTimeout(() => {
        const esperando = GM_getValue(chave, null)?.id === pedido.id;
        if (esperando && GM_getValue(PAPEIS[papel].atendendo, null)?.id !== pedido.id) abrir();
      }, ATENDER_MS);
      return false;
    };

    pagina.addEventListener('message', (evento) => {
      const mensagem = evento.data;
      if ((evento.source && evento.source !== pagina) || !mensagem || mensagem.origem !== 'mesa-xp') return;

      if (mensagem.tipo === 'ola') apresentar();

      if (mensagem.tipo === 'pedir-registro') {
        const desde = Number(mensagem.desde) || 0;
        enviar({ tipo: 'registro', id: mensagem.id, entradas: GM_getValue('registro', []).filter((e) => e.em >= desde) });
      }

      if (mensagem.tipo === 'ultima-captura') {
        const captura = GM_getValue('captura', null);
        if (captura) enviar({ tipo: 'captura', ...captura, id: null });
        const cota = GM_getValue('cotaVista', null);
        if (cota) enviar({ tipo: 'cota', ...cota, id: null });
      }

      if (mensagem.tipo === 'pedir-cotacao') {
        const abriuHub = encaminhar('pedido', { id: mensagem.id, em: Date.now() });
        enviar({ tipo: 'pedido-recebido', id: mensagem.id, abriuHub });
      }

      if (mensagem.tipo === 'pedir-cotas') {
        const { id } = mensagem;
        const itens = (Array.isArray(mensagem.itens) ? mensagem.itens : [])
          .filter((item) => item && FUNDO.test(String(item.fundoId)) && CONTA.test(String(item.conta)))
          .map(({ fundoId, conta, lado }) => ({ fundoId, conta: String(conta), lado: lado === 'vender' ? 'vender' : 'comprar' }));
        if (itens.length === 0) {
          enviar({ tipo: 'cotas-fim', id });
          return;
        }
        const abriuHub = encaminhar('pedidoCotas', { id, itens, em: Date.now() });
        enviar({ tipo: 'pedido-recebido', id, abriuHub });
      }

      // Os prints da cotação de venda, na aba do robô.
      if (mensagem.tipo === 'pedir-prints') {
        const { id } = mensagem;
        const itens = (Array.isArray(mensagem.itens) ? mensagem.itens : [])
          .filter((item) => item && FUNDO.test(String(item.fundoId)) && CONTA.test(String(item.conta)))
          .filter((item) => item.quantidade === null || (typeof item.quantidade === 'number' && item.quantidade > 0))
          .map(({ fundoId, conta, quantidade, modalidade, desagio }) => ({
            fundoId,
            conta: String(conta),
            quantidade,
            modalidade: modalidade === 'clientes' ? 'clientes' : 'xp',
            desagio: typeof desagio === 'number' && Number.isFinite(desagio) ? desagio : null
          }));
        if (itens.length === 0) {
          enviar({ tipo: 'prints-fim', id });
          return;
        }
        // Numa aba do Hub à vista (1.12.0), que a Mesa fecha no fim: escondida, o Chrome segura os
        // relógios dela, e o print não terminava.
        GM_setValue('pedidoPrints', { id, itens, em: Date.now() });
        GM_setValue(PAPEIS.print.bilhete, { em: Date.now() });
        if (abaDoPrint) fecharAbaDoPrint();
        abaDoPrint = { id, aba: GM_openInTab(ABA_DO_ROBO, { active: true, insert: true }) };
        // Se a aba pegou o pedido e não terminou (a tarefa tem prazo), fecha depois do prazo; se nunca
        // pegou (o Hub pediu login), fica aberta, para a pessoa ver.
        setTimeout(() => {
          if (abaDoPrint?.id === id && GM_getValue(PAPEIS.print.atendendo, null)?.id === id) fecharAbaDoPrint();
        }, TAREFA_MS + 30000);
        enviar({ tipo: 'pedido-recebido', id, abriuHub: true });
      }

      // O corpo em HTML para o e-mail que a Mesa vai abrir no Outlook: vale por 2 minutos, uma vez.
      // Sem o HTML (null), é a reserva: a janela abre já, e o HTML vem depois, com o mesmo id.
      if (mensagem.tipo === 'preparar-outlook' && (typeof mensagem.html === 'string' || mensagem.html === null)) {
        if (mensagem.html === null) GM_setValue('corpoColado', null);
        GM_setValue('corpoParaOutlook', { id: mensagem.id, html: mensagem.html, texto: String(mensagem.texto || ''), inicio: String(mensagem.inicio || ''), em: Date.now() });
        enviar({ tipo: 'pedido-recebido', id: mensagem.id, abriuHub: false });
      }

      // O print não saiu: o e-mail aberto fica com o corpo de texto, como está.
      if (mensagem.tipo === 'cancelar-outlook') {
        const atual = GM_getValue('corpoParaOutlook', null);
        if (atual && atual.id === mensagem.id) GM_setValue('corpoParaOutlook', { id: mensagem.id, cancelado: true, em: Date.now() });
      }

      // As respostas dos clientes no Outlook (1.8.0): a Mesa pede a cada minuto enquanto tem pedido
      // esperando o cliente; a caixa de entrada olha por 3 minutos a partir do último pedido.
      if (mensagem.tipo === 'vigiar-outlook') GM_setValue('vigiaOutlook', { ate: Date.now() + 3 * 60 * 1000 });

      // A boleta de um pedido da Fila, numa aba do Hub à vista, para a pessoa (1.10.0). O fundo e a conta
      // vão para o endereço da boleta: só passam na forma exata.
      if (mensagem.tipo === 'abrir-execucao' && mensagem.destino && typeof mensagem.destino === 'object') {
        const d = mensagem.destino;
        const conta = String(d.conta ?? '');
        let destino = null;
        let endereco = null;
        if (CONTA.test(conta) && d.tipo === 'fundo' && FUNDO.test(String(d.fundoId))) {
          destino = { tipo: 'fundo', fundoId: String(d.fundoId), conta, lado: d.lado === 'vender' ? 'vender' : 'comprar' };
          endereco = ABA_DO_ROBO;
        } else if (CONTA.test(conta) && d.tipo === 'tesouro') {
          destino = { tipo: 'tesouro', conta, leitura: d.leitura === 'posicoes' ? 'posicoes' : 'lista' };
          endereco = TESOURO;
        }
        if (!destino) return enviar({ tipo: 'execucao', id: mensagem.id ?? null, ok: false });
        GM_setValue('abaPedidaExecucao', { destino, em: Date.now() });
        GM_openInTab(endereco, { active: true, insert: true });
        enviar({ tipo: 'execucao', id: mensagem.id ?? null, ok: true });
      }

      // A lista do Tesouro da conta, na aba do Tesouro (1.6.0).
      if (mensagem.tipo === 'pedir-tesouro') {
        const { id } = mensagem;
        const conta = String(mensagem.conta ?? '');
        if (!CONTA.test(conta)) {
          enviar({ tipo: 'tesouro', id, erro: 'invalido' });
          return;
        }
        const leitura = mensagem.leitura === 'posicoes' ? 'posicoes' : 'lista';
        const abriuHub = encaminhar('pedidoTesouro', { id, conta, leitura, em: Date.now() }, 'tesouro', TESOURO);
        enviar({ tipo: 'pedido-recebido', id, abriuHub });
      }

      // O cliente da conta, na aba de clientes. A primeira vez ela abre direto na ficha pedida.
      if (mensagem.tipo === 'pedir-cliente') {
        const { id } = mensagem;
        const conta = String(mensagem.conta ?? '');
        if (!CONTA.test(conta)) {
          enviar({ tipo: 'cliente', id, erro: 'invalido' });
          return;
        }
        const abriuHub = encaminhar('pedidoCliente', { id, conta, em: Date.now() }, 'clientes', POSICAO + rotaDoCliente(conta));
        enviar({ tipo: 'pedido-recebido', id, abriuHub });
      }
    });

    // O cliente lido na ficha segue para a Mesa e sai do armazenamento na hora, com o pedido dele.
    // A lista do Tesouro segue para a Mesa e sai do armazenamento na hora, com o pedido.
    GM_addValueChangeListener('tesouro', (_chave, _antigo, novo) => {
      if (!novo) return;
      enviar({ tipo: 'tesouro', ...novo });
      GM_setValue('tesouro', null);
      if (GM_getValue('pedidoTesouro', null)?.id === novo.id) GM_setValue('pedidoTesouro', null);
    });

    GM_addValueChangeListener('cliente', (_chave, _antigo, novo) => {
      if (!novo) return;
      enviar({ tipo: 'cliente', ...novo });
      GM_setValue('cliente', null);
      if (GM_getValue('pedidoCliente', null)?.id === novo.id) GM_setValue('pedidoCliente', null);
    });

    GM_addValueChangeListener('captura', (_chave, _antiga, nova) => {
      if (nova) enviar({ tipo: 'captura', ...nova });
    });
    // Os preços de um pedido: o robô regrava a lista inteira a cada boleta lida, e daqui segue para
    // a Mesa só o que ainda não seguiu — mesmo que duas gravações cheguem juntas.
    let entregues = { id: null, quantos: 0 };
    GM_addValueChangeListener('cotas', (_chave, _antiga, nova) => {
      if (!nova || !Array.isArray(nova.resultados)) return;
      if (entregues.id !== nova.id) entregues = { id: nova.id, quantos: 0 };
      for (const r of nova.resultados.slice(entregues.quantos)) {
        if (r.erro) enviar({ tipo: 'cota-falhou', id: nova.id, fundoId: r.fundoId, motivo: r.erro, indice: r.indice });
        else
          enviar({
            tipo: 'cota',
            id: nova.id,
            fundoId: r.fundoId,
            valor: r.valor,
            dataDaCota: r.dataDaCota,
            indice: r.indice,
            lado: r.lado,
            stock: r.stock || null,
            posicao: r.posicao || null
          });
      }
      entregues.quantos = nova.resultados.length;
      if (nova.fim) {
        enviar({ tipo: 'cotas-fim', id: nova.id });
        // A posição do cliente não fica no armazenamento depois de entregue.
        GM_setValue('cotas', null);
      }
    });
    // Os prints: cada um segue para a Mesa assim que sai, e o armazenamento é limpo no fim.
    let printsEntregues = { id: null, quantos: 0 };
    GM_addValueChangeListener('prints', (_chave, _antiga, nova) => {
      if (!nova || !Array.isArray(nova.resultados)) return;
      if (printsEntregues.id !== nova.id) printsEntregues = { id: nova.id, quantos: 0 };
      for (const r of nova.resultados.slice(printsEntregues.quantos)) {
        enviar({ tipo: 'print', id: nova.id, indice: r.indice, fundoId: r.fundoId, png: r.png || null, quantidade: r.quantidade ?? null, em: r.em || null, erro: r.erro || null });
      }
      printsEntregues.quantos = nova.resultados.length;
      if (nova.fim) {
        enviar({ tipo: 'prints-fim', id: nova.id });
        GM_setValue('prints', null);
        // O último print chegou: a aba do print fecha, e a pessoa volta para onde estava.
        if (abaDoPrint?.id === nova.id) setTimeout(fecharAbaDoPrint, 300);
      }
    });
    // A boleta que a pessoa abriu para executar também deixa o preço exato do fundo, com a hora.
    GM_addValueChangeListener('cotaVista', (_chave, _antiga, nova) => {
      if (nova) enviar({ tipo: 'cota', id: null, fundoId: nova.fundoId, valor: nova.valor, dataDaCota: nova.dataDaCota });
    });
    GM_addValueChangeListener('abas', () => enviar({ tipo: 'estado', versao: VERSAO, hub: estadoDoHub() }));
    // O Outlook disse se colou o corpo.
    GM_addValueChangeListener('corpoColado', (_chave, _antiga, nova) => {
      if (nova) enviar({ tipo: 'corpo-colado', id: nova.id, ok: nova.ok === true, motivo: nova.motivo || null });
    });
    // As respostas vistas na caixa de entrada seguem para a Mesa e saem do armazenamento na hora.
    GM_addValueChangeListener('outlookVigia', (_chave, _antiga, nova) => {
      if (!nova) return;
      enviar({ tipo: 'outlook', em: nova.em, lista: nova.lista === true, itens: nova.itens || 0, respostas: Array.isArray(nova.respostas) ? nova.respostas : [] });
      GM_setValue('outlookVigia', null);
    });

    apresentar();
    document.addEventListener('DOMContentLoaded', apresentar);

    // A aba do robô fica pronta desde que a Mesa abre: abrir o Hub do zero leva uns 7 s, que assim
    // não caem na primeira colagem. Se a última aba aberta nunca deu sinal — Hub deslogado —, não
    // insiste a cada vez que a Mesa recarrega: espera 10 minutos.
    if (!estadoDoHub().robo) abrirHub({ espera: 10 * 60 * 1000 });
  };

  if (ehOHub()) naAbaDoHub();
  else if (ehAMesa()) naAbaDaMesa();
  else if (ehOOutlook()) {
    const iniciarOutlook = () => {
      naAbaDoOutlook();
      naCaixaDoOutlook();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', iniciarOutlook);
    } else {
      iniciarOutlook();
    }
  }
})();
