import XLSX from '../../vendor/xlsx.full.min.js';
import { aviso } from '../../ui/avisos.js';
import { buscarReferencia, excluir, lerHistorico, novoRegistro, salvar } from './historico.js';
import { montarTexto, processRows } from './motor.js';
import { lerPlanilha } from './planilha.js';
import {
  DICAS_MERCADO,
  formatBytes,
  htmlBloqueados,
  htmlCartoes,
  htmlDetalhesFunil,
  htmlErro,
  htmlFunil,
  htmlFunilVazio,
  htmlHistorico,
  htmlLendo,
  htmlMensagem,
  htmlSemResultado,
  htmlVazio,
  numero
} from './render.js';
import { abrirJanela } from '../../ui/janela.js';
import './rendafixa.css';

/**
 * O RendaFixa Pro dentro da Mesa XP.
 *
 * Mesmo fluxo do app original — planilha → mercado → funil → cartões ou mensagem → copiar e
 * salvar —, com o visual do Ordens e sem os enfeites (aurora, vidro, contagem animada, holofote,
 * ondinha, voo até o histórico). A espera artificial da leitura também saiu: a planilha é lida em
 * milissegundos, e o resultado aparece assim que fica pronto.
 *
 * Inicia só quando a aba abre pela primeira vez. Atalhos de teclado e o arrastar-e-soltar valem só
 * com a aba à vista: soltar uma planilha na aba Ordens não a analisa escondido.
 *
 * Regra de negócio não mora aqui: fica em motor.js. A planilha é lida no navegador e não sai dele.
 *
 * @param {HTMLElement} secao a seção `#modulo-rendafixa`
 */
