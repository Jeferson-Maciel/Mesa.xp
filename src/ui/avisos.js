/**
 * Avisos de tela, divididos pelas ferramentas.
 *
 * Um aviso confirma o que aconteceu ("copiado", "salvo") ou conta um problema; nunca pede decisão.
 * O que precisa de decisão vira bloqueio (Ordens) ou fica visível na própria tela (Calendário sem
 * conexão), porque um aviso some sozinho em poucos segundos. A exceção é o **Desfazer** (`acao`):
 * depois de excluir ou resolver, o aviso oferece voltar atrás, como o Gmail e o Keep — é o que
 * deixa a ação ser de um clique, sem janela de "tem certeza?".
 *
 * Erro e aviso com ação ficam mais tempo: quem estava olhando para outro canto da tela ainda tem
 * tempo de ler e de clicar.
 */

const DURACAO = { info: 3200, erro: 6000, acao: 7000 };

/**
 * @param {string} mensagem
 * @param {{ tipo?: 'info' | 'erro', acao?: { rotulo: string, fazer: () => void } }} [opcoes]
 */
export const aviso = (mensagem, { tipo = 'info', acao = null } = {}) => {
  const lista = document.getElementById('toasts');
  if (!lista) return;

  const erro = tipo === 'erro';
  const duracao = acao ? DURACAO.acao : erro ? DURACAO.erro : DURACAO.info;
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

  let feito = false;
  const tirar = () => {
    if (feito) return;
    feito = true;
    toast.remove();
  };
  const sair = () => {
    toast.classList.add('saindo');
    toast.addEventListener('animationend', tirar, { once: true });
    setTimeout(tirar, 400); // movimento reduzido: sem animação, sai assim mesmo
  };

  if (acao) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'toast-acao';
    botao.textContent = acao.rotulo;
    botao.addEventListener('click', () => {
      acao.fazer();
      sair();
    });
    toast.classList.add('com-acao');
    toast.append(botao);
  }

  lista.appendChild(toast);
  setTimeout(sair, duracao);
};
