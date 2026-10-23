import { aviso } from '../../ui/avisos.js';
import { esc } from '../../ui/html.js';
import { normalizarBusca } from '../../comum/busca.js';
import { criarCena } from '../../ui/cena.js';
import { abrirJanela } from '../../ui/janela.js';
import { pedirAnotacao } from '../../comum/anotarDeFora.js';
import { aoMudarAFila, avisarMudancaNaFila } from '../../comum/fila/eventos.js';
import { NOMES_DOS_GRUPOS, destinoDaBoleta, diaDe, fichaDeExecucao, inicioDaVista, linkDaBoleta, mudarEstado, ordensDoLote, pedidosDaVista, prazoPerto, resumoDoDia, vencidosDaGuarda } from '../../comum/fila/regras.js';
import { filaDaPagina } from '../../comum/fila/repositorio.js';
import { quandoHouver, registrarServico, servico } from '../../comum/servicos.js';
import { PASTAS, htmlConferir, htmlFicha, htmlLista, htmlLote, htmlPastas, pastaDoEstado } from './render.js';
import { ligarModalResumo } from './resumo.js';
import { criarVigiaDoOutlook } from './vigiaOutlook.js';
import { criarVigiaDePrazos } from './vigiaPrazos.js';
import './fila.css';

const CHAVE_DA_VISTA = 'mesa_fila_vista';
const lerVista = () => {
  try {
    return localStorage.getItem(CHAVE_DA_VISTA) === 'tabela' ? 'tabela' : 'cartoes';
  } catch {
    return 'cartoes';
  }
};
const gravarVista = (vista) => {
  try {
    localStorage.setItem(CHAVE_DA_VISTA, vista);
  } catch {
    // sem armazenamento, a vista vale só até recarregar
  }
};

/**
 * A Fila do dia: o caminho de cada pedido depois que o e-mail sai (as regras em
 * `src/comum/fila/regras.js`). Uma caixa de entrada com pastas (21/10/2026, "me acostumei com o
 * e-mail limpo"): à vista, **Aprovação e execução** — o que o cliente respondeu, ou foi aprovado, e
 * falta executar, com a resposta, a ficha de execução e a boleta do Hub. **Enviados** e **Executados**
 * são pastas, abertas só para mudar ou conferir alguma coisa. Os pedidos vêm do Ordens (ao copiar ou
 * abrir um e-mail no Outlook) e ficam só neste navegador.
 *
 * @param {HTMLElement} secao a seção `#modulo-fila`
 */
