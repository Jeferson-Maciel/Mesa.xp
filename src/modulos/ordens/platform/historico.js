/**
 * Histórico local das ordens geradas.
 *
 * Fica no `localStorage` do próprio navegador: nenhum dado de cliente sai da máquina. Cada
 * entrada guarda o texto colado original, que é o que permite reabrir e refazer uma ordem —
 * reabrir passa o texto pelo pipeline de novo, em vez de confiar numa saída congelada.
 *
 * O registro acontece quando o operador **copia** uma saída, não a cada tecla digitada: o
 * histórico é a lista do que foi de fato usado, não do que foi rascunhado.
 *
 * Desde a Fase 3 (21/10/2026), cada entrada guarda também as correções do cartão (`ui/correcoes.js`),
 * que o Reabrir aplica sobre o texto lido de novo, e os cartões da Fila que o e-mail criou (`pedidos`,
 * só os ids), para o histórico mostrar em que pé cada e-mail está.
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

export const registrar = ({ conta, ativos, formato, textoOriginal, correcoes = null }) => {
  const lista = ler();

  // Copiar a mesma coisa duas vezes é um clique repetido, não uma ordem nova; as correções são as de agora.
  const anterior = lista[0];
  if (anterior && anterior.textoOriginal === textoOriginal && anterior.formato === formato) {
    anterior.correcoes = correcoes;
    escrever(lista);
    return anterior;
  }

  const entrada = {
    id: 'ord_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    quando: new Date().toISOString(),
    conta: conta ?? '—',
    ativos: ativos ?? [],
    formato,
    textoOriginal: textoOriginal ?? '',
    correcoes,
    pedidos: []
  };

  escrever([entrada, ...lista]);
  return entrada;
};

/** O cartão da Fila que o e-mail desta entrada criou (ou atualizou). */
export const vincularPedido = (id, idDoPedido) => {
  const lista = ler();
  const entrada = lista.find((e) => e.id === id);
  if (!entrada || (entrada.pedidos ?? []).includes(idDoPedido)) return;
  entrada.pedidos = [...(entrada.pedidos ?? []), idDoPedido];
  escrever(lista);
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
