import { aviso } from '../../ui/avisos.js';
import { esc } from '../../ui/html.js';
import { criarRepositorioLocal } from './adaptadores/local.js';
import { criarRepositorioSupabase } from './adaptadores/supabase.js';
import { conexaoDoBanco } from '../../dados/banco.js';
import { DIAS, MESES, diaDaChave, intervaloDaSemana, intervaloDoMes, rotuloDaSemana, segundaDaSemana, somarDias } from './datas.js';
import { CORES, htmlHistorico, htmlHorarios, htmlSemana, indexar } from './render.js';
import { ehErroDeRede } from './repositorio.js';
import './calendario.css';

/**
 * O Calendário de presença dentro da Mesa XP.
 *
 * Visão Semana — a matriz colaborador × dia útil, com o total de presenciais por dia —, a janela
 * do dia (<dialog> nativo: presencial, observação e horários indisponíveis) e o Histórico do mês
 * com filtro por colaborador.
 *
 * Só inicia quando a aba abre: é aqui que a Mesa XP conecta ao banco, e quem só usa Ordens e
 * Renda Fixa, inclusive offline, nunca faz essa conexão. O Calendário exige rede.
 *
 * Erro de rede aparece na tela e fica lá até dar certo — nada de voltar calado para o modo local.
 * Mudança feita por outra pessoa (ou outra aba) chega pelo Realtime e recarrega a visão.
 *
 * @param {HTMLElement} secao a seção `#modulo-calendario`
 */
