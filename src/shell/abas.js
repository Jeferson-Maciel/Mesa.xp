/**
 * As três abas da Mesa XP: rota por hash, atalhos Alt+1/2/3 e início preguiçoso.
 *
 * A rota vive no hash (`#ordens`, `#rendafixa`, `#calendario`) porque o mesmo arquivo roda de dois
 * jeitos: no Netlify e aberto do disco (`file://`). Hash funciona igual nos dois, sem servidor, e
 * dá a cada ferramenta um link próprio para favoritar.
 *
 * Renda Fixa e Calendário só iniciam quando a aba abre pela primeira vez. O código já está no
 * arquivo — o build é um arquivo só, sem `import()` dinâmico —, mas o Calendário abre conexão com
 * o banco ao iniciar, e quem só gera ordens não tem por que conectar a nada.
 *
 * As seções escondidas ficam com `hidden`, e é por ele que cada módulo sabe se está à vista: os
 * atalhos de teclado de uma ferramenta só valem com a aba dela aberta.
 */

export const ABAS = ['ordens', 'rendafixa', 'calendario'];

export const ABA_PADRAO = 'ordens';

/** @returns {string} a aba do hash, ou a padrão para hash vazio ou desconhecido. */
export const abaDoHash = (hash) => {
  const id = String(hash ?? '')
    .replace(/^#\/?/, '')
    .toLowerCase();
  return ABAS.includes(id) ? id : ABA_PADRAO;
};

/**
 * Alt+1/2/3, na ordem da barra. Ctrl+Alt fica de fora: é assim que o AltGr chega no Windows.
 *
 * @param {{ altKey: boolean, ctrlKey: boolean, metaKey: boolean, shiftKey: boolean, code?: string }} tecla
 * @returns {string|null}
 */
export const abaDoAtalho = ({ altKey, ctrlKey, metaKey, shiftKey, code }) => {
  if (!altKey || ctrlKey || metaKey || shiftKey) return null;
  const numero = /^(?:Digit|Numpad)(\d)$/.exec(code ?? '');
  return numero ? (ABAS[Number(numero[1]) - 1] ?? null) : null;
};

/**
 * Liga as abas à tela.
 *
 * @param {object} opcoes
 * @param {Record<string, (secao: HTMLElement) => unknown>} opcoes.preguicosos
 *   o início de cada módulo que espera a aba abrir.
 * @param {(id: string, secao: HTMLElement, erro: unknown) => void} opcoes.aoFalhar
 *   chamado quando um módulo não consegue iniciar; os outros seguem funcionando.
 */
export const ligarAbas = ({ preguicosos, aoFalhar }) => {
  const iniciados = new Set();
  const secaoDe = (id) => document.getElementById(`modulo-${id}`);

  const iniciar = (id) => {
    if (iniciados.has(id) || !preguicosos[id]) return;
    iniciados.add(id);
    try {
      // Um início assíncrono que falha depois também cai em aoFalhar.
      Promise.resolve(preguicosos[id](secaoDe(id))).catch((erro) => aoFalhar(id, secaoDe(id), erro));
    } catch (erro) {
      aoFalhar(id, secaoDe(id), erro);
    }
  };

  const mostrar = (id) => {
    iniciar(id);

    for (const aba of ABAS) secaoDe(aba).hidden = aba !== id;

    // Trocar de aba pelo teclado deixaria o foco num campo agora escondido — e as teclas seguintes
    // iriam para ele, não para a aba à vista (o "m" do Renda Fixa cairia na caixa do Ordens).
    const foco = document.activeElement;
    if (foco && foco !== document.body && foco.closest('.modulo[hidden]')) foco.blur();

    for (const link of document.querySelectorAll('.aba')) {
      if (link.dataset.aba === id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }

    // Ações de um módulo que moram no topo (o Histórico do Ordens) só aparecem com ele.
    for (const el of document.querySelectorAll('[data-so-na-aba]')) el.hidden = el.dataset.soNaAba !== id;
  };

  window.addEventListener('hashchange', () => mostrar(abaDoHash(location.hash)));

  document.addEventListener('keydown', (e) => {
    const id = abaDoAtalho(e);
    if (!id) return;
    e.preventDefault();
    // Mostra já, sem esperar o hashchange: ele chega numa tarefa seguinte, e a próxima tecla,
    // digitada logo depois do Alt+2, iria para a aba anterior. O hashchange que vem depois só
    // repete a mesma aba, o que não tem efeito.
    mostrar(id);
    if (location.hash !== `#${id}`) location.hash = id;
  });

  mostrar(abaDoHash(location.hash));
};
