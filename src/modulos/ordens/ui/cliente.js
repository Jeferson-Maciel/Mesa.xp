import { esc } from '../core/util/html.js';

/**
 * A linha do cliente no cartão: o que o robô trouxe do Hub para a conta, e o assessor que vai em
 * cópia. É conferência antes de ser e-mail: um dígito trocado na conta dá uma ordem válida para a
 * pessoa errada, e o nome à vista é o que denuncia isso.
 *
 * `solicitacao.cliente` é montado pela tela a cada render, da memória da página:
 *   null                                   sem robô, ou sem conta na forma certa
 *   {situacao: 'buscando'}
 *   {situacao: 'falhou', motivo}
 *   {situacao: 'achado', nome, email, assessor: {codigo, nome, email, peloNome, motivo}}
 */

const FALTA_DO_ASSESSOR = {
  'sem-planilha': 'carregue a planilha dos assessores para pôr em cópia',
  'sem-assessor': 'o Hub não trouxe o assessor',
  'fora-da-planilha': 'fora da planilha dos assessores — sem cópia',
  ambiguo: 'mais de um e-mail na planilha — sem cópia'
};

const falta = (texto) => `<span class="cliente-falta">${esc(texto)}</span>`;
const email = (texto) => `<span class="cliente-email">${esc(texto)}</span>`;

/** @returns {string} o HTML da linha, ou vazio */
export const renderCliente = (cliente) => {
  if (!cliente) return '';

  if (cliente.situacao === 'buscando') {
    return '<div class="linha-cliente"><span class="meta-counter buscando">buscando o cliente no Hub…</span></div>';
  }
  if (cliente.situacao === 'falhou') {
    return `<div class="linha-cliente falhou">${falta(`Cliente: ${cliente.motivo}. O e-mail sai com "Prezado(a) Cliente,".`)}</div>`;
  }

  const { assessor } = cliente;
  const quem = [assessor.nome && esc(assessor.nome), assessor.codigo && `<span class="cliente-codigo">${esc(assessor.codigo)}</span>`]
    .filter(Boolean)
    .join(' ');
  const copia = assessor.email
    ? email(assessor.email) + (assessor.peloNome ? ' <span class="cliente-nota">achado pelo nome</span>' : '')
    : falta(FALTA_DO_ASSESSOR[assessor.motivo] ?? 'sem cópia');

  return `<div class="linha-cliente">
      <div class="cliente-item"><span class="cliente-rotulo">Cliente</span><strong class="cliente-nome">${esc(cliente.nome ?? '—')}</strong>${cliente.email ? email(cliente.email) : falta('sem e-mail no Hub')}</div>
      <div class="cliente-item"><span class="cliente-rotulo">Cópia</span>${quem}${copia}</div>
    </div>`;
};
