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
  const duracao = erro ? DURACAO.erro : DURACAO.info;
  const toast = document.createElement('div');
  toast.className = erro ? 'toast erro' : 'toast';
  toast.setAttribute('role', erro ? 'alert' : 'status');
  // A linha que encolhe no pé do aviso mostra quanto tempo ele ainda fica (base.css).
  toast.style.setProperty('--duracao', `${duracao}ms`);
  const icone = document.createElement('span');
  icone.className = 'toast-icone';
  icone.setAttribute('aria-hidden', 'true');
  const texto = document.createElement('span');
  texto.textContent = mensagem;
  toast.append(icone, texto);
  lista.appendChild(toast);

  // Sai deslizando; a remoção espera a animação, ou 400 ms se ela não vier (movimento reduzido).
  setTimeout(() => {
    toast.classList.add('saindo');
    let feito = false;
    const tirar = () => {
      if (feito) return;
      feito = true;
      toast.remove();
    };
    toast.addEventListener('animationend', tirar, { once: true });
    setTimeout(tirar, 400);
  }, duracao);
};
