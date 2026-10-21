/**
 * As respostas dos clientes, vistas pelo robô na caixa de entrada do Outlook na web (robô 1.8.0), e o
 * cartão da Fila de cada uma. Funções puras, testadas em `respostas.test.js`.
 *
 * O robô só lê a lista de mensagens, e dela só as respostas aos nossos e-mails ("RE:/RES:
 * Confirmação…") de hoje: o remetente, o e-mail dele, o assunto, a prévia e a hora. Aqui:
 *
 * - **o e-mail do cliente casa sozinho**: a resposta do endereço do cliente de um cartão só vai para
 *   ele. Com mais de um cartão do mesmo cliente, vale o que ainda espera a resposta, e depois o do
 *   mesmo assunto; sobrando mais de um, é ambígua — o operador escolhe;
 * - **pelo nome é só sugestão**: o cliente que responde de outro endereço é achado pelo nome, mas o
 *   operador confirma. Nada é adivinhado;
 * - **a resposta não aprova nada**: só passa o cartão para "O cliente respondeu" (`regras.js`).
 */

const PREFIXOS = /^\s*(?:(?:re|res|resp|enc|fw|fwd|tr|aw|wg)\s*:\s*)+/i;

/** É resposta (ou encaminhamento) a um e-mail de confirmação da mesa. */
export const ehRespostaDePedido = (assunto) => PREFIXOS.test(String(assunto ?? '')) && /confirma[çc][ãa]o/i.test(String(assunto));

/** O assunto sem os "RE:", "RES:", "ENC:" do começo. */
export const assuntoSemPrefixo = (assunto) => String(assunto ?? '').replace(PREFIXOS, '').trim();

const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const LIGACOES = new Set(['DOS', 'DAS', 'DES']);
const partesDoNome = (nome) => normalizar(nome).split(' ').filter((p) => p.length >= 3 && !LIGACOES.has(p));

/**
 * A hora que o Outlook mostra nas mensagens de hoje ("10:42"), como momento de hoje. Outra coisa
 * (data, dia da semana) não é de hoje: `null`.
 */
export const momentoDaHora = (hora, agora = Date.now()) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora ?? '').trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const d = new Date(agora);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(m[1]), Number(m[2])).getTime();
};

/**
 * Para que cartão vai uma resposta.
 *
 * @param {{email?: string|null, de?: string|null, assunto: string}} resposta
 * @param {object[]} pedidos  os cartões do dia
 * @returns {{tipo: 'casou', pedido: object} | {tipo: 'ambigua'|'pelo-nome', candidatos: object[]} | {tipo: 'nenhum'}}
 */
export const casarResposta = (resposta, pedidos) => {
  const vivos = pedidos.filter((p) => p.estado !== 'cancelado');
  const assunto = normalizar(assuntoSemPrefixo(resposta.assunto));
  const preferir = (lista, criterio) => {
    const melhores = lista.filter(criterio);
    return melhores.length ? melhores : lista;
  };
  const afunilar = (lista) => preferir(preferir(lista, (p) => p.estado === 'enviado'), (p) => normalizar(p.assunto) === assunto);

  const email = String(resposta.email ?? '').trim().toLowerCase();
  if (email) {
    const doEmail = vivos.filter((p) => String(p.cliente?.email ?? '').trim().toLowerCase() === email);
    if (doEmail.length) {
      const lista = afunilar(doEmail);
      return lista.length === 1 ? { tipo: 'casou', pedido: lista[0] } : { tipo: 'ambigua', candidatos: lista };
    }
  }

  // Pelo nome: todas as partes do nome de quem respondeu (duas ou mais) estão no nome do cliente.
  const nome = partesDoNome(resposta.de);
  if (nome.length >= 2) {
    const doNome = vivos.filter((p) => {
      const partes = new Set(partesDoNome(p.cliente?.nome));
      return nome.every((parte) => partes.has(parte));
    });
    if (doNome.length) return { tipo: 'pelo-nome', candidatos: afunilar(doNome) };
  }
  return { tipo: 'nenhum' };
};
