/**
 * Abre um `<dialog>` como modal, crescendo a partir do que o chamou.
 *
 * A janela nasce do ponto de origem — a célula do dia clicada, o botão "+ Novo tópico" — em vez de
 * aparecer do nada no meio da tela: o olho segue de onde ela veio e para onde volta. A animação
 * está em base.css; aqui só se grava o ponto, relativo à própria janela, em `--origem-x/y`.
 *
 * @param {HTMLDialogElement} dialogo
 * @param {Element | null} [origem] o elemento que abriu a janela; sem ele, cresce do centro.
 */
export const abrirJanela = (dialogo, origem = null) => {
  dialogo.showModal();
  if (!origem?.getBoundingClientRect) {
    dialogo.style.removeProperty('--origem-x');
    dialogo.style.removeProperty('--origem-y');
    return;
  }
  const alvo = origem.getBoundingClientRect();
  // offsetLeft/Top e não getBoundingClientRect: a janela já está encolhida pela animação, e a
  // caixa medida com o transform daria um ponto errado.
  dialogo.style.setProperty('--origem-x', `${alvo.left + alvo.width / 2 - dialogo.offsetLeft}px`);
  dialogo.style.setProperty('--origem-y', `${alvo.top + alvo.height / 2 - dialogo.offsetTop}px`);
};
