import { avisarMudancaNaFila } from '../../comum/fila/eventos.js';
import { diaDe, hora, inicioDaVista, pedidosDaVista, registrarResposta } from '../../comum/fila/regras.js';
import { casarResposta, momentoDaHora } from '../../comum/fila/respostas.js';

/**
 * O vigia das respostas no Outlook, do lado da Mesa (robô 1.8.0).
 *
 * Começa com a página, como o contador da Fila. Enquanto há pedido aguardando o cliente ou já
 * respondido (hoje, ou aberto dos últimos dias), pede ao robô, a cada minuto, que olhe a caixa de
 * entrada do Outlook na web. O que o robô vê chega aqui: cada resposta é casada com o cartão dela (`respostas.js`) — o
 * e-mail do cliente casa sozinho e passa o cartão para "O cliente respondeu"; a ambígua e a achada só
 * pelo nome ficam "a conferir", e o operador escolhe o cartão, ou diz que não é de pedido.
 *
 * As respostas a conferir ficam na memória da página: o robô as manda de novo a cada minuto. As que o
 * operador disse não serem de pedido ficam no `localStorage` só pelo id — um resumo, sem nome —, até
 * o fim do dia.
 */

const CHAVE_IGNORADAS = 'mesa_fila_respostas_ignoradas';
// A caixa de entrada vista há mais que isso: a aba foi fechada, ou trocou de página.
const CAIXA_VISTA_MS = 150 * 1000;

const lerIgnoradas = (hoje) => {
  try {
    const todas = JSON.parse(localStorage.getItem(CHAVE_IGNORADAS) || '{}');
    return Object.fromEntries(Object.entries(todas).filter(([, dia]) => dia === hoje));
  } catch {
    return {};
  }
};
const gravarIgnoradas = (ignoradas) => {
  try {
    localStorage.setItem(CHAVE_IGNORADAS, JSON.stringify(ignoradas));
  } catch {
    // Sem localStorage, a resposta volta a aparecer depois de recarregar: incomoda, não erra.
  }
};

