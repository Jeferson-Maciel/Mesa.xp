/**
 * Cópia para a área de transferência.
 *
 * O `navigator.clipboard` só existe em contexto seguro e pode ser negado pelo usuário; o
 * `textarea` escondido com `execCommand` é o plano B que ainda funciona em qualquer navegador.
 * Sem essa reserva, um bloqueio de permissão deixaria o operador sem conseguir copiar o TSV —
 * que é a razão de ser da ferramenta.
 *
 * Com `html`, vão os dois juntos: o Outlook cola o HTML, e a tabela chega em grade; o Excel e os
 * editores de texto puro colam o `texto`, com as colunas separadas por TAB.
 */
export const copiar = async (texto, html = null) => {
  if (!texto) return false;

  try {
    if (html) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([texto], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' })
        })
      ]);
    } else {
      await navigator.clipboard.writeText(texto);
    }
    return true;
  } catch {
    return copiarPeloDocumento(texto, html);
  }
};

const copiarPeloDocumento = (texto, html) => {
  // O evento `copy` é o único jeito de o execCommand levar HTML junto. Sem HTML, o textarea
  // selecionado basta.
  const escrever = (e) => {
    e.clipboardData.setData('text/plain', texto);
    e.clipboardData.setData('text/html', html);
    e.preventDefault();
  };
  if (html) document.addEventListener('copy', escrever);

  const campo = document.createElement('textarea');
  campo.value = texto;
  campo.setAttribute('readonly', '');
  campo.style.cssText = 'position:fixed;top:-9999px;opacity:0';
  document.body.appendChild(campo);
  campo.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    campo.remove();
    document.removeEventListener('copy', escrever);
  }
};

/** @returns {Promise<string|null>} o texto da área de transferência, ou null sem permissão. */
export const colar = async () => {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
};
