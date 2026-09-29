/**
 * Histórico e variações do dia do Renda Fixa.
 *
 * Mesma chave (`rendafixa_history`), mesmo limite (20) e mesmo formato de registro do RendaFixa
 * Pro. Registros antigos não têm `modo`, `arquivo` nem `itens`: são lidos com reserva.
 *
 * A variação (▲ 0,15 / ▼ 0,10) compara cada taxa com a da última análise salva ANTES de hoje no
 * mesmo mercado — salvar várias vezes no mesmo dia não zera a comparação.
 *
 * O armazenamento e o relógio chegam por parâmetro para os testes; na tela são o `localStorage`
 * e `new Date()`. O histórico guarda só a mensagem e os números: a planilha não é gravada.
 */

export const CHAVE_HISTORICO = 'rendafixa_history';

export const MAX_HISTORICO = 20;

const local = () => globalThis.localStorage;

export const lerHistorico = (armazenamento = local()) => {
  try {
    const historico = JSON.parse(armazenamento.getItem(CHAVE_HISTORICO) || '[]');
    return Array.isArray(historico) ? historico : [];
  } catch {
    return [];
  }
};

export const gravarHistorico = (historico, armazenamento = local()) => {
  try {
    armazenamento.setItem(CHAVE_HISTORICO, JSON.stringify(historico));
    return true;
  } catch {
    return false;
  }
};

/** @returns {boolean} false quando o armazenamento está bloqueado ou cheio. */
export const salvar = (registro, armazenamento = local()) =>
  gravarHistorico([registro, ...lerHistorico(armazenamento)].slice(0, MAX_HISTORICO), armazenamento);

export const excluir = (id, armazenamento = local()) =>
  gravarHistorico(lerHistorico(armazenamento).filter((h) => h.id !== id), armazenamento);

export const novoRegistro = ({ resultado, texto, arquivo }, agora = new Date()) => ({
  id: agora.getTime(),
  resultado: texto,
  total_ativos: resultado.totais.lidos,
  total_oportunidades: resultado.totais.exibidos,
  created_at: agora.toISOString(),
  modo: resultado.secundario ? 'secundario' : 'primario',
  arquivo: arquivo || '',
  // Forma compacta das taxas, para calcular as variações do dia seguinte
  itens: resultado.secoes.flatMap((s) =>
    s.itens.map((it) => ({ s: s.id, p: it.prazo, t: it.taxa, x: it.indexador, u: it.sub || '' }))
  )
});

// Registros antigos não têm "modo": deduz pelo título da mensagem
export const registroSecundario = (registro) => {
  if (registro.modo) return registro.modo === 'secundario';
  return String(registro.resultado || '').includes('(MERCADO SECUNDÁRIO)');
};

export const buscarReferencia = (historico, secundario, agora = new Date()) => {
  const inicioDeHoje = new Date(agora);
  inicioDeHoje.setHours(0, 0, 0, 0);
  return (
    historico.find(
      (h) => Array.isArray(h.itens) && registroSecundario(h) === secundario && new Date(h.created_at) < inicioDeHoje
    ) || null
  );
};

/**
 * Variação de uma taxa contra a referência. Só compara o que é comparável: mesma seção, prazo,
 * indexador e subtipo de isento — % do CDI e CDI + spread não se medem na mesma régua.
 *
 * @returns {{ diferenca: number, anterior: { t: number, x: string }, quando: string } | null}
 */
export const variacao = (item, secaoId, referencia) => {
  if (!referencia) return null;
  const anterior = referencia.itens.find(
    (x) => x.s === secaoId && x.p === item.prazo && x.x === item.indexador && x.u === (item.sub || '')
  );
  if (!anterior) return null;
  const diferenca = Math.round((item.taxa - anterior.t) * 100) / 100;
  if (Math.abs(diferenca) < 0.01) return null;
  return { diferenca, anterior, quando: referencia.created_at };
};
