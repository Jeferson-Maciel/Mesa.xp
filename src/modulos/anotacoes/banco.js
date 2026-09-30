import { criarRepositorioIndexedDB } from './adaptadores/indexeddb.js';

/**
 * Um repositório só para a página inteira: o vigia dos lembretes (que abre com a página) e a aba
 * Anotações (que abre na primeira visita) usam a mesma conexão com o IndexedDB.
 */
let repo = null;

export const repositorioDasAnotacoes = () => (repo ??= criarRepositorioIndexedDB());