export const iniciarRendaFixa = (secao) => {
  secao.innerHTML = MARCACAO;

  const el = (nome) => secao.querySelector(`[data-rf="${nome}"]`);
  const ui = {
    raiz: secao.querySelector('.rf'),
    soltar: el('soltar'),
    entradaArquivo: el('entrada-arquivo'),
    arquivo: el('arquivo'),
    arquivoNome: el('arquivo-nome'),
    arquivoDetalhes: el('arquivo-detalhes'),
    trocar: el('trocar'),
    remover: el('remover'),
    mercado: el('mercado'),
    dicaMercado: el('dica-mercado'),
    funil: el('funil'),
    funilDetalhes: el('funil-detalhes'),
    subtitulo: el('subtitulo'),
    visao: el('visao'),
    salvar: el('salvar'),
    copiar: el('copiar'),
    corpo: el('corpo'),
    bloqueados: el('bloqueados'),
    historico: el('historico'),
    historicoContagem: el('historico-contagem'),
    atalhos: el('atalhos')
  };

  const EXTENSOES = /\.(xlsx|xls|csv)$/i;

  const estado = {
    rows: null, // matriz da planilha atual; reprocessada quando o mercado muda
    arquivo: null, // { nome, tamanho, aba }
    secundario: false,
    resultado: null, // saída de processRows
    texto: '', // mensagem final: é o que Copiar e Salvar usam
    salvo: false,
    visao: 'cartoes',
    leitura: 0 // incrementa a cada arquivo, para descartar leituras antigas
  };

  /* ── Planilha ─────────────────────────────────────────────────────────────────────── */

  const abrirSeletor = () => ui.entradaArquivo.click();

  async function lerArquivo(file) {
    if (!EXTENSOES.test(file.name)) {
      aviso('Formato não suportado. Use .xlsx, .xls ou .csv.', { tipo: 'erro' });
      return;
    }

    const leitura = ++estado.leitura;
    Object.assign(estado, { rows: null, resultado: null, texto: '', salvo: false, arquivo: { nome: file.name, tamanho: file.size, aba: '' } });
    mostrarArquivo();
    atualizarAcoes();
    ui.subtitulo.textContent = 'Lendo a planilha…';
    ui.bloqueados.innerHTML = '';
    ui.corpo.innerHTML = htmlLendo(file.name);

    try {
      const dados = await file.arrayBuffer();
      const { aba, rows } = lerPlanilha(dados, XLSX);
      if (leitura !== estado.leitura) return;
      estado.rows = rows;
      estado.arquivo.aba = aba;
      analisar();
    } catch (erro) {
      if (leitura !== estado.leitura) return;
      console.error(erro);
      Object.assign(estado, { rows: null, resultado: null, texto: '' });
      ui.subtitulo.textContent = 'Erro na leitura';
      ui.corpo.innerHTML = htmlErro('Não foi possível ler este arquivo', 'Confira se é uma planilha .xlsx, .xls ou .csv válida e tente de novo.');
      renderFunilVazio();
      atualizarAcoes();
      aviso('Não foi possível ler a planilha.', { tipo: 'erro' });
    }
  }

  function analisar() {
    if (!estado.rows) return;
    const resultado = processRows(estado.rows, estado.secundario);
    estado.resultado = resultado;
    estado.texto = montarTexto(resultado);
    estado.salvo = false;
    renderResultado();
    renderFunil();
    ui.bloqueados.innerHTML = htmlBloqueados(resultado);
    atualizarArquivo();
    atualizarAcoes();
  }

  function mostrarArquivo() {
    ui.soltar.hidden = true;
    ui.arquivo.hidden = false;
    ui.arquivoNome.textContent = estado.arquivo.nome;
    ui.arquivoNome.title = estado.arquivo.nome;
    ui.arquivoDetalhes.textContent = formatBytes(estado.arquivo.tamanho);
  }

  function atualizarArquivo() {
    if (!estado.arquivo || !estado.resultado) return;
    const partes = [formatBytes(estado.arquivo.tamanho), `${numero(estado.resultado.totais.lidos)} linhas`];
    if (estado.arquivo.aba) partes.push(`aba “${estado.arquivo.aba}”`);
    ui.arquivoDetalhes.textContent = partes.join(' · ');
  }

  function removerArquivo() {
    estado.leitura++;
    Object.assign(estado, { rows: null, arquivo: null, resultado: null, texto: '', salvo: false });
    ui.entradaArquivo.value = '';
    ui.arquivo.hidden = true;
    ui.soltar.hidden = false;
    ui.bloqueados.innerHTML = '';
    renderVazio();
    renderFunilVazio();
    atualizarAcoes();
  }

  function aplicarMercado(secundario, { reprocessar = true } = {}) {
    const mudou = estado.secundario !== secundario;
    estado.secundario = secundario;
    const valor = secundario ? 'secundario' : 'primario';
    for (const b of ui.mercado.querySelectorAll('[data-mercado]')) {
      const ativo = b.dataset.mercado === valor;
      b.classList.toggle('ativo', ativo);
      b.setAttribute('aria-checked', String(ativo));
    }
    ui.dicaMercado.textContent = DICAS_MERCADO[valor];
    if (reprocessar && mudou && estado.rows) analisar();
  }

  function aplicarVisao(visao) {
    estado.visao = visao;
    for (const b of ui.visao.querySelectorAll('[data-visao]')) {
      const ativo = b.dataset.visao === visao;
      b.classList.toggle('ativo', ativo);
      b.setAttribute('aria-selected', String(ativo));
    }
    if (estado.resultado) renderResultado();
  }

  function atualizarAcoes() {
    const temMensagem = Boolean(estado.texto);
    ui.copiar.disabled = !temMensagem;
    ui.salvar.disabled = !temMensagem || estado.salvo;
    ui.salvar.textContent = temMensagem && estado.salvo ? 'Salvo' : 'Salvar';
  }

  /* ── Resultado ────────────────────────────────────────────────────────────────────── */

  function renderVazio() {
    ui.subtitulo.textContent = 'Importe uma planilha para começar';
    ui.corpo.innerHTML = htmlVazio();
  }

  function renderResultado() {
    const r = estado.resultado;
    if (!r) return;
    const mercado = r.secundario ? 'mercado secundário' : 'emissão primária';
    const total = r.totais.exibidos;

    ui.subtitulo.textContent = total
      ? `${total} ${total === 1 ? 'oportunidade' : 'oportunidades'} · ${mercado} · ${estado.arquivo?.nome || ''}`
      : `Nenhuma oportunidade · ${mercado}`;

    if (!total) ui.corpo.innerHTML = htmlSemResultado(r);
    else if (estado.visao === 'mensagem') ui.corpo.innerHTML = htmlMensagem(estado.texto);
    else ui.corpo.innerHTML = htmlCartoes(r, buscarReferencia(lerHistorico(), r.secundario));
  }

  function renderFunilVazio() {
    ui.funil.innerHTML = htmlFunilVazio();
    ui.funilDetalhes.innerHTML = '';
  }

  function renderFunil() {
    const abertos = [...ui.funilDetalhes.querySelectorAll('details')].map((d) => d.open);
    ui.funil.innerHTML = htmlFunil(estado.resultado);
    ui.funilDetalhes.innerHTML = htmlDetalhesFunil(estado.resultado, abertos);
  }

  /* ── Copiar e salvar ──────────────────────────────────────────────────────────────── */

  async function copiarTexto(conteudo) {
    try {
      await navigator.clipboard.writeText(conteudo);
      return true;
    } catch {
      // Reserva para navegadores que bloqueiam a Clipboard API (ex.: arquivo aberto via file://)
      const area = document.createElement('textarea');
      area.value = conteudo;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.append(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      area.remove();
      return ok;
    }
  }

  let voltarRotulo = null;
  async function copiarMensagem() {
    if (!estado.texto) return;
    const ok = await copiarTexto(estado.texto);
    if (!ok) {
      aviso('Não foi possível copiar. Abra a visão Mensagem e selecione o texto.', { tipo: 'erro' });
      return;
    }
    ui.copiar.textContent = 'Copiada';
    ui.copiar.classList.add('copiado');
    clearTimeout(voltarRotulo);
    voltarRotulo = setTimeout(() => {
      ui.copiar.textContent = 'Copiar mensagem';
      ui.copiar.classList.remove('copiado');
    }, 1800);
    aviso('Mensagem copiada. É só colar no WhatsApp.');
  }

  function salvarAnalise() {
    if (!estado.texto || estado.salvo) return;
    const registro = novoRegistro({ resultado: estado.resultado, texto: estado.texto, arquivo: estado.arquivo?.nome });
    if (!salvar(registro)) {
      aviso('Não foi possível salvar: o armazenamento do navegador está bloqueado ou cheio.', { tipo: 'erro' });
      return;
    }
    estado.salvo = true;
    atualizarAcoes();
    renderHistorico();
    aviso('Análise salva no histórico.');
  }

  /* ── Histórico ────────────────────────────────────────────────────────────────────── */

  function renderHistorico() {
    const lista = lerHistorico();
    ui.historicoContagem.textContent = lista.length;
    ui.historico.innerHTML = htmlHistorico(lista);
  }

  function acaoHistorico(evento) {
    const botao = evento.target.closest('[data-acao]');
    if (!botao) return;
    const cartao = botao.closest('.rf-hist');
    const id = Number(cartao.dataset.id);
    const registro = lerHistorico().find((h) => h.id === id);
    if (!registro) return;

    switch (botao.dataset.acao) {
      case 'expandir': {
        const aberto = cartao.classList.toggle('aberto');
        botao.textContent = aberto ? 'Recolher' : 'Ver tudo';
        break;
      }
      case 'copiar':
        copiarTexto(registro.resultado).then((ok) =>
          aviso(ok ? 'Mensagem do histórico copiada.' : 'Não foi possível copiar.', { tipo: ok ? 'info' : 'erro' })
        );
        break;
      case 'excluir':
        // Primeiro clique arma a confirmação; o segundo exclui
        if (!botao.classList.contains('armado')) {
          botao.classList.add('armado');
          botao.textContent = 'Excluir?';
          clearTimeout(botao._timer);
          botao._timer = setTimeout(() => {
            botao.classList.remove('armado');
            botao.innerHTML = '&times;';
          }, 3000);
          return;
        }
        excluir(id);
        renderHistorico();
        aviso('Análise excluída.');
        break;
    }
  }

  /* ── Atalhos e arrastar ───────────────────────────────────────────────────────────── */

  function atalhos(e) {
    if (secao.hidden) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (document.querySelector('dialog[open]')) return;

    const acoes = {
      a: abrirSeletor,
      m: () => aplicarMercado(!estado.secundario),
      v: () => aplicarVisao(estado.visao === 'cartoes' ? 'mensagem' : 'cartoes'),
      c: () => !ui.copiar.disabled && copiarMensagem(),
      s: () => !ui.salvar.disabled && salvarAnalise(),
      t: () => document.getElementById('btn-tema')?.click(),
      '?': () => abrirJanela(ui.atalhos, el('abrir-atalhos'))
    };
    const acao = acoes[e.key.toLowerCase()];
    if (acao) {
      e.preventDefault();
      acao();
    }
  }

  function ligarArrastar() {
    let profundidade = 0;
    const temArquivos = (e) => !secao.hidden && Array.from(e.dataTransfer?.types || []).includes('Files');
    const encerrar = () => {
      profundidade = 0;
      ui.raiz.classList.remove('arrastando');
    };

    window.addEventListener('dragenter', (e) => {
      if (!temArquivos(e)) return;
      e.preventDefault();
      profundidade++;
      ui.raiz.classList.add('arrastando');
    });
    window.addEventListener('dragover', (e) => {
      if (!temArquivos(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('dragleave', (e) => {
      if (!temArquivos(e)) return;
      profundidade = Math.max(0, profundidade - 1);
      if (profundidade === 0) encerrar();
    });
    window.addEventListener('drop', (e) => {
      if (!temArquivos(e)) return;
      e.preventDefault();
      encerrar();
      const arquivo = e.dataTransfer.files[0];
      if (arquivo) lerArquivo(arquivo);
    });
  }

  /* ── Eventos ──────────────────────────────────────────────────────────────────────── */

  ui.soltar.addEventListener('click', abrirSeletor);
  ui.entradaArquivo.addEventListener('change', () => {
    const arquivo = ui.entradaArquivo.files[0];
    ui.entradaArquivo.value = '';
    if (arquivo) lerArquivo(arquivo);
  });
  ui.trocar.addEventListener('click', abrirSeletor);
  ui.remover.addEventListener('click', removerArquivo);

  ui.mercado.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-mercado]');
    if (botao) aplicarMercado(botao.dataset.mercado === 'secundario');
  });
  ui.mercado.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    aplicarMercado(e.key === 'ArrowRight');
    ui.mercado.querySelector('[aria-checked="true"]').focus();
  });
  ui.visao.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-visao]');
    if (botao) aplicarVisao(botao.dataset.visao);
  });
  ui.visao.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    aplicarVisao(e.key === 'ArrowRight' ? 'mensagem' : 'cartoes');
    ui.visao.querySelector('[aria-selected="true"]').focus();
  });

  ui.corpo.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-acao]');
    if (!botao) return;
    if (botao.dataset.acao === 'trocar-mercado') aplicarMercado(!estado.secundario);
    if (botao.dataset.acao === 'abrir') abrirSeletor();
  });
  ui.copiar.addEventListener('click', copiarMensagem);
  ui.salvar.addEventListener('click', salvarAnalise);
  ui.historico.addEventListener('click', acaoHistorico);

  el('abrir-atalhos').addEventListener('click', () => abrirJanela(ui.atalhos, el('abrir-atalhos')));
  ui.atalhos.addEventListener('click', (e) => {
    // Clique no fundo (fora da caixa) ou no botão de fechar.
    if (e.target === ui.atalhos || e.target.closest('[data-fechar]')) ui.atalhos.close();
  });

  document.addEventListener('keydown', atalhos);
  ligarArrastar();

  aplicarMercado(false, { reprocessar: false });
  aplicarVisao('cartoes');
  renderVazio();
  renderFunilVazio();
  renderHistorico();
  atualizarAcoes();
};

