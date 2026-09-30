import { ErroDoRepositorio, fichaDoAnexo, porEdicao, validarAnexo, validarNota } from '../repositorio.js';

/**
 * As anotações em memória: o mesmo contrato do adaptador de IndexedDB (ver repositorio.js), para os
 * testes. Copia tudo que entra e sai, como o banco faria: quem edita o objeto devolvido não mexe
 * no que está guardado.
 */
export const criarRepositorioEmMemoria = () => {
  const notas = new Map();
  const anexos = new Map(); // id → { notaId, blob }
  const copia = (n) => structuredClone(n);

  const exigir = (notaId) => {
    const nota = notas.get(notaId);
    if (!nota) throw new ErroDoRepositorio('A anotação não existe mais.');
    return nota;
  };

  return {
    modo: 'memoria',

    async listarNotas() {
      return [...notas.values()].map(copia).sort(porEdicao);
    },

    async salvarNota(nota, { manterData = false } = {}) {
      validarNota(nota);
      const gravada = { ...copia(nota), atualizadaEm: manterData ? nota.atualizadaEm : Date.now() };
      notas.set(gravada.id, gravada);
      return copia(gravada);
    },

    async excluirNota(id) {
      notas.delete(id);
      for (const [anexoId, a] of anexos) if (a.notaId === id) anexos.delete(anexoId);
    },

    async adicionarAnexo(notaId, arquivo, ficha, { manterData = false } = {}) {
      validarAnexo(arquivo);
      const nota = exigir(notaId);
      const nova = fichaDoAnexo(arquivo, ficha);
      anexos.set(nova.id, { notaId, blob: arquivo });
      nota.anexos = [...nota.anexos.filter((a) => a.id !== nova.id), nova];
      if (!manterData) nota.atualizadaEm = Date.now();
      return { ...nova };
    },

    async lerAnexo(anexoId) {
      return anexos.get(anexoId)?.blob ?? null;
    },

    async removerAnexo(notaId, anexoId) {
      anexos.delete(anexoId);
      const nota = notas.get(notaId);
      if (nota) {
        nota.anexos = nota.anexos.filter((a) => a.id !== anexoId);
        nota.atualizadaEm = Date.now();
      }
    }
  };
};
