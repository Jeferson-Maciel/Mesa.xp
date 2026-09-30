import { aviso } from '../../ui/avisos.js';
import { criarCena } from '../../ui/cena.js';
import { esc } from '../../ui/html.js';
import { abrirJanela } from '../../ui/janela.js';
import { exportarBackup, importarBackup } from './backup.js';
import { repositorioDasAnotacoes } from './banco.js';
import { aoMudar, avisarMudanca } from './eventos.js';
import { aplicarAtalho, chaveDoDia, rotuloDoLembrete } from './lembretes.js';
import { adicionarEtiqueta, contagens, estaVazia, etiquetasEmUso, filtrarNotas, novaNota } from './notas.js';
import {
  htmlAnexos,
  htmlEditor,
  htmlEtiquetasEditor,
  htmlEtiquetasFiltro,
  htmlFiltros,
  htmlLembrete,
  htmlLinks,
  htmlLista,
  linkDaNota
} from './render.js';
import { novoId } from './repositorio.js';
import { estadoDasNotificacoes, gravarConfig, lerConfig, pedirNotificacoes } from './vigia.js';
import './anotacoes.css';

/**
 * Anotações — o bloco de notas de cada um, com lembretes.
 *
 * Lista à esquerda (busca, filtros por estado, etiquetas), anotação aberta à direita. Escreve-se
 * como num bloco de notas: salva sozinho, cola print com Ctrl+V, link vira botão. Um lembrete
 * deixa a anotação amarela até o dia; no dia (ou na hora) ela fica vermelha e o vigia (vigia.js)
 * avisa na tela, em qualquer aba.
 *
 * As anotações ficam no navegador de quem usa (repositorio.js explica por quê). O backup leva
 * para outro computador.
 *
 * Rotas: `#anotacoes` e `#anotacoes/nota/<id>`.
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
    selecionada: null, // id da anotação aberta
    noEditor: null // id da anotação desenhada no editor
  };

  const atual = () => estado.notas.find((n) => n.id === estado.selecionada) ?? null;
  const naAba = () => !secao.hidden;
  const idDaRota = () => {
    const [, tipo, id] = location.hash.replace(/^#\/?/, '').split('/');
    return tipo === 'nota' && id ? decodeURIComponent(id) : null;
  };

  /* ── Gravação ─────────────────────────────────────────────────────────────────────────
     Toda escrita passa por uma fila: um anexo que entra enquanto o texto está sendo salvo não pode
     ser apagado pela gravação do texto, que leu a anotação antes dele. */

  let fila = Promise.resolve();
  const naFila = (tarefa) => {
    const feito = fila.then(tarefa);
    fila = feito.catch(() => {});
    return feito;
  };

  let pedidoPersistencia = false;
  const pedirPersistencia = () => {
    // O navegador pode limpar dados de um site sob falta de espaço; pedindo, ele guarda para sempre
    // (só em HTTPS; aberto do disco, fica como está).
    if (pedidoPersistencia) return;
    pedidoPersistencia = true;
    navigator.storage?.persist?.().catch(() => {});
  };

  const mostrarSalvo = (texto) => {
    const alvo = el('salvo');
    if (alvo) alvo.textContent = texto;
  };

  let espera = null;
  let pendente = false;

  const salvarAgora = () => {
    clearTimeout(espera);
    if (!pendente) return fila;
    pendente = false;
    return naFila(async () => {
      const nota = atual();
      if (!nota) return;
      try {
        const gravada = await repo.salvarNota(nota);
        nota.atualizadaEm = gravada.atualizadaEm;
        pedirPersistencia();
        mostrarSalvo(`Salvo às ${new Date(gravada.atualizadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
        avisarMudanca('aba');
      } catch (erro) {
        pendente = true;
        mostrarSalvo('Não salvou');
        aviso(erro.message, { tipo: 'erro' });
      }
    });
  };

  const agendarSalvar = () => {
    pendente = true;
    mostrarSalvo('Salvando…');
    clearTimeout(espera);
    espera = setTimeout(salvarAgora, 450);
  };

  /** Muda a anotação aberta, redesenha a lista e salva (já, ou daqui a pouco se é digitação). */
  const alterar = (mudanca, { ja = true } = {}) => {
    const nota = atual();
    if (!nota) return;
    mudanca(nota);
    renderLateral();
    if (ja) {
      pendente = true;
      salvarAgora();
    } else {
      agendarSalvar();
    }
  };

  /* ── Carga ────────────────────────────────────────────────────────────────────────── */

  async function carregar() {
    try {
      const lidas = await repo.listarNotas();
      // A anotação aberta com digitação por salvar fica como está na tela: a versão local é a mais nova.
      const local = pendente ? atual() : null;
      estado.notas = local ? lidas.map((n) => (n.id === local.id ? local : n)) : lidas;
      estado.carregou = true;
      el('erro').innerHTML = '';
    } catch (erro) {
      console.error(erro);
      el('erro').innerHTML = `<div class="alert alert-danger" role="alert">${esc(erro.message)}</div>`;
    }
    render();
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
    const visiveis = filtrarNotas(estado.notas, estado, agora);
    el('lista').innerHTML = htmlLista({ notas: visiveis, agora, selecionada: estado.selecionada, filtro: estado.filtro, termo: estado.termo });
  }

  function renderPrincipal() {
    const nota = atual();
    raiz.classList.toggle('com-nota', Boolean(nota));
    if (!nota) {
      estado.noEditor = null;
      encenar('vazio');
      principal.innerHTML = `
        <div class="an-boas-vindas">
          <div class="empty-state">
            <p>${estado.notas.length ? 'Escolha uma anotação ao lado, ou comece outra.' : 'Seu bloco de notas da mesa.'}</p>
            <span>Escreva o que precisa lembrar, cole os prints com Ctrl+V e marque um lembrete: a anotação fica amarela até o dia e vermelha quando chegar a hora — com aviso na tela, em qualquer aba.</span>
            <button type="button" class="copy-btn btn-primario" data-acao="nova">Nova anotação</button>
          </div>
          <ul class="an-atalhos-teclado">
            <li><kbd>N</kbd> nova anotação</li>
            <li><kbd>/</kbd> buscar</li>
            <li><kbd>Ctrl</kbd>+<kbd>V</kbd> colar print</li>
            <li><kbd>Alt</kbd>+<kbd>5</kbd> esta aba</li>
          </ul>
        </div>`;
      return;
    }
    if (estado.noEditor === nota.id) return; // já desenhado: as partes se atualizam sozinhas
    estado.noEditor = nota.id;
    encenar(nota.id);
    principal.innerHTML = htmlEditor({ nota, agora: new Date(), sugestoes: etiquetasEmUso(estado.notas).map((e) => e.nome) });
    mostrarSalvo(nota.atualizadaEm ? `Salvo às ${new Date(nota.atualizadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '');
    ajustarAltura();
    carregarMiniaturas();
  }

  function render() {
    if (!estado.carregou) return;
    renderLateral();
    renderPrincipal();
  }

  // As partes do editor que mudam sem redesenhar o texto (o cursor não pode pular no meio da digitação).
  const renderLembrete = () => {
    const nota = atual();
    const alvo = el('lembrete');
    if (nota && alvo) alvo.innerHTML = htmlLembrete(nota, new Date());
  };
  const renderEtiquetas = () => {
    const nota = atual();
    const alvo = el('etiquetas');
    if (nota && alvo) alvo.innerHTML = htmlEtiquetasEditor(nota, etiquetasEmUso(estado.notas).map((e) => e.nome));
  };
  const renderAnexos = () => {
    const nota = atual();
    const alvo = el('anexos');
    if (nota && alvo) alvo.innerHTML = htmlAnexos(nota.anexos);
    carregarMiniaturas();
  };
  const renderBarra = () => {
    const nota = atual();
    const fixar = principal.querySelector('[data-acao="fixar"]');
    const resolver = principal.querySelector('[data-acao="resolver"]');
    if (!nota || !fixar) return;
    fixar.setAttribute('aria-pressed', String(nota.fixada));
    fixar.textContent = nota.fixada ? 'Fixada' : 'Fixar';
    resolver.textContent = nota.concluida ? 'Reabrir' : 'Resolvido';
  };

  // O texto cresce com o que se escreve, em vez de rolar dentro de uma caixa pequena.
  const ajustarAltura = () => {
    const texto = principal.querySelector('[data-campo="texto"]');
    if (!texto) return;
    texto.style.height = 'auto';
    texto.style.height = `${Math.max(texto.scrollHeight + 2, 260)}px`;
  };

  /* ── Anexos ───────────────────────────────────────────────────────────────────────── */

  const enderecos = new Map(); // anexoId → object URL do arquivo

  const enderecoDe = async (anexoId) => {
    if (enderecos.has(anexoId)) return enderecos.get(anexoId);
    const blob = await repo.lerAnexo(anexoId);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    enderecos.set(anexoId, url);
    return url;
  };

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

  async function anexar(arquivos) {
    const nota = atual();
    if (!nota || !arquivos.length) return;
    await salvarAgora();
    let feitos = 0;
    for (const arquivo of arquivos) {
      try {
        await naFila(async () => {
          const ficha = await repo.adicionarAnexo(nota.id, arquivo, { nome: nomeDoArquivo(arquivo) });
          nota.anexos = [...nota.anexos, ficha];
          nota.atualizadaEm = Date.now();
        });
        feitos++;
      } catch (erro) {
        aviso(erro.message, { tipo: 'erro' });
      }
    }
    if (feitos) {
      pedirPersistencia();
      avisarMudanca('aba');
      renderAnexos();
      renderLateral();
      aviso(feitos === 1 ? 'Anexado à anotação.' : `${feitos} arquivos anexados.`);
    }
  }

  const visor = el('visor');
  let noVisor = null;

  async function abrirAnexo(anexoId, origem) {
    const nota = atual();
    const ficha = nota?.anexos.find((a) => a.id === anexoId);
    if (!ficha) return;
    const url = await enderecoDe(anexoId);
    if (!url) return aviso('O arquivo deste anexo não foi encontrado.', { tipo: 'erro' });
    if (!ficha.tipo.startsWith('image/')) return baixar(url, ficha.nome);
    noVisor = ficha;
    el('visor-img').src = url;
    el('visor-img').alt = ficha.nome;
    el('visor-nome').textContent = ficha.nome;
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
      const png = await comoPng(await repo.lerAnexo(noVisor.id));
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
    const nota = atual();
    if (!nota || !noVisor || !confirm(`Remover "${noVisor.nome}" desta anotação?`)) return;
    const ficha = noVisor;
    visor.close();
    try {
      await naFila(() => repo.removerAnexo(nota.id, ficha.id));
      nota.anexos = nota.anexos.filter((a) => a.id !== ficha.id);
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

  /* ── Ações ────────────────────────────────────────────────────────────────────────── */

  async function nova() {
    await salvarAgora();
    const nota = novaNota(novoId());
    try {
      await naFila(() => repo.salvarNota(nota));
    } catch (erro) {
      return aviso(erro.message, { tipo: 'erro' });
    }
    estado.notas.unshift(nota);
    Object.assign(estado, { filtro: 'todas', etiqueta: '', termo: '' });
    el('busca').value = '';
    avisarMudanca('aba');
    location.hash = linkDaNota(nota.id);
    requestAnimationFrame(() => principal.querySelector('[data-campo="titulo"]')?.focus());
  }

  // Anotação aberta e abandonada sem nada escrito não fica na lista.
  async function descartarSeVazia(id) {
    const nota = estado.notas.find((n) => n.id === id);
    if (!nota || !estaVazia(nota)) return;
    estado.notas = estado.notas.filter((n) => n.id !== id);
    try {
      await naFila(() => repo.excluirNota(id));
      avisarMudanca('aba');
    } catch (erro) {
      console.error(erro);
    }
  }

  async function abrirDaRota() {
    const id = idDaRota();
    if (id === estado.selecionada) return render();
    const anterior = estado.selecionada;
    await salvarAgora();
    estado.selecionada = id && estado.notas.some((n) => n.id === id) ? id : null;
    if (anterior && anterior !== estado.selecionada) await descartarSeVazia(anterior);
    render();
    if (id && !estado.selecionada && estado.carregou) aviso('Esta anotação não existe mais neste navegador.', { tipo: 'erro' });
  }

  async function excluir() {
    const nota = atual();
    if (!nota || !confirm('Excluir esta anotação e os anexos dela? Não dá para desfazer.')) return;
    clearTimeout(espera);
    pendente = false;
    try {
      await naFila(() => repo.excluirNota(nota.id));
    } catch (erro) {
      return aviso(erro.message, { tipo: 'erro' });
    }
    for (const a of nota.anexos) {
      URL.revokeObjectURL(enderecos.get(a.id));
      enderecos.delete(a.id);
    }
    estado.notas = estado.notas.filter((n) => n.id !== nota.id);
    estado.selecionada = null;
    avisarMudanca('aba');
    location.hash = '#anotacoes';
    aviso('Anotação excluída.');
  }

  const mudarLembrete = (lembrete) => {
    alterar((n) => {
      n.lembrete = lembrete;
      if (lembrete && n.concluida) {
        n.concluida = false;
        n.concluidaEm = null;
        renderBarra();
      }
    });
    renderLembrete();
    if (lembrete) aviso(`Lembrete marcado: ${rotuloDoLembrete(atual(), new Date())}.`);
  };

  // Com Enter, o cursor volta para o campo, pronto para a próxima etiqueta; saindo do campo (clique
  // em outro lugar), a etiqueta entra e o cursor fica onde a pessoa clicou.
  const incluirEtiqueta = (campo, { continuar = false } = {}) => {
    const texto = campo.value;
    if (!texto.trim()) return;
    alterar((n) => {
      n.etiquetas = adicionarEtiqueta(n.etiquetas, texto);
    });
    renderEtiquetas();
    if (continuar) principal.querySelector('[data-campo="etiqueta"]')?.focus();
  };

  principal.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-acao], [data-atalho], [data-remover-etiqueta], [data-anexo]');
    if (!alvo) return;
    if (alvo.dataset.atalho) return mudarLembrete(aplicarAtalho(alvo.dataset.atalho, new Date()));
    if (alvo.dataset.removerEtiqueta !== undefined) {
      alterar((n) => {
        n.etiquetas = n.etiquetas.filter((x) => x !== alvo.dataset.removerEtiqueta);
      });
      return renderEtiquetas();
    }
    if (alvo.dataset.anexo) return abrirAnexo(alvo.dataset.anexo, alvo);

    const acao = alvo.dataset.acao;
    if (acao === 'nova') nova();
    else if (acao === 'voltar') location.hash = '#anotacoes';
    else if (acao === 'excluir') excluir();
    else if (acao === 'sem-lembrete') {
      mudarLembrete(null);
      aviso('Lembrete tirado.');
    } else if (acao === 'fixar') {
      alterar((n) => {
        n.fixada = !n.fixada;
      });
      renderBarra();
    } else if (acao === 'resolver') {
      alterar((n) => {
        n.concluida = !n.concluida;
        n.concluidaEm = n.concluida ? Date.now() : null;
      });
      renderBarra();
      renderLembrete();
      aviso(atual().concluida ? 'Resolvida. Ela fica guardada em "Resolvidas".' : 'Anotação reaberta.');
    } else if (acao === 'anexar') {
      el('arquivo')?.click();
    } else if (acao === 'inserir-data') {
      const texto = principal.querySelector('[data-campo="texto"]');
      const d = new Date();
      const carimbo = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — `;
      texto.focus();
      texto.setRangeText(carimbo, texto.selectionStart, texto.selectionEnd, 'end');
      texto.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  principal.addEventListener('input', (e) => {
    const campo = e.target.dataset?.campo;
    if (campo === 'titulo' || campo === 'texto') {
      alterar(
        (n) => {
          n[campo] = e.target.value;
        },
        { ja: false }
      );
      if (campo === 'texto') {
        ajustarAltura();
        el('links').innerHTML = htmlLinks(e.target.value);
      }
    }
  });

  principal.addEventListener('change', (e) => {
    const campo = e.target.dataset?.campo;
    const nota = atual();
    if (!nota) return;
    if (campo === 'data') {
      mudarLembrete(e.target.value ? { data: e.target.value, hora: nota.lembrete?.hora ?? null } : null);
    } else if (campo === 'hora') {
      // Hora sem dia vale para hoje.
      mudarLembrete({ data: nota.lembrete?.data ?? chaveDoDia(new Date()), hora: e.target.value || null });
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
    if (e.target.dataset?.campo === 'titulo' && e.key === 'Enter') {
      e.preventDefault();
      principal.querySelector('[data-campo="texto"]')?.focus();
    }
  });

  principal.addEventListener('focusout', (e) => {
    if (e.target.dataset?.campo === 'etiqueta' && e.target.value.trim()) incluirEtiqueta(e.target);
    if (e.target.dataset?.campo === 'titulo' || e.target.dataset?.campo === 'texto') salvarAgora();
  });

  // Colar print: Ctrl+V com uma imagem na área de transferência vira anexo; texto cola normal.
  principal.addEventListener('paste', (e) => {
    const arquivos = [...(e.clipboardData?.files ?? [])];
    if (!arquivos.length || !atual()) return;
    e.preventDefault();
    anexar(arquivos);
  });

  // Arrastar arquivos para a anotação aberta.
  principal.addEventListener('dragover', (e) => {
    if (!atual() || !e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    principal.classList.add('an-soltando');
  });
  principal.addEventListener('dragleave', (e) => {
    if (!principal.contains(e.relatedTarget)) principal.classList.remove('an-soltando');
  });
  principal.addEventListener('drop', (e) => {
    principal.classList.remove('an-soltando');
    if (!atual() || !e.dataTransfer?.files.length) return;
    e.preventDefault();
    anexar([...e.dataTransfer.files]);
  });

  /* ── Lateral ──────────────────────────────────────────────────────────────────────── */

  el('nova').addEventListener('click', nova);

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

  el('etiquetas-filtro').addEventListener('click', (e) => {
    const botao = e.target.closest('[data-etiqueta]');
    if (!botao) return;
    const nome = botao.dataset.etiqueta;
    estado.etiqueta = estado.etiqueta.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR') ? '' : nome;
    renderLateral();
  });

  // Backup
  el('exportar').addEventListener('click', async () => {
    await salvarAgora();
    try {
      const dados = await exportarBackup(repo);
      const url = URL.createObjectURL(new Blob([JSON.stringify(dados)], { type: 'application/json' }));
      baixar(url, `anotacoes-mesa-xp-${chaveDoDia(new Date())}.json`);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      aviso(`Backup com ${dados.notas.length} anotação(ões) e ${dados.anexos.length} anexo(s) baixado.`);
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
    if (!naAba() || e.ctrlKey || e.metaKey || e.altKey) return;
    const digitando = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
    if (digitando) return;
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      nova();
    } else if (e.key === '/') {
      e.preventDefault();
      el('busca').focus();
    }
  });

  window.addEventListener('hashchange', () => {
    if (location.hash === '#anotacoes' || location.hash.startsWith('#anotacoes/')) abrirDaRota();
  });

  // Outra parte gravou (o vigia adiou um lembrete, outra aba do navegador editou): relê.
  aoMudar(async (origem) => {
    if (origem === 'aba') return;
    await carregar();
    renderLembrete();
    renderBarra();
  });

  // Quem sai da aba do navegador ou fecha a página não perde a última palavra.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) salvarAgora();
  });
  window.addEventListener('pagehide', () => salvarAgora());

  // "Hoje às 14:00" vira "Venceu hoje às 14:00" sem ninguém mexer.
  setInterval(() => {
    if (!naAba() || !estado.carregou) return;
    renderLateral();
    const foco = document.activeElement;
    if (!principal.querySelector('[data-an="lembrete"]')?.contains(foco)) renderLembrete();
  }, 30_000);

  carregar().then(abrirDaRota);
};

const MARCACAO = `
<div class="an">
  <aside class="an-lateral" aria-label="Minhas anotações">
    <div class="an-lateral-topo">
      <h2 class="panel-title">Minhas anotações</h2>
      <button type="button" class="copy-btn btn-primario an-nova" data-an="nova" title="Nova anotação (N)">Nova</button>
    </div>
    <label class="an-busca">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>
      <input type="search" data-an="busca" placeholder="Buscar nas anotações ( / )" aria-label="Buscar nas anotações" autocomplete="off" />
    </label>
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