const curto = (texto, n = 90) => {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * @param {object} opcoes
 * @param {object} opcoes.robo  a ponte do robô (`aoReceberOutlook`, `vigiarOutlook`, `presente`, `versao`)
 * @param {(versao: string) => boolean} [opcoes.atende]  o robô desta versão faz o que a Mesa pede (a versão mínima, ou mais nova)
 * @param {object} opcoes.repo  o repositório da Fila
 * @param {(mensagem: string, opcoes?: object) => void} [opcoes.avisar]
 * @param {() => number} [opcoes.agora]
 */
export const criarVigiaDoOutlook = ({ robo, atende = () => true, repo, avisar = () => {}, agora = () => Date.now() }) => {
  const estado = { caixaVistaEm: 0, itens: 0, esperando: 0, soltas: [], ignoradas: lerIgnoradas(diaDe(agora())) };
  const ouvintes = new Set();
  const mudou = () => ouvintes.forEach((fn) => fn());
  let fila = Promise.resolve();
  const emFila = (fn) => (fila = fila.then(fn).catch(() => {}));

  const daVista = async () => pedidosDaVista(await repo.listarDesde(inicioDaVista(agora())), diaDe(agora()), agora());

  // O e-mail que a própria mesa mandou (a prévia começa pelo "Prezado(a)" de todo modelo do Ordens):
  // com a pasta Itens Enviados aberta, ele citaria a conta e casaria como se fosse a resposta.
  const ehDaMesa = (previa) => /^\s*Prezado\(a\)/i.test(previa ?? '');

  async function receber(leitura) {
    if (leitura.lista) {
      estado.caixaVistaEm = leitura.em;
      estado.itens = leitura.itens;
    }
    let pedidos = await daVista();
    const doId = new Map(pedidos.filter((p) => p.resposta?.id).map((p) => [p.resposta.id, p]));
    const soltas = [];
    let gravou = false;
    const gravar = async (atualizado) => {
      await repo.salvar(atualizado);
      pedidos = pedidos.map((p) => (p.id === atualizado.id ? atualizado : p));
      doId.set(atualizado.resposta.id, atualizado);
      gravou = true;
    };

    for (const r of leitura.respostas) {
      const em = momentoDaHora(r.hora, agora());
      if (em === null || estado.ignoradas[r.id] || ehDaMesa(r.previa)) continue;
      const resposta = { id: r.id, de: r.de, email: r.email, assunto: r.assunto, previa: r.previa, em, conta: r.conta ?? null };
      // A mesma conversa com uma mensagem nova: a prévia muda, e o cartão fica com a de agora.
      const jaGuardada = doId.get(r.id);
      if (jaGuardada) {
        if (jaGuardada.resposta.previa !== r.previa) await gravar(registrarResposta(jaGuardada, resposta, agora()));
        continue;
      }
      const casamento = casarResposta(resposta, pedidos);
      if (casamento.tipo === 'casou') {
        const atualizado = registrarResposta(casamento.pedido, resposta, agora());
        await gravar(atualizado);
        avisar(`${r.de || 'O cliente'} respondeu (conta ${atualizado.conta}): "${curto(r.previa) || 'sem prévia'}"`, {
          acao: { rotulo: 'Ver na Fila', fazer: () => (location.hash = '#fila') }
        });
      } else if (casamento.tipo !== 'nenhum' || r.prefixo || r.conta) {
        // O que não casou com nada só fica "a conferir" se for resposta a e-mail nosso — com "RE:" ou
        // com a conta citada. Outro e-mail com "Confirmação" no assunto (um aviso de sistema) não é.
        soltas.push({ resposta, motivo: casamento.tipo, candidatos: (casamento.candidatos ?? []).map((p) => p.id) });
      }
    }
    estado.soltas = soltas;
    if (gravou) avisarMudancaNaFila('robo');
    mudou();
  }

  async function pedirSePrecisa() {
    try {
      const pedidos = await daVista();
      // O que respondeu ainda pode ter outra mensagem ("só metade") até o operador aprovar.
      estado.esperando = pedidos.filter((p) => p.estado === 'enviado' || p.estado === 'respondeu').length;
    } catch {
      estado.esperando = 0;
    }
    if (estado.esperando > 0 || estado.soltas.length > 0) robo.vigiarOutlook();
    mudou();
  }

  robo.aoReceberOutlook((leitura) => emFila(() => receber(leitura)));

  return {
    pedirSePrecisa: () => emFila(pedirSePrecisa),

    /** Espera o que já chegou ser tratado (para os testes). */
    pronto: () => fila,

    /**
     * Como a Fila mostra o vigia, no alto: `vigiando`, `sem-caixa` (o Outlook não está aberto na caixa
     * de entrada), `parado` (nada esperando resposta), `sem-robo` e `robo-velho`.
     *
     * @returns {{tipo: string, texto: string, titulo: string}}
     */
    situacao() {
      if (!robo.presente) return { tipo: 'sem-robo', texto: 'Outlook: sem o robô', titulo: 'Instale o robô do Hub (no Ordens, "Instalar robô") para ver as respostas dos clientes aqui.' };
      if (!atende(robo.versao)) {
        return { tipo: 'robo-velho', texto: 'Outlook: atualize o robô', titulo: `O robô instalado é a versão ${robo.versao}, antiga demais para as respostas no Outlook. No Ordens, clique em "Atualizar robô".` };
      }
      if (estado.esperando === 0 && estado.soltas.length === 0) return { tipo: 'parado', texto: 'Outlook: nada esperando resposta', titulo: 'Quando um e-mail sair, o robô passa a olhar a caixa de entrada.' };
      if (agora() - estado.caixaVistaEm > CAIXA_VISTA_MS) {
        return { tipo: 'sem-caixa', texto: 'Outlook: abra a caixa de entrada', titulo: 'Deixe o Outlook na web aberto na caixa de entrada, numa aba deste Chrome: o robô vê as respostas na lista de mensagens.' };
      }
      return { tipo: 'vigiando', texto: `Outlook: vendo as respostas · ${hora(estado.caixaVistaEm)}`, titulo: `O robô olhou a caixa de entrada às ${hora(estado.caixaVistaEm)} (${estado.itens} mensagens na lista).` };
    },

    /** As respostas que não casaram sozinhas, com os cartões candidatos. */
    soltas: () => estado.soltas,

    /** O operador disse de que cartão é a resposta. */
    atribuir: (idResposta, idPedido) =>
      emFila(async () => {
        const solta = estado.soltas.find((s) => s.resposta.id === idResposta);
        const pedido = (await repo.listarTodos()).find((p) => p.id === idPedido);
        if (!solta || !pedido) return;
        await repo.salvar(registrarResposta(pedido, solta.resposta, agora()));
        estado.soltas = estado.soltas.filter((s) => s !== solta);
        avisarMudancaNaFila('robo');
        mudou();
      }),

    /** O operador disse que a resposta não é de pedido: não aparece mais hoje. */
    ignorar(idResposta) {
      estado.ignoradas[idResposta] = diaDe(agora());
      gravarIgnoradas(estado.ignoradas);
      estado.soltas = estado.soltas.filter((s) => s.resposta.id !== idResposta);
      mudou();
    },

    /** @returns {() => void} a função que para de escutar */
    aoMudar(fn) {
      ouvintes.add(fn);
      return () => ouvintes.delete(fn);
    }
  };
};
