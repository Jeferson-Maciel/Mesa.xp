/**
 * Avisos de tela, divididos pelas três ferramentas.
 *
 * Um aviso só confirma o que aconteceu ("copiado", "salvo") ou conta um problema; nunca pede
 * decisão. O que precisa de decisão vira bloqueio (Ordens) ou fica visível na própria tela
 * (Calendário sem conexão), porque um aviso some sozinho em poucos segundos.
 *
 * Erro fica mais tempo e sai com a cor de erro: quem estava olhando para outro canto da tela
 * ainda tem tempo de ler.
 */

const DURACAO = { info: 3200, erro: 6000 };

/**
 * @param {string} mensagem
 * @param {{ tipo?: 'info' | 'erro' }} [opcoes]
 */
export const aviso = (mensagem, { tipo = 'info' } = {}) => {
  const lista = document.getElementById('toasts');
  if (!lista) return;

  const erro = tipo === 'erro';
  const toast = document.createElement('div');
  toast.className = erro ? 'toast erro' : 'toast';
  toast.setAttribute('role', erro ? 'alert' : 'status');
  toast.textContent = mensagem;
  lista.appendChild(toast);
  setTimeout(() => toast.remove(), erro ? DURACAO.erro : DURACAO.info);
};
