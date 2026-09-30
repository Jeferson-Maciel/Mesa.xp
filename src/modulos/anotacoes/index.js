import { aviso } from '../../ui/avisos.js';
import { criarCena } from '../../ui/cena.js';
import { esc } from '../../ui/html.js';
import { abrirJanela } from '../../ui/janela.js';
import { exportarBackup, importarBackup } from './backup.js';
import { repositorioDasAnotacoes } from './banco.js';
import { lerDataNatural, semOsTrechos } from './dataNatural.js';
import { aoMudar, avisarMudanca } from './eventos.js';
import { aplicarAtalho, chaveDoDia, rotuloDoLembrete } from './lembretes.js';
import { MODELOS, aplicarModelo } from './modelos.js';
import {
  LIMITES,
  adicionarEtiqueta,
  alternarItem,
  camposDe,
  contagens,
  etiquetasEmUso,
  filtrarNotas,
  mesclarAoSalvar,
  mesmosCampos,
  novaNota,
  paraApagarDeVez
} from './notas.js';
import {
  LINK_NOVA,
  htmlAnexos,
  htmlChecklist,
  htmlDataLida,
  htmlEditor,
  htmlEtiquetasEditor,
  htmlEtiquetasFiltro,
  htmlFiltros,
  htmlLembrete,
  htmlLinks,
  htmlLista,
  htmlRecuperar,
  linkDaNota,
  textoDoStatus
} from './render.js';
import { novoId } from './repositorio.js';
import { estadoDasNotificacoes, gravarConfig, lerConfig, pedirNotificacoes } from './vigia.js';
import './anotacoes.css';

/**
 * Anotações — o bloco de notas de cada um, com lembretes.
 *
 * Lista à esquerda (entrada rápida, busca, filtros, etiquetas, e as visões Lista e Planejado),
 * anotação aberta à direita — e, sem nenhuma aberta, uma anotação nova, pronta para escrever.
 *
 * **Salvar é explícito** (pedido da mesa, e o que as pessoas esperam segundo o NN/g): o editor
 * trabalha num rascunho, e nada muda na anotação gravada até Salvar. O selo no alto diz sempre em
 * que pé está — nova, alterações não salvas, salvando, salvo às 14:32 —; sair com alteração pede
 * confirmação; e o rascunho fica guardado no navegador enquanto não é salvo, para voltar se a
 * página fechar no meio. Salvar leva a uma anotação nova; Ctrl+S salva sem sair.
 *
 * As anotações ficam no navegador de quem usa (repositorio.js explica por quê).
 *
 * Rotas: `#anotacoes` (a última aberta), `#anotacoes/nova`, `#anotacoes/nota/<id>`.
 *
 * @param {HTMLElement} secao a seção `#modulo-anotacoes`
 */
