/**
 * Escapa um valor para dentro de HTML — em texto e em atributo entre aspas.
 *
 * Renda Fixa e Calendário montam a tela por `innerHTML`, e o que vai para lá vem de fora: nome de
 * ativo lido da planilha, nome de colaborador, observação e motivo gravados no banco por qualquer
 * pessoa com a chave anon. Tudo isso passa por aqui antes de virar marcação.
 *
 * O Ordens tem a sua cópia em `modulos/ordens/core/util/html.js`, porque o core dele não depende de
 * nada fora do módulo.
 */
export const esc = (valor) =>
  String(valor ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
