import { faixaDeHorarios } from '../comum/horarios.js';
import { esc } from '../ui/html.js';

/**
 * Os horários do mercado no topo, em qualquer aba: o que fecha primeiro entre os abertos, com quanto
 * falta (âmbar a meia hora ou menos), e, no clique, os quatro — o pregão da B3, o Estoque clientes,
 * o secundário da XP e o Tesouro (`comum/horarios.js`). Anda com o relógio, a cada 20 s.
 */
export const ligarRelogio = ({ agora = () => new Date() } = {}) => {
  const botao = document.getElementById('btn-relogio');
  const painel = document.getElementById('relogio-painel');
  if (!botao || !painel) return;

  const desenhar = () => {
    const { itens, proximo } = faixaDeHorarios(agora());
    const principal = proximo ?? itens[0];
    botao.dataset.situacao = proximo ? proximo.situacao : 'fechado';
    botao.querySelector('.relogio-nome').textContent = proximo ? proximo.nome : 'Mercado';
    botao.querySelector('.relogio-falta').textContent = proximo ? proximo.texto.split(' · ').pop().replace(/^leilão em /, '') : 'fechado';
    botao.title = `${principal.nome}: ${principal.texto}. Clique para ver os horários do dia.`;
    painel.innerHTML = `<ul class="relogio-itens">${itens
      .map((i) => `<li data-situacao="${i.situacao}"><span class="relogio-item-nome">${esc(i.nome)}</span><span class="relogio-item-texto">${esc(i.texto)}</span></li>`)
      .join('')}</ul>`;
  };

  const fechar = () => {
    painel.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
  };
  botao.addEventListener('click', () => {
    const abrir = painel.hidden;
    desenhar();
    painel.hidden = !abrir;
    botao.setAttribute('aria-expanded', String(abrir));
  });
  document.addEventListener('click', (e) => {
    if (!painel.hidden && !e.target.closest('#relogio')) fechar();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !painel.hidden) fechar();
  });

  desenhar();
  setInterval(desenhar, 20_000);
};
