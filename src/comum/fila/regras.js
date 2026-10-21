import { HORARIOS, proximoHorario } from '../horarios.js';

/**
 * A Fila do dia: o caminho de cada pedido depois que o e-mail sai — o cliente responde, aprova, a
 * mesa executa. Funções puras, testadas em `regras.test.js`; o repositório (IndexedDB) e a tela ficam
 * em volta. Decidido com o usuário em 21/10/2026 ("pode fazer tudo isso").
 *
 * - Um cartão nasce quando um e-mail do Ordens é copiado ou aberto no Outlook: é o que de fato vai
 *   para o cliente. Colar e analisar, só, não cria nada. O mesmo pedido copiado de novo, ainda à
 *   espera do cliente, atualiza o cartão em vez de criar outro.
 * - Os estados são as colunas: aguardando o cliente → o cliente respondeu (o robô viu a resposta no
 *   Outlook) → aprovado, a executar → executado. Cancelado sai do quadro. Quem diz que o cliente
 *   aprovou é o operador: "ok, mas só metade" não é aprovação, e nada aqui é adivinhado.
 * - Os prazos vêm do que o pedido é (os horários em `../horarios.js`): o leilão da bolsa, o Tesouro,
 *   o Estoque clientes, o secundário da XP e a validade da cotação de venda.
 * - Tudo fica no navegador: o cartão tem o nome e a conta do cliente.
 */

export const ESTADOS = ['enviado', 'respondeu', 'aprovado', 'executado', 'cancelado'];

export const COLUNAS = [
  { estado: 'enviado', titulo: 'Aguardando o cliente' },
  { estado: 'respondeu', titulo: 'O cliente respondeu' },
  { estado: 'aprovado', titulo: 'Aprovado: executar' },
  { estado: 'executado', titulo: 'Executado' }
];

export const NOMES_DOS_GRUPOS = {
  bolsa: 'Bolsa',
  'fundos-compra': 'Fundos · Compra',
  'fundos-venda': 'Fundos · Venda',
  tesouro: 'Tesouro · Aplicação',
  'tesouro-resgate': 'Tesouro · Resgate'
};

