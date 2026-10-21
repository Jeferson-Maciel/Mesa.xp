import { chaveDoDia } from '../../comum/dia.js';
import { quandoHouver, registrarServico, servico } from '../../comum/servicos.js';
import { criarCena } from '../../ui/cena.js';
import { diaAnteriorComFoto, filtrarPrateleira, fotoDaPrateleira, guardarFoto, linhasDaPrateleira, mudancasNaPrateleira, ordenarPrateleira, semMudanca } from './regras.js';
import { htmlMudancas, htmlTabela } from './render.js';
import './fundos.css';

/**
 * A Prateleira de fundos (Alt+3, a pedra peridoto): os fundos do secundário que o robô traz do Hub,
 * numa tabela que ordena e filtra, e o que mudou desde o último dia visto (as regras em `regras.js`).
 *
 * A captura é a mesma que o Ordens usa para converter R$ em cotas: o Ordens a guarda e a oferece pelo
 * serviço `prateleira` (`atual`, `aoMudar`, `atualizar`), e esta aba não o importa. A foto de cada dia
 * fica no `localStorage` — é dado de mercado, sem cliente —, tirada assim que a captura chega, com a
 * aba aberta ou não (`iniciarFotosDaPrateleira`, com a página).
 */

const CHAVE_FOTOS = 'mesa_prateleira_fotos';

const lerFotos = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_FOTOS) || '{}');
  } catch {
    return {};
  }
};

const diaDaCaptura = (estoque) => chaveDoDia(estoque.exportadaEm);

const tirarFoto = (estoque) => {
  if (!estoque?.fundos?.length || estoque.origem !== 'hub') return;
  try {
    localStorage.setItem(CHAVE_FOTOS, JSON.stringify(guardarFoto(lerFotos(), diaDaCaptura(estoque), fotoDaPrateleira(linhasDaPrateleira(estoque)))));
  } catch {
    // Sem espaço ou sem localStorage: a tabela segue, só sem o "o que mudou".
  }
};

/** A foto de cada captura, com a página: a aba Fundos pode nunca ter sido aberta no dia. */
export const iniciarFotosDaPrateleira = () =>
  quandoHouver('prateleira', (prateleira) => {
    tirarFoto(prateleira.atual());
    prateleira.aoMudar(() => tirarFoto(prateleira.atual()));
  });

/** @param {HTMLElement} secao a seção `#modulo-fundos` */
export const iniciarFundos = (secao) => {
  secao.innerHTML = MARCACAO;
  const el = (nome) => secao.querySelector(`[data-fu="${nome}"]`);
  const encenar = criarCena(secao.querySelector('.fu'));
  const estado = { campo: 'desagio', sentido: 'desc', termo: '', comEstoque: false, estoqueClientes: false };

  function render() {
    const estoque = servico('prateleira')?.atual() ?? null;
    const todas = linhasDaPrateleira(estoque);
    const linhas = ordenarPrateleira(filtrarPrateleira(todas, estado), estado.campo, estado.sentido);
    el('tabela').innerHTML = htmlTabela(linhas, { campo: estado.campo, sentido: estado.sentido, total: todas.length });
    // A entrada na primeira carga e quando chega outra Prateleira, não a cada letra ou ordenação.
    encenar(`${estoque?.origem ?? 'nenhuma'}|${estoque?.exportadaEm ?? ''}|${todas.length}`);
    el('vazio').hidden = todas.length > 0;
    el('mudancas-caixa').hidden = !todas.length || estoque?.origem !== 'hub';

    if (estoque) {
      const quando = new Date(estoque.exportadaEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
      el('origem').textContent = `${todas.length} fundos · ${estoque.origem === 'hub' ? 'captura do Hub' : 'planilha'} de ${quando}${linhas.length !== todas.length ? ` · ${linhas.length} no filtro` : ''}`;
    } else el('origem').textContent = 'sem a prateleira ainda';

    if (estoque?.origem === 'hub' && todas.length) {
      const fotos = lerFotos();
      const dia = diaDaCaptura(estoque);
      const anterior = diaAnteriorComFoto(fotos, dia);
      const mudancas = anterior ? mudancasNaPrateleira(fotos[anterior], fotoDaPrateleira(todas)) : null;
      el('mudancas').innerHTML = htmlMudancas(mudancas, anterior, mudancas ? semMudanca(mudancas) : true);
    }
    const prateleira = servico('prateleira');
    el('atualizar').disabled = !prateleira;
  }

  el('tabela').addEventListener('click', (e) => {
    const botao = e.target.closest('[data-ordenar]');
    if (!botao) return;
    const campo = botao.dataset.ordenar;
    estado.sentido = estado.campo === campo ? (estado.sentido === 'asc' ? 'desc' : 'asc') : campo === 'nome' ? 'asc' : 'desc';
    estado.campo = campo;
    render();
  });
  el('busca').addEventListener('input', (e) => {
    estado.termo = e.target.value;
    render();
  });
  for (const filtro of ['comEstoque', 'estoqueClientes']) {
    el(filtro).addEventListener('change', (e) => {
      estado[filtro] = e.target.checked;
      render();
    });
  }
  el('atualizar').addEventListener('click', () => servico('prateleira')?.atualizar());

  // A busca da Mesa (Ctrl+K) abre a aba já filtrada pelo fundo.
  registrarServico('fundos.mostrar', (termo) => {
    estado.termo = termo;
    el('busca').value = termo;
    render();
  });

  quandoHouver('prateleira', (prateleira) => {
    prateleira.aoMudar(render);
    render();
  });
  render();
};

const MARCACAO = `
<div class="fu">
  <section class="panel fu-topo">
    <div class="fu-titulo">
      <h2 class="panel-title">Prateleira de fundos</h2>
      <span class="meta-counter" data-fu="origem"></span>
    </div>
    <div class="fu-ferramentas">
      <input type="search" class="fu-busca" data-fu="busca" placeholder="Buscar fundo ou ticker" aria-label="Buscar fundo" />
      <label class="fu-filtro"><input type="checkbox" data-fu="comEstoque" /> Com estoque XP</label>
      <label class="fu-filtro"><input type="checkbox" data-fu="estoqueClientes" /> Estoque clientes aberto</label>
      <button type="button" class="copy-btn btn-primario" data-fu="atualizar" title="Pede ao robô uma captura nova da Prateleira do Hub">Atualizar pelo robô</button>
    </div>
  </section>

  <section class="panel fu-vazio-painel" data-fu="vazio">
    <div class="empty-state">
      <p>A prateleira ainda não chegou.</p>
      <span>Com o robô do Hub, "Atualizar pelo robô" a traz; sem ele, carregue os fundos no Ordens (Secundário › Sem o robô).</span>
    </div>
  </section>

  <section class="panel fu-mudancas-caixa" data-fu="mudancas-caixa" hidden>
    <h2 class="panel-title">O que mudou</h2>
    <div data-fu="mudancas"></div>
  </section>

  <div data-fu="tabela"></div>

  <p class="fu-nota">Os fundos do secundário como o Hub os mostra na Prateleira: a mesma captura que o Ordens usa para converter R$ em cotas. Dado de mercado, sem cliente; a foto de cada dia fica neste navegador, para o "o que mudou".</p>
</div>`;

