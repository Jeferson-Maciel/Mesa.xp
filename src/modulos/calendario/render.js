/**
 * O HTML do Calendário: funções puras, sem DOM, testadas em `render.test.js`.
 *
 * Qualquer pessoa com a chave anon escreve no banco, então nome, observação e motivo são entrada
 * não confiável: tudo passa por `esc`, e a cor do colaborador, que vai para um atributo `style`,
 * passa por `corSegura` — só hex.
 *
 * A matriz da semana mostra os horários indisponíveis mas não o motivo: ele pode ser de saúde, e
 * a matriz é a tela que fica aberta à vista de todos. O motivo aparece na janela do dia e no
 * histórico, como no app original.
 */

import { esc } from '../../ui/html.js';
import { DIAS, DIAS_CURTOS, chaveDoDia, diasUteis, mesmoDia, rotuloCurto, semanasDoMes } from './datas.js';

/** A paleta do app original: as cores já gravadas no banco vêm daqui. */
export const CORES = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7'];

export const corSegura = (cor) => (/^#[0-9a-f]{3,8}$/i.test(cor || '') ? cor : CORES[0]);

const chave = (data, colaboradorId) => `${data}|${colaboradorId}`;

/** @returns {Map<string, import('./repositorio.js').Registro>} os registros por dia e colaborador */
export const indexar = (registros) => new Map(registros.map((r) => [chave(r.data, r.colaboradorId), r]));

const registroDe = (registros, dia, colaboradorId) => registros.get(chave(chaveDoDia(dia), colaboradorId)) ?? null;

const ddmm = (dia) => `${String(dia.getDate()).padStart(2, '0')}/${String(dia.getMonth() + 1).padStart(2, '0')}`;

const faixa = (h) => `${h.inicio}–${h.fim}`;

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const pessoa = (c) =>
  `<span class="cal-pessoa"><i class="cal-cor" style="background:${corSegura(c.cor)}"></i><span class="cal-nome" title="${esc(c.nome)}">${esc(c.nome)}</span></span>`;

/* ── Semana ───────────────────────────────────────────────────────────────────────────── */

const celulaDaSemana = (c, dia, registro, ehHoje) => {
  const presencial = Boolean(registro?.presencial);
  const observacao = registro?.observacao?.trim();
  const horarios = registro?.indisponiveis ?? [];
  const marcas = [
    observacao ? '<span class="cal-marca" title="Tem observação">obs</span>' : '',
    horarios.length ? `<span class="cal-marca cal-indisponivel" title="Horário indisponível">${esc(horarios.map(faixa).join(', '))}</span>` : ''
  ].join('');
  const descricao = `${c.nome}, ${DIAS[dia.getDay()]} ${ddmm(dia)}: ${presencial ? 'presencial' : 'não marcado'}. Clique para editar.`;

  return `<td${ehHoje ? ' class="cal-hoje"' : ''}>
      <button type="button" class="cal-dia${presencial ? ' presente' : ''}" data-dia="${chaveDoDia(dia)}" data-colaborador="${esc(c.id)}" aria-label="${esc(descricao)}">
        <span class="cal-status">${presencial ? 'Presencial' : '—'}</span>${marcas}
      </button>
    </td>`;
};

export const htmlSemana = ({ colaboradores, registros, segunda, hoje }) => {
  if (colaboradores.length === 0) {
    return '<div class="empty-state"><p>Nenhum colaborador cadastrado.</p><span>Adicione os membros da equipe no campo acima.</span></div>';
  }

  const dias = diasUteis(segunda);
  const cabecalho = dias
    .map((d) => `<th scope="col"${mesmoDia(d, hoje) ? ' class="cal-hoje"' : ''}><span>${DIAS_CURTOS[d.getDay()]}</span> ${ddmm(d)}</th>`)
    .join('');

  const linhas = colaboradores
    .map(
      (c) => `
    <tr class="cal-linha">
      <th scope="row">
        ${pessoa(c)}
        <button type="button" class="cal-remover" data-remover="${esc(c.id)}" aria-label="Remover ${esc(c.nome)}" title="Remover ${esc(c.nome)}">&times;</button>
      </th>
      ${dias.map((d) => celulaDaSemana(c, d, registroDe(registros, d, c.id), mesmoDia(d, hoje))).join('')}
    </tr>`
    )
    .join('');

  const totais = dias
    .map((d) => {
      const n = colaboradores.filter((c) => registroDe(registros, d, c.id)?.presencial).length;
      return `<td${mesmoDia(d, hoje) ? ' class="cal-hoje"' : ''}>${n}</td>`;
    })
    .join('');

  return `
  <div class="cal-rolagem">
    <table class="cal-matriz">
      <thead><tr><th scope="col">Colaborador</th>${cabecalho}</tr></thead>
      <tbody>${linhas}</tbody>
      <tfoot><tr><th scope="row">Presenciais</th>${totais}</tr></tfoot>
    </table>
  </div>`;
};

/* ── Histórico ────────────────────────────────────────────────────────────────────────── */

const celulaDoHistorico = (registro) => {
  const presencial = Boolean(registro?.presencial);
  const partes = [`<span class="cal-status${presencial ? ' presente' : ''}">${presencial ? '✓' : '—'}</span>`];
  if (registro?.observacao?.trim()) partes.push(`<span class="cal-obs">${esc(registro.observacao)}</span>`);
  if (registro?.indisponiveis?.length) {
    const texto = registro.indisponiveis.map((h) => faixa(h) + (h.motivo ? ` (${h.motivo})` : '')).join(', ');
    partes.push(`<span class="cal-indisponivel">${esc(texto)}</span>`);
  }
  return `<td>${partes.join('')}</td>`;
};

export const htmlHistorico = ({ colaboradores, registros, ano, mes }) => {
  if (colaboradores.length === 0) return '<div class="empty-state"><p>Nenhum colaborador para mostrar.</p></div>';

  return semanasDoMes(ano, mes)
    .map((semana, i) => {
      let presencas = 0;
      let ausencias = 0;
      for (const dia of semana) {
        for (const c of colaboradores) {
          const r = registroDe(registros, dia, c.id);
          if (r?.presencial) presencas++;
          if (r?.indisponiveis?.length) ausencias++;
        }
      }

      const cabecalho = semana.map((d) => `<th scope="col"><span>${DIAS_CURTOS[d.getDay()]}</span> ${d.getDate()}</th>`).join('');
      const linhas = colaboradores
        .map((c) => `<tr><th scope="row">${pessoa(c)}</th>${semana.map((d) => celulaDoHistorico(registroDe(registros, d, c.id))).join('')}</tr>`)
        .join('');

      return `
    <section class="cal-semana-hist">
      <button type="button" class="cal-semana-topo" data-semana="${i}" aria-expanded="true">
        <strong>${rotuloCurto(semana[0])} — ${rotuloCurto(semana.at(-1))}</strong>
        <span class="cal-resumo">
          <span class="cal-presencas">${plural(presencas, 'presença', 'presenças')}</span>
          ${ausencias ? `<span class="cal-ausencias">${plural(ausencias, 'ausência parcial', 'ausências parciais')}</span>` : ''}
        </span>
      </button>
      <div class="cal-rolagem" data-corpo-semana="${i}">
        <table class="cal-matriz cal-matriz-hist">
          <thead><tr><th scope="col">Colaborador</th>${cabecalho}</tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
    </section>`;
    })
    .join('');
};

/* ── Janela do dia ────────────────────────────────────────────────────────────────────── */

export const htmlHorarios = (horarios) =>
  horarios.length
    ? horarios
        .map(
          (h, i) => `
      <li class="cal-horario">
        <span class="cal-horario-faixa">${esc(h.inicio)} – ${esc(h.fim)}</span>
        <span class="cal-horario-motivo">${esc(h.motivo || 'Sem motivo')}</span>
        <button type="button" class="cal-remover" data-remover-horario="${i}" aria-label="Remover horário" title="Remover horário">&times;</button>
      </li>`
        )
        .join('')
    : '<li class="cal-horario-vazio">Nenhum horário indisponível registrado.</li>';
