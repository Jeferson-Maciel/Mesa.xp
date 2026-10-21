/**
 * Avisos de tela, divididos pelas ferramentas.
 *
 * Um aviso confirma o que aconteceu ("copiado", "salvo") ou conta um problema; nunca pede decisão.
 * O que precisa de decisão vira bloqueio (Ordens) ou fica visível na própria tela (Calendário sem
 * conexão), porque um aviso some sozinho em poucos segundos. A exceção é o **Desfazer** (`acao`):
 * depois de excluir ou resolver, o aviso oferece voltar atrás, como o Gmail e o Keep — é o que
 * deixa a ação ser de um clique, sem janela de "tem certeza?".
 *
 * Erro e aviso com ação ficam mais tempo: quem estava olhando para outro canto da tela ainda tem
 * tempo de ler e de clicar.
 */

const DURACAO = { info: 3200, erro: 6000, acao: 7000 };

/**
 * Sinalização de áudio sutil (Web Audio API): feedback não intrusivo para ações concluídas e erros.
 */
// A preferência do som. O armazenamento pode estar bloqueado (o acesso lança): aí o som fica ligado,
// e nada disso pode impedir a Mesa de abrir.
const somDesligado = () => {
  try {
    return localStorage.getItem('xp_som') === 'desligado';
  } catch {
    return false;
  }
};

export const tocarSom = (tipo = 'info') => {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (somDesligado()) return;

    const ctx = new AudioCtx();
    const agora = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (tipo === 'erro') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, agora);
      osc.frequency.setValueAtTime(185, agora + 0.08);
      gain.gain.setValueAtTime(0.035, agora);
      gain.gain.exponentialRampToValueAtTime(0.0001, agora + 0.18);
      osc.start(agora);
      osc.stop(agora + 0.18);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, agora);
      osc.frequency.setValueAtTime(880, agora + 0.04);
      gain.gain.setValueAtTime(0.03, agora);
      gain.gain.exponentialRampToValueAtTime(0.0001, agora + 0.12);
      osc.start(agora);
      osc.stop(agora + 0.12);
    }
    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 250);
  } catch {}
};

/**
 * Controla o botão de som na casca superior.
 *
 * @param {HTMLElement|null} botao
 */
export const ligarBotaoDeSom = (botao) => {
  if (!botao) return;
  const atualizar = () => {
    const mudo = somDesligado();
    botao.dataset.som = mudo ? 'desligado' : 'ligado';
    botao.title = mudo ? 'Sons operacionais: desligados (clique para ligar)' : 'Sons operacionais: ligados (clique para silenciar)';
    botao.setAttribute('aria-label', botao.title);
  };
  botao.addEventListener('click', () => {
    const atual = somDesligado();
    try {
      localStorage.setItem('xp_som', atual ? 'ligado' : 'desligado');
    } catch {}
    atualizar();
    if (atual) tocarSom('info');
  });
  atualizar();
};

/**
 * @param {string} mensagem
 * @param {{ tipo?: 'info' | 'erro', acao?: { rotulo: string, fazer: () => void } }} [opcoes]
 */
export const aviso = (mensagem, { tipo = 'info', acao = null } = {}) => {
  tocarSom(tipo);
  const lista = document.getElementById('toasts');
  if (!lista) return;

  const erro = tipo === 'erro';
  const duracao = acao ? DURACAO.acao : erro ? DURACAO.erro : DURACAO.info;
  const toast = document.createElement('div');
  toast.className = erro ? 'toast erro' : 'toast';
  toast.setAttribute('role', erro ? 'alert' : 'status');
  // A linha que encolhe no pé do aviso mostra quanto tempo ele ainda fica (base.css).
  toast.style.setProperty('--duracao', `${duracao}ms`);
  const icone = document.createElement('span');
  icone.className = 'toast-icone';
  icone.setAttribute('aria-hidden', 'true');
  const texto = document.createElement('span');
  texto.textContent = mensagem;
  toast.append(icone, texto);

  let feito = false;
  const tirar = () => {
    if (feito) return;
    feito = true;
    toast.remove();
  };
  const sair = () => {
    toast.classList.add('saindo');
    toast.addEventListener('animationend', tirar, { once: true });
    setTimeout(tirar, 400); // movimento reduzido: sem animação, sai assim mesmo
  };

  if (acao) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'toast-acao';
    botao.textContent = acao.rotulo;
    botao.addEventListener('click', () => {
      acao.fazer();
      sair();
    });
    toast.classList.add('com-acao');
    toast.append(botao);
  }

  lista.appendChild(toast);
  setTimeout(sair, duracao);
};

