/**
 * A inscrição no Realtime do Supabase, a mesma para Calendário e Operacional.
 *
 * O servidor responde em dois tempos, como foi medido contra o projeto da mesa em 30/09/2026:
 * primeiro o status SUBSCRIBED; uns 150 ms depois, o aviso de sistema "Subscribed to PostgreSQL".
 * Só a partir desse aviso as mudanças do banco começam a chegar. Por isso:
 *
 *   - SUBSCRIBED vira CONECTANDO, não "ao vivo";
 *   - o aviso de sistema vira AO_VIVO, e é nele que a tela recarrega uma vez — para pegar o que
 *     mudou entre a carga inicial e a inscrição ficar pronta, que nenhum evento vai trazer;
 *   - canal que cai, expira ou é recusado vira ERRO.
 *
 * O supabase-js reconecta sozinho; cada nova inscrição pronta traz outro AO_VIVO e outra recarga.
 *
 * @param {object} cliente o cliente do supabase-js (ou um fake com channel/removeChannel)
 * @param {string} nome o nome do canal
 * @param {string[]} tabelas as tabelas do schema public a escutar
 * @param {() => void} aoMudar chamado a cada mudança em qualquer das tabelas
 * @param {(status: 'CONECTANDO' | 'AO_VIVO' | 'ERRO', erro?: unknown) => void} aoStatus
 * @returns {() => void} cancela a inscrição
 */
export const assinarTabelas = (cliente, nome, tabelas, aoMudar, aoStatus) => {
  const canal = cliente.channel(nome);
  for (const table of tabelas) canal.on('postgres_changes', { event: '*', schema: 'public', table }, aoMudar);

  canal.on('system', {}, (aviso) => {
    if (aviso?.extension !== 'postgres_changes') return;
    if (aviso.status === 'ok') aoStatus?.('AO_VIVO');
    else aoStatus?.('ERRO', aviso);
  });

  canal.subscribe((status, erro) => {
    if (status === 'SUBSCRIBED') aoStatus?.('CONECTANDO');
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') aoStatus?.('ERRO', erro);
  });

  return () => {
    cliente.removeChannel(canal);
  };
};
