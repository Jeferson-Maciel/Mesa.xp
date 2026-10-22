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
  const estado = { dia: diaDe(Date.now()), pedidos: [], busca: '', aberto: null, pasta: 'executar', vista: lerVista() };
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
    const situacao = vigia?.situacao() ?? { tipo: 'sem-robo', texto: 'Outlook: sem o robô', titulo: 'Instale o robô do Hub (no Ordens, "Copiar robô") para ver as respostas dos clientes aqui.' };
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
  secao.addEventListener('keydown', (e) => e.key === 'Escape' && fecharMenus());

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
    const { ordens, fora, semSimples } = ordensDoLote(pedido);
    const solicitacao = { conta: pedido.conta, ordens, horario: pedido.horario ?? null };
    const lotes = {
      simples: formatar && ordens.length && !semSimples.length ? formatar.simples(solicitacao) : null,
      twap: formatar && ordens.length ? formatar.twap(solicitacao) : null,
      fora,
      semSimples
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
  el('resumo').addEventListener('click', async () => {
    const ok = await copiar(resumoDoDia(estado.pedidos, estado.dia));
    aviso(ok ? 'Resumo do dia copiado.' : 'Não foi possível copiar o resumo.', { tipo: ok ? 'info' : 'erro' });
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
      <button type="button" class="copy-btn" data-fl="resumo" title="Copiar o resumo do dia, com o que ficou pendente">Resumo do dia</button>
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
</div>`;
