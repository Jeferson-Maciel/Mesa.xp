import { fontesDeBusca } from '../comum/busca.js';
import { esc } from '../ui/html.js';
import { abrirJanela } from '../ui/janela.js';

/**
 * A busca da Mesa inteira: Ctrl+K de qualquer aba (ou o botão do topo) abre a janela, e cada fonte
 * registrada em `comum/busca.js` responde ao que se digita. As setas escolhem, Enter abre, Esc fecha.
 * A janela é a mesma para todas as abas; o que cada resultado faz ao abrir é da fonte dele.
 */
export const ligarBusca = () => {
  const janela = document.getElementById('busca');
  const campo = document.getElementById('busca-termo');
  const lista = document.getElementById('busca-resultados');
  if (!janela || !campo || !lista) return;

  let resultados = [];
  let escolhido = 0;
  let rodada = 0;

  const mostrar = (grupos) => {
    resultados = grupos.flatMap((g) => g.itens);
    escolhido = 0;
    if (!resultados.length) {
      lista.innerHTML = `<p class="busca-vazio">${campo.value.trim() ? 'Nada encontrado.' : 'Digite para buscar nos modelos, nas anotações, na Fila e no histórico.'}</p>`;
      return;
    }
    let i = 0;
    lista.innerHTML = grupos
      .filter((g) => g.itens.length)
      .map(
        (g) => `
        <div class="busca-grupo" role="group" aria-label="${esc(g.nome)}">
          <span class="busca-grupo-nome">${esc(g.nome)}</span>
          ${g.itens
            .map(
              (item) => `<button type="button" class="busca-item" role="option" data-i="${i++}">
                <span class="busca-titulo">${esc(item.titulo)}</span>
                ${item.detalhe ? `<span class="busca-detalhe">${esc(item.detalhe)}</span>` : ''}
              </button>`
            )
            .join('')}
        </div>`
      )
      .join('');
    marcar();
  };

  const marcar = () => {
    for (const b of lista.querySelectorAll('.busca-item')) {
      const ativo = Number(b.dataset.i) === escolhido;
      b.classList.toggle('ativo', ativo);
      b.setAttribute('aria-selected', String(ativo));
      if (ativo) b.scrollIntoView({ block: 'nearest' });
    }
  };

  const buscar = async () => {
    const termo = campo.value;
    const minha = ++rodada;
    const grupos = await Promise.all(
      fontesDeBusca().map(async (fonte) => {
        try {
          return { nome: fonte.nome, itens: (await fonte.buscar(termo)) ?? [] };
        } catch {
          return { nome: fonte.nome, itens: [] };
        }
      })
    );
    if (minha === rodada) mostrar(grupos);
  };

  const abrir = (i) => {
    const item = resultados[i];
    if (!item) return;
    janela.close();
    item.abrir();
  };

  const abrirBusca = (origem = null) => {
    if (janela.open) return campo.select();
    campo.value = '';
    abrirJanela(janela, origem);
    campo.focus();
    buscar();
  };

  campo.addEventListener('input', buscar);
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!resultados.length) return;
      escolhido = (escolhido + (e.key === 'ArrowDown' ? 1 : -1) + resultados.length) % resultados.length;
      marcar();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      abrir(escolhido);
    }
  });
  lista.addEventListener('click', (e) => {
    const item = e.target.closest('.busca-item');
    if (item) abrir(Number(item.dataset.i));
  });
  janela.addEventListener('click', (e) => {
    if (e.target === janela) janela.close();
  });

  document.getElementById('btn-busca')?.addEventListener('click', (e) => abrirBusca(e.currentTarget));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      abrirBusca();
    }
  });
};
