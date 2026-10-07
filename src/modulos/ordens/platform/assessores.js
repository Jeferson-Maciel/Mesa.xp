/**
 * A planilha dos assessores, no `localStorage` do navegador.
 *
 * Não tem dado de cliente: é o nome, o e-mail e o código de cada assessor do escritório. Fica no
 * navegador até outra ser carregada, porque muda pouco. Nunca vai para o repositório, que é
 * público. O cliente, ao contrário, não é guardado em lugar nenhum: vive só na memória da página.
 */

const CHAVE = 'ordens_assessores';

/** @returns {{arquivo: string, carregadaEm: string, lista: Array<{nome: string, email: string, codigos: string[], ativo: boolean}>}|null} */
export const carregar = () => {
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
    return guardado && Array.isArray(guardado.lista) ? guardado : null;
  } catch {
    return null;
  }
};

export const salvar = (assessores) => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(assessores));
    return true;
  } catch {
    return false;
  }
};
