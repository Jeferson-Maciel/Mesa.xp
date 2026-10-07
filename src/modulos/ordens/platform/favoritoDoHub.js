import fonte from './favorito-hub.js?raw';

/**
 * O favorito do Hub como endereço `javascript:`, para o botão do painel que o operador arrasta
 * para a barra de favoritos. O texto do favorito, e o porquê de ele ser assim, está em
 * `favorito-hub.js`.
 */

/** O texto numa linha só, sem o comentário do cabeçalho. */
export const scriptDoFavorito = (texto = fonte) =>
  texto
    .replace(/^\s*\/\*\*[\s\S]*?\*\/\s*/, '')
    .replace(/\s*\n\s*/g, ' ')
    .trim();

export const enderecoDoFavorito = (texto = fonte) => `javascript:${encodeURIComponent(scriptDoFavorito(texto))}`;
