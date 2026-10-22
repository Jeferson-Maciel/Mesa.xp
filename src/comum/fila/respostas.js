/**
 * As respostas dos clientes, vistas pelo robô na caixa de entrada do Outlook na web (robô 1.8.0), e o
 * cartão da Fila de cada uma. Funções puras, testadas em `respostas.test.js`.
 *
 * O robô só lê a lista de mensagens, e dela só os e-mails de confirmação ("Confirmação…", com ou sem
 * "RE:" — no modo conversas do Outlook, a lista mostra o assunto sem o prefixo) de hoje: o remetente,
 * o e-mail dele, o assunto, a prévia, a hora e a conta citada. Aqui:
 *
 * - **a conta citada casa primeiro** (1.9.1): a prévia da resposta traz o começo do e-mail original,
 *   "na conta XP 1234567" — o que liga a resposta ao pedido mesmo sem o e-mail do cliente;
 * - **o e-mail do cliente casa sozinho**: a resposta do endereço do cliente de um cartão só vai para
 *   ele. Com mais de um cartão do mesmo cliente (ou da mesma conta), vale o que ainda espera a
 *   resposta, e depois o do mesmo assunto; sobrando mais de um, é ambígua — o operador escolhe;
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
  const t = String(hora ?? '').trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?$/i.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59) return null;
  if (m[3]) {
    const isPM = m[3].toUpperCase() === 'PM';
    if (h < 1 || h > 12) return null;
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
  } else if (h > 23) {
    return null;
  }
  const d = new Date(agora);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, min).getTime();
};

/**
 * Desambigua pedidos candidatos analisando o conteúdo semântico da resposta (prévia e assunto):
 * - Operação citada (compra vs. venda vs. resgate vs. aplicação)
 * - Tickers e ativos do pedido presentes no texto da resposta
 * - Trechos literais do e-mail do pedido citados na mensagem
 */
export const desambiguarPorConteudo = (candidatos, resposta) => {
  if (candidatos.length <= 1) return candidatos;
  const texto = normalizar(`${resposta?.assunto ?? ''} ${resposta?.previa ?? ''}`);
  if (!texto) return candidatos;

  const pontuados = candidatos.map((p) => {
    let pontos = 0;
    const ordens = p.ordens ?? [];
    const todosCompra = ordens.length > 0 && ordens.every((o) => o.operacao === 'C');
    const todosVenda = ordens.length > 0 && ordens.every((o) => o.operacao === 'V');
    const ehCompra = p.grupo === 'fundos-compra' || p.grupo === 'tesouro' || todosCompra;
    const ehVenda = p.grupo === 'fundos-venda' || p.grupo === 'tesouro-resgate' || todosVenda;

    // 1. Evidência explícita de operação no texto
    const temCompra = /\b(?:COMPRA|COMPRAR|APLICACAO|APLICAR)\b/.test(texto);
    const temOpCompra = /OPERACAO\s*:\s*COMPRA|OPERACAO\s+COMPRA|ESTRATEGIA\s*:\s*COMPRA/.test(texto);
    const temVenda = /\b(?:VENDA|VENDER|RESGATE|RESGATAR|CONDICOES)\b/.test(texto);
    const temOpVenda = /OPERACAO\s*:\s*VENDA|OPERACAO\s+VENDA|ESTRATEGIA\s*:\s*VENDA/.test(texto);

    if (ehCompra) {
      if (temOpCompra) pontos += 30;
      else if (temCompra) pontos += 10;
      if (temOpVenda) pontos -= 30;
    }

    if (ehVenda) {
      if (temOpVenda) pontos += 30;
      else if (temVenda) pontos += 10;
      if (temOpCompra) pontos -= 30;
    }

    // 2. Evidência de ativos e tickers citados no texto
    for (const o of ordens) {
      const ativoNorm = normalizar(o.ativo);
      if (!ativoNorm) continue;
      const partes = ativoNorm.split(' ');
      const ticker = partes.find((part) => /^[A-Z0-9]{4}\d{1,2}[A-Z]?$/.test(part));
      if (ticker && new RegExp(`\\b${ticker}\\b`).test(texto)) {
        pontos += 40;
      } else if (ativoNorm.length >= 4 && texto.includes(ativoNorm)) {
        pontos += 35;
      } else {
        const primeiroTermo = partes.find((part) => part.length >= 4 && !['FII', 'RL', 'FEEDER', 'FIP'].includes(part));
        if (primeiroTermo && new RegExp(`\\b${primeiroTermo}\\b`).test(texto)) {
          pontos += 20;
        }
      }
    }

    // 3. Trechos característicos do e-mail citados na prévia
    if (p.texto) {
      const textoPedido = normalizar(p.texto);
      const linhasPedido = textoPedido.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= 10);
      for (const linha of linhasPedido) {
        if (texto.includes(linha)) {
          pontos += 15;
          break;
        }
      }
    }

    return { pedido: p, pontos };
  });

  pontuados.sort((a, b) => b.pontos - a.pontos);
  const melhor = pontuados[0];
  const segundo = pontuados[1];

  if (melhor && melhor.pontos > 0 && (!segundo || melhor.pontos > segundo.pontos)) {
    return [melhor.pedido];
  }

  return candidatos;
};

/**
 * Para que cartão vai uma resposta.
 *
 * @param {{email?: string|null, de?: string|null, assunto: string, previa?: string|null, conta?: string|null}} resposta
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
  const afunilar = (lista) => {
    const porEstado = preferir(lista, (p) => p.estado === 'enviado');
    const porAssunto = preferir(porEstado, (p) => normalizar(p.assunto) === assunto);
    return desambiguarPorConteudo(porAssunto, resposta);
  };

  // A conta citada na resposta (o "na conta XP 1234567" do e-mail original, que a prévia traz) é o
  // que liga mais certo (pedido do operador em 21/10/2026): vale mesmo sem o e-mail do cliente.
  const conta = String(resposta.conta ?? '').trim();
  if (conta) {
    const daConta = vivos.filter((p) => p.conta === conta);
    if (daConta.length) {
      const lista = afunilar(daConta);
      return lista.length === 1 ? { tipo: 'casou', pedido: lista[0] } : { tipo: 'ambigua', candidatos: lista };
    }
  }

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

