/**
 * O HTML da Prateleira de fundos: funções puras, testadas em `render.test.js`. O que vem do Hub (o
 * nome do fundo) passa por `esc`.
 */

import { esc } from '../../ui/html.js';

const pct = (v) => (v === null || v === undefined ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
const reais = (v) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 6 }));
const cotas = (v) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }));

export const COLUNAS = [
  { campo: 'nome', rotulo: 'Fundo' },
  { campo: 'desagio', rotulo: 'Deságio' },
  { campo: 'roaMaximo', rotulo: 'ROA máx.', dica: 'O deságio menos o deságio mínimo do cliente: o fim da barra de ROA adicional na boleta' },
  { campo: 'aplicacaoMinima', rotulo: 'Mínimo' },
  { campo: 'pu', rotulo: 'PU' },
  { campo: 'estoque', rotulo: 'Estoque XP' },
  { campo: null, rotulo: 'Estoque clientes' }
];

/**
 * @param {object[]} linhas  já filtradas e ordenadas
 * @param {{campo: string, sentido: 'asc'|'desc', total: number}} ordem
 */
export const htmlTabela = (linhas, { campo, sentido, total }) => {
  if (!total) return '';
  if (!linhas.length) return '<p class="fu-vazio">Nenhum fundo com esse filtro.</p>';
  const maiorDesagio = Math.max(...linhas.map((l) => l.desagio ?? 0), 0.01);
  const cabeca = COLUNAS.map((c) => {
    if (!c.campo) return `<th scope="col"><span class="fu-ordenar fu-sem-ordem">${c.rotulo}</span></th>`;
    const ativo = c.campo === campo;
    const aria = ativo ? ` aria-sort="${sentido === 'asc' ? 'ascending' : 'descending'}"` : '';
    return `<th scope="col"${aria}><button type="button" class="fu-ordenar${ativo ? ' ativo' : ''}" data-ordenar="${c.campo}"${c.dica ? ` title="${esc(c.dica)}"` : ''}>${c.rotulo}${ativo ? `<span aria-hidden="true">${sentido === 'asc' ? '↑' : '↓'}</span>` : ''}</button></th>`;
  }).join('');
  const corpo = linhas
    .map(
      (l) => `
      <tr${(l.estoque ?? 0) > 0 ? '' : ' class="fu-sem-estoque"'}>
        <th scope="row"><span class="fu-fundo">${l.ticker ? `<span class="fu-ticker">${esc(l.ticker)}</span>` : ''}<span class="fu-nome" title="${esc(l.nome)}">${esc(l.nome)}</span></span></th>
        <td class="fu-num fu-desagio" style="--forca:${((l.desagio ?? 0) / maiorDesagio).toFixed(3)}"><span>${pct(l.desagio)}</span></td>
        <td class="fu-num">${pct(l.roaMaximo)}</td>
        <td class="fu-num">${reais(l.aplicacaoMinima)}</td>
        <td class="fu-num">${reais(l.pu)}</td>
        <td class="fu-num">${(l.estoque ?? 0) > 0 ? cotas(l.estoque) : '<span class="fu-zerado">sem estoque</span>'}</td>
        <td class="fu-num">${l.clientes ? `${pct(l.clientes.desagio)} · ${cotas(l.clientes.estoque)}` : '<span class="fu-fechado">fechado</span>'}</td>
      </tr>`
    )
    .join('');
  return `<div class="fu-tabela-caixa"><table class="fu-tabela"><thead><tr>${cabeca}</tr></thead><tbody>${corpo}</tbody></table></div>`;
};

const ddmm = (dia) => dia.split('-').reverse().slice(0, 2).join('/');

/** O que mudou desde o último dia com foto. */
export const htmlMudancas = (mudancas, diaAnterior, semMudanca) => {
  if (!diaAnterior) return '<p class="fu-nota">Primeira foto da prateleira.</p>';
  if (semMudanca) return `<p class="fu-nota">Nada mudou desde ${ddmm(diaAnterior)}.</p>`;
  const lista = (titulo, itens) => (itens.length ? `<div class="fu-mudanca"><h3>${titulo}</h3><ul>${itens.join('')}</ul></div>` : '');
  const seta = (de, para) => `<span class="fu-de">${pct(de)}</span> → <b class="${para > de ? 'fu-subiu' : 'fu-caiu'}">${pct(para)}</b>`;
  return `
    <p class="fu-nota">Desde ${ddmm(diaAnterior)}:</p>
    <div class="fu-mudancas">
      ${lista('Entraram', mudancas.entraram.map((f) => `<li>${esc(f)}</li>`))}
      ${lista('Saíram', mudancas.sairam.map((f) => `<li>${esc(f)}</li>`))}
      ${lista('Deságio', mudancas.desagio.map((m) => `<li><span class="fu-m-fundo">${esc(m.fundo)}</span> ${seta(m.de, m.para)}</li>`))}
      ${lista('ROA máximo', mudancas.roa.map((m) => `<li><span class="fu-m-fundo">${esc(m.fundo)}</span> ${seta(m.de, m.para)}</li>`))}
      ${lista('Estoque XP', mudancas.estoque.map((m) => `<li><span class="fu-m-fundo">${esc(m.fundo)}</span> <b class="${m.zerou ? 'fu-caiu' : 'fu-subiu'}">${m.zerou ? 'zerou' : 'voltou'}</b></li>`))}
    </div>`;
};
