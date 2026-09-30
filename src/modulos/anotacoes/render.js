/**
 * O HTML da aba Anotações e dos alertas de lembrete: funções puras, sem DOM, testadas em
 * `render.test.js`.
 *
 * Anotação é texto livre — às vezes colado de um e-mail ou de uma conversa — e tudo passa por
 * `esc`. Link só vira link se for http ou https (notas.js), e abre em outra aba sem acesso a esta.
 * As miniaturas dos prints saem sem `src`: o arquivo mora no IndexedDB, e index.js põe o endereço
 * dele (um object URL) depois de desenhar.
 */

import { esc } from '../../ui/html.js';
import { ATALHOS, estadoDaNota, rotuloDoLembrete } from './lembretes.js';
import { corDaEtiqueta, extrairLinks, tituloVisivel, trechoDe } from './notas.js';

export const linkDaNota = (id) => `#anotacoes/nota/${encodeURIComponent(id)}`;

const dataEHora = (ms) => {
  const d = new Date(ms);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

const tamanho = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** O selo colorido do lembrete: amarelo pendente, vermelho vencido, verde resolvido. */
export const htmlSelo = (nota, agora) => {
  const rotulo = rotuloDoLembrete(nota, agora);
  return rotulo ? `<span class="an-selo an-selo-${estadoDaNota(nota, agora)}">${esc(rotulo)}</span>` : '';
};

const htmlEtiqueta = (nome, extra = '') => `<span class="an-etiqueta an-cor-${corDaEtiqueta(nome)}"${extra}>${esc(nome)}</span>`;

/* ── Lista ────────────────────────────────────────────────────────────────────────────── */

export const htmlCartao = (nota, agora, selecionada) => {
  const estado = estadoDaNota(nota, agora);
  const trecho = trechoDe(nota);
  const anexos = nota.anexos.length ? `<span class="an-contagem-anexos" title="Anexos">${plural(nota.anexos.length, 'anexo', 'anexos')}</span>` : '';
  const etiquetas = nota.etiquetas.slice(0, 4).map((e) => htmlEtiqueta(e)).join('');
  return `
    <a class="an-cartao an-${estado}${nota.fixada ? ' an-fixada' : ''}" href="${linkDaNota(nota.id)}"${selecionada ? ' aria-current="true"' : ''} data-id="${esc(nota.id)}">
      <span class="an-cartao-topo">
        <strong>${esc(tituloVisivel(nota))}</strong>
        ${nota.fixada ? '<span class="an-pino" title="Fixada" aria-label="Fixada"></span>' : ''}
      </span>
      ${trecho ? `<span class="an-trecho">${esc(trecho)}</span>` : ''}
      <span class="an-cartao-pe">${htmlSelo(nota, agora)}${etiquetas}${anexos}</span>
    </a>`;
};

const VAZIOS = {
  todas: ['Nenhuma anotação ainda.', 'Clique em "Nova anotação" (ou aperte N) e escreva, cole prints com Ctrl+V e marque um lembrete.'],
  lembretes: ['Nenhum lembrete pendente.', 'Marque um lembrete numa anotação e ele aparece aqui, em amarelo, até o dia chegar.'],
  vencidas: ['Nada vencido.', 'Quando um lembrete chegar, a anotação fica vermelha e aparece aqui.'],
  resolvidas: ['Nada resolvido ainda.', 'Marque uma anotação como resolvida e ela sai do caminho, mas fica guardada aqui.']
};

export const htmlLista = ({ notas, agora, selecionada, filtro, termo }) => {
  if (notas.length === 0) {
    const [titulo, dica] = termo.trim() ? [`Nada encontrado para “${termo.trim()}”.`, 'A busca olha o título, o texto e as etiquetas.'] : VAZIOS[filtro] ?? VAZIOS.todas;
    return `<div class="empty-state pequeno"><p>${esc(titulo)}</p><span>${esc(dica)}</span></div>`;
  }
  return notas.map((n) => htmlCartao(n, agora, n.id === selecionada)).join('');
};

const ROTULOS_FILTRO = { todas: 'Todas', lembretes: 'Lembretes', vencidas: 'Vencidas', resolvidas: 'Resolvidas' };

export const htmlFiltros = ({ contagens, filtro }) =>
  Object.entries(ROTULOS_FILTRO)
    .map(
      ([id, rotulo]) =>
        `<button type="button" class="an-filtro an-filtro-${id}" data-filtro="${id}" aria-pressed="${id === filtro}">${rotulo}<span>${contagens[id]}</span></button>`
    )
    .join('');

export const htmlEtiquetasFiltro = ({ etiquetas, atual }) =>
  etiquetas.length
    ? etiquetas
        .map(
          ({ nome, total }) =>
            `<button type="button" class="an-etiqueta an-cor-${corDaEtiqueta(nome)} an-etiqueta-filtro" data-etiqueta="${esc(nome)}" aria-pressed="${
              nome.toLocaleLowerCase('pt-BR') === atual.toLocaleLowerCase('pt-BR')
            }">${esc(nome)}<span>${total}</span></button>`
        )
        .join('')
    : '<span class="an-dica">Nenhuma etiqueta ainda.</span>';

/* ── Editor ───────────────────────────────────────────────────────────────────────────── */

export const htmlLembrete = (nota, agora) => {
  const estado = estadoDaNota(nota, agora);
  const { data = '', hora = '' } = nota.lembrete ?? {};
  const atalhos = ATALHOS.filter((a) => a.disponivel(agora))
    .map((a) => `<button type="button" class="an-atalho" data-atalho="${a.id}">${a.rotulo}</button>`)
    .join('');
  const verbo = estado === 'vencida' || estado === 'hoje' ? 'Adiar' : nota.lembrete ? 'Mudar' : 'Lembrar';
  return `
    <div class="an-lembrete an-lembrete-${estado}">
      <div class="an-lembrete-linha">
        <span class="an-lembrete-rotulo">${nota.lembrete ? htmlSelo(nota, agora) : 'Lembrete'}</span>
        <label class="an-campo-data"><span>Dia</span><input type="date" data-campo="data" value="${esc(data)}" /></label>
        <label class="an-campo-data"><span>Hora</span><input type="time" data-campo="hora" value="${esc(hora ?? '')}" /></label>
        ${nota.lembrete ? '<button type="button" class="an-link" data-acao="sem-lembrete">Tirar lembrete</button>' : ''}
      </div>
      <div class="an-atalhos"><span>${verbo}:</span>${atalhos}</div>
    </div>`;
};

export const htmlEtiquetasEditor = (nota, sugestoes) => `
  <div class="an-etiquetas-editor">
    ${nota.etiquetas
      .map(
        (e) =>
          `<span class="an-etiqueta an-cor-${corDaEtiqueta(e)}">${esc(e)}<button type="button" data-remover-etiqueta="${esc(e)}" aria-label="Tirar a etiqueta ${esc(e)}">&times;</button></span>`
      )
      .join('')}
    <input class="an-nova-etiqueta" data-campo="etiqueta" list="an-sugestoes" placeholder="+ etiqueta" maxlength="40" autocomplete="off" aria-label="Nova etiqueta" />
    <datalist id="an-sugestoes">${sugestoes.map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist>
  </div>`;

export const htmlLinks = (texto) => {
  const links = extrairLinks(texto);
  if (!links.length) return '';
  return `
    <div class="an-links">
      <span class="an-secao">Links</span>
      ${links
        .map((url) => {
          let rotulo = url;
          try {
            const u = new URL(url);
            rotulo = u.hostname + (u.pathname.length > 1 ? u.pathname : '');
          } catch {
            // endereço estranho: mostra como veio
          }
          return `<a class="an-link-externo" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(url)}">${esc(rotulo)}</a>`;
        })
        .join('')}
    </div>`;
};

export const htmlAnexos = (anexos) => {
  if (!anexos.length) return '';
  return `
    <div class="an-anexos">
      <span class="an-secao">Anexos <span class="counter-badge">${anexos.length}</span></span>
      <div class="an-anexos-grade">
        ${anexos
          .map((a) =>
            a.tipo.startsWith('image/')
              ? `<button type="button" class="an-miniatura" data-anexo="${esc(a.id)}" title="${esc(a.nome)} · ${tamanho(a.tamanho)}">
                   <img alt="${esc(a.nome)}" data-miniatura="${esc(a.id)}" />
                 </button>`
              : `<button type="button" class="an-arquivo" data-anexo="${esc(a.id)}" title="Baixar ${esc(a.nome)}">
                   <strong>${esc(a.nome)}</strong><span>${tamanho(a.tamanho)}</span>
                 </button>`
          )
          .join('')}
      </div>
    </div>`;
};

/**
 * @param {{ nota: object, agora: Date, sugestoes: string[] }} dados
 *   `sugestoes`: as etiquetas já usadas, para completar ao digitar.
 */
export const htmlEditor = ({ nota, agora, sugestoes }) => `
  <div class="an-editor" data-an="editor" data-id="${esc(nota.id)}">
    <div class="an-editor-barra">
      <button type="button" class="an-voltar" data-acao="voltar">Anotações</button>
      <span class="an-salvo" data-an="salvo" aria-live="polite"></span>
      <div class="an-editor-acoes">
        <button type="button" class="copy-btn an-fixar" data-acao="fixar" aria-pressed="${nota.fixada}">${nota.fixada ? 'Fixada' : 'Fixar'}</button>
        <button type="button" class="copy-btn an-resolver" data-acao="resolver">${nota.concluida ? 'Reabrir' : 'Resolvido'}</button>
        <button type="button" class="copy-btn an-perigo" data-acao="excluir">Excluir</button>
      </div>
    </div>

    <input class="an-titulo" data-campo="titulo" value="${esc(nota.titulo)}" placeholder="Título — ex.: Estorno do dia 25" maxlength="200" aria-label="Título" autocomplete="off" />

    <div data-an="lembrete">${htmlLembrete(nota, agora)}</div>
    <div data-an="etiquetas">${htmlEtiquetasEditor(nota, sugestoes)}</div>

    <div class="an-ferramentas">
      <button type="button" class="an-ferramenta" data-acao="inserir-data" title="Escreve a data e a hora de agora no texto">Inserir data</button>
      <button type="button" class="an-ferramenta" data-acao="anexar" title="Anexar prints e arquivos">Anexar</button>
      <span class="an-dica">Cole prints com Ctrl+V ou arraste arquivos para cá.</span>
    </div>

    <textarea class="an-texto" data-campo="texto" spellcheck="true" placeholder="Escreva aqui: o que aconteceu, com quem, o que falta fazer. Links viram botões embaixo." aria-label="Texto da anotação">${esc(nota.texto)}</textarea>

    <div data-an="links">${htmlLinks(nota.texto)}</div>
    <div data-an="anexos">${htmlAnexos(nota.anexos)}</div>

    <p class="an-rodape">Criada em ${esc(dataEHora(nota.criadaEm))} · editada em ${esc(dataEHora(nota.atualizadaEm))}</p>
    <input type="file" multiple hidden data-an="arquivo" />
  </div>`;

/* ── Alerta ───────────────────────────────────────────────────────────────────────────── */

/** O cartão que salta na tela quando um lembrete vence, em qualquer aba. */
export const htmlAlerta = (nota, agora) => `
  <div class="an-alerta" role="alert" data-id="${esc(nota.id)}">
    <div class="an-alerta-topo">
      <span class="an-sino" aria-hidden="true"></span>
      <span class="an-alerta-titulo">Lembrete</span>
      <button type="button" class="icon-close-btn" data-alerta="dispensar" aria-label="Fechar o alerta (a anotação continua vermelha)" title="Fechar (a anotação continua vermelha)">&times;</button>
    </div>
    <strong class="an-alerta-nota">${esc(tituloVisivel(nota))}</strong>
    <span class="an-alerta-quando">${esc(rotuloDoLembrete(nota, agora))}</span>
    ${trechoDe(nota, 110) ? `<span class="an-alerta-trecho">${esc(trechoDe(nota, 110))}</span>` : ''}
    <div class="an-alerta-acoes">
      <button type="button" class="copy-btn btn-primario" data-alerta="abrir">Abrir</button>
      <button type="button" class="copy-btn" data-alerta="adiar-1h">+1 hora</button>
      <button type="button" class="copy-btn" data-alerta="adiar-amanha">Amanhã 9h</button>
      <button type="button" class="copy-btn an-resolver" data-alerta="resolver">Resolvido</button>
    </div>
  </div>`;
