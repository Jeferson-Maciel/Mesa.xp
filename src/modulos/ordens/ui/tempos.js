/**
 * O relatório de tempos do robô do Hub: o que a Mesa e o robô fizeram numa colagem, com a hora, numa
 * linha do tempo só, e um resumo no topo. Serve para achar onde vão os segundos de um pedido com
 * vários fundos — o operador copia e manda.
 *
 * Sem nada do cliente: nomes de fundo, tempos e os caminhos das chamadas do Hub. Número longo, como
 * uma conta num caminho, sai trocado por `<n>` — no robô e de novo aqui, por garantia.
 *
 * Os dois lados anotam com `Date.now()`: a Mesa e a aba do Hub rodam no mesmo computador, no mesmo
 * relógio.
 */

/** @typedef {{em: number, passo: string, [extra: string]: unknown}} Passo */

const segundos = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
const semNumeroLongo = (texto) => String(texto).replace(/\d{5,}/g, '<n>');
const emLista = (nomes) => (nomes.length < 2 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`);

const ONDE = { Prateleira: 'na Prateleira', boleta: 'na boleta', 'outra página': 'em outra página' };

const descrever = (quem, p, nome) => {
  if (quem === 'Mesa') {
    switch (p.passo) {
      case 'colou':
        return `Mesa: colou o pedido (${p.fundos} fundo(s) com compra)`;
      case 'atualizou':
        return 'Mesa: clicou em Atualizar cotações';
      case 'pediu os preços':
        return `Mesa: pediu o preço exato de ${emLista((p.fundoIds ?? []).map(nome))}`;
      case 'dispensou o preço':
        return `Mesa: dispensou a boleta de ${nome(p.fundoId)} — o preço exato não muda as cotas`;
      case 'recebeu o preço':
        return `Mesa: recebeu o preço exato de ${nome(p.fundoId)}`;
      case 'não recebeu o preço':
        return `Mesa: não recebeu o preço exato de ${nome(p.fundoId)} (${p.motivo})`;
      default:
        return `Mesa: ${p.passo}`;
    }
  }

  switch (p.passo) {
    case 'chamada':
      return `${p.fase === 'volta' ? 'Hub respondeu' : 'Hub chamou'} ${p.caminho}`;
    case 'pedido recebido':
      return `Robô: recebeu o pedido (${p.tipo})`;
    case 'tarefa começou': {
      const detalhes = [p.tipo];
      if (p.escondida) detalhes.push('aba escondida');
      if (p.onde) detalhes.push(ONDE[p.onde] ?? p.onde);
      if (p.botao !== undefined) detalhes.push(p.botao ? 'com o botão Atualizar' : 'sem o botão Atualizar');
      return `Robô: começou a tarefa (${detalhes.join('; ')})`;
    }
    case 'a lista veio sem clique':
      return 'Robô: a lista chegou sozinha, sem clicar em Atualizar';
    case 'abriu a boleta':
      return `Robô: abriu a boleta de ${nome(p.fundoId)}${p.direto ? ', direto da anterior' : ''}`;
    case 'a troca direta não trouxe o pre-check':
      return `Robô: indo direto de uma boleta para a outra, o pre-check de ${nome(p.fundoId)} não veio — vai pela Prateleira`;
    case 'pre-check chegou':
      return `Robô: o pre-check de ${nome(p.fundoId)} chegou`;
    case 'pre-check não veio':
      return `Robô: o pre-check de ${nome(p.fundoId)} não veio`;
    default:
      return `Robô: ${p.passo}`;
  }
};

/**
 * @param {{inicio: number, versao: string|null, nomes: Record<string, string>, mesa: Passo[], robo: Passo[]}} rodada
 * @returns {string}
 */
export const formatarTempos = ({ inicio, versao, nomes = {}, mesa = [], robo = [] }) => {
  const nome = (fundoId) => nomes[fundoId] ?? `fundo ${String(fundoId).slice(0, 8)}`;
  const daMesa = (passo) => mesa.find((p) => p.passo === passo);

  // O resumo: o total, a cotação e o que cada preço acrescentou à espera — os preços vêm um atrás
  // do outro, então cada um conta do anterior (ou do pedido, o primeiro).
  const fim = Math.max(inicio, ...mesa.map((p) => p.em));
  const resumo = [`Total: ${segundos(fim - inicio)}`];

  const pediuCotacao = daMesa('pediu a cotação');
  const recebeuCotacao = daMesa('recebeu a cotação');
  if (pediuCotacao && recebeuCotacao) resumo.push(`Cotação: ${segundos(recebeuCotacao.em - pediuCotacao.em)}`);

  let desde = daMesa('pediu os preços')?.em;
  for (const p of mesa) {
    if (p.passo === 'dispensou o preço') resumo.push(`Preço exato de ${nome(p.fundoId)}: dispensado, não muda as cotas`);
    if ((p.passo === 'recebeu o preço' || p.passo === 'não recebeu o preço') && desde !== undefined) {
      const falha = p.passo === 'não recebeu o preço' ? ` (falhou: ${p.motivo})` : '';
      resumo.push(`Preço exato de ${nome(p.fundoId)}: ${segundos(p.em - desde)}${falha}`);
      desde = p.em;
    }
  }

  const linhas = [
    ...mesa.map((p) => ({ ...p, quem: 'Mesa' })),
    ...robo.map((p) => ({ ...p, quem: 'Robô' }))
  ]
    .filter((p) => p.em >= inicio)
    .sort((a, b) => a.em - b.em)
    .map((p) => `+${segundos(p.em - inicio)}  ${descrever(p.quem, p, nome)}`);

  const quando = new Date(inicio).toLocaleString('pt-BR');
  return semNumeroLongo(
    [`Tempos do robô do Hub · ${quando} · robô ${versao ?? '?'}`, '', ...resumo, '', 'Linha do tempo:', ...linhas].join('\n')
  );
};
