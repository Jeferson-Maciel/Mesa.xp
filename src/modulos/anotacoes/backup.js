/**
 * Backup das anotações: um arquivo .json com as anotações e os anexos (em base64).
 *
 * As anotações moram no navegador (ver repositorio.js). O backup é o que as leva para outro
 * computador, da versão aberta do disco para a do Netlify, ou de volta depois de alguém limpar os
 * dados do navegador. Importar **junta**: anotação que já existe só é trocada se a do arquivo for
 * mais recente — importar o mesmo backup duas vezes não duplica nada.
 */

import { ErroDoRepositorio } from './repositorio.js';

export const FORMATO = 'mesa-xp-anotacoes';

const paraBase64 = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
};

const deBase64 = (texto, tipo) => {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
};

/** @returns {Promise<object>} o conteúdo do arquivo de backup. */
export const exportarBackup = async (repo, agora = Date.now()) => {
  const notas = await repo.listarNotas();
  const anexos = [];
  for (const nota of notas) {
    for (const ficha of nota.anexos) {
      const blob = await repo.lerAnexo(ficha.id);
      if (blob) anexos.push({ ...ficha, notaId: nota.id, base64: await paraBase64(blob) });
    }
  }
  return { formato: FORMATO, versao: 1, exportadoEm: agora, notas, anexos };
};

/**
 * @returns {Promise<{ importadas: number, ignoradas: number, anexos: number }>}
 *   ignoradas: já estavam aqui, iguais ou mais novas.
 */
export const importarBackup = async (repo, dados) => {
  if (dados?.formato !== FORMATO || !Array.isArray(dados.notas)) {
    throw new ErroDoRepositorio('Este arquivo não é um backup de anotações da Mesa XP.');
  }
  const atuais = new Map((await repo.listarNotas()).map((n) => [n.id, n]));
  const anexosDe = new Map();
  for (const a of dados.anexos ?? []) {
    if (!anexosDe.has(a.notaId)) anexosDe.set(a.notaId, []);
    anexosDe.get(a.notaId).push(a);
  }

  let importadas = 0;
  let ignoradas = 0;
  let anexos = 0;
  for (const nota of dados.notas) {
    const atual = atuais.get(nota.id);
    if (atual && atual.atualizadaEm >= nota.atualizadaEm) {
      ignoradas++;
      continue;
    }
    // Primeiro a anotação sem anexos; cada anexo entra com o mesmo id e a ficha volta junto.
    await repo.salvarNota({ ...nota, anexos: [] }, { manterData: true });
    for (const a of anexosDe.get(nota.id) ?? []) {
      await repo.adicionarAnexo(nota.id, deBase64(a.base64, a.tipo), { id: a.id, nome: a.nome, criadoEm: a.criadoEm }, { manterData: true });
      anexos++;
    }
    importadas++;
  }
  return { importadas, ignoradas, anexos };
};