/** O dia local `AAAA-MM-DD` de um momento — nunca `toISOString()`, que muda o dia às 21h. */
export const diaDe = (momento) => {
  const d = new Date(momento);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

/** A identidade de um pedido no dia: a conta, o grupo e os ativos com a operação de cada um. */
export const chaveDoPedido = ({ conta, grupo, ordens }) =>
  `${conta}|${grupo}|${ordens
    .map((o) => `${normalizar(o.ativo)}:${o.operacao}`)
    .sort()
    .join(',')}`;

/**
 * Os prazos de um pedido, no momento em que o e-mail sai.
 *
 * @param {{grupo: string, ordens: object[], em: number, validadeDaCotacao?: number|null}} p
 */
export const prazosDoPedido = ({ grupo, ordens, em, validadeDaCotacao = null }) => {
  const prazos = [];
  const ate = (hhmm) => proximoHorario(em, hhmm).getTime();
  if (grupo === 'bolsa') prazos.push({ tipo: 'leilao', ate: ate(HORARIOS.pregao.leilao), rotulo: 'leilão da B3' });
  if (grupo === 'fundos-compra' && ordens.some((o) => o.estoque === 'clientes')) {
    prazos.push({ tipo: 'estoque-clientes', ate: ate(HORARIOS.estoqueClientes.ate), rotulo: 'Estoque clientes casa até' });
  }
  if (grupo === 'fundos-venda' && validadeDaCotacao) prazos.push({ tipo: 'cotacao', ate: validadeDaCotacao, rotulo: 'cotação da venda vale até' });
  if (grupo.startsWith('fundos')) prazos.push({ tipo: 'secundario', ate: ate(HORARIOS.secundario.ate), rotulo: 'secundário da XP até' });
  if (grupo.startsWith('tesouro')) prazos.push({ tipo: 'tesouro', ate: ate(HORARIOS.tesouro.fecha), rotulo: 'Tesouro até' });
  return prazos.sort((a, b) => a.ate - b.ate);
};

let sequencia = 0;
const novoId = (em) => `${em.toString(36)}-${(++sequencia).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * O cartão de um pedido cujo e-mail acabou de sair.
 *
 * @param {object} p
 * @param {string} p.conta
 * @param {{nome: string, email: string|null}|null} [p.cliente]
 * @param {{nome: string, email: string|null}|null} [p.assessor]
 * @param {string} p.grupo  bolsa, fundos-compra, fundos-venda, tesouro, tesouro-resgate
 * @param {string} p.formato  email ou auditoria
 * @param {string} p.assunto
 * @param {object[]} p.ordens  o que cada ordem é, como o e-mail a escreve
 * @param {string} p.texto  o e-mail, como saiu
 * @param {number} p.em
 * @param {number|null} [p.validadeDaCotacao]  na venda de fundo, até quando vale a cotação (o print)
 */
export const novoPedido = ({ conta, cliente = null, assessor = null, grupo, formato, assunto, ordens, texto, em, validadeDaCotacao = null }) => ({
  id: novoId(em),
  dia: diaDe(em),
  criadoEm: em,
  atualizadoEm: em,
  conta: String(conta),
  cliente,
  assessor,
  grupo,
  formato,
  assunto,
  ordens,
  texto,
  estado: 'enviado',
  historico: [{ estado: 'enviado', em }],
  prazos: prazosDoPedido({ grupo, ordens, em, validadeDaCotacao }),
  resposta: null,
  chave: chaveDoPedido({ conta, grupo, ordens })
});

/**
 * O que fazer com um e-mail que sai: se o mesmo pedido de hoje ainda espera o cliente, o cartão é
 * atualizado (o e-mail foi refeito ou reenviado); senão, nasce um cartão novo — o que já foi aprovado,
 * executado ou cancelado é outro pedido.
 *
 * Quando o operador confirmou, no Ordens, que o pedido repetido é novo de verdade (`novo`), só os
 * cartões que nasceram da mesma solicitação (`proprios`) contam: copiar duas vezes não duplica, e o
 * pedido de antes fica como estava.
 *
 * @param {object[]} pedidosDoDia
 * @param {object} dados  como em `novoPedido`
 * @param {{novo?: boolean, proprios?: Set<string>}} [opcoes]
 * @returns {object} o cartão a gravar
 */
export const registrarEnvio = (pedidosDoDia, dados, { novo: pedidoNovo = false, proprios = new Set() } = {}) => {
  const novo = novoPedido(dados);
  const candidatos = pedidoNovo ? pedidosDoDia.filter((p) => proprios.has(p.id)) : pedidosDoDia;
  const mesmo = candidatos.find((p) => p.chave === novo.chave && (p.estado === 'enviado' || p.estado === 'respondeu'));
  if (!mesmo) return novo;
  return { ...mesmo, cliente: novo.cliente ?? mesmo.cliente, assessor: novo.assessor ?? mesmo.assessor, ordens: novo.ordens, texto: novo.texto, prazos: novo.prazos, atualizadoEm: dados.em };
};

/** O cartão no estado novo, com a passagem no histórico. */
export const mudarEstado = (pedido, estado, em = Date.now()) => {
  if (!ESTADOS.includes(estado)) throw new Error(`estado desconhecido: ${estado}`);
  if (pedido.estado === estado) return pedido;
  return { ...pedido, estado, atualizadoEm: em, historico: [...pedido.historico, { estado, em }] };
};

/**
 * A resposta do cliente, vista pelo robô no Outlook: o cartão que esperava o cliente passa para "o
 * cliente respondeu"; o que já andou (aprovado, executado) só guarda a resposta.
 */
export const registrarResposta = (pedido, resposta, em = Date.now()) => {
  const comResposta = { ...pedido, resposta, atualizadoEm: em };
  return pedido.estado === 'enviado' ? mudarEstado(comResposta, 'respondeu', em) : comResposta;
};

/** `ok`, `perto` (falta uma hora ou menos) ou `vencido`. */
export const situacaoDoPrazo = (prazo, agora = Date.now()) => {
  const falta = prazo.ate - agora;
  return falta <= 0 ? 'vencido' : falta <= 60 * 60000 ? 'perto' : 'ok';
};

/** O prazo que pede atenção primeiro; nenhum quando o pedido já foi executado ou cancelado. */
export const prazoMaisUrgente = (pedido, agora = Date.now()) => {
  if (pedido.estado === 'executado' || pedido.estado === 'cancelado') return null;
  return pedido.prazos.find((p) => situacaoDoPrazo(p, agora) !== 'ok') ?? pedido.prazos[0] ?? null;
};

/** Pede atenção agora: o cliente respondeu, ou um prazo está perto ou vencido. */
export const pedeAtencao = (pedido, agora = Date.now()) => {
  if (pedido.estado === 'respondeu') return true;
  const prazo = prazoMaisUrgente(pedido, agora);
  return Boolean(prazo) && situacaoDoPrazo(prazo, agora) !== 'ok';
};

/**
 * As ordens de um pedido novo que repetem um pedido de hoje: mesma conta, mesmo ativo, mesma operação,
 * e o outro não foi cancelado. O grupo é corrido, e o mesmo pedido colado duas vezes é um erro fácil.
 *
 * @returns {Array<{ativo: string, operacao: string, em: number, estado: string}>}
 */
export const repetidosHoje = (conta, ordens, pedidosDoDia) => {
  const repetidos = [];
  for (const ordem of ordens) {
    const alvo = normalizar(ordem.ativo);
    const outro = pedidosDoDia.find(
      (p) => p.conta === String(conta) && p.estado !== 'cancelado' && p.ordens.some((o) => normalizar(o.ativo) === alvo && o.operacao === ordem.operacao)
    );
    if (outro) repetidos.push({ ativo: ordem.ativo, operacao: ordem.operacao, em: outro.criadoEm, estado: outro.estado });
  }
  return repetidos;
};

/** As contas que já passaram pela Fila, em qualquer dia. */
export const contasConhecidas = (pedidos) => new Set(pedidos.map((p) => p.conta));

const hora = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const diaEHora = (ms) =>
  new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');

const verbo = (ordem, grupo) => {
  if (grupo === 'tesouro') return 'aplicar';
  if (grupo === 'tesouro-resgate') return 'resgatar';
  return ordem.operacao === 'V' ? 'vender' : 'comprar';
};

// "1193" → 1193, "123,45678910" → 123.4567891: como o e-mail escreve a quantidade (sem milhar).
const numeroDoEmail = (texto) => {
  const t = String(texto ?? '').trim();
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * A quantidade de cada ativo **no e-mail que saiu** — o que o cliente aprovou (pedido do operador em
 * 21/10/2026: "ter também a quantidade de cotas que foi auditada, para executar com base nas cotas").
 * É o `Quantidade:` do bloco de cada `Ativo:` (o e-mail por grupo e a auditoria de venda), ou a coluna
 * `Qtd. Total` do E-mail em tabela. Na compra de fundo em R$, são as cotas da conversão, com o ROA
 * escolhido no Copiar; na venda do total, a posição lida na boleta. O bloco com `Valor:` não tem cotas.
 *
 * @param {string} texto  o e-mail, como saiu
 * @returns {Map<string, number>} pelo ativo, sem acento e em maiúsculas
 */
export const quantidadesDoEmail = (texto) => {
  const mapa = new Map();
  const linhas = String(texto ?? '').split(/\r?\n/);
  linhas.forEach((linha, i) => {
    const ativo = /^Ativo:\s*(.+?);?\s*$/.exec(linha.trim());
    const quantidade = ativo && /^Quantidade:\s*([\d.,]+);?\s*$/.exec((linhas[i + 1] ?? '').trim());
    const n = quantidade ? numeroDoEmail(quantidade[1]) : null;
    if (n !== null) mapa.set(normalizar(ativo[1]), n);
  });
  // O E-mail em tabela: a linha de cabeçalho com Ativo e Qtd. Total, e as linhas embaixo dela.
  linhas.forEach((linha, i) => {
    const colunas = linha.split('\t').map((c) => c.trim());
    const iAtivo = colunas.indexOf('Ativo');
    const iQuantidade = colunas.findIndex((c) => c === 'Qtd. Total' || c === 'Quantidade');
    if (iAtivo < 0 || iQuantidade < 0) return;
    for (const abaixo of linhas.slice(i + 1)) {
      const celulas = abaixo.split('\t').map((c) => c.trim());
      if (celulas.length <= Math.max(iAtivo, iQuantidade)) break;
      const n = numeroDoEmail(celulas[iQuantidade]);
      if (n !== null && celulas[iAtivo]) mapa.set(normalizar(celulas[iAtivo]), n);
    }
  });
  return mapa;
};

/** A quantidade da ordem como o e-mail aprovado a escreveu; sem ela no e-mail, a da própria ordem. */
export const quantidadeAprovada = (pedido, ordem) => quantidadesDoEmail(pedido.texto).get(normalizar(ordem.ativo)) ?? ordem.quantidade ?? null;

// Com o espaço comum depois do R$ (o toLocaleString põe o não separável): a ficha é copiada e colada.
const reais = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ');
const numeroNaTela = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 8 });

/** O estoque da ordem de fundo: o que o pedido disse, e o Estoque XP sem nada dito. */
export const estoqueDaOrdem = (pedido, ordem) =>
  pedido.grupo.startsWith('fundos') ? (ordem.estoque === 'clientes' ? 'Estoque clientes' : 'Estoque XP') : null;

/**
 * O quanto de cada ordem, para executar: as cotas do e-mail aprovado (ou a quantidade da bolsa) em
 * primeiro lugar, e o que o pedido disse — o valor em R$, o total da posição — ao lado.
 *
 * @returns {{principal: string, detalhes: string[]}}
 */
export const quantoParaExecutar = (pedido, ordem) => {
  const fundo = pedido.grupo.startsWith('fundos');
  const quantidade = quantidadeAprovada(pedido, ordem);
  const detalhes = [];
  if (ordem.financeiro && !ordem.quantidade && quantidade !== null) detalhes.push(`pedido ${reais(ordem.financeiro)}`);
  if (ordem.total && quantidade !== null) detalhes.push('o total da posição');
  if (quantidade !== null) return { principal: `${numeroNaTela(quantidade)}${fundo ? ' cotas' : ''}`, detalhes };
  if (ordem.total) return { principal: 'o total da posição', detalhes };
  if (ordem.financeiro) return { principal: reais(ordem.financeiro), detalhes: fundo ? ['sem as cotas no e-mail'] : [] };
  return { principal: '', detalhes };
};

/**
 * A ficha para executar no Hub: a conta e o cliente, o que fazer com cada ativo e o prazo que vale.
 * Sai do que o e-mail aprovado pediu — as cotas são as dele —, e nada é refeito nem recalculado aqui.
 */
export const fichaDeExecucao = (pedido, agora = Date.now()) => {
  const cabeca = `EXECUTAR · conta ${pedido.conta}${pedido.cliente?.nome ? ` · ${pedido.cliente.nome}` : ''}`;
  const aprovado = [...pedido.historico].reverse().find((h) => h.estado === 'aprovado');
  const sub = `${NOMES_DOS_GRUPOS[pedido.grupo] ?? pedido.grupo}${aprovado ? ` · aprovado às ${hora(aprovado.em)}` : ''}`;
  const linhas = pedido.ordens.map((o) => {
    const { principal, detalhes } = quantoParaExecutar(pedido, o);
    const partes = [`${verbo(o, pedido.grupo)} ${principal}`, estoqueDaOrdem(pedido, o), pedido.grupo === 'bolsa' ? (o.preco ?? 'A mercado') : null, ...detalhes];
    return `- ${o.ativo}: ${partes.filter(Boolean).join(' · ')}`;
  });
  const prazo = prazoMaisUrgente(pedido, agora);
  const rodape = prazo ? `Prazo: ${prazo.rotulo} ${diaEHora(prazo.ate)}` : null;
  return [cabeca, sub, ...linhas, rodape].filter(Boolean).join('\n');
};

/**
 * A boleta do Hub para executar a ordem, pela rota do próprio Hub — a conta vai no caminho, como o Hub
 * a escreve, e nunca num parâmetro. Só fundo do secundário (com o id do fundo) e o Tesouro.
 */
export const linkDaBoleta = (ordem, conta, grupo) => {
  if (grupo?.startsWith('fundos') && ordem.fundoId) {
    return `https://hub.xpi.com.br/new/fundos-de-investimento#/secundario/${ordem.operacao === 'V' ? 'vender' : 'comprar'}/${ordem.fundoId}/${conta}`;
  }
  if (grupo === 'tesouro') return 'https://hub.xpi.com.br/new/renda-fixa/#/produtos/tesouro-direto';
  if (grupo === 'tesouro-resgate') return 'https://hub.xpi.com.br/new/renda-fixa/#/posicoes/cliente/tesouro-direto';
  return null;
};