export const iniciarCalendario = (secao) => {
  secao.innerHTML = MARCACAO;
  const el = (nome) => secao.querySelector(`[data-cal="${nome}"]`);

  const { config, cliente } = conexaoDoBanco();

  if (config.modo === 'invalido') {
    el('erro').innerHTML = `<div class="alert alert-danger">Calendário sem banco configurado: ${esc(config.erro)}</div>`;
    el('conexao').textContent = 'sem banco';
    for (const controle of secao.querySelectorAll('button, input, select')) controle.disabled = true;
    return;
  }

  const repo = config.modo === 'local' ? criarRepositorioLocal() : criarRepositorioSupabase(cliente);

  const hoje = new Date();
  const estado = {
    colaboradores: [],
    registros: new Map(),
    visao: 'semana',
    segunda: segundaDaSemana(hoje),
    ano: hoje.getFullYear(),
    mes: hoje.getMonth(),
    filtro: '',
    sequencia: 0, // cada carga numerada: uma resposta atrasada de uma navegação antiga é descartada
    carregou: false
  };

  const dia = { colaborador: null, data: null, horarios: [] };

  /* ── Conexão e erros ──────────────────────────────────────────────────────────────── */

  const conexao = el('conexao');
  const mostrarConexao = (texto, classe) => {
    conexao.textContent = texto;
    conexao.className = `meta-counter cal-conexao ${classe}`;
  };

  const mensagemDeErro = (erro) =>
    ehErroDeRede(erro)
      ? `Sem conexão com o banco de presença. ${erro.message}`
      : erro?.message || 'Erro desconhecido no banco de presença.';

  const mostrarErro = (erro) => {
    el('erro').innerHTML = `
      <div class="alert alert-danger" role="alert">
        <span>${esc(mensagemDeErro(erro))} O que está na tela pode estar desatualizado.</span>
        <button type="button" class="copy-btn" data-cal="tentar">Tentar de novo</button>
      </div>`;
  };

  const limparErro = () => {
    el('erro').innerHTML = '';
  };

  /* ── Carga ────────────────────────────────────────────────────────────────────────── */

  const intervalo = () => (estado.visao === 'semana' ? intervaloDaSemana(estado.segunda) : intervaloDoMes(estado.ano, estado.mes));

  async function carregar() {
    const numero = ++estado.sequencia;
    if (!estado.carregou) mostrarConexao('carregando…', '');
    try {
      const { inicio, fim } = intervalo();
      const [colaboradores, registros] = await Promise.all([repo.listarColaboradores(), repo.listarRegistros(inicio, fim)]);
      if (numero !== estado.sequencia) return;
      estado.colaboradores = colaboradores;
      estado.registros = indexar(registros);
      estado.carregou = true;
      limparErro();
      render();
      if (repo.modo === 'local') mostrarConexao('modo local: dados só neste navegador', 'cal-aviso');
      else if (!conexao.classList.contains('cal-vivo') && !conexao.classList.contains('cal-aviso')) mostrarConexao('conectado', '');
    } catch (erro) {
      if (numero !== estado.sequencia) return;
      console.error(erro);
      mostrarErro(erro);
      render();
      if (!estado.carregou) mostrarConexao('sem conexão', 'cal-aviso');
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────────────────── */

  function render() {
    el('visao-semana').hidden = estado.visao !== 'semana';
    el('visao-historico').hidden = estado.visao !== 'historico';
    for (const b of el('visao').querySelectorAll('[data-visao]')) {
      const ativo = b.dataset.visao === estado.visao;
      b.classList.toggle('ativo', ativo);
      b.setAttribute('aria-selected', String(ativo));
    }

    if (estado.visao === 'semana') {
      el('rotulo-semana').textContent = rotuloDaSemana(estado.segunda);
      el('semana').innerHTML = estado.carregou
        ? htmlSemana({ colaboradores: estado.colaboradores, registros: estado.registros, segunda: estado.segunda, hoje: new Date() })
        : '';
    } else {
      el('rotulo-mes').textContent = `${MESES[estado.mes]} ${estado.ano}`;
      renderFiltro();
      const colaboradores = estado.filtro ? estado.colaboradores.filter((c) => c.id === estado.filtro) : estado.colaboradores;
      el('historico').innerHTML = estado.carregou
        ? htmlHistorico({ colaboradores, registros: estado.registros, ano: estado.ano, mes: estado.mes })
        : '';
    }
  }

  function renderFiltro() {
    // Colaborador filtrado que foi removido volta o filtro para "Todos".
    if (estado.filtro && !estado.colaboradores.some((c) => c.id === estado.filtro)) estado.filtro = '';
    el('filtro').innerHTML =
      '<option value="">Todos</option>' +
      estado.colaboradores.map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('');
    el('filtro').value = estado.filtro;
  }

  /* ── Colaboradores ────────────────────────────────────────────────────────────────── */

  async function adicionarColaborador() {
    const nome = el('nome').value.trim();
    if (!nome) return aviso('Digite o nome do colaborador.', { tipo: 'erro' });
    if (estado.colaboradores.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
      return aviso('Colaborador já cadastrado.', { tipo: 'erro' });
    }

    const botao = el('adicionar');
    botao.disabled = true;
    try {
      await repo.adicionarColaborador(nome, CORES[estado.colaboradores.length % CORES.length]);
      el('nome').value = '';
      aviso(`${nome} adicionado.`);
      await carregar();
    } catch (erro) {
      console.error(erro);
      aviso(mensagemDeErro(erro), { tipo: 'erro' });
      mostrarErro(erro);
    } finally {
      botao.disabled = false;
    }
  }

  async function removerColaborador(id) {
    const colaborador = estado.colaboradores.find((c) => c.id === id);
    if (!colaborador) return;
    if (!confirm(`Remover "${colaborador.nome}" e todos os registros dele?`)) return;
    try {
      await repo.removerColaborador(id);
      aviso(`${colaborador.nome} removido.`);
      await carregar();
    } catch (erro) {
      console.error(erro);
      aviso(mensagemDeErro(erro), { tipo: 'erro' });
      mostrarErro(erro);
    }
  }

  /* ── Janela do dia ────────────────────────────────────────────────────────────────── */

  const dialogo = el('dialogo');

  function abrirDia(data, colaboradorId) {
    const colaborador = estado.colaboradores.find((c) => c.id === colaboradorId);
    if (!colaborador) return;
    const registro = estado.registros.get(`${data}|${colaboradorId}`);
    const d = diaDaChave(data);

    Object.assign(dia, { colaborador, data, horarios: registro ? registro.indisponiveis.map((h) => ({ ...h })) : [] });
    el('dialogo-titulo').textContent = `${colaborador.nome} — ${DIAS[d.getDay()]}, ${data.slice(8, 10)}/${data.slice(5, 7)}`;
    el('presencial').checked = Boolean(registro?.presencial);
    el('observacao').value = registro?.observacao ?? '';
    el('motivo').value = '';
    el('erro-dialogo').innerHTML = '';
    renderHorarios();
    dialogo.showModal();
  }

  function renderHorarios() {
    el('horarios').innerHTML = htmlHorarios(dia.horarios);
  }

  function adicionarHorario() {
    const inicio = el('inicio').value;
    const fim = el('fim').value;
    const motivo = el('motivo').value.trim();
    if (!inicio || !fim) return aviso('Preencha os dois horários.', { tipo: 'erro' });
    if (inicio >= fim) return aviso('O horário final deve ser depois do inicial.', { tipo: 'erro' });
    dia.horarios.push({ inicio, fim, motivo });
    el('motivo').value = '';
    renderHorarios();
    aviso('Horário adicionado. Não esqueça de salvar.');
  }

  async function salvarDia() {
    const botao = el('salvar');
    botao.disabled = true;
    el('erro-dialogo').innerHTML = '';
    try {
      await repo.salvarRegistro({
        colaboradorId: dia.colaborador.id,
        data: dia.data,
        presencial: el('presencial').checked,
        observacao: el('observacao').value.trim(),
        indisponiveis: dia.horarios
      });
      dialogo.close();
      aviso('Registro salvo.');
      await carregar();
    } catch (erro) {
      // A janela fica aberta com o que foi digitado: nada se perde por causa de uma queda de rede.
      console.error(erro);
      el('erro-dialogo').innerHTML = `<div class="alert alert-danger" role="alert">${esc(mensagemDeErro(erro))} Nada foi perdido: tente salvar de novo.</div>`;
      aviso('Não foi possível salvar o dia.', { tipo: 'erro' });
    } finally {
      botao.disabled = false;
    }
  }

  /* ── Navegação ────────────────────────────────────────────────────────────────────── */

  function trocarVisao(visao) {
    if (estado.visao === visao) return;
    estado.visao = visao;
    render();
    carregar();
  }

  function andarSemana(semanas) {
    estado.segunda = somarDias(estado.segunda, semanas * 7);
    render();
    carregar();
  }

  function andarMes(meses) {
    const alvo = new Date(estado.ano, estado.mes + meses, 1);
    estado.ano = alvo.getFullYear();
    estado.mes = alvo.getMonth();
    render();
    carregar();
  }

  /* ── Eventos ──────────────────────────────────────────────────────────────────────── */

  el('visao').addEventListener('click', (e) => {
    const botao = e.target.closest('[data-visao]');
    if (botao) trocarVisao(botao.dataset.visao);
  });

  el('novo').addEventListener('submit', (e) => {
    e.preventDefault();
    adicionarColaborador();
  });

  el('erro').addEventListener('click', (e) => {
    if (e.target.closest('[data-cal="tentar"]')) carregar();
  });

  el('semana-anterior').addEventListener('click', () => andarSemana(-1));
  el('semana-seguinte').addEventListener('click', () => andarSemana(1));
  el('hoje').addEventListener('click', () => {
    estado.segunda = segundaDaSemana(new Date());
    render();
    carregar();
  });
  el('mes-anterior').addEventListener('click', () => andarMes(-1));
  el('mes-seguinte').addEventListener('click', () => andarMes(1));
  el('filtro').addEventListener('change', () => {
    estado.filtro = el('filtro').value;
    render();
  });

  el('semana').addEventListener('click', (e) => {
    const remover = e.target.closest('[data-remover]');
    if (remover) return removerColaborador(remover.dataset.remover);
    const celula = e.target.closest('.cal-dia');
    if (celula) abrirDia(celula.dataset.dia, celula.dataset.colaborador);
  });

  el('historico').addEventListener('click', (e) => {
    const topo = e.target.closest('.cal-semana-topo');
    if (!topo) return;
    const corpo = el('historico').querySelector(`[data-corpo-semana="${topo.dataset.semana}"]`);
    corpo.hidden = !corpo.hidden;
    topo.setAttribute('aria-expanded', String(!corpo.hidden));
  });

  el('form-dia').addEventListener('submit', (e) => {
    e.preventDefault();
    salvarDia();
  });
  el('adicionar-horario').addEventListener('click', adicionarHorario);
  el('motivo').addEventListener('keydown', (e) => {
    // Enter no motivo acrescenta o horário, como no app original — não salva o dia.
    if (e.key === 'Enter') {
      e.preventDefault();
      adicionarHorario();
    }
  });
  el('horarios').addEventListener('click', (e) => {
    const botao = e.target.closest('[data-remover-horario]');
    if (!botao) return;
    dia.horarios.splice(Number(botao.dataset.removerHorario), 1);
    renderHorarios();
  });
  el('fechar').addEventListener('click', () => dialogo.close());
  el('cancelar').addEventListener('click', () => dialogo.close());
  // Clique no fundo escurecido, fora da caixa, fecha sem salvar.
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo) dialogo.close();
  });

  /* ── Tempo real ───────────────────────────────────────────────────────────────────── */

  // Um salvamento gera vários eventos (o dia e cada horário): junta tudo numa recarga só.
  let espera = null;
  let caiu = false;
  repo.assinarMudancas(
    () => {
      clearTimeout(espera);
      espera = setTimeout(carregar, 300);
    },
    (status) => {
      if (status === 'SUBSCRIBED') {
        mostrarConexao('ao vivo', 'cal-vivo');
        // Voltou depois de cair: o que mudou nesse meio tempo não chegou por evento.
        if (caiu) carregar();
        caiu = false;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        caiu = true;
        mostrarConexao('sem atualização ao vivo', 'cal-aviso');
      }
    }
  );

  render();
  carregar();
};

