/**
 * Histórico local das ordens geradas.
 *
 * Fica no `localStorage` do próprio navegador: nenhum dado de cliente sai da máquina. Cada
 * entrada guarda o texto colado original, que é o que permite reabrir e refazer uma ordem —
 * reabrir passa o texto pelo pipeline de novo, em vez de confiar numa saída congelada.
 *
 * O registro acontece quando o operador **copia** uma saída, não a cada tecla digitada: o
 * histórico é a lista do que foi de fato usado, não do que foi rascunhado.
 */

const CHAVE = 'xp_ordens_historico_v2';
const LIMITE = 50;

const ler = () => {
  try {
    const bruto = localStorage.getItem(CHAVE);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
};

const escrever = (lista) => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista.slice(0, LIMITE)));
    return true;
  } catch {
    return false;
  }
};

export const listar = () => ler();

export const registrar = ({ conta, ativos, formato, textoOriginal }) => {
  const lista = ler();

  // Copiar a mesma coisa duas vezes é um clique repetido, não uma ordem nova.
  const anterior = lista[0];
  if (anterior && anterior.textoOriginal === textoOriginal && anterior.formato === formato) {
    return anterior;
  }

  const entrada = {
    id: 'ord_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    quando: new Date().toISOString(),
    conta: conta ?? '—',
    ativos: ativos ?? [],
    formato,
    textoOriginal: textoOriginal ?? ''
  };

  escrever([entrada, ...lista]);
  return entrada;
};

export const buscar = (termo) => {
  const lista = ler();
  const alvo = String(termo ?? '').trim().toLowerCase();
  if (!alvo) return lista;

  return lista.filter((e) =>
    [e.conta, e.formato, e.textoOriginal, ...(e.ativos ?? [])]
      .join(' ')
      .toLowerCase()
      .includes(alvo)
  );
};

export const remover = (id) => escrever(ler().filter((e) => e.id !== id));

export const limpar = () => {
  try {
    localStorage.removeItem(CHAVE);
    return true;
  } catch {
    return false;
  }
};
