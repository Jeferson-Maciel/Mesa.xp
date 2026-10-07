// ==UserScript==
// @name         Mesa XP · Robô do Hub
// @namespace    mesa-xp
// @version      1.3.2
// @description  Quando a Mesa XP pede, atualiza a Prateleira do Mercado Secundário, lê o preço exato da cota nas boletas e o nome, o e-mail e o assessor do cliente na ficha dele, em abas do Hub só dele, e entrega à Mesa o que o próprio Hub recebeu. Não lê senha nem token.
// @match        https://hub.xpi.com.br/*
// @match        https://mesa-xp.vercel.app/*
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
 *                            · preço exato das cotas: abre as boletas dos fundos, uma atrás da
 *                              outra, para a conta pelo endereço do próprio Hub
 *                              (#/secundario/comprar/<fundo>/<conta>), lê a resposta de cada
 *                              pre-check e, no fim, volta para a Prateleira
 *   aba da Mesa  ←── o que o Hub respondeu, cada preço assim que chega
 *
 *   aba da Mesa   pede ──→ aba de clientes do robô no Hub — outra aba só dele (1.3.0), na Posição
 *                          Consolidada: abre a ficha do cliente pelo endereço do próprio Hub
 *                          (#/<conta em base64>) e lê a resposta de customer-info
 *   aba da Mesa  ←── só o nome, o e-mail e o assessor do cliente
 *
 *   São duas abas porque a Posição Consolidada é outro módulo do Hub: ir e voltar da Prateleira
 *   recarregaria a página inteira a cada cliente, e a Prateleira deixaria de estar pronta para a
 *   cotação. Na aba de clientes, trocar de cliente é só trocar o fim do endereço.
 *
 * Regras:
 *  - não lê senha, token nem cabeçalho, não chama a API por conta própria e não manda nada para
 *    fora do Chrome: só escuta o `fetch` do próprio app e muda a rota da aba dele;
 *  - na boleta, não digita nem clica em nada: abrir o endereço já carrega o cliente. Nunca passa da
 *    etapa 1. Vai de uma boleta direto para a próxima — voltar à Prateleira entre elas custava uns
 *    4 s de desenho, mais 2 a 3 s da lista que ela baixa de novo — e volta uma vez só, no fim. Se a
 *    troca direta não disparar o pre-check, passa pela Prateleira entre as boletas, como antes;
 *  - do pre-check só sai o preço e o dia da cota do fundo pedido — nada do cliente;
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

  const VERSAO = '1.3.2';
  const BASE = 'https://hub.xpi.com.br/new/fundos-de-investimento';
  // Sem parâmetro nenhum: qualquer um trava o módulo do Mercado Secundário do Hub.
  const ABA_DO_ROBO = `${BASE}#/secundario/prateleira`;
  const NOME_DA_ABA = 'mesa-xp-robo';
  // A aba de clientes: a Posição Consolidada, onde a busca do topo do Hub leva. O cliente vai no fim
  // do endereço, como o próprio Hub o escreve: a conta em base64.
  const POSICAO = 'https://hub.xpi.com.br/new/posicao-consolidada/';
  const NOME_DA_ABA_DE_CLIENTES = 'mesa-xp-clientes';
  const rotaDoCliente = (conta) => `#/${btoa(String(conta))}`;
  const FICHA = /\/advisor-customer-consolidated-portfolio\/v\d+\/api\/customers\/(\d+)\/customer-info(\?|$)/;
  // Cada papel de aba tem o nome dela, o bilhete que a Mesa deixa antes de abri-la e a marca de que
  // pegou o pedido.
  const PAPEIS = {
    prateleira: { nome: NOME_DA_ABA, bilhete: 'abaPedida', atendendo: 'atendendo', abriuEm: 'abriuHubEm' },
    clientes: { nome: NOME_DA_ABA_DE_CLIENTES, bilhete: 'abaPedidaClientes', atendendo: 'atendendoClientes', abriuEm: 'abriuClientesEm' }
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
    const papelDoNome = () => Object.keys(PAPEIS).find((p) => PAPEIS[p].nome === pagina.name) ?? null;
    const papelPossivel = location.pathname.startsWith('/new/posicao-consolidada')
      ? 'clientes'
      : location.pathname.startsWith('/new/fundos-de-investimento')
        ? 'prateleira'
        : null;
    if (!papelDoNome() && papelPossivel && visibilidadeReal() === 'hidden') {
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
        : naPrateleira() || location.hash.startsWith('#/secundario/comprar/');
    const botao = () => document.querySelector('soma-button[aria-label="atualizar"]');

    // O título diz, na barra de abas, que esta é a aba do robô.
    const marcarTitulo = () => {
      if (doRobo && !document.title.startsWith('🤖')) document.title = `🤖 ${papel === 'clientes' ? 'Clientes' : 'Robô'} · ${document.title}`;
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

    // A ficha chega por XHR, não por fetch: o gancho no XHR só entra na aba de clientes do robô.
    if (papel === 'clientes') {
      const prototipo = pagina.XMLHttpRequest.prototype;
      const abrirXhr = prototipo.open;
      const enviarXhr = prototipo.send;
      prototipo.open = function (metodo, endereco, ...resto) {
        this.mesaxpEndereco = String(endereco);
        return abrirXhr.call(this, metodo, endereco, ...resto);
      };
      prototipo.send = function (...args) {
        const endereco = this.mesaxpEndereco || '';
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
        // quando é a pessoa que abre a boleta: o preço fica guardado para o dia.
        if (PRE_CHECK.test(endereco)) {
          resposta
            .clone()
            .json()
            .then((json) => {
              const fundo = json && json.fund;
              if (!fundo || !FUNDO.test(String(fundo.id)) || typeof fundo.quotaValue !== 'number') return;
              const cota = { fundoId: fundo.id, valor: fundo.quotaValue, dataDaCota: String(fundo.quotaDate || '').slice(0, 10) };
              if (esperaPreCheck && esperaPreCheck.fundoId === cota.fundoId) esperaPreCheck.resolver(cota);
              else GM_setValue('cotaVista', { ...cota, em: Date.now() });
            })
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
    const naBoleta = () => location.hash.startsWith('#/secundario/comprar/');
    const ondeEsta = () =>
      papel === 'clientes' ? 'ficha do cliente' : naPrateleira() ? 'Prateleira' : naBoleta() ? 'boleta' : 'outra página';

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

    // Abre a boleta do fundo para a conta e espera o pre-check dele.
    const abrirBoleta = (fundoId, conta, prazo, direto) =>
      new Promise((resolver) => {
        const relogio = setTimeout(() => {
          esperaPreCheck = null;
          resolver(null);
        }, prazo);
        esperaPreCheck = {
          fundoId,
          resolver: (cota) => {
            clearTimeout(relogio);
            esperaPreCheck = null;
            resolver(cota);
          }
        };
        registrar('abriu a boleta', { fundoId, direto });
        irPara(`#/secundario/comprar/${fundoId}/${conta}`);
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
      for (const [i, { fundoId, conta }] of itens.entries()) {
        // Saindo de uma boleta que não carregou (a conta não é de um cliente, por exemplo), a troca
        // direta não diria nada: passa pela Prateleira.
        const direto = trocaDireta && naBoleta() && anteriorCarregou;
        if (naBoleta() && !direto) await passarPelaPrateleira();
        let cota = await abrirBoleta(fundoId, conta, direto ? TROCA_DIRETA_MS : PRE_CHECK_MS, direto);
        if (!cota && direto) {
          trocaDireta = false;
          registrar('a troca direta não trouxe o pre-check', { fundoId });
          await passarPelaPrateleira();
          cota = await abrirBoleta(fundoId, conta, PRE_CHECK_MS, false);
        }
        registrar(cota ? 'pre-check chegou' : 'pre-check não veio', { fundoId });
        anteriorCarregou = Boolean(cota);
        resultados.push(cota || { fundoId, erro: 'sem-boleta' });
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
      const recarregar = () => {
        GM_setValue('recarregouPara', id);
        GM_setValue(PAPEIS.clientes.atendendo, null);
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
        document.title = document.title.replace(/^🤖 (Robô|Clientes) · /, '');
        darSinal();
        return;
      }
      const atendendo = PAPEIS[papel].atendendo;
      if (GM_getValue(atendendo, null)?.id === pedido.id) return; // outra aba do robô já pegou

      vistos.add(pedido.id);
      GM_setValue(atendendo, { id: pedido.id, em: Date.now() });
      const tipo = trabalho === atualizar ? 'cotação' : trabalho === lerCliente ? 'cliente' : 'preços exatos';
      registrar('pedido recebido', { tipo });
      fila = fila
        .then(() => {
          registrar('tarefa começou', { tipo, escondida: visibilidadeReal() === 'hidden', onde: ondeEsta(), botao: Boolean(botao()) });
          return trabalho(pedido);
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
      const itens = pedido.itens.filter((item) => item && FUNDO.test(String(item.fundoId)) && CONTA.test(String(item.conta)));
      if (itens.length > 0) receber({ ...pedido, itens }, lerCotas);
    };

    // A conta vai para o endereço da ficha: só passa na forma exata.
    const receberCliente = (pedido) => {
      if (papel !== 'clientes' || !pedido || !CONTA.test(String(pedido.conta))) return;
      receber({ ...pedido, conta: String(pedido.conta) }, lerCliente);
    };

    const pegarPendentes = () => {
      receberCotacao(GM_getValue('pedido', null));
      receberCotas(GM_getValue('pedidoCotas', null));
      receberCliente(GM_getValue('pedidoCliente', null));
    };

    GM_addValueChangeListener('pedido', (_chave, _antigo, novo) => receberCotacao(novo));
    GM_addValueChangeListener('pedidoCotas', (_chave, _antigo, novo) => receberCotas(novo));
    GM_addValueChangeListener('pedidoCliente', (_chave, _antigo, novo) => receberCliente(novo));
    document.addEventListener('DOMContentLoaded', () => {
      darSinal();
      // A aba que o robô acabou de abrir chega depois do pedido: confere se há um esperando.
      pegarPendentes();
    });
    pagina.addEventListener('hashchange', darSinal);
    pagina.addEventListener('pagehide', sair);
    setInterval(darSinal, 30000);
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
        clientes: doRobo('clientes').length > 0
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

    // Sem aba do papel viva, abre uma. Com ela, espera o aviso de que ela pegou o pedido: a aba
    // pode ter sido fechada há pouco, ou posta para dormir pelo Chrome, e ainda contar como viva
    // pelo último sinal.
    const encaminhar = (chave, pedido, papel = 'prateleira', endereco = ABA_DO_ROBO) => {
      GM_setValue(chave, pedido);
      const abrir = () => abrirAba(papel, endereco);
      if (!estadoDoHub()[papel === 'clientes' ? 'clientes' : 'robo']) return abrir();
      setTimeout(() => GM_getValue(PAPEIS[papel].atendendo, null)?.id !== pedido.id && abrir(), ATENDER_MS);
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
          .map(({ fundoId, conta }) => ({ fundoId, conta: String(conta) }));
        if (itens.length === 0) {
          enviar({ tipo: 'cotas-fim', id });
          return;
        }
        const abriuHub = encaminhar('pedidoCotas', { id, itens, em: Date.now() });
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
        if (r.erro) enviar({ tipo: 'cota-falhou', id: nova.id, fundoId: r.fundoId, motivo: r.erro });
        else enviar({ tipo: 'cota', id: nova.id, fundoId: r.fundoId, valor: r.valor, dataDaCota: r.dataDaCota });
      }
      entregues.quantos = nova.resultados.length;
      if (nova.fim) enviar({ tipo: 'cotas-fim', id: nova.id });
    });
    // A boleta que a pessoa abriu para executar também deixa o preço exato do fundo para o dia.
    GM_addValueChangeListener('cotaVista', (_chave, _antiga, nova) => {
      if (nova) enviar({ tipo: 'cota', id: null, fundoId: nova.fundoId, valor: nova.valor, dataDaCota: nova.dataDaCota });
    });
    GM_addValueChangeListener('abas', () => enviar({ tipo: 'estado', versao: VERSAO, hub: estadoDoHub() }));

    apresentar();
    document.addEventListener('DOMContentLoaded', apresentar);

    // A aba do robô fica pronta desde que a Mesa abre: abrir o Hub do zero leva uns 7 s, que assim
    // não caem na primeira colagem. Se a última aba aberta nunca deu sinal — Hub deslogado —, não
    // insiste a cada vez que a Mesa recarrega: espera 10 minutos.
    if (!estadoDoHub().robo) abrirHub({ espera: 10 * 60 * 1000 });
  };

  if (ehOHub()) naAbaDoHub();
  else if (ehAMesa()) naAbaDaMesa();
})();