const MARCACAO = `
<div class="rf">
  <div class="rf-grade">
    <div class="rf-lateral">
      <section class="panel">
        <div class="panel-header-row">
          <h2 class="panel-title">Planilha</h2>
          <span class="meta-counter">exportação de renda fixa da XP</span>
        </div>

        <button type="button" class="rf-soltar" data-rf="soltar" title="Escolher planilha (A)">
          <strong>Arraste a planilha aqui</strong>
          <span>ou clique para escolher · .xlsx, .xls, .csv</span>
        </button>

        <div class="rf-arquivo" data-rf="arquivo" hidden>
          <div class="rf-arquivo-info">
            <strong data-rf="arquivo-nome"></strong>
            <span class="meta-counter" data-rf="arquivo-detalhes"></span>
          </div>
          <button type="button" class="copy-btn" data-rf="trocar" title="Trocar planilha (A)">Trocar</button>
          <button type="button" class="rf-excluir" data-rf="remover" aria-label="Remover planilha" title="Remover planilha">&times;</button>
        </div>

        <input type="file" accept=".xlsx,.xls,.csv" data-rf="entrada-arquivo" hidden />
        <p class="rf-nota">A planilha é lida neste navegador e não é enviada a servidor nenhum.</p>
      </section>

      <section class="panel">
        <div class="panel-header-row">
          <h2 class="panel-title">Mercado</h2>
          <span class="meta-counter">M alterna</span>
        </div>
        <div class="segmentado" role="radiogroup" aria-label="Mercado" data-rf="mercado">
          <button type="button" class="seg" role="radio" data-mercado="primario">Emissão primária</button>
          <button type="button" class="seg" role="radio" data-mercado="secundario">Mercado secundário</button>
        </div>
        <p class="rf-nota" data-rf="dica-mercado"></p>
      </section>

      <section class="panel">
        <div class="panel-header-row">
          <h2 class="panel-title">Funil da análise</h2>
        </div>
        <div class="rf-funil" data-rf="funil"></div>
        <div data-rf="funil-detalhes"></div>
      </section>
    </div>

    <section class="panel rf-resultado">
      <div class="rf-resultado-topo">
        <div class="rf-resultado-titulo">
          <h2 class="panel-title">Oportunidades do dia</h2>
          <span class="meta-counter" data-rf="subtitulo"></span>
        </div>
        <div class="rf-acoes">
          <div class="segmentado" role="tablist" aria-label="Visualização" data-rf="visao">
            <button type="button" class="seg" role="tab" data-visao="cartoes">Cartões</button>
            <button type="button" class="seg" role="tab" data-visao="mensagem">Mensagem</button>
          </div>
          <button type="button" class="copy-btn" data-rf="salvar" title="Salvar no histórico (S)">Salvar</button>
          <button type="button" class="copy-btn btn-primario" data-rf="copiar" title="Copiar mensagem (C)">Copiar mensagem</button>
        </div>
      </div>
      <div class="rf-corpo" data-rf="corpo" aria-live="polite"></div>
      <div data-rf="bloqueados"></div>
    </section>
  </div>

  <section class="panel rf-historico">
    <div class="panel-header-row">
      <h2 class="panel-title">Histórico <span class="counter-badge" data-rf="historico-contagem">0</span></h2>
      <button type="button" class="rf-link" data-rf="abrir-atalhos" title="Atalhos de teclado (?)">Atalhos</button>
    </div>
    <p class="rf-nota">Últimas 20 análises salvas neste navegador. As variações nos cartões comparam com a última análise salva antes de hoje.</p>
    <div class="rf-historico-lista" data-rf="historico"></div>
  </section>

  <dialog class="rf-atalhos" data-rf="atalhos" aria-labelledby="rf-atalhos-titulo">
    <div class="panel-header-row">
      <h2 class="panel-title" id="rf-atalhos-titulo">Atalhos do Renda Fixa</h2>
      <button type="button" class="icon-close-btn" data-fechar aria-label="Fechar">&times;</button>
    </div>
    <dl>
      <div><dt><kbd>A</kbd></dt><dd>Abrir planilha</dd></div>
      <div><dt><kbd>M</kbd></dt><dd>Alternar mercado primário / secundário</dd></div>
      <div><dt><kbd>V</kbd></dt><dd>Alternar cartões / mensagem</dd></div>
      <div><dt><kbd>C</kbd></dt><dd>Copiar mensagem</dd></div>
      <div><dt><kbd>S</kbd></dt><dd>Salvar no histórico</dd></div>
      <div><dt><kbd>T</kbd></dt><dd>Alternar tema claro / escuro</dd></div>
      <div><dt><kbd>?</kbd></dt><dd>Mostrar esta lista</dd></div>
    </dl>
    <p class="rf-nota">Também dá para soltar a planilha em qualquer lugar desta aba.</p>
  </dialog>
</div>`;