const MARCACAO = `
<div class="cal">
  <section class="panel">
    <div class="cal-topo">
      <div class="segmentado" role="tablist" aria-label="Visão" data-cal="visao">
        <button type="button" class="seg" role="tab" data-visao="semana">Semana</button>
        <button type="button" class="seg" role="tab" data-visao="historico">Histórico</button>
      </div>
      <form class="cal-novo" data-cal="novo">
        <input type="text" data-cal="nome" placeholder="Nome do colaborador" maxlength="40" autocomplete="off" aria-label="Nome do colaborador" />
        <button type="submit" class="copy-btn" data-cal="adicionar">Adicionar</button>
      </form>
      <span class="meta-counter cal-conexao" data-cal="conexao" role="status"></span>
    </div>

    <div class="cal-erro" data-cal="erro"></div>

    <div data-cal="visao-semana">
      <div class="cal-navegacao">
        <button type="button" class="cal-nav" data-cal="semana-anterior" aria-label="Semana anterior" title="Semana anterior">‹</button>
        <strong class="cal-rotulo" data-cal="rotulo-semana"></strong>
        <button type="button" class="cal-nav" data-cal="semana-seguinte" aria-label="Próxima semana" title="Próxima semana">›</button>
        <button type="button" class="copy-btn" data-cal="hoje" title="Ir para a semana atual">Hoje</button>
      </div>
      <div data-cal="semana"></div>
    </div>

    <div data-cal="visao-historico" hidden>
      <div class="cal-navegacao">
        <button type="button" class="cal-nav" data-cal="mes-anterior" aria-label="Mês anterior" title="Mês anterior">‹</button>
        <strong class="cal-rotulo" data-cal="rotulo-mes"></strong>
        <button type="button" class="cal-nav" data-cal="mes-seguinte" aria-label="Próximo mês" title="Próximo mês">›</button>
        <label class="cal-filtro">Filtrar por <select data-cal="filtro"></select></label>
      </div>
      <div class="cal-historico" data-cal="historico"></div>
    </div>
  </section>

  <dialog class="cal-dialogo" data-cal="dialogo" aria-labelledby="cal-dialogo-titulo">
    <form data-cal="form-dia">
      <div class="panel-header-row">
        <h2 class="panel-title" id="cal-dialogo-titulo" data-cal="dialogo-titulo"></h2>
        <button type="button" class="icon-close-btn" data-cal="fechar" aria-label="Fechar" title="Fechar (Esc)">&times;</button>
      </div>

      <label class="cal-check"><input type="checkbox" data-cal="presencial" /> Presencial neste dia</label>

      <label class="cal-campo">
        <span>Observação</span>
        <textarea data-cal="observacao" rows="3" placeholder="Ex.: reunião externa, home office parcial"></textarea>
      </label>

      <fieldset class="cal-campo">
        <legend>Horários indisponíveis</legend>
        <ul class="cal-horarios" data-cal="horarios"></ul>
        <div class="cal-novo-horario">
          <input type="time" data-cal="inicio" value="08:00" aria-label="Início" />
          <span>até</span>
          <input type="time" data-cal="fim" value="09:00" aria-label="Fim" />
          <input type="text" data-cal="motivo" maxlength="60" placeholder="Motivo (ex.: médico)" aria-label="Motivo" />
          <button type="button" class="copy-btn" data-cal="adicionar-horario">Adicionar</button>
        </div>
      </fieldset>

      <div data-cal="erro-dialogo"></div>

      <div class="cal-dialogo-acoes">
        <button type="button" class="copy-btn" data-cal="cancelar">Cancelar</button>
        <button type="submit" class="copy-btn cal-primario" data-cal="salvar">Salvar</button>
      </div>
    </form>
  </dialog>
</div>`;
