import fonte from './robo-hub.user.js?raw';

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

/** O script que a Mesa oferece para copiar e colar no Tampermonkey. */
export const scriptDoRobo = fonte;

/** A versão do robô que esta Mesa espera; outra versão instalada pede a cópia nova. */
export const VERSAO_DO_ROBO = fonte.match(/^\/\/ @version\s+(\S+)/m)?.[1] ?? null;

const MENSAGENS = {
  'sem-robo': 'o robô do Hub não está instalado',
  'sem-resposta': 'o Hub não respondeu a tempo',
  'sem-boleta': 'a boleta não carregou na aba do robô — a conta é de um cliente seu?',
  'sem-cliente': 'o Hub não mostrou esse cliente — a conta é de um cliente seu?',
  'ficha-desconhecida': 'a ficha do cliente veio do Hub num formato que o robô não conhece — o robô precisa ser atualizado',
  invalido: 'fundo ou conta numa forma que o robô não aceita'
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
  const pendentes = new Map();
  const lotes = new Map();

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

    if (mensagem.tipo === 'registro') {
      const pendente = mensagem.id ? pendentes.get(mensagem.id) : null;
      if (!pendente) return;
      clearTimeout(pendente.relogio);
      pendentes.delete(mensagem.id);
      pendente.resolver(Array.isArray(mensagem.entradas) ? mensagem.entradas : []);
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
      const resultados = new Map();
      const validos = [];
      for (const { fundoId, conta } of itens) {
        if (FUNDO.test(String(fundoId)) && CONTA.test(String(conta))) validos.push({ fundoId, conta: String(conta) });
        else resultados.set(fundoId, { fundoId, erro: new ErroDoRobo('invalido') });
      }
      const emOrdem = () => itens.map(({ fundoId }) => resultados.get(fundoId));
      if (validos.length === 0) return Promise.resolve(emOrdem());
      if (versao === null) {
        for (const { fundoId } of validos) resultados.set(fundoId, { fundoId, erro: new ErroDoRobo('sem-robo') });
        return Promise.resolve(emOrdem());
      }

      const id = novoId();
      return new Promise((resolver) => {
        let relogio = null;
        const terminar = () => {
          clearTimeout(relogio);
          lotes.delete(id);
          for (const { fundoId } of validos) {
            if (!resultados.has(fundoId)) resultados.set(fundoId, { fundoId, erro: new ErroDoRobo('sem-resposta') });
          }
          resolver(emOrdem());
        };
        const esperar = () => {
          clearTimeout(relogio);
          relogio = setTimeout(terminar, prazo);
        };
        lotes.set(id, {
          chegou(mensagem) {
            const { fundoId } = mensagem;
            if (!validos.some((v) => v.fundoId === fundoId) || resultados.has(fundoId)) return;
            const resultado =
              mensagem.tipo === 'cota'
                ? { fundoId, valor: mensagem.valor, dataDaCota: mensagem.dataDaCota }
                : { fundoId, erro: new ErroDoRobo(mensagem.motivo) };
            resultados.set(fundoId, resultado);
            aoChegar(resultado);
            if (validos.every((v) => resultados.has(v.fundoId))) terminar();
            else esperar();
          },
          terminar
        });
        esperar();
        enviar({ tipo: 'pedir-cotas', id, itens: validos });
      });
    }
  };
};
