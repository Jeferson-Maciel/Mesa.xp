import fonte from './robo-hub.user.js?raw';
import snapdom from '../../../vendor/snapdom.js?raw';

/**
 * A ponte entre o Ordens e o robô do Hub (`robo-hub.user.js`, que roda no Tampermonkey).
 *
 * O robô roda dentro desta mesma aba e conversa com a página por `postMessage`: a Mesa pede uma
 * cotação, ele a pede à aba do Hub, e a resposta do Hub volta por aqui. Sem o robô instalado, a
 * Mesa segue como antes — o 📥 e a planilha continuam servindo.
 *
 * Toda captura que chega é avisada, inclusive a que ninguém pediu: quando alguém atualiza a
 * Prateleira à mão, a Mesa também fica com a cotação nova.
 */

/**
 * O código do robô, como está no repositório — sem a SnapDOM. É ele que os testes de segurança leem
 * (sem token, senha, cabeçalho nem API do Hub): a biblioteca tem `fetch` e `headers` dentro, para
 * trazer as imagens da própria página para o print, e é conferida à parte, byte a byte.
 */
export const fonteDoRobo = fonte;

/**
 * O script que a Mesa oferece para copiar e colar no Tampermonkey: o robô, com a SnapDOM 3.2.0
 * (`src/vendor/snapdom.js`) no marcador do print. A troca é feita por uma função, e não por um texto,
 * para que um cifrão do código da biblioteca não seja lido como padrão de substituição.
 */
export const scriptDoRobo = fonte.replace('/*@@SNAPDOM@@*/', () => snapdom);

/** A versão do robô que esta Mesa espera; outra versão instalada pede a cópia nova. */
export const VERSAO_DO_ROBO = fonte.match(/^\/\/ @version\s+(\S+)/m)?.[1] ?? null;

const MENSAGENS = {
  'sem-robo': 'o robô do Hub não está instalado',
  'sem-resposta': 'o Hub não respondeu a tempo',
  'sem-boleta': 'a boleta não carregou na aba do robô — a conta é de um cliente seu?',
  'sem-cliente': 'o Hub não mostrou esse cliente — a conta é de um cliente seu?',
  'ficha-desconhecida': 'a ficha do cliente veio do Hub num formato que o robô não conhece — o robô precisa ser atualizado',
  invalido: 'fundo ou conta numa forma que o robô não aceita',
  // O print da cotação de venda (1.5.0): cada passo que pode não sair, com o que a pessoa vê.
  'sem-estoque': 'a boleta de venda não mostrou a escolha do Estoque clientes',
  'estoque-diferente': 'o deságio do painel não é o do estoque pedido — o print não foi tirado',
  'sem-campo': 'a boleta de venda não mostrou o campo de quantidade, nem depois de escolher o estoque',
  'sem-total': 'a boleta de venda não mostrou o botão "Total de cotas"',
  'sem-conta': 'a boleta não fez a conta da venda com a quantidade',
  'sem-detalhe': 'o detalhe da operação não abriu na boleta',
  'quantidade-diferente': 'a quantidade da boleta não bateu com a do pedido — o print não foi tirado',
  'sem-regiao': 'não achei o painel do valor da operação na boleta',
  'sem-snapdom': 'o robô veio sem a biblioteca do print — copie o robô de novo',
  'falhou-o-print': 'o print falhou na aba do robô',
  'print-demorou': 'a foto da boleta passou de 30 s na aba do robô — clique em "Tirar prints" de novo',
  'sem-print': 'o robô não trouxe o print',
  'sem-tesouro': 'o Hub não mostrou a lista do Tesouro para essa conta — a conta é de um cliente seu?',
  'sem-posicoes-tesouro': 'o Hub não mostrou a posição no Tesouro dessa conta — a conta é de um cliente seu?'
};

export class ErroDoRobo extends Error {
  /** @param {'sem-robo'|'sem-resposta'|'sem-boleta'|'sem-cliente'|'ficha-desconhecida'|'invalido'} codigo */
  constructor(codigo) {
    super(MENSAGENS[codigo] ?? MENSAGENS['sem-resposta']);
    this.codigo = codigo in MENSAGENS ? codigo : 'sem-resposta';
  }
}

