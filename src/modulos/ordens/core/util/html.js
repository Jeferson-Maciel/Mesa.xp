/**
 * Escapa um valor para dentro de HTML.
 *
 * Mora no core porque o core também escreve HTML: a tabela da auditoria vai para o e-mail como
 * HTML, e ativo e preço são texto digitado — um `<` no preço não pode virar marcação.
 */
export const esc = (valor) =>
  String(valor ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
