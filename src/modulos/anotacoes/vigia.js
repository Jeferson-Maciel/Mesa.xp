/**
 * O vigia dos lembretes: roda desde que a página abre, em qualquer aba da Mesa XP.
 *
 * A aba Anotações só inicia na primeira visita (como as outras), mas um lembrete não pode esperar
 * alguém abrir a aba: quem está no Ordens o dia inteiro tem de ser avisado ali mesmo. Por isso o
 * vigia é separado da tela e começa com a página (main.js). Ele:
 *
 * - põe o contador na aba Anotações — vermelho com as vencidas; âmbar com as de hoje;
 * - põe "(2)" no título da página, que aparece na aba do navegador mesmo com outra aba à frente;
 * - mostra o alerta na tela quando um lembrete vence, com Abrir, +1 hora, Amanhã 9h e Resolvido;
 * - toca um som curto (desligável) e, se a pessoa ligou, dispara o alerta do Windows.
 *
 * Um alerta fechado no × não volta: a anotação fica vermelha até ser resolvida ou adiada. O que
 * marca isso é `lembrete.avisado`; um lembrete novo (adiado, trocado) nasce sem ele e avisa de novo.
 *
 * Com a aba do navegador escondida há mais de 5 minutos, o Chrome só roda timers uma vez por
 * minuto: o alerta pode chegar até um minuto depois da hora. Ao voltar para a aba, confere na hora.
 */

import { aviso } from '../../ui/avisos.js';
import { aplicarAtalho, estadoDaNota, proximoMomento, rotuloDoLembrete } from './lembretes.js';
import { tituloVisivel } from './notas.js';
import { aoMudar, avisarMudanca } from './eventos.js';
import { htmlAlerta } from './render.js';

/* ── Preferências de alerta (por navegador) ───────────────────────────────────────────── */

const CHAVE_CONFIG = 'mesa_anotacoes_config';

export const lerConfig = () => {
  try {
    return { som: true, ...JSON.parse(localStorage.getItem(CHAVE_CONFIG) || '{}') };
  } catch {
    return { som: true };
  }
};

export const gravarConfig = (config) => {
  try {
    localStorage.setItem(CHAVE_CONFIG, JSON.stringify(config));
  } catch {
    // sem armazenamento, vale só nesta sessão
  }
};

/** 'ligado' | 'bloqueado' | 'desligado' | 'indisponivel' — o alerta do Windows (Notification). */
export const estadoDasNotificacoes = () => {
  if (typeof Notification !== 'function' || !window.isSecureContext) return 'indisponivel';
  return { granted: 'ligado', denied: 'bloqueado' }[Notification.permission] ?? 'desligado';
};

/** Pede a permissão; só funciona a partir de um clique (regra do navegador). */
export const pedirNotificacoes = async () => {
  if (estadoDasNotificacoes() === 'indisponivel') return 'indisponivel';
  try {
    await Notification.requestPermission();
  } catch {
    // navegador antigo: a permissão fica como estava
  }
  return estadoDasNotificacoes();
};

/* ── Som ──────────────────────────────────────────────────────────────────────────────── */

let audio = null;

// Duas notas curtas e baixas, como um "dim-dom" de recepção. O navegador só deixa tocar depois que
// a pessoa já clicou em algo na página; antes disso, fica em silêncio sem erro.
const tocar = () => {
  if (!lerConfig().som) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    const inicio = audio.currentTime + 0.02;
    [
      [880, 0],
      [660, 0.16]
    ].forEach(([frequencia, atraso]) => {
      const osc = audio.createOscillator();
      const volume = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequencia;
      volume.gain.setValueAtTime(0, inicio + atraso);
      volume.gain.linearRampToValueAtTime(0.12, inicio + atraso + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.001, inicio + atraso + 0.5);
      osc.connect(volume).connect(audio.destination);
      osc.start(inicio + atraso);
      osc.stop(inicio + atraso + 0.55);
    });
  } catch {
    // sem áudio: o alerta visual basta
  }
};

/* ── O vigia ──────────────────────────────────────────────────────────────────────────── */

/**
 * @param {object} opcoes
 * @param {import('./repositorio.js').RepositorioDeAnotacoes} opcoes.repo
 * @param {(id: string) => void} opcoes.abrirNota leva à anotação (a aba Anotações, com ela aberta)
 */
