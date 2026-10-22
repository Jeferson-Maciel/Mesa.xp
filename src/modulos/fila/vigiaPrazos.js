import { avisarMudancaNaFila } from '../../comum/fila/eventos.js';
import { diaDe, inicioDaVista, marcarPrazoAvisado, pedidosDaVista, prazosParaAvisar, textoDoAvisoDePrazo } from '../../comum/fila/regras.js';

/**
 * O vigia dos prazos da Fila (Fase 3, 21/10/2026): começa com a página, como os lembretes das
 * Anotações — quem passa o dia no Ordens também é avisado. 15 min antes do prazo de um pedido em
 * Aprovação e execução, e 30 min antes do de um e-mail que espera o cliente, mostra o aviso de prazo
 * (âmbar, com som) com "Ver na Fila". Uma vez por pedido e por prazo: o avisado fica gravado no cartão
 * (`regras.js`, `prazosAvisados`) antes do aviso, e recarregar não avisa de novo.
 *
 * @param {object} opcoes
 * @param {object} opcoes.repo  o repositório da Fila
 * @param {(texto: string, opcoes: object) => void} opcoes.avisar
 * @param {(pedido: object) => void} [opcoes.abrir]  "Ver na Fila": leva ao cartão
 * @param {() => number} [opcoes.agora]
 */
export const criarVigiaDePrazos = ({ repo, avisar, abrir = () => {}, agora = () => Date.now() }) => {
  let fila = Promise.resolve();

  async function conferir() {
    const momento = agora();
    const daVista = async () => pedidosDaVista(await repo.listarDesde(inicioDaVista(momento)), diaDe(momento), momento);
    if (!prazosParaAvisar(await daVista(), momento).length) return;
    // Relidos antes de gravar, como estão no banco agora: o vigia do Outlook pode ter acabado de
    // gravar uma resposta, que o cartão regravado apagaria.
    let gravou = false;
    const marcados = new Map();
    for (const item of prazosParaAvisar(await daVista(), momento)) {
      // Dois prazos do mesmo pedido de uma vez: o segundo marca sobre o primeiro.
      const marcado = marcarPrazoAvisado(marcados.get(item.pedido.id) ?? item.pedido, item.prazo, momento);
      marcados.set(marcado.id, marcado);
      await repo.salvar(marcado);
      gravou = true;
      avisar(textoDoAvisoDePrazo(item, momento), { tipo: 'prazo', acao: { rotulo: 'Ver na Fila', fazer: () => abrir(marcado) } });
    }
    if (gravou) avisarMudancaNaFila('prazos');
  }

  return {
    /** Confere os prazos agora; uma conferência por vez. */
    conferir: () => (fila = fila.then(conferir).catch(() => {}))
  };
};
