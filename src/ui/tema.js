/**
 * Alternância entre o modo claro e o escuro.
 *
 * O tema vive num atributo do `<html>`, e não numa classe do `<body>`, porque o script inline do
 * `index.html` precisa aplicá-lo antes da primeira pintura — sem isso a tela pisca no tema errado
 * a cada carregamento, que num aplicativo aberto o dia inteiro é um incômodo diário.
 *
 * **O escuro é o padrão**, e não a preferência do sistema: navegador novo abre no escuro, e a
 * escolha do operador passa a valer a partir do primeiro clique no botão. A preferência do
 * sistema fica de fora de propósito — a mesma pessoa pode ter o Windows no claro e ainda assim
 * querer esta ferramenta no escuro, já que é ela que fica aberta o expediente inteiro.
 *
 * A escolha é gravada por navegador, no `localStorage`. Ela não acompanha a pessoa de uma
 * máquina para outra, o que é o esperado: cada estação tem sua tela e sua iluminação.
 */

const CHAVE = 'xp_tema';

export const TEMAS = ['claro', 'escuro'];

export const TEMA_PADRAO = 'escuro';

const gravado = () => {
  try {
    const valor = localStorage.getItem(CHAVE);
    return TEMAS.includes(valor) ? valor : null;
  } catch {
    return null;
  }
};

/** @returns {'claro'|'escuro'} o tema gravado neste navegador, ou o padrão. */
export const temaAtual = () => gravado() ?? TEMA_PADRAO;

/** @returns {'claro'|'escuro'} o outro tema. */
export const oOutro = (tema) => (tema === 'claro' ? 'escuro' : 'claro');

export const aplicar = (tema) => {
  document.documentElement.dataset.tema = tema;
  document.documentElement.style.colorScheme = tema === 'claro' ? 'light' : 'dark';

  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // Sem localStorage o tema vale só nesta sessão, o que é aceitável.
  }
};

/**
 * Liga o botão de tema. Devolve o tema em vigor para quem quiser refletir na interface.
 *
 * @param {HTMLElement} botao
 */
export const ligarBotaoDeTema = (botao) => {
  const rotular = (tema) => {
    const proximo = oOutro(tema);
    botao.dataset.tema = tema;
    botao.setAttribute('aria-label', `Mudar para o modo ${proximo}`);
    botao.title = `Modo ${proximo}`;
  };

  const inicial = temaAtual();
  aplicar(inicial);
  rotular(inicial);

  botao.addEventListener('click', () => {
    const proximo = oOutro(document.documentElement.dataset.tema);
    const trocar = () => {
      aplicar(proximo);
      rotular(proximo);
    };

    // O tema novo se abre em círculo a partir do botão (base.css, View Transitions). Sem suporte,
    // ou com movimento reduzido pedido no sistema, troca na hora.
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (typeof document.startViewTransition !== 'function' || reduzido) return trocar();
    const caixa = botao.getBoundingClientRect();
    const x = caixa.left + caixa.width / 2;
    const y = caixa.top + caixa.height / 2;
    const raio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const estilo = document.documentElement.style;
    estilo.setProperty('--vt-x', `${x}px`);
    estilo.setProperty('--vt-y', `${y}px`);
    estilo.setProperty('--vt-r', `${raio}px`);
    document.startViewTransition(trocar);
  });

  return inicial;
};
