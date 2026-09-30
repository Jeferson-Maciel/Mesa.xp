/**
 * Entrada em cena só quando a vista muda.
 *
 * Calendário e Operacional redesenham a tela a cada atualização ao vivo — basta um colega salvar.
 * Se as animações de entrada (linhas em sequência, selos que estalam, barras que crescem)
 * rodassem a cada redesenho, a tela piscaria o dia inteiro. Por isso elas ficam presas à classe
 * `em-cena`, que este controle põe no elemento só quando a chave da vista muda — outra semana,
 * outro post, a primeira carga — e tira logo depois.
 *
 * @param {HTMLElement} elemento onde a classe `em-cena` é posta
 * @param {number} [duracao] quanto tempo ela fica, em ms: o bastante para a animação mais longa
 * @returns {(chave: string) => void} chame a cada render, com a chave da vista
 */
export const criarCena = (elemento, duracao = 1600) => {
  let ultima = null;
  let fim = null;
  return (chave) => {
    if (chave === ultima) return;
    ultima = chave;
    elemento.classList.remove('em-cena');
    void elemento.offsetWidth; // recomeça as animações se a classe ainda estava lá
    elemento.classList.add('em-cena');
    clearTimeout(fim);
    fim = setTimeout(() => elemento.classList.remove('em-cena'), duracao);
  };
};
