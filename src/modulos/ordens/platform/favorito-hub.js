/**
 * O favorito do Hub — o texto que vira o botão da barra de favoritos.
 *
 * Não é um módulo: `favoritoDoHub.js` o importa como texto (`?raw`) e faz dele um `javascript:…`.
 * Roda dentro do Hub, na Prateleira do Mercado Secundário, com o operador já logado: escuta o
 * `fetch` do próprio app, clica em Atualizar e, quando a resposta da prateleira chega, baixa ela
 * inteira num .json com a hora da captura. Não lê token nem cabeçalho, não chama a API por conta
 * própria e não manda nada para lugar nenhum: o arquivo vai para os downloads, e o operador o
 * carrega no Ordens.
 *
 * Fica burro de propósito. Cada colega arrasta o favorito uma vez, e um favorito velho não se
 * atualiza sozinho; toda a leitura (os campos, o "N/D", os números em pt-BR) mora no Ordens, em
 * `core/secundario/estoque.js`, que muda com o build.
 *
 * O texto vira uma linha só: nada de comentário de linha, ponto e vírgula em tudo e nenhuma
 * string com quebra de linha.
 */
(() => {
  const TITULO = 'Mesa XP';

  const avisar = (texto) => {
    const caixa = document.createElement('div');
    caixa.textContent = TITULO + ': ' + texto;
    caixa.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:380px;padding:12px 16px;border-radius:8px;background:#26303d;color:#e6ebf1;font:13px/1.45 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35)';
    document.body.appendChild(caixa);
    setTimeout(() => caixa.remove(), 8000);
  };

  if (!/(^|\.)hub\.xpi\.com\.br$/.test(location.hostname)) {
    alert(TITULO + ': abra o Hub XP em Fundos > Mercado Secundário > Prateleira e clique no favorito de novo.');
    return;
  }

  const atualizar = document.querySelector('soma-button[aria-label="atualizar"]');
  if (!atualizar) {
    alert(TITULO + ': não achei o botão Atualizar. Abra a Prateleira do Mercado Secundário e clique no favorito de novo.');
    return;
  }

  const baixar = (resposta) => {
    if (!resposta || !Array.isArray(resposta.data)) {
      alert(TITULO + ': a resposta do Hub veio num formato que eu não conheço. Nada foi baixado.');
      return;
    }

    const agora = new Date();
    const dois = (n) => String(n).padStart(2, '0');
    const nome = 'mercado-secundario-' + dois(agora.getDate()) + '-' + dois(agora.getMonth() + 1) + '-' + agora.getFullYear() + '-' + dois(agora.getHours()) + 'h' + dois(agora.getMinutes()) + '.json';
    const captura = Object.assign({ capturadaEm: agora.toISOString(), origem: 'hub.xpi.com.br/investment-funds-secondary' }, resposta);

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(captura)], { type: 'application/json' }));
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);

    avisar(resposta.data.length + ' fundos baixados em ' + nome + '. Carregue o arquivo no Ordens, em Secundário.');
  };

  if (!window.__mesaXpGancho) {
    window.__mesaXpGancho = true;
    const original = window.fetch;
    window.fetch = async function (...args) {
      const resposta = await original.apply(this, args);
      try {
        const endereco = String((args[0] && args[0].url) || args[0]);
        const espera = window.__mesaXpEspera;
        if (espera && /investment-funds-secondary(\?|$)/.test(endereco)) {
          window.__mesaXpEspera = null;
          resposta.clone().json().then(espera, () => alert(TITULO + ': não consegui ler a resposta do Hub. Nada foi baixado.'));
        }
      } catch {
        /* o app do Hub segue com a resposta dele, de qualquer jeito */
      }
      return resposta;
    };
  }

  clearTimeout(window.__mesaXpPrazo);
  window.__mesaXpEspera = (resposta) => {
    clearTimeout(window.__mesaXpPrazo);
    baixar(resposta);
  };
  window.__mesaXpPrazo = setTimeout(() => {
    if (!window.__mesaXpEspera) return;
    window.__mesaXpEspera = null;
    alert(TITULO + ': o Hub não respondeu em 20 segundos. Clique no favorito de novo.');
  }, 20000);

  atualizar.click();
})();