// O fundo e a conta vão para o endereço da boleta, na aba do robô: só passam na forma exata.
const FUNDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTA = /^\d{5,8}$/;

/**
 * @typedef {{capturadaEm: string, resposta: object, id?: string|null}} CapturaDoRobo
 * @typedef {{abas: number, robo: boolean, prateleira: boolean, clientes?: boolean}} EstadoDoHub
 * @typedef {{conta: string, nome?: string, email?: string, assessorCodigo?: string, assessorNome?: string}} ClienteDoRobo
 * @typedef {{fundoId: string, valor?: number, dataDaCota?: string, erro?: ErroDoRobo}} ResultadoDaCota
 */

/** @param {{janela?: Window}} [opcoes] */
export const criarRoboHub = ({ janela = window } = {}) => {
  let versao = null;
  /** @type {EstadoDoHub|null} */
  let hub = null;
  const aoMudar = new Set();
  const aoCapturar = new Set();
  const aoCotar = new Set();
  const aoOutlook = new Set();
  const pendentes = new Map();
  const lotes = new Map();
  const lotesDePrints = new Map();

  const enviar = (mensagem) => janela.postMessage({ origem: 'mesa-xp', ...mensagem }, '*');
  const avisarMudanca = () => aoMudar.forEach((fn) => fn());

  janela.addEventListener('message', (evento) => {
    const mensagem = evento.data;
    if ((evento.source && evento.source !== janela) || !mensagem || mensagem.origem !== 'robo-hub') return;

    if (mensagem.tipo === 'presente' || mensagem.tipo === 'estado') {
      const primeiraVez = versao === null;
      versao = mensagem.versao ?? versao;
      hub = mensagem.hub ?? hub;
      // Achado o robô, a Mesa já pega a última captura que ele guardou.
      if (primeiraVez) enviar({ tipo: 'ultima-captura' });
      avisarMudanca();
    }

    // O preço exato de um fundo: pedido pela Mesa, ou visto numa boleta que a pessoa abriu.
    // `em` é quando o preço foi lido: a boleta que alguém abriu mais cedo chega com a hora dela; o
    // que o robô acaba de ler chega sem, e é de agora. O preço vale só por uns minutos (secundario.js).
    if (mensagem.tipo === 'cota' && typeof mensagem.valor === 'number') {
      const em = typeof mensagem.em === 'number' ? mensagem.em : Date.now();
      aoCotar.forEach((fn) => fn({ fundoId: mensagem.fundoId, valor: mensagem.valor, dataDaCota: mensagem.dataDaCota, em }));
    }

    // Os preços de um pedido chegam um a um, e o fim diz que não vem mais nenhum.
    const lote = mensagem.id ? lotes.get(mensagem.id) : null;
    if (lote && (mensagem.tipo === 'cota' || mensagem.tipo === 'cota-falhou')) lote.chegou(mensagem);
    if (lote && mensagem.tipo === 'cotas-fim') lote.terminar();

    // Os prints de um pedido, um a um, e o fim.
    const loteDePrints = mensagem.id ? lotesDePrints.get(mensagem.id) : null;
    if (loteDePrints && mensagem.tipo === 'print') loteDePrints.chegou(mensagem);
    if (loteDePrints && mensagem.tipo === 'prints-fim') loteDePrints.terminar();

    // O Outlook disse se colou o corpo do e-mail.
    if (mensagem.tipo === 'corpo-colado') {
      const pendente = mensagem.id ? pendentes.get(mensagem.id) : null;
      if (!pendente) return;
      clearTimeout(pendente.relogio);
      pendentes.delete(mensagem.id);
      pendente.resolver({ ok: mensagem.ok === true, motivo: mensagem.motivo ?? null });
    }

    if (mensagem.tipo === 'registro') {
      const pendente = mensagem.id ? pendentes.get(mensagem.id) : null;
      if (!pendente) return;
      clearTimeout(pendente.relogio);
      pendentes.delete(mensagem.id);
      pendente.resolver(Array.isArray(mensagem.entradas) ? mensagem.entradas : []);
    }

    // A lista do Tesouro da conta pedida (1.6.0) ou a posição dela (1.7.0): os títulos, ou o erro do
    // Hub como ele veio.
    if (mensagem.tipo === 'tesouro') {
      const pendente = mensagem.id ? pendentes.get(mensagem.id) : null;
      if (!pendente) return;
      clearTimeout(pendente.relogio);
      pendentes.delete(mensagem.id);
      const semNada = { invalido: 'invalido', 'sem-lista': 'sem-tesouro', 'sem-posicoes': 'sem-posicoes-tesouro' }[mensagem.erro];
      if (semNada) pendente.rejeitar(new ErroDoRobo(semNada));
      else
        pendente.resolver({
          conta: mensagem.conta,
          itens: Array.isArray(mensagem.itens) ? mensagem.itens : null,
          posicoes: Array.isArray(mensagem.posicoes) ? mensagem.posicoes : null,
          erro: mensagem.erro ?? null
        });
    }

    // O cliente pedido: os campos da ficha que o robô leu, ou o motivo de não ter lido.
    if (mensagem.tipo === 'cliente') {
      const pendente = mensagem.id ? pendentes.get(mensagem.id) : null;
      if (!pendente) return;
      clearTimeout(pendente.relogio);
      pendentes.delete(mensagem.id);
      if (mensagem.erro) pendente.rejeitar(new ErroDoRobo(mensagem.erro));
      else {
        const { conta, nome, email, assessorCodigo, assessorNome } = mensagem;
        pendente.resolver({ conta, nome, email, assessorCodigo, assessorNome });
      }
    }

    // O que o robô viu na caixa de entrada do Outlook (1.8.0): só as respostas aos e-mails de
    // confirmação, cada uma com o remetente, o e-mail, o assunto, a prévia e a hora — e quantas
    // mensagens a lista tinha, para a Fila dizer se a caixa de entrada está à vista.
    if (mensagem.tipo === 'outlook') {
      const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);
      const respostas = (Array.isArray(mensagem.respostas) ? mensagem.respostas : [])
        .filter((r) => r && typeof r.id === 'string' && typeof r.assunto === 'string')
        .slice(0, 100)
        .map((r) => ({
          id: r.id.slice(0, 40),
          de: texto(r.de, 200),
          email: texto(r.email, 200),
          assunto: r.assunto.slice(0, 300),
          previa: texto(r.previa, 300) ?? '',
          hora: texto(r.hora, 5),
          // A conta citada na resposta (1.9.1) e se o assunto tem "RE:".
          conta: typeof r.conta === 'string' && /^\d{5,9}$/.test(r.conta) ? r.conta : null,
          prefixo: r.prefixo === true
        }));
      const leitura = { em: typeof mensagem.em === 'number' ? mensagem.em : Date.now(), lista: mensagem.lista === true, itens: Number(mensagem.itens) || 0, respostas };
      aoOutlook.forEach((fn) => fn(leitura));
    }

    if (mensagem.tipo === 'captura' && mensagem.resposta) {
      const captura = { capturadaEm: mensagem.capturadaEm, resposta: mensagem.resposta, id: mensagem.id ?? null };
      aoCapturar.forEach((fn) => fn(captura));

      const pendente = mensagem.id ? pendentes.get(mensagem.id) : null;
      if (pendente) {
        clearTimeout(pendente.relogio);
        pendentes.delete(mensagem.id);
        pendente.resolver(captura);
      }
    }
  });

  const novoId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const pedir = (mensagem, prazo) => {
    if (versao === null) return Promise.reject(new ErroDoRobo('sem-robo'));

    const id = novoId();
    return new Promise((resolver, rejeitar) => {
      const relogio = setTimeout(() => {
        pendentes.delete(id);
        rejeitar(new ErroDoRobo('sem-resposta'));
      }, prazo);
      pendentes.set(id, { resolver, rejeitar, relogio });
      enviar({ ...mensagem, id });
    });
  };

  enviar({ tipo: 'ola' });

  return {
    get presente() {
      return versao !== null;
    },
    get versao() {
      return versao;
    },
    get hub() {
      return hub;
    },

    /** @param {() => void} fn */
    aoMudar(fn) {
      aoMudar.add(fn);
    },

    /** @param {(captura: CapturaDoRobo) => void} fn */
    aoReceberCaptura(fn) {
      aoCapturar.add(fn);
    },

    /** @param {(cota: {fundoId: string, valor: number, dataDaCota: string}) => void} fn */
    aoReceberCota(fn) {
      aoCotar.add(fn);
    },

    /**
     * O que o robô (1.8.0) vê na caixa de entrada do Outlook, a cada mudança e a cada minuto, enquanto
     * a Mesa pede (`vigiarOutlook`).
     *
     * @param {(leitura: {em: number, lista: boolean, itens: number,
     *   respostas: Array<{id: string, de: string|null, email: string|null, assunto: string, previa: string, hora: string|null}>}) => void} fn
     */
    aoReceberOutlook(fn) {
      aoOutlook.add(fn);
    },

    /**
     * Pede ao robô que olhe as respostas na caixa de entrada do Outlook pelos próximos 3 minutos. A
     * Fila pede a cada minuto enquanto tem pedido esperando o cliente; sem robô, não faz nada.
     */
    vigiarOutlook() {
      if (versao !== null) enviar({ tipo: 'vigiar-outlook' });
    },

    /**
     * Pede ao robô (1.10.0) que abra, numa aba do Hub à vista, a boleta de um pedido da Fila: a do fundo
     * (`{tipo: 'fundo', fundoId, conta, lado}`) ou o Tesouro do cliente (`{tipo: 'tesouro', conta,
     * leitura}`). O robô só leva até lá. Sem robô, devolve false, e a Fila abre o link direto.
     */
    abrirParaExecutar(destino) {
      if (versao === null || !destino) return false;
      enviar({ tipo: 'abrir-execucao', destino });
      return true;
    },

    /**
     * Pede ao robô que atualize a Prateleira no Hub e espera a resposta daquele pedido.
     *
     * @param {{prazo?: number}} [opcoes]  o prazo cobre abrir a aba do Hub, se for preciso
     * @returns {Promise<CapturaDoRobo>}
     */
    pedirCotacao({ prazo = 30000 } = {}) {
      return pedir({ tipo: 'pedir-cotacao' }, prazo);
    },

    /**
     * O que o robô anotou desde `desde` (ms): os passos da aba dele e as chamadas do Hub, para o
     * relatório de tempos. Sem robô, ou sem resposta, vem vazio.
     *
     * @returns {Promise<Array<{em: number, passo: string}>>}
     */
    pedirRegistro(desde, { prazo = 2000 } = {}) {
      return pedir({ tipo: 'pedir-registro', desde }, prazo).catch(() => []);
    },

    /**
     * Pede ao robô o cliente da conta: ele abre a ficha do cliente no Hub, na aba dele de clientes, e
     * devolve só o nome, o e-mail e o assessor responsável. A primeira vez abre a aba do Hub, que
     * leva uns segundos; as outras só trocam de cliente.
     *
     * @param {string} conta
     * @param {{prazo?: number}} [opcoes]
     * @returns {Promise<ClienteDoRobo>}
     */
    /**
     * Pede ao robô (1.6.0) a lista do Tesouro Direto para a conta: ele escolhe o cliente na página de
     * Produtos → Tesouro Direto, na aba dele do Tesouro, e devolve os títulos que o Hub mostrou (com a
     * taxa e o vencimento), ou o erro do Hub (conta não habilitada) em `erro`.
     *
     * Com `leitura: 'posicoes'` (1.7.0), vai a Posições → Tesouro Direto e devolve, em `posicoes`, os
     * títulos que o cliente tem — para o resgate.
     *
     * @returns {Promise<{conta: string, itens: object[]|null, posicoes: object[]|null, erro: string|null}>}
     */
    pedirTesouro(conta, { leitura = 'lista', prazo = 60000 } = {}) {
      if (!CONTA.test(String(conta ?? ''))) return Promise.reject(new ErroDoRobo('invalido'));
      return pedir({ tipo: 'pedir-tesouro', conta: String(conta), leitura: leitura === 'posicoes' ? 'posicoes' : 'lista' }, prazo);
    },

    pedirCliente(conta, { prazo = 30000 } = {}) {
      if (!CONTA.test(String(conta ?? ''))) return Promise.reject(new ErroDoRobo('invalido'));
      return pedir({ tipo: 'pedir-cliente', conta: String(conta) }, prazo);
    },

    /**
     * Pede ao robô, de uma vez, o preço exato da cota de cada fundo — que só a boleta mostra. Ele abre
     * as boletas uma atrás da outra, na aba dele, para a conta de cada pedido, e devolve de cada uma
     * só o preço e o dia da cota, assim que o lê (`aoChegar`). Nunca falha inteiro: o fundo sem
     * preço vem com o motivo em `erro`, e a Mesa segue com a conta conservadora para ele.
     *
     * @param {{itens: Array<{fundoId: string, conta: string|number}>,
     *   aoChegar?: (resultado: ResultadoDaCota) => void, prazo?: number}} pedido
     *   `prazo` é quanto esperar sem notícia nenhuma do robô — uma boleta que não carrega leva 15 s
     *   para ele desistir, e mais se ele tiver de passar pela Prateleira
     * @returns {Promise<ResultadoDaCota[]>} na ordem dos itens
     */
    pedirCotas({ itens, aoChegar = () => {}, prazo = 40000 }) {
      const doPreco = (r) => (r.erro ? { fundoId: r.fundoId, erro: r.erro } : { fundoId: r.fundoId, valor: r.boleta.quotaValue, dataDaCota: r.boleta.quotaDate });
      return pedirLote(
        itens.map(({ fundoId, conta }) => ({ fundoId, conta })),
        { aoChegar: (r) => aoChegar(doPreco(r)), prazo, comLado: false }
      ).then((resultados) => resultados.map(doPreco));
    },

    /**
     * Pede ao robô (1.4.0) as boletas de compra e de venda, de uma vez: ele as abre uma atrás da
     * outra, na aba dele, para a conta de cada item, e devolve de cada uma o preço, as modalidades do
     * fundo (Estoque XP e Estoque clientes) e, na venda, a posição do cliente. A leitura dos campos é
     * da Mesa (`core/secundario/boletaDoHub.js`). O mesmo fundo pode vir em duas contas: a resposta
     * volta no lugar do item (`indice`).
     *
     * @param {{itens: Array<{fundoId: string, conta: string|number, lado: 'comprar'|'vender'}>,
     *   aoChegar?: (resultado: ResultadoDaBoleta) => void, prazo?: number}} pedido
     * @returns {Promise<ResultadoDaBoleta[]>} na ordem dos itens
     */
    /**
     * Pede ao robô (1.5.0) o print da cotação de venda de cada fundo: ele abre a boleta de venda para
     * a conta, preenche a quantidade (o "Total de cotas", com `quantidade: null`, ou a do pedido),
     * abre o detalhe da operação, confere a quantidade e tira o print do painel. Cada um chega assim
     * que sai (`aoChegar`); nunca falha inteiro.
     *
     * @param {{itens: Array<{fundoId: string, conta: string|number, quantidade: number|null}>,
     *   aoChegar?: (r: {indice: number, fundoId: string, png?: string, quantidade?: number|null,
     *   em?: number, erro?: ErroDoRobo}) => void, prazo?: number}} pedido
     */
    pedirPrints({ itens, aoChegar = () => {}, prazo = 45000 }) {
      const resultados = new Array(itens.length).fill(null);
      const validos = [];
      itens.forEach((item, indice) => {
        const quantidadeBoa = item.quantidade === null || (typeof item.quantidade === 'number' && item.quantidade > 0);
        if (FUNDO.test(String(item.fundoId)) && CONTA.test(String(item.conta)) && quantidadeBoa) {
          validos.push({
            fundoId: item.fundoId,
            conta: String(item.conta),
            quantidade: item.quantidade,
            // O estoque da venda (1.9.0): o robô o escolhe na boleta, e confere o deságio dele no painel.
            modalidade: item.modalidade === 'clientes' ? 'clientes' : 'xp',
            desagio: typeof item.desagio === 'number' && Number.isFinite(item.desagio) ? item.desagio : null,
            indice
          });
        } else resultados[indice] = { indice, fundoId: item.fundoId, erro: new ErroDoRobo('invalido') };
      });
      if (validos.length === 0) return Promise.resolve(resultados);
      if (versao === null) {
        for (const v of validos) resultados[v.indice] = { indice: v.indice, fundoId: v.fundoId, erro: new ErroDoRobo('sem-robo') };
        return Promise.resolve(resultados);
      }

      const id = novoId();
      return new Promise((resolver) => {
        let relogio = null;
        const terminar = () => {
          clearTimeout(relogio);
          lotesDePrints.delete(id);
          for (const v of validos) {
            if (!resultados[v.indice]) resultados[v.indice] = { indice: v.indice, fundoId: v.fundoId, erro: new ErroDoRobo('sem-resposta') };
          }
          resolver(resultados);
        };
        const esperar = () => {
          clearTimeout(relogio);
          relogio = setTimeout(terminar, prazo);
        };
        lotesDePrints.set(id, {
          chegou(mensagem) {
            const item = Number.isInteger(mensagem.indice) ? validos[mensagem.indice] : null;
            if (!item || item.fundoId !== mensagem.fundoId || resultados[item.indice]) return;
            const png = typeof mensagem.png === 'string' && /^data:image\/png;base64,/.test(mensagem.png) ? mensagem.png : null;
            const resultado =
              png && !mensagem.erro
                ? { indice: item.indice, fundoId: item.fundoId, png, quantidade: mensagem.quantidade ?? null, em: mensagem.em ?? Date.now() }
                : { indice: item.indice, fundoId: item.fundoId, erro: new ErroDoRobo(mensagem.erro || 'sem-print') };
            resultados[item.indice] = resultado;
            aoChegar(resultado);
            if (validos.every((v) => resultados[v.indice])) terminar();
            else esperar();
          },
          terminar
        });
        esperar();
        enviar({ tipo: 'pedir-prints', id, itens: validos.map(({ fundoId, conta, quantidade, modalidade, desagio }) => ({ fundoId, conta, quantidade, modalidade, desagio })) });
      });
    },

    /**
     * Deixa com o robô (1.5.0) o corpo em HTML do e-mail que a Mesa vai abrir no Outlook, e espera
     * ele dizer se colou. `inicio` é o começo do texto que vai no link: é por ele que o robô sabe que
     * o e-mail aberto é este. Sem resposta no prazo, vem `{ok: false, motivo: 'sem-resposta'}`.
     *
     * @returns {Promise<{ok: boolean, motivo: string|null}>}
     */
    prepararOutlook({ html, texto, inicio, prazo = 40000 }) {
      const reserva = this.reservarOutlook({ texto, inicio, prazo });
      if (!reserva) return Promise.resolve({ ok: false, motivo: 'sem-robo' });
      reserva.mandar(html);
      return reserva.resposta;
    },

    /**
     * Reserva o e-mail que a Mesa vai abrir no Outlook, antes de o HTML ficar pronto: a janela tem de
     * abrir no clique (senão o navegador a bloqueia), e os prints levam segundos. O robô no Outlook
     * espera o HTML (\`mandar\`), com o mesmo id; \`cancelar\` deixa o corpo de texto como está.
     *
     * @returns {null | {resposta: Promise<{ok: boolean, motivo: string|null}>, mandar: (html: string) => void,
     *   cancelar: () => void}}
     */
    reservarOutlook({ texto = '', inicio = '', prazo = 120000 } = {}) {
      if (versao === null) return null;
      const id = novoId();
      const resposta = new Promise((resolver) => {
        const desistir = () => {
          pendentes.delete(id);
          resolver({ ok: false, motivo: 'sem-resposta' });
        };
        pendentes.set(id, { resolver, rejeitar: desistir, relogio: setTimeout(desistir, prazo) });
      });
      enviar({ tipo: 'preparar-outlook', id, html: null, texto, inicio });
      return {
        resposta,
        mandar: (html) => enviar({ tipo: 'preparar-outlook', id, html, texto, inicio }),
        cancelar: () => {
          enviar({ tipo: 'cancelar-outlook', id });
          const pendente = pendentes.get(id);
          if (pendente) {
            clearTimeout(pendente.relogio);
            pendentes.delete(id);
            pendente.resolver({ ok: false, motivo: 'cancelado' });
          }
        }
      };
    },

    pedirBoletas({ itens, aoChegar = () => {}, prazo = 40000 }) {
      return pedirLote(
        itens.map(({ fundoId, conta, lado }) => ({ fundoId, conta, lado: lado === 'vender' ? 'vender' : 'comprar' })),
        { aoChegar, prazo, comLado: true }
      );
    }
  };

  /**
   * @typedef {{indice: number, fundoId: string, lado?: 'comprar'|'vender', erro?: ErroDoRobo,
   *   boleta?: {fundoId: string, lado: string, quotaValue: number, quotaDate: string, stock: object|null,
   *   posicao: object|null, em: number}}} ResultadoDaBoleta
   */
  function pedirLote(itens, { aoChegar, prazo, comLado }) {
    const resultados = new Array(itens.length).fill(null);
    // Os válidos levam o lugar deles na lista que a Mesa pediu.
    const validos = [];
    itens.forEach((item, indice) => {
      if (FUNDO.test(String(item.fundoId)) && CONTA.test(String(item.conta))) validos.push({ ...item, conta: String(item.conta), indice });
      else resultados[indice] = { indice, fundoId: item.fundoId, lado: item.lado, erro: new ErroDoRobo('invalido') };
    });
    if (validos.length === 0) return Promise.resolve(resultados);
    if (versao === null) {
      for (const v of validos) resultados[v.indice] = { indice: v.indice, fundoId: v.fundoId, lado: v.lado, erro: new ErroDoRobo('sem-robo') };
      return Promise.resolve(resultados);
    }

    const id = novoId();
    return new Promise((resolver) => {
      let relogio = null;
      const terminar = () => {
        clearTimeout(relogio);
        lotes.delete(id);
        for (const v of validos) {
          if (!resultados[v.indice]) resultados[v.indice] = { indice: v.indice, fundoId: v.fundoId, lado: v.lado, erro: new ErroDoRobo('sem-resposta') };
        }
        resolver(resultados);
      };
      const esperar = () => {
        clearTimeout(relogio);
        relogio = setTimeout(terminar, prazo);
      };
      lotes.set(id, {
        chegou(mensagem) {
          // A 1.4.0 diz o lugar do item (o robô o conta na lista que recebeu, só com os válidos);
          // sem isso, vale o primeiro item ainda sem resposta com o mesmo fundo.
          const pelaPosicao = Number.isInteger(mensagem.indice) ? validos[mensagem.indice] : null;
          const item =
            pelaPosicao && pelaPosicao.fundoId === mensagem.fundoId && !resultados[pelaPosicao.indice]
              ? pelaPosicao
              : validos.find((v) => v.fundoId === mensagem.fundoId && !resultados[v.indice]);
          if (!item) return;
          const resultado =
            mensagem.tipo === 'cota'
              ? {
                  indice: item.indice,
                  fundoId: item.fundoId,
                  lado: item.lado,
                  boleta: {
                    fundoId: item.fundoId,
                    lado: item.lado ?? 'comprar',
                    quotaValue: mensagem.valor,
                    quotaDate: mensagem.dataDaCota,
                    stock: mensagem.stock ?? null,
                    posicao: mensagem.posicao ?? null,
                    em: Date.now()
                  }
                }
              : { indice: item.indice, fundoId: item.fundoId, lado: item.lado, erro: new ErroDoRobo(mensagem.motivo) };
          resultados[item.indice] = resultado;
          aoChegar(resultado);
          if (validos.every((v) => resultados[v.indice])) terminar();
          else esperar();
        },
        terminar
      });
      esperar();
      enviar({ tipo: 'pedir-cotas', id, itens: validos.map(({ fundoId, conta, lado }) => (comLado ? { fundoId, conta, lado } : { fundoId, conta })) });
    });
  }
};
