import { chaveDoDia } from '../../../comum/dia.js';

/**
 * O lote como arquivo (F9, 22/10/2026): o mesmo texto do Copiar, em .tsv, com TAB e `\n`, sem marca
 * de ordem de bytes — decisão do usuário, "igual ao copiado". O nome diz o lote, a conta (ou quantas
 * contas, no Juntos) e o dia local.
 */

const NOMES = { lote: 'lote-simples', twap: 'lote-twap' };

export const nomeDoArquivoDoLote = ({ formato, contas, momento = new Date() }) =>
  `${NOMES[formato]}-${contas.length === 1 ? contas[0] : `${contas.length}-contas`}-${chaveDoDia(momento)}.tsv`;

export const arquivoDoLote = (texto) => new Blob([texto], { type: 'text/tab-separated-values;charset=utf-8' });

/** Entrega o arquivo aos downloads do navegador (funciona também aberto do disco). */
export const baixarArquivo = (blob, nome) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