/** O resumo do dia, para o fim do expediente: quantos em cada estado, e o que ficou pendente. */
export const resumoDoDia = (pedidos, dia) => {
  const doDia = pedidos.filter((p) => p.dia === dia);
  const [ano, mes, d] = dia.split('-');
  if (!doDia.length) return `${d}/${mes}/${ano}: nenhum pedido na Fila.`;
  const conta = (estado) => doDia.filter((p) => p.estado === estado).length;
  const partes = [
    [conta('executado'), 'executado', 'executados'],
    [conta('aprovado'), 'aprovado a executar', 'aprovados a executar'],
    [conta('respondeu'), 'respondido, a conferir', 'respondidos, a conferir'],
    [conta('enviado'), 'aguardando o cliente', 'aguardando o cliente'],
    [conta('cancelado'), 'cancelado', 'cancelados']
  ]
    .filter(([n]) => n > 0)
    .map(([n, um, varios]) => `${n} ${n === 1 ? um : varios}`);
  const pendentes = doDia
    .filter((p) => p.estado !== 'executado' && p.estado !== 'cancelado')
    .map((p) => `- conta ${p.conta}${p.cliente?.nome ? ` (${p.cliente.nome})` : ''}: ${NOMES_DOS_GRUPOS[p.grupo]} — ${p.ordens.map((o) => o.ativo).join(', ')} · ${p.estado === 'aprovado' ? 'aprovado, a executar' : p.estado === 'respondeu' ? 'respondeu' : `enviado às ${hora(p.criadoEm)}`}`);
  return [`${d}/${mes}/${ano}: ${doDia.length} ${doDia.length === 1 ? 'pedido' : 'pedidos'} — ${partes.join(', ')}.`, ...(pendentes.length ? ['', 'Pendentes:', ...pendentes] : [])].join('\n');
};

/**
 * Os cartões de um dia, como a Fila os mostra. Hoje, também os que ficaram abertos nos últimos 7 dias
 * (aguardando o cliente, respondidos, aprovados): o e-mail das 17h tem resposta na manhã seguinte, e
 * o que não foi executado ontem continua pendente hoje.
 */
export const DIAS_ABERTOS = 7;
const ABERTOS = new Set(['enviado', 'respondeu', 'aprovado']);
export const pedidosDaVista = (todos, dia, agora = Date.now()) => {
  if (dia !== diaDe(agora)) return todos.filter((p) => p.dia === dia);
  const limite = diaDe(agora - DIAS_ABERTOS * 86400000);
  return todos.filter((p) => p.dia === dia || (p.dia < dia && p.dia >= limite && ABERTOS.has(p.estado)));
};

/** Os cartões que já passaram do tempo de guarda (90 dias). */
export const DIAS_DE_GUARDA = 90;
export const vencidosDaGuarda = (pedidos, agora = Date.now()) => {
  const limite = diaDe(agora - DIAS_DE_GUARDA * 86400000);
  return pedidos.filter((p) => p.dia < limite);
};