export const iniciarVigia = ({ repo, abrirNota }) => {
  const caixa = document.getElementById('alertas-lembrete');
  const contador = document.querySelector('[data-contador="anotacoes"]');
  const tituloOriginal = document.title;
  const notificadas = new Set();
  let notas = [];
  let proximo = null;

  const sair = (alerta) => {
    alerta.classList.add('saindo');
    setTimeout(() => alerta.remove(), 260);
  };

  const notificar = (nota, agora) => {
    if (estadoDasNotificacoes() !== 'ligado' || notificadas.has(nota.id)) return;
    notificadas.add(nota.id);
    try {
      const n = new Notification(`Lembrete: ${tituloVisivel(nota)}`, {
        body: rotuloDoLembrete(nota, agora),
        tag: `mesa-xp-${nota.id}`,
        requireInteraction: true
      });
      n.onclick = () => {
        window.focus();
        abrirNota(nota.id);
        n.close();
      };
    } catch {
      // alguns navegadores só notificam por service worker; o alerta na tela continua valendo
    }
  };

  const verificar = () => {
    const agora = new Date();
    let vencidas = 0;
    let hoje = 0;
    const paraAvisar = [];
    for (const n of notas) {
      const estado = estadoDaNota(n, agora);
      if (estado === 'vencida') {
        vencidas++;
        if (!n.lembrete.avisado) paraAvisar.push(n);
      } else if (estado === 'hoje') {
        hoje++;
      }
    }

    if (contador) {
      contador.textContent = String(vencidas || hoje);
      contador.hidden = vencidas + hoje === 0;
      contador.classList.toggle('vencidas', vencidas > 0);
      contador.title = vencidas ? `${vencidas} lembrete(s) vencido(s)` : `${hoje} lembrete(s) para hoje`;
    }
    document.title = vencidas ? `(${vencidas}) ${tituloOriginal}` : tituloOriginal;

    if (caixa) {
      const ids = new Set(paraAvisar.map((n) => n.id));
      for (const alerta of caixa.querySelectorAll('.an-alerta:not(.saindo)')) if (!ids.has(alerta.dataset.id)) sair(alerta);
      let novos = 0;
      for (const n of paraAvisar) {
        const existente = [...caixa.querySelectorAll('.an-alerta')].find((a) => a.dataset.id === n.id && !a.classList.contains('saindo'));
        if (existente) continue;
        caixa.insertAdjacentHTML('beforeend', htmlAlerta(n, agora));
        notificar(n, agora);
        novos++;
      }
      if (novos) tocar();
    }

    // Um timer até o próximo vencimento, além da conferência a cada 30 s.
    clearTimeout(proximo);
    const momento = proximoMomento(notas, agora);
    if (momento) proximo = setTimeout(verificar, Math.min(momento - agora + 250, 2 ** 31 - 1));
  };

  const recarregar = async () => {
    try {
      notas = await repo.listarNotas();
    } catch (erro) {
      // Sem IndexedDB o vigia fica quieto; a aba Anotações mostra o erro quando for aberta.
      console.error(erro);
      return;
    }
    verificar();
  };

  caixa?.addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-alerta]');
    if (!botao) return;
    const alerta = botao.closest('.an-alerta');
    const nota = notas.find((n) => n.id === alerta?.dataset.id);
    if (!nota) return;

    const acao = botao.dataset.alerta;
    const agora = new Date();
    let nova;
    if (acao === 'abrir' || acao === 'dispensar') nova = { ...nota, lembrete: { ...nota.lembrete, avisado: true } };
    else if (acao === 'adiar-1h') nova = { ...nota, lembrete: aplicarAtalho('1h', agora) };
    else if (acao === 'adiar-amanha') nova = { ...nota, lembrete: aplicarAtalho('amanha-9h', agora) };
    else if (acao === 'resolver') nova = { ...nota, concluida: true, concluidaEm: agora.getTime() };
    else return;

    sair(alerta);
    notificadas.delete(nota.id);
    try {
      // Ver ou fechar o alerta não é editar a anotação: a data de edição fica como estava.
      await repo.salvarNota(nova, { manterData: acao === 'abrir' || acao === 'dispensar' });
      notas = notas.map((n) => (n.id === nova.id ? nova : n));
      avisarMudanca('vigia');
      verificar();
    } catch (erro) {
      aviso(erro.message, { tipo: 'erro' });
    }
    if (acao === 'abrir') abrirNota(nota.id);
    else if (acao !== 'dispensar') aviso(acao === 'resolver' ? 'Anotação resolvida.' : `Lembrete adiado: ${rotuloDoLembrete(nova, agora)}.`);
  });

  aoMudar((origem) => {
    if (origem !== 'vigia') recarregar();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) verificar();
  });
  setInterval(verificar, 30_000);
  recarregar();

  return { verificar, recarregar };
};