export const iniciarFila = (secao) => {
  secao.innerHTML = MARCACAO;
  const repo = filaDaPagina();
  const el = (nome) => secao.querySelector(`[data-fl="${nome}"]`);
  const encenar = criarCena(secao.querySelector('.fl'));
  const ui = {
    pastas: el('pastas'),
    lista: el('lista'),
    subtitulo: el('subtitulo'),
    dia: el('dia'),
    busca: el('busca'),
    janela: el('janela'),
    janelaTitulo: el('janela-titulo'),
    janelaCorpo: el('janela-corpo'),
    outlook: el('outlook'),
    conferir: el('conferir'),
    vista: el('vista')
  };
  // Abre sempre em Aprovação e execução: a caixa limpa, com o que falta fazer.
  const estado = { dia: diaDe(Date.now()), pedidos: [], busca: '', aberto: null, pasta: 'executar', vista: lerVista(), selecionadoId: null };
  const hoje = () => diaDe(Date.now());

  /* ── Carregar e mostrar ───────────────────────────────────────────────────────────── */

  async function carregar() {
    try {
      // Hoje, também o que ficou aberto dos últimos dias (regras.js).
      estado.pedidos = estado.dia === hoje() ? pedidosDaVista(await repo.listarDesde(inicioDaVista()), estado.dia) : await repo.listarDoDia(estado.dia);
      render();
    } catch (erro) {
      ui.lista.innerHTML = `<div class="alert alert-danger">${esc(erro.message)}</div>`;
    }
  }

  const semAcento = normalizarBusca;
  const filtrados = () => {
    const termo = semAcento(estado.busca).trim();
    if (!termo) return estado.pedidos;
    return estado.pedidos.filter((p) => semAcento([p.conta, p.cliente?.nome, NOMES_DOS_GRUPOS[p.grupo], ...p.ordens.map((o) => o.ativo)].join(' ')).includes(termo));
  };

  function render() {
    const agora = Date.now();
    const lista = filtrados();
    ui.pastas.innerHTML = htmlPastas(lista, estado.pasta, agora);
    ui.lista.innerHTML = htmlLista(lista, estado.pasta, agora, { vista: estado.vista });
    ui.vista.hidden = estado.pasta !== 'executar';
    for (const b of ui.vista.querySelectorAll('[data-vista]')) b.setAttribute('aria-pressed', String(b.dataset.vista === estado.vista));
    // A entrada só quando a vista muda: outro dia, outra pasta, um pedido que chegou ou saiu dela —
    // não a cada 30 s, nem a cada letra da busca.
    encenar(`${estado.dia}|${estado.pasta}|${estado.pedidos.filter((p) => pastaDoEstado(p.estado) === estado.pasta).map((p) => p.id).join(',')}`);
    ui.lista.dataset.pasta = estado.pasta;
    // O pedido que a busca, o aviso de prazo ou o histórico do Ordens pediu: à vista uma vez, e aceso
    // até a pessoa mudar de pasta ou de busca (o redesenho de 30 s não o apaga).
    if (estado.destaque) {
      const alvo = ui.lista.querySelector(`[data-id="${CSS.escape(estado.destaque.id)}"]`);
      alvo?.classList.add('fl-destaque');
      if (alvo && !estado.destaque.visto) {
        estado.destaque.visto = true;
        alvo.classList.add('fl-acende');
        alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      estado.selecionadoId = estado.destaque.id;
    } else if (estado.selecionadoId) {
      const alvo = ui.lista.querySelector(`[data-id="${CSS.escape(estado.selecionadoId)}"]`);
      if (alvo) {
        alvo.classList.add('fl-destaque');
      } else {
        estado.selecionadoId = null;
      }
    }
    ui.dia.value = estado.dia;
    const [ano, mes, d] = estado.dia.split('-');
    const nome = estado.dia === hoje() ? 'hoje' : new Date(Number(ano), Number(mes) - 1, Number(d)).toLocaleDateString('pt-BR', { weekday: 'long' });
    ui.subtitulo.textContent = `${nome}, ${d}/${mes} · ${estado.pedidos.length} ${estado.pedidos.length === 1 ? 'pedido' : 'pedidos'}`;
    renderOutlook();
  }

  // O vigia das respostas no Outlook: a situação no alto e as respostas a conferir.
  function renderOutlook() {
    const vigia = servico('vigiaDoOutlook');
    const situacao = vigia?.situacao() ?? { tipo: 'sem-robo', texto: 'Outlook: sem o robô', titulo: 'Instale o robô do Hub (no Ordens, "Instalar robô") para ver as respostas dos clientes aqui.' };
    ui.outlook.dataset.tipo = situacao.tipo;
    ui.outlook.textContent = situacao.texto;
    ui.outlook.title = situacao.titulo;
    const conferir = vigia && estado.dia === hoje() && estado.pasta === 'executar' ? htmlConferir(vigia.soltas(), estado.pedidos) : '';
    ui.conferir.hidden = !conferir;
    ui.conferir.innerHTML = conferir;
  }
  quandoHouver('vigiaDoOutlook', (vigia) => {
    vigia.aoMudar(renderOutlook);
    renderOutlook();
  });

  ui.conferir.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-acao]');
    const vigia = servico('vigiaDoOutlook');
    const idResposta = botao?.closest('[data-resposta]')?.dataset.resposta;
    if (!botao || !vigia || !idResposta) return;
    if (botao.dataset.acao === 'atribuir') vigia.atribuir(idResposta, botao.dataset.pedido);
    if (botao.dataset.acao === 'ignorar') vigia.ignorar(idResposta);
  });

  // A chave Cartões / Tabela de Aprovação e execução, lembrada neste navegador.
  ui.vista.addEventListener('click', (e) => {
    const vista = e.target.closest('[data-vista]')?.dataset.vista;
    if (!vista || vista === estado.vista) return;
    estado.vista = vista;
    gravarVista(vista);
    render();
  });

  // O menu "…" da linha: um aberto por vez; fecha com um clique fora, ao escolher ou com Esc.
  const fecharMenus = (exceto = null) => ui.lista.querySelectorAll('.fl-menu[open]').forEach((m) => m !== exceto && m.removeAttribute('open'));
  ui.lista.addEventListener('toggle', (e) => e.target.matches?.('.fl-menu[open]') && fecharMenus(e.target), true);
  document.addEventListener('click', (e) => !e.target.closest?.('.fl-menu') && fecharMenus());

  ui.pastas.addEventListener('click', (e) => {
    const pasta = e.target.closest('[data-pasta]')?.dataset.pasta;
    if (!pasta || pasta === estado.pasta) return;
    estado.pasta = pasta;
    estado.destaque = null;
    render();
  });

  /* ── Mexer num pedido ─────────────────────────────────────────────────────────────── */

  const doId = (id) => estado.pedidos.find((p) => p.id === id);
  const nomeDaPasta = (estadoDoPedido) => PASTAS.find((p) => p.id === pastaDoEstado(estadoDoPedido))?.titulo ?? '';

  async function mudar(id, novo, { desfazendo = false } = {}) {
    const pedido = doId(id);
    if (!pedido || pedido.estado === novo) return;
    const atualizado = mudarEstado(pedido, novo);
    estado.pedidos = estado.pedidos.map((p) => (p.id === id ? atualizado : p));
    render();
    try {
      await repo.salvar(atualizado);
      avisarMudancaNaFila('fila');
    } catch (erro) {
      aviso(erro.message, { tipo: 'erro' });
      carregar();
      return;
    }
    // O pedido sai da pasta aberta: o aviso diz para onde foi, com o "Desfazer".
    if (!desfazendo) {
      const texto = novo === 'cancelado' ? `Conta ${pedido.conta}: cancelado.` : `Conta ${pedido.conta}: está em ${nomeDaPasta(novo)}.`;
      aviso(texto, { acao: { rotulo: 'Desfazer', fazer: () => mudar(id, pedido.estado, { desfazendo: true }) } });
    }
  }

  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      return false;
    }
  }

  function abrirFicha(pedido, origem) {
    estado.aberto = pedido.id;
    ui.janelaTitulo.textContent = `Ficha de execução · conta ${pedido.conta}`;
    ui.janelaCorpo.innerHTML = htmlFicha(pedido, Date.now());
    abrirJanela(ui.janela, origem);
  }

  /*
   * "Gerar lote": o Lote Simples e o Lote TWAP do pedido, pelas regras do Ordens (o serviço
   * ordens.lotes), com as quantidades do e-mail aprovado (regras.js, ordensDoLote).
   */
  function abrirLote(pedido, origem) {
    const formatar = servico('ordens.lotes');
    const { fora, semSimples, paraSimples, paraTwap, misto } = ordensDoLote(pedido);
    const de = (ordens) => ({ conta: pedido.conta, ordens, horario: pedido.horario ?? null });
    const lotes = {
      simples: formatar && paraSimples.length ? formatar.simples(de(paraSimples)) : null,
      twap: formatar && paraTwap.length ? formatar.twap(de(paraTwap)) : null,
      fora,
      semSimples,
      misto
    };
    estado.aberto = pedido.id;
    estado.lotes = lotes;
    ui.janelaTitulo.textContent = `Lote · conta ${pedido.conta}`;
    ui.janelaCorpo.innerHTML = htmlLote(pedido, lotes, Date.now());
    abrirJanela(ui.janela, origem);
  }

  /*
   * A boleta certa: o robô (1.10.0) abre uma aba do Hub à vista e leva até ela — a boleta do fundo, ou
   * o Tesouro do cliente. Sem o robô da versão certa, o link direto, numa aba nova.
   */
  function abrirBoleta(pedido, indice) {
    const ordem = pedido.ordens[indice];
    const destino = ordem ? destinoDaBoleta(ordem, pedido.conta, pedido.grupo) : null;
    if (!destino) return;
    const robo = servico('robo');
    if (robo?.presente && servico('roboAtende')?.(robo.versao) && robo.abrirParaExecutar(destino)) {
      aviso(destino.tipo === 'tesouro' ? 'O robô está abrindo o Tesouro Direto com o cliente da conta.' : 'O robô está abrindo a boleta no Hub.');
      return;
    }
    const link = linkDaBoleta(ordem, pedido.conta, pedido.grupo);
    if (link) window.open(link, '_blank', 'noopener');
    if (!robo?.presente) aviso('Sem o robô, a boleta abre pelo endereço: confira o cliente e o fundo no Hub.');
  }

  function abrirEmail(pedido, origem) {
    estado.aberto = pedido.id;
    ui.janelaTitulo.textContent = `${pedido.assunto} · conta ${pedido.conta}`;
    ui.janelaCorpo.innerHTML = `<pre class="fl-ficha-texto">${esc(pedido.texto || '(o e-mail não foi guardado)')}</pre>
      <div class="fl-ficha-acoes"><button type="button" class="copy-btn" data-acao="copiar-email">Copiar o e-mail</button></div>`;
    abrirJanela(ui.janela, origem);
  }

  function anotar(pedido) {
    const ativos = pedido.ordens.map((o) => o.ativo).join(', ');
    pedirAnotacao({
      titulo: `Conta ${pedido.conta}${pedido.cliente?.nome ? ` · ${pedido.cliente.nome}` : ''} — ${NOMES_DOS_GRUPOS[pedido.grupo]}`,
      texto: `${ativos}\n\n${fichaDeExecucao(pedido)}\n\n`,
      etiquetas: ['fila']
    });
  }

  ui.lista.addEventListener('click', (e) => {
    const item = e.target.closest('[data-id]');
    if (item?.dataset?.id) {
      selecionarPedido(item.dataset.id, { rolar: false });
    }
    const botao = e.target.closest('[data-acao]');
    if (!botao) return;
    const pedido = doId(botao.closest('[data-id]')?.dataset.id);
    if (!pedido) return;
    const acao = botao.dataset.acao;
    fecharMenus();
    if (acao === 'estado') mudar(pedido.id, botao.dataset.estado);
    if (acao === 'ficha') abrirFicha(pedido, botao);
    if (acao === 'lote') abrirLote(pedido, botao);
    if (acao === 'boleta') abrirBoleta(pedido, Number(botao.dataset.indice));
    if (acao === 'email') abrirEmail(pedido, botao);
    if (acao === 'anotar') anotar(pedido);
  });

  ui.janela.addEventListener('click', async (e) => {
    if (e.target === ui.janela || e.target.closest('[data-fechar]')) return ui.janela.close();
    const botao = e.target.closest('[data-acao]');
    const pedido = doId(estado.aberto);
    if (!botao || !pedido) return;
    if (botao.dataset.acao === 'copiar-ficha' || botao.dataset.acao === 'copiar-email') {
      const ok = await copiar(botao.dataset.acao === 'copiar-ficha' ? fichaDeExecucao(pedido) : pedido.texto);
      aviso(ok ? 'Copiado.' : 'Não foi possível copiar.', { tipo: ok ? 'info' : 'erro' });
    }
    if (botao.dataset.acao === 'copiar-lote') {
      const formato = botao.dataset.formato;
      const tsv = estado.lotes?.[formato];
      if (!tsv) return;
      const ok = await copiar(tsv);
      aviso(ok ? `${formato === 'twap' ? 'Lote TWAP' : 'Lote Simples'} copiado: cole na planilha.` : 'Não foi possível copiar.', { tipo: ok ? 'info' : 'erro' });
    }
    if (botao.dataset.acao === 'boleta') abrirBoleta(pedido, Number(botao.dataset.indice));
  });

  /* ── Seleção e Atalhos de Teclado (Fase 1) ─────────────────────────────────────────── */

  function selecionarPedido(id, { rolar = true } = {}) {
    estado.selecionadoId = id;
    for (const elItem of ui.lista.querySelectorAll('.fl-destaque')) {
      if (elItem.dataset.id !== id) elItem.classList.remove('fl-destaque');
    }
    if (!id) return;
    const alvo = ui.lista.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (alvo) {
      alvo.classList.add('fl-destaque');
      if (rolar) alvo.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function moverSelecao(direcao) {
    const itens = Array.from(ui.lista.querySelectorAll('[data-id]'));
    if (!itens.length) return;
    const idx = estado.selecionadoId ? itens.findIndex((el) => el.dataset.id === estado.selecionadoId) : -1;
    let proximoIdx = 0;
    if (idx === -1) {
      proximoIdx = direcao > 0 ? 0 : itens.length - 1;
    } else {
      proximoIdx = Math.max(0, Math.min(itens.length - 1, idx + direcao));
    }
    selecionarPedido(itens[proximoIdx].dataset.id, { rolar: true });
  }

  function alternarVista() {
    if (estado.pasta !== 'executar') return;
    estado.vista = estado.vista === 'cartoes' ? 'tabela' : 'cartoes';
    gravarVista(estado.vista);
    render();
  }

  function mudarPastaPorIndice(indice) {
    const pastasVisiveis = PASTAS.filter(
      (p) => p.id !== 'cancelados' || estado.pedidos.some((x) => x.estado === 'cancelado') || estado.pasta === 'cancelados'
    );
    const alvo = pastasVisiveis[indice];
    if (alvo && alvo.id !== estado.pasta) {
      estado.pasta = alvo.id;
      estado.destaque = null;
      estado.selecionadoId = null;
      render();
    }
  }

  function acaoNoPedidoSelecionado(tipo) {
    if (!estado.selecionadoId) {
      const primeiro = ui.lista.querySelector('[data-id]');
      if (!primeiro) return;
      selecionarPedido(primeiro.dataset.id, { rolar: true });
    }
    const elPedido = ui.lista.querySelector(`[data-id="${CSS.escape(estado.selecionadoId)}"]`);
    const pedido = doId(estado.selecionadoId);
    if (!elPedido || !pedido) return;

    if (tipo === 'executar') {
      const btnExecutado = elPedido.querySelector('[data-acao="estado"][data-estado="executado"]');
      if (btnExecutado) return btnExecutado.click();
      const btnAprovou = elPedido.querySelector('[data-acao="estado"][data-estado="aprovado"]');
      if (btnAprovou) return btnAprovou.click();
      const btnPrimario = elPedido.querySelector('.fl-botao-primario');
      if (btnPrimario) return btnPrimario.click();
    } else if (tipo === 'lote') {
      const btnLote = elPedido.querySelector('[data-acao="lote"]') || elPedido.querySelector('[data-acao="ficha"]');
      if (btnLote) btnLote.click();
    } else if (tipo === 'ficha') {
      const btnFicha = elPedido.querySelector('[data-acao="ficha"]');
      if (btnFicha) btnFicha.click();
    } else if (tipo === 'boleta') {
      const btnBoleta = elPedido.querySelector('[data-acao="boleta"]');
      if (btnBoleta) btnBoleta.click();
    } else if (tipo === 'email') {
      const btnEmail = elPedido.querySelector('[data-acao="email"]');
      if (btnEmail) btnEmail.click();
    }
  }

  document.addEventListener('keydown', (e) => {
    if (secao.hidden) return;

    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;

    if (ui.janela.open || secao.querySelector('dialog[open]')) {
      if (e.key === 'Escape') ui.janela.close();
      return;
    }

    if (e.key === 'Escape') {
      fecharMenus();
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const tecla = e.key.toLowerCase();

    if (tecla === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      moverSelecao(1);
    } else if (tecla === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      moverSelecao(-1);
    } else if (tecla === 'e') {
      e.preventDefault();
      acaoNoPedidoSelecionado('executar');
    } else if (tecla === 'l') {
      e.preventDefault();
      acaoNoPedidoSelecionado('lote');
    } else if (tecla === 'f') {
      e.preventDefault();
      acaoNoPedidoSelecionado('ficha');
    } else if (tecla === 'b') {
      e.preventDefault();
      acaoNoPedidoSelecionado('boleta');
    } else if (tecla === 'm') {
      e.preventDefault();
      acaoNoPedidoSelecionado('email');
    } else if (tecla === 't') {
      e.preventDefault();
      alternarVista();
    } else if (e.key >= '1' && e.key <= '4') {
      e.preventDefault();
      mudarPastaPorIndice(Number(e.key) - 1);
    }
  });

  /* ── O dia, a busca e o resumo ─────────────────────────────────────────────────────── */

  const irParaODia = (dia) => {
    estado.dia = dia;
    carregar();
  };
  const somarDias = (dia, n) => {
    const [a, m, d] = dia.split('-').map(Number);
    return diaDe(new Date(a, m - 1, d + n));
  };
  el('anterior').addEventListener('click', () => irParaODia(somarDias(estado.dia, -1)));
  el('seguinte').addEventListener('click', () => irParaODia(somarDias(estado.dia, 1)));
  el('hoje').addEventListener('click', () => irParaODia(hoje()));
  ui.dia.addEventListener('change', () => ui.dia.value && irParaODia(ui.dia.value));
  ui.busca.addEventListener('input', () => {
    estado.busca = ui.busca.value;
    estado.destaque = null;
    render();
  });

  const modalResumo = ligarModalResumo(secao, {
    obterPedidos: () => estado.pedidos,
    obterDia: () => estado.dia,
    aoAvisar: aviso,
    aoCopiar: copiar
  });

  el('resumo').addEventListener('click', async (e) => {
    const ok = await copiar(resumoDoDia(estado.pedidos, estado.dia));
    aviso(ok ? 'Resumo do dia copiado.' : 'Não foi possível copiar o resumo.', { tipo: ok ? 'info' : 'erro' });
    modalResumo.abrir(e.currentTarget);
  });

  // A busca da Mesa (Ctrl+K), o aviso de prazo e o histórico do Ordens abrem um pedido: a Fila vai ao dia e à pasta dele, já filtrada pela conta.
  registrarServico('fila.mostrar', (pedido) => {
    estado.dia = pedido.dia;
    estado.pasta = pastaDoEstado(pedido.estado);
    estado.busca = pedido.conta;
    ui.busca.value = pedido.conta;
    estado.destaque = { id: pedido.id, visto: false };
    carregar();
  });

  // O que outra parte gravou (o Ordens, o robô, outra aba) aparece aqui; os prazos andam com o relógio.
  aoMudarAFila((origem) => origem !== 'fila' && carregar());
  setInterval(() => {
    // Com o menu "…" aberto, espera: o redesenho o fecharia na mão da pessoa.
    if (!secao.hidden && !ui.lista.querySelector('.fl-menu[open]')) render();
  }, 30000);

  // Os pedidos de mais de 90 dias saem, uma vez por abertura.
  repo
    .listarTodos()
    .then((todos) => {
      const velhos = vencidosDaGuarda(todos);
      return velhos.length ? repo.apagar(velhos.map((p) => p.id)) : null;
    })
    .catch(() => {});

  carregar();
};

/**
 * O vigia das respostas no Outlook (`vigiaOutlook.js`): começa com a página, assim que o Ordens
 * registra a ponte do robô, e fica nos serviços para a aba Fila o mostrar. Pede ao robô que olhe a
 * caixa de entrada a cada minuto, enquanto há pedido esperando o cliente.
 */
export const iniciarVigiaDaFila = () => {
  quandoHouver('robo', (robo) => {
    const vigia = criarVigiaDoOutlook({ robo, atende: (versao) => servico('roboAtende')?.(versao) ?? true, repo: filaDaPagina(), avisar: aviso });
    registrarServico('vigiaDoOutlook', vigia);
    aoMudarAFila(() => vigia.pedirSePrecisa());
    robo.aoMudar(() => vigia.pedirSePrecisa());
    setInterval(() => vigia.pedirSePrecisa(), 60000);
    vigia.pedirSePrecisa();
  });
};

/**
 * O contador da aba Fila: quantos pedidos estão em Aprovação e execução — o cliente respondeu, ou foi
 * aprovado, e falta executar. Começa com a página, como o vigia das Anotações: quem está no Ordens
 * também vê. Fica âmbar com um prazo perto (Fase 3: os 15 min de Aprovação e execução, os 30 min dos
 * Enviados), e então conta também o e-mail sem resposta de prazo perto.
 */
export const iniciarContadorDaFila = () => {
  const contador = document.querySelector('[data-contador="fila"]');
  if (!contador) return;
  const repo = filaDaPagina();
  const paraExecutar = PASTAS.find((p) => p.id === 'executar').estados;
  const contar = async () => {
    try {
      const agora = Date.now();
      const daVista = pedidosDaVista(await repo.listarDesde(inicioDaVista(agora)), diaDe(agora), agora);
      const perto = daVista.filter((p) => prazoPerto(p, agora));
      const contados = daVista.filter((p) => paraExecutar.includes(p.estado) || perto.includes(p));
      const n = contados.length;
      contador.hidden = n === 0;
      contador.textContent = n;
      contador.classList.toggle('perto', perto.length > 0);
      const executar = contados.length - perto.filter((p) => !paraExecutar.includes(p.estado)).length;
      contador.title = [
        executar ? `${executar} ${executar === 1 ? 'pedido para aprovar e executar' : 'pedidos para aprovar e executar'}` : '',
        perto.length ? `${perto.length} com o prazo perto` : ''
      ]
        .filter(Boolean)
        .join(' · ');
    } catch {
      contador.hidden = true;
    }
  };
  aoMudarAFila(contar);
  setInterval(contar, 30000);
  contar();
};

/**
 * O aviso de prazo (`vigiaPrazos.js`), em qualquer aba: confere a cada 30 s e a cada mudança na Fila.
 * "Ver na Fila" leva ao cartão.
 */
export const iniciarAvisosDePrazo = () => {
  const vigia = criarVigiaDePrazos({
    repo: filaDaPagina(),
    avisar: aviso,
    abrir: (pedido) => {
      location.hash = 'fila';
      quandoHouver('fila.mostrar', (mostrar) => mostrar(pedido));
    }
  });
  aoMudarAFila((origem) => origem !== 'prazos' && vigia.conferir());
  setInterval(() => vigia.conferir(), 30000);
  // Ao voltar para a aba do navegador, na hora: escondida, o Chrome só roda o relógio uma vez por minuto.
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && vigia.conferir());
  vigia.conferir();
};

const MARCACAO = `
<div class="fl">
  <section class="panel fl-topo">
    <div class="fl-titulo">
      <h2 class="panel-title">Fila do dia</h2>
      <span class="meta-counter" data-fl="subtitulo"></span>
    </div>
    <div class="fl-dia">
      <button type="button" class="copy-btn fl-seta" data-fl="anterior" aria-label="Dia anterior" title="Dia anterior">‹</button>
      <input type="date" class="fl-data" data-fl="dia" aria-label="Dia da Fila" />
      <button type="button" class="copy-btn fl-seta" data-fl="seguinte" aria-label="Dia seguinte" title="Dia seguinte">›</button>
      <button type="button" class="copy-btn" data-fl="hoje">Hoje</button>
    </div>
    <span class="fl-outlook" data-fl="outlook" data-tipo="sem-robo">Outlook</span>
    <div class="fl-ferramentas">
      <input type="search" class="fl-busca" data-fl="busca" placeholder="Buscar conta, cliente ou ativo" aria-label="Buscar na Fila" />
      <button type="button" class="copy-btn" data-fl="resumo" title="Ver resumo operacional do dia, exportar Excel e PDF">Resumo do dia</button>
    </div>
  </section>

  <div class="fl-caixa">
    <nav class="fl-pastas" data-fl="pastas" aria-label="Pastas da Fila"></nav>
    <div class="fl-principal">
      <section class="panel fl-conferir" data-fl="conferir" aria-label="Respostas a conferir" hidden></section>
      <div class="fl-vista" data-fl="vista" role="group" aria-label="Como mostrar Aprovação e execução">
        <button type="button" data-vista="cartoes" aria-pressed="true">Cartões</button>
        <button type="button" data-vista="tabela" aria-pressed="false">Tabela</button>
      </div>
      <div class="fl-lista" data-fl="lista"></div>
    </div>
  </div>

  <dialog class="fl-janela" data-fl="janela" aria-labelledby="fl-janela-titulo">
    <div class="panel-header-row">
      <h2 class="panel-title" id="fl-janela-titulo" data-fl="janela-titulo"></h2>
      <button type="button" class="icon-close-btn" data-fechar aria-label="Fechar">&times;</button>
    </div>
    <div data-fl="janela-corpo"></div>
  </dialog>

  <dialog class="fl-resumo-dialogo" data-fl="resumo-dialogo" aria-label="Resumo Operacional do Dia"></dialog>
</div>`;
