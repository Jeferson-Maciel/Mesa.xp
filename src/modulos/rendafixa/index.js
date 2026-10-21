import XLSX from '../../vendor/xlsx.full.min.js';
import { aviso } from '../../ui/avisos.js';
import { buscarReferencia, excluir, lerHistorico, novoRegistro, salvar } from './historico.js';
import { montarTexto, processRows } from './motor.js';
import { lerPlanilha } from './planilha.js';
import { trechosDaMensagem } from './analise.js';
import { desenharImagem, layoutDaImagem } from './imagem.js';
import { diasUteisAte, simularPre } from './simulador.js';
import { ehDiaUtil } from '../../comum/diasUteis.js';
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
  numero,
  htmlResultadoDaSimulacao,
  opcoesDoSimulador
} from './render.js';
import { abrirJanela } from '../../ui/janela.js';
import './rendafixa.css';

/**
 * O RendaFixa Pro dentro da Mesa XP.
 *
 * Mesmo fluxo do app original — planilha → mercado → funil → cartões ou mensagem → copiar e
 * salvar —, no visual da Mesa. A espera artificial da leitura saiu: a planilha é lida em
 * milissegundos, e o resultado aparece assim que fica pronto. Desde 21/10/2026 (a repaginação): os
 * dois mercados calculados de uma vez, com a contagem de cada um no seletor; os números que chegam
 * contam até o valor; os destaques levam à seção; cada seção copia só o trecho dela; e a linha e o
 * ponto do gráfico se acendem juntos.
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
    imagem: el('imagem'),
    contaPrimario: el('conta-primario'),
    contaSecundario: el('conta-secundario'),
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
    porMercado: null, // os dois resultados, calculados juntos: { false: primário, true: secundário }
    trechos: {}, // um trecho da mensagem por seção, para copiar só ela (analise.js)
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
    Object.assign(estado, { rows: null, porMercado: null, resultado: null, texto: '', trechos: {}, salvo: false, arquivo: { nome: file.name, tamanho: file.size, aba: '' } });
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
    // Os dois mercados de uma vez: a contagem de cada um vai no seletor, e trocar não relê a planilha.
    estado.porMercado ??= { false: processRows(estado.rows, false), true: processRows(estado.rows, true) };
    const resultado = estado.porMercado[estado.secundario];
    estado.resultado = resultado;
    estado.texto = montarTexto(resultado);
    estado.trechos = trechosDaMensagem(estado.texto, resultado.secoes);
    mostrarContagens();
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

  // Quantas oportunidades cada mercado tem: para saber, antes de trocar, se o outro vale a pena.
  function mostrarContagens() {
    const mostrar = (selo, secundario) => {
      const total = estado.porMercado?.[secundario]?.totais.exibidos;
      selo.hidden = total === undefined;
      selo.textContent = total ?? '';
      selo.title = total === undefined ? '' : `${total} ${total === 1 ? 'oportunidade' : 'oportunidades'}`;
    };
    mostrar(ui.contaPrimario, false);
    mostrar(ui.contaSecundario, true);
  }

  function removerArquivo() {
    estado.leitura++;
    Object.assign(estado, { rows: null, porMercado: null, arquivo: null, resultado: null, texto: '', trechos: {}, salvo: false });
    mostrarContagens();
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
    ui.imagem.disabled = !temMensagem;
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
    else if (estado.visao === 'mensagem') ui.corpo.innerHTML = htmlMensagem(estado.texto, { trechos: estado.trechos });
    else ui.corpo.innerHTML = htmlCartoes(r, buscarReferencia(lerHistorico(), r.secundario), { trechos: estado.trechos });
    contar(ui.corpo);
  }

  /*
   * Os números que chegam contam até o valor, em 700 ms, desacelerando: a taxa nova "assenta" no
   * lugar. O HTML já traz o valor final — sem movimento (prefers-reduced-motion), ele só aparece —, e
   * a contagem termina escrevendo exatamente esse texto.
   */
  function contar(raiz) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const numeroNaTela of raiz.querySelectorAll('[data-contar]')) {
      const alvo = Number(numeroNaTela.dataset.contar);
      if (!Number.isFinite(alvo) || alvo <= 0) continue;
      const final = numeroNaTela.textContent;
      const inteiro = 'inteiro' in numeroNaTela.dataset;
      const de = inteiro ? 0 : alvo * 0.6;
      const inicio = performance.now();
      const formato = inteiro ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
      const passo = (agora) => {
        const t = Math.min(1, (agora - inicio) / 700);
        const valor = de + (alvo - de) * (1 - (1 - t) ** 3);
        numeroNaTela.textContent = t < 1 ? valor.toLocaleString('pt-BR', formato) : final;
        if (t < 1 && numeroNaTela.isConnected) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    }
  }

  // Um destaque leva à seção dele, que acende uma vez para o olho achar.
  function irPara(id) {
    const secaoAlvo = ui.corpo.querySelector(`.rf-secao[data-sec="${id}"]`);
    if (!secaoAlvo) return;
    const suave = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    secaoAlvo.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'center' });
    secaoAlvo.classList.remove('rf-acesa');
    void secaoAlvo.offsetWidth;
    secaoAlvo.classList.add('rf-acesa');
  }

  // Copiar só uma categoria: o título e o bloco dela, como estão na mensagem.
  async function copiarSecao(id, botao) {
    const trecho = estado.trechos[id];
    if (!trecho) return;
    if (!(await copiarTexto(trecho))) {
      aviso('Não foi possível copiar. Abra a visão Mensagem e selecione o texto.', { tipo: 'erro' });
      return;
    }
    botao.classList.add('copiado');
    setTimeout(() => botao.classList.remove('copiado'), 1600);
    aviso('Copiada só esta categoria, com o mesmo texto da mensagem.');
  }

  // A linha e o ponto do gráfico se acendem juntos: passar o mouse numa acende o outro.
  function acenderPar(e) {
    const alvo = e.target.closest?.('.rf-linha, .rf-curva:not(.rf-curva-mini) circle');
    const secaoDoAlvo = e.target.closest?.('.rf-secao');
    for (const acesa of ui.corpo.querySelectorAll('.rf-par')) acesa.classList.remove('rf-par');
    if (!alvo || !secaoDoAlvo) return;
    const i = alvo.dataset.i;
    for (const par of secaoDoAlvo.querySelectorAll(`.rf-linha[data-i="${i}"], .rf-curva circle[data-i="${i}"]`)) par.classList.add('rf-par');
  }

  function renderFunilVazio() {
    ui.funil.innerHTML = htmlFunilVazio();
    ui.funilDetalhes.innerHTML = '';
  }

  function renderFunil() {
    const abertos = [...ui.funilDetalhes.querySelectorAll('details')].map((d) => d.open);
    ui.funil.innerHTML = htmlFunil(estado.resultado);
    ui.funilDetalhes.innerHTML = htmlDetalhesFunil(estado.resultado, abertos);
    contar(ui.funil);
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
      i: () => !ui.imagem.disabled && baixarImagem(),
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
    if (botao.dataset.acao === 'ir-para') irPara(botao.dataset.sec);
    if (botao.dataset.acao === 'copiar-secao') copiarSecao(botao.dataset.sec, botao);
  });
  ui.corpo.addEventListener('pointerover', acenderPar);
  ui.corpo.addEventListener('pointerleave', acenderPar);
  ui.copiar.addEventListener('click', copiarMensagem);
  ui.imagem.addEventListener('click', () => baixarImagem());

  /*
   * "Baixar imagem" (21/10/2026): as oportunidades num PNG, desenhado num canvas (imagem.js), com o
   * nome do dia e do mercado. Sai do navegador só para a pasta de downloads de quem clicou.
   */
  function baixarImagem() {
    const r = estado.resultado;
    if (!r || !r.totais.exibidos) return;
    const hoje = new Date();
    const data = hoje.toLocaleDateString('pt-BR');
    const canvas = desenharImagem(document.createElement('canvas'), layoutDaImagem(r, { data }));
    canvas.toBlob((blob) => {
      if (!blob) return aviso('Não foi possível gerar a imagem.', { tipo: 'erro' });
      const link = document.createElement('a');
      const dia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      link.href = URL.createObjectURL(blob);
      link.download = `renda-fixa-${dia}${r.secundario ? '-secundario' : ''}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      aviso('Imagem baixada: anexe no WhatsApp.');
    }, 'image/png');
  }

  // O simulador de pré-fixado, embaixo dos cartões: refaz a conta a cada tecla.
  const lerValor = (texto) => {
    const limpo = String(texto ?? '').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const n = Number(limpo);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  function simular() {
    const caixa = ui.corpo.querySelector('[data-rf-simulador]');
    const r = estado.resultado;
    if (!caixa || !r) return;
    const opcao = opcoesDoSimulador(r)[Number(caixa.querySelector('[data-sim="titulo"]').value)];
    const valor = lerValor(caixa.querySelector('[data-sim="valor"]').value);
    const saida = caixa.querySelector('[data-sim="resultado"]');
    if (!opcao || !valor) {
      saida.innerHTML = htmlResultadoDaSimulacao(null, {});
      return;
    }
    const hoje = new Date();
    const vencimento = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + opcao.item.dias);
    const diasUteis = diasUteisAte(hoje, vencimento, ehDiaUtil);
    const sim = simularPre({ valor, taxa: opcao.item.taxa, diasUteis, diasCorridos: opcao.item.dias, isento: opcao.isento });
    saida.innerHTML = htmlResultadoDaSimulacao(sim, { diasUteis, diasCorridos: opcao.item.dias });
  }
  ui.corpo.addEventListener('input', (e) => e.target.closest?.('[data-rf-simulador]') && simular());
  ui.corpo.addEventListener('change', (e) => e.target.closest?.('[data-rf-simulador]') && simular());
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
  <div class="rf-soltura" aria-hidden="true">
    <div><strong>Solte para analisar</strong><span>a planilha é lida aqui, sem sair do navegador</span></div>
  </div>
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
          <button type="button" class="seg" role="radio" data-mercado="primario">Emissão primária <span class="rf-conta" data-rf="conta-primario" hidden></span></button>
          <button type="button" class="seg" role="radio" data-mercado="secundario">Mercado secundário <span class="rf-conta" data-rf="conta-secundario" hidden></span></button>
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
          <button type="button" class="copy-btn" data-rf="imagem" title="Baixar as oportunidades como imagem, para o WhatsApp (I)">Baixar imagem</button>
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
      <div><dt><kbd>I</kbd></dt><dd>Baixar as oportunidades como imagem</dd></div>
      <div><dt><kbd>S</kbd></dt><dd>Salvar no histórico</dd></div>
      <div><dt><kbd>T</kbd></dt><dd>Alternar tema claro / escuro</dd></div>
      <div><dt><kbd>?</kbd></dt><dd>Mostrar esta lista</dd></div>
    </dl>
    <p class="rf-nota">Também dá para soltar a planilha em qualquer lugar desta aba.</p>
  </dialog>
</div>`;