export const iniciarAnotacoes = (secao) => {
  secao.innerHTML = MARCACAO;
  const el = (nome) => secao.querySelector(`[data-an="${nome}"]`);
  const raiz = secao.querySelector('.an');
  const principal = el('principal');
  const repo = repositorioDasAnotacoes();

  const estado = {
    notas: [],
    carregou: false,
    filtro: 'todas',
    etiqueta: '',
    termo: '',
    visao: lerPreferencia('visao', 'lista'),
    recemSalva: null,
    // O que está no editor: a anotação (id), se é nova, o rascunho e os anexos que entram ao salvar.
    aberta: null, // { id, nova, original, campos, anexosNovos: [{ ficha…, blob, url }] }
    gravacao: 'nova', // nova | sujo | salvando | salvo | erro
    salvoEm: null
  };

  const naAba = () => !secao.hidden;
  const gravada = (id) => estado.notas.find((n) => n.id === id) ?? null;
  const sujo = () => Boolean(estado.aberta && (!mesmosCampos(estado.aberta.original, estado.aberta.campos) || estado.aberta.anexosNovos.length));

  const rotaAtual = () => {
    const [, tipo, id] = location.hash.replace(/^#\/?/, '').split('/');
    if (tipo === 'nota' && id) return { tipo: 'nota', id: decodeURIComponent(id) };
    if (tipo === 'nova') return { tipo: 'nova' };
    return { tipo: 'raiz' };
  };

  /* ── Gravação ─────────────────────────────────────────────────────────────────────────
     Toda escrita passa por uma fila: duas gravações da mesma anotação nunca se cruzam. */

  let fila = Promise.resolve();
  const naFila = (tarefa) => {
    const feito = fila.then(tarefa);
    fila = feito.catch(() => {});
    return feito;
  };

  let pedidoPersistencia = false;
  const pedirPersistencia = () => {
    // No HTTPS, pede ao navegador que não limpe estes dados por falta de espaço.
    if (pedidoPersistencia) return;
    pedidoPersistencia = true;
    navigator.storage?.persist?.().catch(() => {});
  };

  /* ── Rascunho guardado (para não perder nada se a página fechar) ──────────────────── */

  const CHAVE_RASCUNHO = 'mesa_anotacoes_rascunho';
  const chaveDoAberto = () => (estado.aberta?.nova ? 'nova' : estado.aberta?.id);

  let esperaRascunho = null;
  const guardarRascunho = () => {
    clearTimeout(esperaRascunho);
    esperaRascunho = setTimeout(guardarRascunhoJa, 300);
  };
  function guardarRascunhoJa() {
    clearTimeout(esperaRascunho);
    try {
      if (!estado.aberta || mesmosCampos(estado.aberta.original, estado.aberta.campos)) {
        if (lerRascunho()?.chave === chaveDoAberto()) localStorage.removeItem(CHAVE_RASCUNHO);
        return;
      }
      localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ chave: chaveDoAberto(), campos: estado.aberta.campos, em: Date.now() }));
    } catch {
      // sem armazenamento: o rascunho vale só na tela
    }
  }
  const lerRascunho = () => {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || 'null');
    } catch {
      return null;
    }
  };
  const apagarRascunho = () => {
    try {
      localStorage.removeItem(CHAVE_RASCUNHO);
    } catch {
      // nada a apagar
    }
  };

  /* ── Carga ────────────────────────────────────────────────────────────────────────── */

  async function carregar() {
    try {
      estado.notas = await repo.listarNotas();
      estado.carregou = true;
      el('erro').innerHTML = '';
    } catch (erro) {
      console.error(erro);
      el('erro').innerHTML = `<div class="alert alert-danger" role="alert">${esc(erro.message)}</div>`;
    }
  }

  // A lixeira guarda por 30 dias; depois disso, apaga de vez (com os anexos).
  async function limparLixeira() {
    const ids = paraApagarDeVez(estado.notas);
    if (!ids.length) return;
    for (const id of ids) await naFila(() => repo.excluirNota(id)).catch((e) => console.error(e));
    estado.notas = estado.notas.filter((n) => !ids.includes(n.id));
    avisarMudanca('aba');
  }

  /* ── Render ───────────────────────────────────────────────────────────────────────── */

  const encenar = criarCena(principal);

  function renderLateral() {
    const agora = new Date();
    const etiquetas = etiquetasEmUso(estado.notas);
    if (estado.etiqueta && !etiquetas.some((e) => e.nome.toLocaleLowerCase('pt-BR') === estado.etiqueta.toLocaleLowerCase('pt-BR'))) {
      estado.etiqueta = '';
    }
    el('filtros').innerHTML = htmlFiltros({ contagens: contagens(estado.notas, agora), filtro: estado.filtro });
    el('etiquetas-filtro').innerHTML = htmlEtiquetasFiltro({ etiquetas, atual: estado.etiqueta });
    for (const b of el('visao').querySelectorAll('[data-visao]')) {
      b.classList.toggle('ativo', b.dataset.visao === estado.visao);
      b.setAttribute('aria-pressed', String(b.dataset.visao === estado.visao));
    }
    const visiveis = filtrarNotas(estado.notas, estado, agora);
    const selecionada = estado.aberta && !estado.aberta.nova ? estado.aberta.id : null;
    el('lista').innerHTML = htmlLista({ notas: visiveis, agora, selecionada, filtro: estado.filtro, termo: estado.termo, visao: estado.visao, recemSalva: estado.recemSalva });
  }

  const sugestoes = () => etiquetasEmUso(estado.notas).map((e) => e.nome);
  const notaDoAberto = () => (estado.aberta.nova ? { ...novaNota(estado.aberta.id), anexos: [] } : gravada(estado.aberta.id));

  function renderEditor({ manterFoco = false } = {}) {
    const nota = notaDoAberto();
    if (!nota) return;
    // Redesenhar sem tirar o cursor do lugar (Ctrl+S salva e continua na mesma palavra).
    const foco = manterFoco ? document.activeElement?.dataset?.campo : null;
    const selecao = foco ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    principal.innerHTML = htmlEditor({
      nota,
      campos: estado.aberta.campos,
      agora: new Date(),
      sugestoes: sugestoes(),
      nova: estado.aberta.nova,
      anexosNovos: estado.aberta.anexosNovos
    });
    mostrarGravacao();
    ajustarAltura();
    carregarMiniaturas();
    oferecerRecuperacao();
    if (foco) {
      const campo = principal.querySelector(`[data-campo="${foco}"]`);
      campo?.focus();
      if (selecao && campo?.setSelectionRange) campo.setSelectionRange(...selecao);
    }
  }

  // As partes do editor que mudam sem redesenhar o texto.
  const renderLembrete = () => {
    const alvo = el('lembrete');
    const nota = estado.aberta && notaDoAberto();
    if (alvo && nota && !nota.excluidaEm) alvo.innerHTML = htmlLembrete({ ...nota, ...estado.aberta.campos }, new Date());
  };
  const renderEtiquetas = () => {
    const alvo = el('etiquetas');
    if (alvo && estado.aberta) alvo.innerHTML = htmlEtiquetasEditor(estado.aberta.campos.etiquetas, sugestoes());
  };
  const renderAnexos = () => {
    const alvo = el('anexos');
    const nota = estado.aberta && notaDoAberto();
    if (alvo && nota) alvo.innerHTML = htmlAnexos(nota.anexos, estado.aberta.anexosNovos);
    carregarMiniaturas();
  };
  const renderTexto = () => {
    el('checklist').innerHTML = htmlChecklist(estado.aberta.campos.texto);
    el('links').innerHTML = htmlLinks(estado.aberta.campos.texto);
  };

  /** O selo de gravação e o botão Salvar dizem em que pé está a anotação aberta. */
  function mostrarGravacao() {
    const editor = el('editor');
    if (!editor || !estado.aberta) return;
    if (estado.gravacao !== 'salvando' && estado.gravacao !== 'erro') {
      estado.gravacao = sujo() ? 'sujo' : estado.aberta.nova ? 'nova' : 'salvo';
    }
    editor.dataset.gravacao = estado.gravacao;
    const salvoEm = estado.salvoEm ?? notaDoAberto()?.atualizadaEm;
    if (notaDoAberto()?.excluidaEm) {
      editor.dataset.gravacao = 'lixeira';
      el('status').innerHTML = '<span class="an-status-texto">Na lixeira</span>';
      return;
    }
    el('status').innerHTML = `<span class="an-status-texto">${esc(textoDoStatus(estado.gravacao, salvoEm))}</span>${
      estado.gravacao === 'sujo' ? '<button type="button" class="an-link" data-acao="descartar">Descartar</button>' : ''
    }`;
    raiz.classList.toggle('com-alteracoes', estado.gravacao === 'sujo');
  }

  function render() {
    if (!estado.carregou) return;
    renderLateral();
    renderEditor();
  }

  // O texto cresce com o que se escreve, em vez de rolar dentro de uma caixa pequena.
  const ajustarAltura = () => {
    const texto = principal.querySelector('[data-campo="texto"]');
    if (!texto) return;
    texto.style.height = 'auto';
    texto.style.height = `${Math.max(texto.scrollHeight + 2, 240)}px`;
  };

  /* ── Abrir e sair ─────────────────────────────────────────────────────────────────── */

  const novoRascunho = () => {
    const base = novaNota(novoId());
    return { id: base.id, nova: true, original: camposDe(base), campos: camposDe(base), anexosNovos: [] };
  };

  const soltarAnexosNovos = () => {
    for (const a of estado.aberta?.anexosNovos ?? []) URL.revokeObjectURL(a.url);
  };

  function abrir(rascunho) {
    soltarAnexosNovos();
    estado.aberta = rascunho;
    estado.gravacao = rascunho.nova ? 'nova' : 'salvo';
    estado.salvoEm = null;
    raiz.classList.toggle('com-nota', rotaAtual().tipo !== 'raiz');
    encenar(rascunho.id);
    renderLateral();
    renderEditor();
  }

  // Leva à anotação nova. Se o endereço já é o dela, o hashchange não vem: segue a rota na mão.
  const irParaNova = () => {
    if (location.hash === LINK_NOVA) seguirRota();
    else location.hash = LINK_NOVA;
  };

  // Volta ao hash anterior sem disparar a rota de novo (quem cancelou a saída fica onde estava).
  let hashAnterior = location.hash;
  const voltarHash = () => history.replaceState(null, '', hashAnterior || '#anotacoes');

  async function seguirRota() {
    const rota = rotaAtual();
    raiz.classList.toggle('com-nota', rota.tipo !== 'raiz');

    // A raiz da aba (Alt+5, o clique na aba) mostra o que já estava aberto: nada se perde.
    if (rota.tipo === 'raiz') {
      if (!estado.aberta) abrir(novoRascunho());
      hashAnterior = location.hash;
      return;
    }
    if (rota.tipo === 'nova' && estado.aberta?.nova) {
      hashAnterior = location.hash;
      principal.querySelector('[data-campo="titulo"]')?.focus();
      return;
    }
    if (rota.tipo === 'nota' && estado.aberta?.id === rota.id) {
      hashAnterior = location.hash;
      return;
    }

    if (sujo() && !confirm('Esta anotação tem alterações não salvas. Sair sem salvar?')) {
      voltarHash();
      raiz.classList.toggle('com-nota', rotaAtual().tipo !== 'raiz');
      return;
    }
    if (sujo()) apagarRascunho();
    hashAnterior = location.hash;

    if (rota.tipo === 'nova') {
      abrir(novoRascunho());
      requestAnimationFrame(() => principal.querySelector('[data-campo="titulo"]')?.focus());
      return;
    }
    const nota = gravada(rota.id);
    if (!nota) {
      if (estado.carregou) aviso('Esta anotação não existe mais neste navegador.', { tipo: 'erro' });
      history.replaceState(null, '', LINK_NOVA);
      abrir(novoRascunho());
      return;
    }
    abrir({ id: nota.id, nova: false, original: camposDe(nota), campos: camposDe(nota), anexosNovos: [] });
  }

  // Havia alterações de antes, não salvas? Oferece recuperar.
  function oferecerRecuperacao() {
    const guardado = lerRascunho();
    const alvo = el('recuperar');
    if (!alvo || !guardado || guardado.chave !== chaveDoAberto()) return;
    const nota = notaDoAberto();
    if (mesmosCampos(guardado.campos, estado.aberta.campos) || (!estado.aberta.nova && guardado.em < nota.atualizadaEm)) {
      apagarRascunho();
      return;
    }
    alvo.innerHTML = htmlRecuperar(guardado.em);
  }

  /* ── Salvar ───────────────────────────────────────────────────────────────────────── */

  const botaoSalvar = () => principal.querySelector('[data-acao="salvar"]');

  /**
   * @param {{ depois: 'nova' | 'ficar' | 'nada' }} opcoes
   *   'nova': salva e abre uma anotação nova (o botão Salvar, Ctrl+Enter); 'ficar': Ctrl+S;
   *   'nada': só grava, sem aviso — antes de resolver uma anotação com alteração.
   * @returns {Promise<boolean>} se a anotação está gravada ao fim
   */
  async function salvar({ depois = 'nova' } = {}) {
    const aberta = estado.aberta;
    if (!aberta || notaDoAberto()?.excluidaEm || estado.gravacao === 'salvando') return false;

    if (!sujo()) {
      if (aberta.nova) {
        aviso('Escreva alguma coisa antes de salvar.');
        principal.querySelector('[data-campo="titulo"]')?.focus();
      } else if (depois === 'nova') {
        irParaNova();
      }
      return !aberta.nova;
    }

    estado.gravacao = 'salvando';
    mostrarGravacao();
    const botao = botaoSalvar();
    if (botao) {
      botao.dataset.estado = 'salvando';
      botao.textContent = 'Salvando…';
    }

    try {
      const salva = await naFila(async () => {
        const atual = aberta.nova ? novaNota(aberta.id) : gravada(aberta.id);
        const nota = mesclarAoSalvar({ original: aberta.original, rascunho: aberta.campos, atual });
        let resultado = await repo.salvarNota(nota);
        for (const a of aberta.anexosNovos) {
          const ficha = await repo.adicionarAnexo(nota.id, a.blob, { id: a.id, nome: a.nome, criadoEm: a.criadoEm });
          resultado = { ...resultado, anexos: [...resultado.anexos, ficha], atualizadaEm: Date.now() };
        }
        return resultado;
      });

      estado.notas = [salva, ...estado.notas.filter((n) => n.id !== salva.id)];
      apagarRascunho();
      pedirPersistencia();
      avisarMudanca('aba');
      estado.recemSalva = salva.id;
      setTimeout(() => {
        if (estado.recemSalva === salva.id) {
          estado.recemSalva = null;
          renderLateral();
        }
      }, 1800);

      // O rascunho vira a anotação gravada; os anexos novos já estão no banco.
      soltarAnexosNovos();
      Object.assign(aberta, { nova: false, original: camposDe(salva), campos: camposDe(salva), anexosNovos: [] });
      estado.gravacao = 'salvo';
      estado.salvoEm = salva.atualizadaEm;
      renderLateral();

      if (depois === 'nada') {
        history.replaceState(null, '', linkDaNota(salva.id));
        hashAnterior = location.hash;
      } else if (depois === 'nova') {
        if (botao) {
          botao.dataset.estado = 'salvo';
          botao.classList.add('copiado');
          botao.textContent = 'Salvo';
        }
        aviso('Anotação salva.', { acao: { rotulo: 'Abrir', fazer: () => (location.hash = linkDaNota(salva.id)) } });
        // A folha salva sai de cena e uma nova entra (anotacoes.css).
        el('editor')?.classList.add('an-saindo');
        setTimeout(() => {
          hashAnterior = linkDaNota(salva.id);
          irParaNova();
        }, 380);
      } else {
        history.replaceState(null, '', linkDaNota(salva.id));
        hashAnterior = location.hash;
        raiz.classList.add('com-nota');
        renderEditor({ manterFoco: true });
        const novo = botaoSalvar();
        if (novo) {
          novo.classList.add('copiado');
          novo.textContent = 'Salvo';
          setTimeout(() => {
            novo.classList.remove('copiado');
            novo.textContent = 'Salvar';
          }, 1400);
        }
        aviso('Anotação salva.');
      }
      return true;
    } catch (erro) {
      console.error(erro);
      estado.gravacao = 'erro';
      mostrarGravacao();
      if (botao) {
        delete botao.dataset.estado;
        botao.textContent = 'Salvar';
      }
      aviso(erro.message, { tipo: 'erro' });
      return false;
    }
  }

  /* ── Mudar o rascunho ─────────────────────────────────────────────────────────────── */

  const mudarCampos = (mudanca) => {
    if (!estado.aberta || notaDoAberto()?.excluidaEm) return;
    mudanca(estado.aberta.campos);
    const eraSujo = estado.gravacao === 'sujo';
    estado.gravacao = 'sujo';
    mostrarGravacao();
    // O botão Salvar dá um toque quando a anotação passa a ter alteração (anotacoes.css).
    if (!eraSujo && sujo()) {
      const botao = botaoSalvar();
      botao?.classList.remove('an-cutucar');
      void botao?.offsetWidth;
      botao?.classList.add('an-cutucar');
    }
    guardarRascunho();
  };

  const mudarLembrete = (lembrete) => {
    mudarCampos((c) => {
      c.lembrete = lembrete;
    });
    renderLembrete();
  };

  const incluirEtiqueta = (campo, { continuar = false } = {}) => {
    const texto = campo.value;
    if (!texto.trim()) return;
    mudarCampos((c) => {
      c.etiquetas = adicionarEtiqueta(c.etiquetas, texto);
    });
    renderEtiquetas();
    if (continuar) principal.querySelector('[data-campo="etiqueta"]')?.focus();
  };

  const aplicarNoTexto = (novoTexto) => {
    const area = principal.querySelector('[data-campo="texto"]');
    mudarCampos((c) => {
      c.texto = novoTexto;
    });
    if (area && area.value !== novoTexto) area.value = novoTexto;
    ajustarAltura();
    renderTexto();
  };

  /* ── Ações sobre a anotação gravada ───────────────────────────────────────────────── */

  // Resolver, reabrir, excluir e restaurar gravam na hora e oferecem Desfazer.
  async function gravarJa(nota, mensagem, desfazer) {
    try {
      const salva = await naFila(() => repo.salvarNota(nota));
      estado.notas = estado.notas.map((n) => (n.id === salva.id ? salva : n));
      avisarMudanca('aba');
      aviso(mensagem, desfazer ? { acao: { rotulo: 'Desfazer', fazer: desfazer } } : {});
      return salva;
    } catch (erro) {
      aviso(erro.message, { tipo: 'erro' });
      return null;
    }
  }

  async function alternarResolvida(id, { daLista = false } = {}) {
    // A anotação aberta com alteração (texto, anexos) é salva antes: resolver leva tudo junto.
    if (estado.aberta?.id === id && sujo() && !(await salvar({ depois: 'nada' }))) return;
    const nota = gravada(id) && { ...gravada(id) };
    if (!nota) return;
    const resolver = !nota.concluida;
    const antes = gravada(id);
    if (daLista) {
      const cartao = [...el('lista').querySelectorAll('.an-cartao')].find((c) => c.dataset.id === id);
      cartao?.classList.add(resolver ? 'an-resolvendo' : 'an-reabrindo');
      await new Promise((ok) => setTimeout(ok, resolver ? 420 : 200));
    }
    const salva = await gravarJa(
      { ...nota, concluida: resolver, concluidaEm: resolver ? Date.now() : null },
      resolver ? 'Resolvida. Ela fica em "Resolvidas".' : 'Anotação reaberta.',
      () => gravarJa({ ...antes }, 'Voltou como estava.').then(depoisDeMudar)
    );
    if (!salva) return depoisDeMudar();
    if (estado.aberta?.id === id) {
      Object.assign(estado.aberta, { original: camposDe(salva), campos: camposDe(salva) });
      apagarRascunho();
      if (resolver && !daLista) return irParaNova();
    }
    depoisDeMudar();
  }

  async function mandarParaLixeira(id) {
    const nota = gravada(id);
    if (!nota) return;
    if (estado.aberta?.id === id) {
      soltarAnexosNovos();
      estado.aberta.anexosNovos = [];
      estado.aberta.campos = { ...estado.aberta.original };
      apagarRascunho();
    }
    const salva = await gravarJa({ ...nota, excluidaEm: Date.now() }, 'Movida para a lixeira (30 dias).', () =>
      gravarJa({ ...nota, excluidaEm: null }, 'Anotação restaurada.').then(depoisDeMudar)
    );
    if (salva && estado.aberta?.id === id) return irParaNova();
    depoisDeMudar();
  }

  async function restaurar(id) {
    const nota = gravada(id);
    if (!nota) return;
    await gravarJa({ ...nota, excluidaEm: null }, 'Anotação restaurada.');
    depoisDeMudar();
  }

  async function apagarDeVez(id) {
    const nota = gravada(id);
    if (!nota || !confirm('Apagar de vez esta anotação e os anexos dela? Não dá para desfazer.')) return;
    try {
      await naFila(() => repo.excluirNota(id));
    } catch (erro) {
      return aviso(erro.message, { tipo: 'erro' });
    }
    for (const a of nota.anexos) {
      URL.revokeObjectURL(enderecos.get(a.id));
      enderecos.delete(a.id);
    }
    estado.notas = estado.notas.filter((n) => n.id !== id);
    avisarMudanca('aba');
    aviso('Anotação apagada de vez.');
    if (estado.aberta?.id === id) irParaNova();
    else renderLateral();
  }

  async function alternarFixada() {
    const nota = gravada(estado.aberta?.id);
    if (!nota) return;
    const salva = await gravarJa({ ...nota, fixada: !nota.fixada }, nota.fixada ? 'Desafixada.' : 'Fixada no alto da lista.');
    if (!salva) return;
    const botao = principal.querySelector('[data-acao="fixar"]');
    botao?.setAttribute('aria-pressed', String(salva.fixada));
    if (botao) botao.textContent = salva.fixada ? 'Fixada' : 'Fixar';
    renderLateral();
  }

  // Depois de mudar uma anotação gravada: a lista, e o editor se ela é a aberta.
  function depoisDeMudar() {
    renderLateral();
    const aberta = estado.aberta;
    if (aberta && !aberta.nova && gravada(aberta.id)) {
      if (!sujo()) Object.assign(aberta, { original: camposDe(gravada(aberta.id)), campos: camposDe(gravada(aberta.id)) });
      renderEditor({ manterFoco: true });
    }
  }

  /* ── Anexos ───────────────────────────────────────────────────────────────────────── */

  const enderecos = new Map(); // anexoId → object URL do arquivo gravado

  const anexoNovo = (id) => estado.aberta?.anexosNovos.find((a) => a.id === id) ?? null;

  const enderecoDe = async (anexoId) => {
    const novo = anexoNovo(anexoId);
    if (novo) return novo.url;
    if (enderecos.has(anexoId)) return enderecos.get(anexoId);
    const blob = await repo.lerAnexo(anexoId);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    enderecos.set(anexoId, url);
    return url;
  };

  const blobDe = async (anexoId) => anexoNovo(anexoId)?.blob ?? repo.lerAnexo(anexoId);

  async function carregarMiniaturas() {
    for (const img of principal.querySelectorAll('img[data-miniatura]')) {
      try {
        const url = await enderecoDe(img.dataset.miniatura);
        if (url) img.src = url;
      } catch (erro) {
        console.error(erro);
      }
    }
  }

  const nomeDoArquivo = (arquivo) => {
    // O print colado chega como "image.png": ganha a data e a hora, como o Sticky Notes faz.
    if (arquivo.name && arquivo.name !== 'image.png') return arquivo.name;
    const d = new Date();
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    return `print ${chaveDoDia(d)} ${hora}.${(arquivo.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
  };

  // O anexo entra no rascunho e vai para o banco junto com a anotação, ao salvar.
  function anexar(arquivos) {
    if (!estado.aberta || notaDoAberto()?.excluidaEm || !arquivos.length) return;
    let feitos = 0;
    for (const arquivo of arquivos) {
      if (arquivo.size > LIMITES.anexo) {
        aviso(`"${arquivo.name}" tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB; o limite é ${LIMITES.anexo / 1024 / 1024} MB.`, { tipo: 'erro' });
        continue;
      }
      estado.aberta.anexosNovos.push({
        id: novoId(),
        nome: nomeDoArquivo(arquivo),
        tipo: arquivo.type || 'application/octet-stream',
        tamanho: arquivo.size,
        criadoEm: Date.now(),
        blob: arquivo,
        url: URL.createObjectURL(arquivo)
      });
      feitos++;
    }
    if (!feitos) return;
    mudarCampos(() => {});
    renderAnexos();
    aviso(feitos === 1 ? 'Anexado. Salve para guardar.' : `${feitos} arquivos anexados. Salve para guardar.`);
  }

  const visor = el('visor');
  let noVisor = null;

  async function abrirAnexo(anexoId, origem) {
    const nota = notaDoAberto();
    const ficha = anexoNovo(anexoId) ?? nota?.anexos.find((a) => a.id === anexoId);
    if (!ficha) return;
    const url = await enderecoDe(anexoId);
    if (!url) return aviso('O arquivo deste anexo não foi encontrado.', { tipo: 'erro' });
    if (!ficha.tipo.startsWith('image/')) return baixar(url, ficha.nome);
    noVisor = ficha;
    el('visor-img').src = url;
    el('visor-img').alt = ficha.nome;
    el('visor-nome').textContent = ficha.nome;
    el('visor-remover').hidden = Boolean(nota?.excluidaEm);
    abrirJanela(visor, origem);
  }

  const baixar = (url, nome) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.append(a);
    a.click();
    a.remove();
  };

  // A área de transferência só aceita PNG: um JPG é redesenhado num canvas antes de copiar.
  const comoPng = async (blob) => {
    if (blob.type === 'image/png') return blob;
    const imagem = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = imagem.width;
    canvas.height = imagem.height;
    canvas.getContext('2d').drawImage(imagem, 0, 0);
    return new Promise((ok) => canvas.toBlob(ok, 'image/png'));
  };

  el('visor-copiar').addEventListener('click', async () => {
    if (!noVisor) return;
    const botao = el('visor-copiar');
    try {
      const png = await comoPng(await blobDe(noVisor.id));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      botao.classList.add('copiado');
      setTimeout(() => botao.classList.remove('copiado'), 1600);
      aviso('Print copiado: é só colar (Ctrl+V) no e-mail ou no WhatsApp.');
    } catch (erro) {
      console.error(erro);
      aviso('Não foi possível copiar a imagem. Use Baixar.', { tipo: 'erro' });
    }
  });

  el('visor-baixar').addEventListener('click', async () => {
    if (noVisor) baixar(await enderecoDe(noVisor.id), noVisor.nome);
  });

  el('visor-remover').addEventListener('click', async () => {
    const ficha = noVisor;
    if (!ficha || !estado.aberta) return;
    // O anexo que ainda não foi salvo sai do rascunho; o gravado sai do banco, com confirmação.
    if (anexoNovo(ficha.id)) {
      URL.revokeObjectURL(ficha.url);
      estado.aberta.anexosNovos = estado.aberta.anexosNovos.filter((a) => a.id !== ficha.id);
      visor.close();
      mudarCampos(() => {});
      renderAnexos();
      return;
    }
    const nota = gravada(estado.aberta.id);
    if (!nota || !confirm(`Remover "${ficha.nome}" desta anotação? Não dá para desfazer.`)) return;
    visor.close();
    try {
      await naFila(() => repo.removerAnexo(nota.id, ficha.id));
      const atualizada = { ...nota, anexos: nota.anexos.filter((a) => a.id !== ficha.id) };
      estado.notas = estado.notas.map((n) => (n.id === nota.id ? atualizada : n));
      URL.revokeObjectURL(enderecos.get(ficha.id));
      enderecos.delete(ficha.id);
      avisarMudanca('aba');
      renderAnexos();
      renderLateral();
      aviso('Anexo removido.');
    } catch (erro) {
      aviso(erro.message, { tipo: 'erro' });
    }
  });

  el('visor-fechar').addEventListener('click', () => visor.close());
  visor.addEventListener('click', (e) => {
    if (e.target === visor) visor.close();
  });

  /* ── Eventos do editor ────────────────────────────────────────────────────────────── */

  async function copiarTexto() {
    const { titulo, texto } = estado.aberta.campos;
    const conteudo = texto.trim() ? texto : titulo;
    const botao = principal.querySelector('[data-acao="copiar"]');
    try {
      await navigator.clipboard.writeText(conteudo);
      botao?.classList.add('copiado');
      setTimeout(() => botao?.classList.remove('copiado'), 1600);
      aviso('Texto copiado.');
    } catch {
      aviso('Não foi possível copiar. Selecione o texto e use Ctrl+C.', { tipo: 'erro' });
    }
  }

  principal.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-acao], [data-atalho], [data-remover-etiqueta], [data-anexo], [data-modelo]');
    if (!alvo || !estado.aberta) return;
    if (alvo.dataset.atalho) return mudarLembrete(aplicarAtalho(alvo.dataset.atalho, new Date()));
    if (alvo.dataset.removerEtiqueta !== undefined) {
      mudarCampos((c) => {
        c.etiquetas = c.etiquetas.filter((x) => x !== alvo.dataset.removerEtiqueta);
      });
      return renderEtiquetas();
    }
    if (alvo.dataset.anexo) return abrirAnexo(alvo.dataset.anexo, alvo);
    if (alvo.dataset.modelo) {
      const modelo = MODELOS.find((m) => m.id === alvo.dataset.modelo);
      if (!modelo) return;
      if (sujo() && !confirm('Trocar o que já foi escrito pelo modelo?')) return;
      mudarCampos((c) => Object.assign(c, aplicarModelo(modelo, new Date())));
      renderEditor();
      const titulo = principal.querySelector('[data-campo="titulo"]');
      titulo?.focus();
      titulo?.setSelectionRange(titulo.value.length, titulo.value.length);
      return;
    }

    const acao = alvo.dataset.acao;
    const id = estado.aberta.id;
    if (acao === 'salvar') salvar({ depois: 'nova' });
    else if (acao === 'voltar') location.hash = '#anotacoes';
    else if (acao === 'descartar') {
      if (!confirm('Descartar as alterações não salvas?')) return;
      soltarAnexosNovos();
      estado.aberta.anexosNovos = [];
      estado.aberta.campos = { ...estado.aberta.original, etiquetas: [...estado.aberta.original.etiquetas] };
      apagarRascunho();
      estado.gravacao = estado.aberta.nova ? 'nova' : 'salvo';
      renderEditor();
      aviso('Alterações descartadas.');
    } else if (acao === 'recuperar') {
      const guardado = lerRascunho();
      if (guardado) {
        estado.aberta.campos = guardado.campos;
        renderEditor();
        mudarCampos(() => {});
        el('recuperar').innerHTML = '';
      }
    } else if (acao === 'ignorar-rascunho') {
      apagarRascunho();
      el('recuperar').innerHTML = '';
    } else if (acao === 'copiar') copiarTexto();
    else if (acao === 'fixar') alternarFixada();
    else if (acao === 'resolver') alternarResolvida(id);
    else if (acao === 'excluir') mandarParaLixeira(id);
    else if (acao === 'restaurar') restaurar(id);
    else if (acao === 'apagar-de-vez') apagarDeVez(id);
    else if (acao === 'sem-lembrete') mudarLembrete(null);
    else if (acao === 'anexar') el('arquivo')?.click();
    else if (acao === 'inserir-data' || acao === 'inserir-tarefa') {
      const area = principal.querySelector('[data-campo="texto"]');
      const d = new Date();
      let trecho = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — `;
      if (acao === 'inserir-tarefa') {
        // Linha de tarefa: no começo de uma linha vazia, ou numa linha nova.
        const antes = area.value.slice(0, area.selectionStart);
        trecho = antes === '' || antes.endsWith('\n') ? '[ ] ' : '\n[ ] ';
      }
      area.focus();
      area.setRangeText(trecho, area.selectionStart, area.selectionEnd, 'end');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  principal.addEventListener('input', (e) => {
    const campo = e.target.dataset?.campo;
    if (campo === 'titulo' || campo === 'texto') {
      mudarCampos((c) => {
        c[campo] = e.target.value;
      });
      if (campo === 'texto') {
        ajustarAltura();
        renderTexto();
      }
    }
  });

  principal.addEventListener('change', (e) => {
    const campo = e.target.dataset?.campo;
    if (!estado.aberta) return;
    const { lembrete } = estado.aberta.campos;
    if (campo === 'data') {
      mudarLembrete(e.target.value ? { data: e.target.value, hora: lembrete?.hora ?? null } : null);
    } else if (campo === 'hora') {
      // Hora sem dia vale para hoje.
      mudarLembrete({ data: lembrete?.data ?? chaveDoDia(new Date()), hora: e.target.value || null });
    } else if (e.target.dataset?.item !== undefined) {
      aplicarNoTexto(alternarItem(estado.aberta.campos.texto, Number(e.target.dataset.item)));
    } else if (e.target.dataset?.an === 'arquivo') {
      anexar([...e.target.files]);
      e.target.value = '';
    }
  });

  principal.addEventListener('keydown', (e) => {
    if (e.target.dataset?.campo === 'etiqueta' && (e.key === 'Enter' || e.key === ',')) {
      e.preventDefault();
      incluirEtiqueta(e.target, { continuar: true });
    }
    if (e.target.dataset?.campo === 'titulo' && e.key === 'Enter' && !e.ctrlKey) {
      e.preventDefault();
      principal.querySelector('[data-campo="texto"]')?.focus();
    }
  });

  principal.addEventListener('focusout', (e) => {
    if (e.target.dataset?.campo === 'etiqueta' && e.target.value.trim()) incluirEtiqueta(e.target);
  });

  // Colar print: Ctrl+V com uma imagem na área de transferência vira anexo; texto cola normal.
  principal.addEventListener('paste', (e) => {
    const arquivos = [...(e.clipboardData?.files ?? [])];
    if (!arquivos.length || !estado.aberta) return;
    e.preventDefault();
    anexar(arquivos);
  });

  principal.addEventListener('dragover', (e) => {
    if (!estado.aberta || !e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    principal.classList.add('an-soltando');
  });
  principal.addEventListener('dragleave', (e) => {
    if (!principal.contains(e.relatedTarget)) principal.classList.remove('an-soltando');
  });
  principal.addEventListener('drop', (e) => {
    principal.classList.remove('an-soltando');
    if (!estado.aberta || !e.dataTransfer?.files.length) return;
    e.preventDefault();
    anexar([...e.dataTransfer.files]);
  });

  /* ── Lateral ──────────────────────────────────────────────────────────────────────── */

  el('nova').addEventListener('click', () => irParaNova());

  // Entrada rápida: "ligar pro cliente amanhã 10h #retorno" vira anotação com lembrete e etiqueta.
  const rapida = el('rapida');
  let dataIgnorada = false;
  const lerRapida = () => {
    const texto = rapida.value;
    const etiquetas = [...texto.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{1,40})/gu)].map((m) => m[1]);
    const semEtiquetas = texto.replace(/(?:^|\s)#[\p{L}\p{N}_-]{1,40}/gu, ' ');
    const lido = dataIgnorada ? null : lerDataNatural(semEtiquetas, new Date());
    const titulo = (lido ? semOsTrechos(semEtiquetas, lido.trechos) : semEtiquetas).replace(/\s+/g, ' ').trim();
    return { titulo, lembrete: lido?.lembrete ?? null, etiquetas };
  };
  const mostrarRapida = () => {
    const { lembrete, etiquetas } = lerRapida();
    el('rapida-lido').innerHTML =
      htmlDataLida(lembrete, new Date()) + etiquetas.map((e) => `<span class="an-etiqueta an-cor-0">${esc(e)}</span>`).join('');
  };
  rapida.addEventListener('input', () => {
    if (!rapida.value.trim()) dataIgnorada = false;
    mostrarRapida();
  });
  el('rapida-lido').addEventListener('click', (e) => {
    if (e.target.closest('[data-an="ignorar-data"]')) {
      dataIgnorada = true;
      mostrarRapida();
      rapida.focus();
    }
  });
  el('form-rapida').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { titulo, lembrete, etiquetas } = lerRapida();
    if (!titulo) return;
    let nota = novaNota(novoId());
    nota = { ...nota, titulo: titulo.slice(0, LIMITES.titulo), lembrete, etiquetas: etiquetas.reduce(adicionarEtiqueta, []) };
    try {
      const salva = await naFila(() => repo.salvarNota(nota));
      estado.notas.unshift(salva);
      estado.recemSalva = salva.id;
      rapida.value = '';
      dataIgnorada = false;
      mostrarRapida();
      pedirPersistencia();
      avisarMudanca('aba');
      renderLateral();
      setTimeout(() => {
        if (estado.recemSalva === salva.id) {
          estado.recemSalva = null;
          renderLateral();
        }
      }, 1800);
      aviso(lembrete ? `Anotado · ${rotuloDoLembrete(salva, new Date())}.` : 'Anotado.', {
        acao: { rotulo: 'Abrir', fazer: () => (location.hash = linkDaNota(salva.id)) }
      });
    } catch (erro) {
      aviso(erro.message, { tipo: 'erro' });
    }
  });

  el('busca').addEventListener('input', (e) => {
    estado.termo = e.target.value;
    renderLateral();
  });
  el('busca').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.target.value = '';
      estado.termo = '';
      renderLateral();
    }
  });

  el('filtros').addEventListener('click', (e) => {
    const botao = e.target.closest('[data-filtro]');
    if (!botao) return;
    estado.filtro = botao.dataset.filtro;
    renderLateral();
  });

  el('visao').addEventListener('click', (e) => {
    const botao = e.target.closest('[data-visao]');
    if (!botao) return;
    estado.visao = botao.dataset.visao;
    gravarPreferencia('visao', estado.visao);
    renderLateral();
  });

  el('etiquetas-filtro').addEventListener('click', (e) => {
    const botao = e.target.closest('[data-etiqueta]');
    if (!botao) return;
    const nome = botao.dataset.etiqueta;
    estado.etiqueta = estado.etiqueta.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR') ? '' : nome;
    renderLateral();
  });

  // A bolinha do cartão resolve (ou reabre); na lixeira, restaurar.
  el('lista').addEventListener('click', (e) => {
    const resolver = e.target.closest('[data-resolver]');
    if (resolver) {
      e.preventDefault();
      return alternarResolvida(resolver.dataset.resolver, { daLista: true });
    }
    const restaurarBotao = e.target.closest('[data-restaurar]');
    if (restaurarBotao) {
      e.preventDefault();
      restaurar(restaurarBotao.dataset.restaurar);
    }
  });

  // Backup
  el('exportar').addEventListener('click', async () => {
    try {
      const dados = await exportarBackup(repo);
      const url = URL.createObjectURL(new Blob([JSON.stringify(dados)], { type: 'application/json' }));
      baixar(url, `anotacoes-mesa-xp-${chaveDoDia(new Date())}.json`);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      aviso(`Backup com ${dados.notas.length} anotação(ões) e ${dados.anexos.length} anexo(s) baixado.${sujo() ? ' A anotação aberta tem alterações não salvas: elas não foram no backup.' : ''}`);
    } catch (erro) {
      aviso(erro.message, { tipo: 'erro' });
    }
  });

  el('importar').addEventListener('click', () => el('arquivo-backup').click());
  el('arquivo-backup').addEventListener('change', async (e) => {
    const [arquivo] = e.target.files;
    e.target.value = '';
    if (!arquivo) return;
    try {
      const dados = JSON.parse(await arquivo.text());
      const r = await naFila(() => importarBackup(repo, dados));
      avisarMudanca('aba');
      await carregar();
      depoisDeMudar();
      aviso(`Importadas ${r.importadas} anotação(ões) e ${r.anexos} anexo(s)${r.ignoradas ? `; ${r.ignoradas} já estavam aqui` : ''}.`);
    } catch (erro) {
      aviso(erro instanceof SyntaxError ? 'Este arquivo não é um backup válido.' : erro.message, { tipo: 'erro' });
    }
  });

  // Preferências de alerta
  const som = el('som');
  som.checked = lerConfig().som;
  som.addEventListener('change', () => gravarConfig({ ...lerConfig(), som: som.checked }));

  const ROTULO_NOTIFICACAO = {
    ligado: 'Alertas do Windows: ligados',
    bloqueado: 'Alertas do Windows: bloqueados no navegador',
    desligado: 'Ligar alertas do Windows',
    indisponivel: ''
  };
  const mostrarNotificacoes = (situacao = estadoDasNotificacoes()) => {
    const botao = el('notificacoes');
    botao.textContent = ROTULO_NOTIFICACAO[situacao];
    botao.hidden = situacao === 'indisponivel';
    botao.disabled = situacao !== 'desligado';
  };
  mostrarNotificacoes();
  el('notificacoes').addEventListener('click', async () => {
    const situacao = await pedirNotificacoes();
    mostrarNotificacoes(situacao);
    if (situacao === 'bloqueado') aviso('O navegador bloqueou os alertas do Windows. O aviso na tela continua funcionando.', { tipo: 'erro' });
  });

  /* ── Teclado, rota e sincronização ────────────────────────────────────────────────── */

  document.addEventListener('keydown', (e) => {
    if (!naAba()) return;
    // Ctrl+S salva e continua; Ctrl+Enter salva e começa outra — de qualquer campo.
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      return salvar({ depois: 'ficar' });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && principal.contains(e.target)) {
      e.preventDefault();
      return salvar({ depois: 'nova' });
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      irParaNova();
    } else if (e.key === '/') {
      e.preventDefault();
      el('busca').focus();
    }
  });

  window.addEventListener('hashchange', () => {
    if (location.hash === '#anotacoes' || location.hash.startsWith('#anotacoes/')) seguirRota();
  });

  // Fechar ou recarregar a página com alteração não salva: o navegador pergunta antes.
  window.addEventListener('beforeunload', (e) => {
    if (!sujo()) return;
    guardarRascunhoJa();
    e.preventDefault();
    e.returnValue = '';
  });
  window.addEventListener('pagehide', () => {
    if (sujo()) guardarRascunhoJa();
  });

  // Outra parte gravou (o vigia adiou um lembrete, outra aba do navegador editou): relê.
  aoMudar(async (origem) => {
    if (origem === 'aba') return;
    const antes = estado.aberta && !estado.aberta.nova ? gravada(estado.aberta.id) : null;
    await carregar();
    const aberta = estado.aberta;
    const depois = aberta && !aberta.nova ? gravada(aberta.id) : null;
    if (depois && antes) {
      const mexeuNoLembrete = !mesmosCampos({ ...aberta.original, lembrete: aberta.campos.lembrete }, aberta.original);
      if (!sujo()) {
        Object.assign(aberta, { original: camposDe(depois), campos: camposDe(depois) });
        renderEditor({ manterFoco: true });
      } else if (!mexeuNoLembrete) {
        // Editando o texto enquanto o alerta adiou: o lembrete novo aparece, o texto fica.
        aberta.original.lembrete = camposDe(depois).lembrete;
        aberta.campos.lembrete = camposDe(depois).lembrete;
        renderLembrete();
      }
    }
    renderLateral();
  });

  // "Hoje às 14:00" vira "Venceu hoje às 14:00" sem ninguém mexer.
  setInterval(() => {
    if (!naAba() || !estado.carregou) return;
    renderLateral();
    if (!el('lembrete')?.contains(document.activeElement)) renderLembrete();
  }, 30_000);

  carregar()
    .then(limparLixeira)
    .then(() => {
      if (!estado.carregou) return;
      renderLateral();
      seguirRota();
    });
};

function lerPreferencia(nome, padrao) {
  try {
    return JSON.parse(localStorage.getItem('mesa_anotacoes_tela') || '{}')[nome] ?? padrao;
  } catch {
    return padrao;
  }
}

function gravarPreferencia(nome, valor) {
  try {
    const atual = JSON.parse(localStorage.getItem('mesa_anotacoes_tela') || '{}');
    localStorage.setItem('mesa_anotacoes_tela', JSON.stringify({ ...atual, [nome]: valor }));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

const MARCACAO = `
<div class="an">
  <aside class="an-lateral" aria-label="Minhas anotações">
    <div class="an-lateral-topo">
      <h2 class="panel-title">Minhas anotações</h2>
      <button type="button" class="copy-btn btn-primario an-nova" data-an="nova" title="Nova anotação (N)">Nova</button>
    </div>

    <form class="an-rapida" data-an="form-rapida" autocomplete="off">
      <input data-an="rapida" placeholder="Anotar rápido… ex.: ligar pro cliente amanhã 10h #retorno" aria-label="Anotar rápido" maxlength="200" />
      <div class="an-rapida-lido" data-an="rapida-lido" aria-live="polite"></div>
    </form>

    <label class="an-busca">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>
      <input type="search" data-an="busca" placeholder="Buscar ( / )" aria-label="Buscar nas anotações" autocomplete="off" />
    </label>

    <div class="an-visao-linha">
      <div class="segmentado an-visao" data-an="visao" role="group" aria-label="Visão">
        <button type="button" class="seg" data-visao="lista">Lista</button>
        <button type="button" class="seg" data-visao="agenda">Planejado</button>
      </div>
    </div>
    <div class="an-filtros" data-an="filtros" role="group" aria-label="Filtrar"></div>
    <div class="an-etiquetas" data-an="etiquetas-filtro" role="group" aria-label="Etiquetas"></div>
    <div data-an="erro"></div>
    <nav class="an-lista" data-an="lista" aria-label="Anotações"></nav>

    <div class="an-lateral-pe">
      <p class="an-privado">Só neste navegador — ninguém mais vê.
        <button type="button" class="an-link" data-an="exportar">Exportar backup</button> ·
        <button type="button" class="an-link" data-an="importar">Importar</button>
      </p>
      <div class="an-config">
        <label class="an-som"><input type="checkbox" data-an="som" /> Som no alerta</label>
        <button type="button" class="an-link" data-an="notificacoes"></button>
      </div>
      <input type="file" accept="application/json,.json" hidden data-an="arquivo-backup" />
    </div>
  </aside>

  <section class="an-principal" data-an="principal" aria-label="Anotação aberta"></section>

  <dialog class="an-visor" data-an="visor" aria-labelledby="an-visor-nome">
    <div class="an-visor-topo">
      <strong id="an-visor-nome" data-an="visor-nome"></strong>
      <div class="an-visor-acoes">
        <button type="button" class="copy-btn btn-primario" data-an="visor-copiar">Copiar imagem</button>
        <button type="button" class="copy-btn" data-an="visor-baixar">Baixar</button>
        <button type="button" class="copy-btn an-perigo" data-an="visor-remover">Remover</button>
        <button type="button" class="icon-close-btn" data-an="visor-fechar" aria-label="Fechar">&times;</button>
      </div>
    </div>
    <img data-an="visor-img" alt="" />
  </dialog>
</div>`;
