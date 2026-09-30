/**
 * O HTML da aba Anotações e dos alertas de lembrete: funções puras, sem DOM, testadas em
 * `render.test.js`.
 *
 * Anotação é texto livre — às vezes colado de um e-mail ou de uma conversa — e tudo passa por
 * `esc`. Link só vira link se for http ou https (notas.js), e abre em outra aba sem acesso a esta.
 * As miniaturas dos prints saem sem `src`: o arquivo mora no IndexedDB (ou, antes de salvar, na
 * memória), e index.js põe o endereço dele depois de desenhar.
 */

import { esc } from '../../ui/html.js';
import { ATALHOS, estadoDaNota, rotuloDoLembrete } from './lembretes.js';
import { MODELOS } from './modelos.js';
import { agruparPorPrazo, camposDe, corDaEtiqueta, extrairLinks, lerChecklist, progressoChecklist, tituloVisivel, trechoDe } from './notas.js';

export const LINK_NOVA = '#anotacoes/nova';
export const linkDaNota = (id) => `#anotacoes/nota/${encodeURIComponent(id)}`;

const hhmm = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dataEHora = (ms) => `${new Date(ms).toLocaleDateString('pt-BR')} às ${hhmm(ms)}`;

const tamanho = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Minúsculo e sem acento, caractere por caractere: a posição achada vale no texto original.
const dobrar = (texto) => {
  let saida = '';
  for (const ch of String(texto)) {
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    saida += base.length === ch.length ? base : ch;
  }
  return saida;
};

/** O texto escapado, com o termo da busca marcado (sem ligar para acento nem maiúscula). */
export const realcar = (texto, termo) => {
  const alvo = dobrar(String(termo ?? '').trim());
  const original = String(texto ?? '');
  if (!alvo) return esc(original);
  const dobrado = dobrar(original);
  let saida = '';
  let desde = 0;
  for (let i = dobrado.indexOf(alvo); i >= 0; i = dobrado.indexOf(alvo, i + alvo.length)) {
    saida += esc(original.slice(desde, i)) + `<mark>${esc(original.slice(i, i + alvo.length))}</mark>`;
    desde = i + alvo.length;
  }
  return saida + esc(original.slice(desde));
};

/** O selo colorido do lembrete: amarelo pendente, vermelho vencido, verde resolvido. */
export const htmlSelo = (nota, agora) => {
  const rotulo = rotuloDoLembrete(nota, agora);
  return rotulo ? `<span class="an-selo an-selo-${estadoDaNota(nota, agora)}">${esc(rotulo)}</span>` : '';
};

const htmlEtiqueta = (nome, termo = '') => `<span class="an-etiqueta an-cor-${corDaEtiqueta(nome)}">${realcar(nome, termo)}</span>`;

/* ── Lista ────────────────────────────────────────────────────────────────────────────── */

/**
 * O cartão da anotação. A bolinha da esquerda resolve (e reabre) com um clique, como no Todoist;
 * na lixeira, o cartão oferece restaurar.
 */
export const htmlCartao = (nota, agora, selecionada, { termo = '', recemSalva = false } = {}) => {
  const estado = estadoDaNota(nota, agora);
  const trecho = trechoDe(nota);
  const { feitos, total } = progressoChecklist(nota.texto);
  const pe = [
    htmlSelo(nota, agora),
    ...nota.etiquetas.slice(0, 4).map((e) => htmlEtiqueta(e, termo)),
    total ? `<span class="an-progresso${feitos === total ? ' completo' : ''}" title="Checklist">${feitos}/${total}</span>` : '',
    nota.anexos.length ? `<span class="an-contagem-anexos" title="Anexos">${plural(nota.anexos.length, 'anexo', 'anexos')}</span>` : ''
  ].join('');
  const naLixeira = estado === 'excluida';
  const acao = naLixeira
    ? `<button type="button" class="an-restaurar" data-restaurar="${esc(nota.id)}" title="Restaurar">Restaurar</button>`
    : `<button type="button" class="an-bolinha" data-resolver="${esc(nota.id)}" aria-pressed="${estado === 'resolvida'}" title="${estado === 'resolvida' ? 'Reabrir' : 'Marcar como resolvida'}" aria-label="${estado === 'resolvida' ? 'Reabrir' : 'Marcar como resolvida'}"></button>`;
  return `
    <article class="an-cartao an-${estado}${nota.fixada ? ' an-fixada' : ''}${recemSalva ? ' an-recem-salva' : ''}" data-id="${esc(nota.id)}">
      ${acao}
      <a class="an-cartao-link" href="${linkDaNota(nota.id)}"${selecionada ? ' aria-current="true"' : ''}>
        <span class="an-cartao-topo">
          <strong>${realcar(tituloVisivel(nota), termo)}</strong>
          ${nota.fixada ? '<span class="an-pino" title="Fixada" aria-label="Fixada"></span>' : ''}
        </span>
        ${trecho ? `<span class="an-trecho">${realcar(trecho, termo)}</span>` : ''}
        ${pe ? `<span class="an-cartao-pe">${pe}</span>` : ''}
      </a>
    </article>`;
};

const VAZIOS = {
  todas: ['Nenhuma anotação ainda.', 'Escreva na caixa acima — "ligar pro cliente amanhã 10h" já vira lembrete — ou clique em Nova.'],
  lembretes: ['Nenhum lembrete pendente.', 'Marque um lembrete numa anotação e ele aparece aqui, em amarelo, até o dia chegar.'],
  vencidas: ['Nada vencido.', 'Quando um lembrete chegar, a anotação fica vermelha e aparece aqui.'],
  resolvidas: ['Nada resolvido ainda.', 'Clique na bolinha de uma anotação para resolvê-la; ela fica guardada aqui.'],
  lixeira: ['Lixeira vazia.', 'O que você exclui fica aqui por 30 dias, e dá para restaurar.']
};

export const htmlLista = ({ notas, agora, selecionada, filtro, termo, visao = 'lista', recemSalva = null }) => {
  if (notas.length === 0) {
    const [titulo, dica] = termo.trim() ? [`Nada encontrado para “${termo.trim()}”.`, 'A busca olha o título, o texto e as etiquetas.'] : VAZIOS[filtro] ?? VAZIOS.todas;
    return `<div class="empty-state pequeno"><p>${esc(titulo)}</p><span>${esc(dica)}</span></div>`;
  }
  const cartao = (n) => htmlCartao(n, agora, n.id === selecionada, { termo, recemSalva: n.id === recemSalva });
  if (visao !== 'agenda' || filtro === 'lixeira') return notas.map(cartao).join('');
  return agruparPorPrazo(notas, agora)
    .map(
      (g) => `
    <section class="an-grupo an-grupo-${g.id}">
      <h3 class="an-grupo-titulo"><span>${g.titulo}</span><span class="an-grupo-contagem">${g.notas.length}</span></h3>
      ${g.notas.map(cartao).join('')}
    </section>`
    )
    .join('');
};

const ROTULOS_FILTRO = { todas: 'Todas', lembretes: 'Lembretes', vencidas: 'Vencidas', resolvidas: 'Resolvidas', lixeira: 'Lixeira' };

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
    : '';

/** O selo da data lida na entrada rápida, com o × para ignorá-la. */
export const htmlDataLida = (lembrete, agora) =>
  lembrete
    ? `<span class="an-selo an-selo-pendente an-data-lida">${esc(rotuloDoLembrete({ lembrete, concluida: false }, agora))}<button type="button" data-an="ignorar-data" aria-label="Não usar esta data" title="Não usar esta data">&times;</button></span>`
    : '';

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

export const htmlEtiquetasEditor = (etiquetas, sugestoes) => `
  <div class="an-etiquetas-editor">
    ${etiquetas
      .map(
        (e) =>
          `<span class="an-etiqueta an-cor-${corDaEtiqueta(e)}">${esc(e)}<button type="button" data-remover-etiqueta="${esc(e)}" aria-label="Tirar a etiqueta ${esc(e)}">&times;</button></span>`
      )
      .join('')}
    <input class="an-nova-etiqueta" data-campo="etiqueta" list="an-sugestoes" placeholder="+ etiqueta" maxlength="40" autocomplete="off" aria-label="Nova etiqueta" />
    <datalist id="an-sugestoes">${sugestoes.map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist>
  </div>`;

/** As tarefas do texto, com caixinhas e a barra de progresso. Marcar muda o texto. */
export const htmlChecklist = (texto) => {
  const itens = lerChecklist(texto);
  if (!itens.length) return '';
  const feitos = itens.filter((i) => i.feito).length;
  return `
    <div class="an-checklist${feitos === itens.length ? ' completo' : ''}">
      <div class="an-checklist-topo">
        <span class="an-secao">Tarefas</span>
        <span class="an-checklist-conta">${feitos} de ${itens.length}</span>
      </div>
      <div class="an-checklist-barra"><i style="--feito:${(feitos / itens.length).toFixed(3)}"></i></div>
      <ul>
        ${itens
          .map(
            (i) =>
              `<li class="${i.feito ? 'feito' : ''}"><label><input type="checkbox" data-item="${i.linha}"${i.feito ? ' checked' : ''} /><span>${esc(i.texto || 'tarefa')}</span></label></li>`
          )
          .join('')}
      </ul>
    </div>`;
};

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

const htmlAnexo = (a, novo) =>
  a.tipo.startsWith('image/')
    ? `<button type="button" class="an-miniatura${novo ? ' an-anexo-novo' : ''}" data-anexo="${esc(a.id)}" title="${esc(a.nome)} · ${tamanho(a.tamanho)}">
         <img alt="${esc(a.nome)}" data-miniatura="${esc(a.id)}" />
       </button>`
    : `<button type="button" class="an-arquivo${novo ? ' an-anexo-novo' : ''}" data-anexo="${esc(a.id)}" title="Baixar ${esc(a.nome)}">
         <strong>${esc(a.nome)}</strong><span>${tamanho(a.tamanho)}</span>
       </button>`;

/** Os anexos gravados e, marcados "novo", os que entram quando a anotação for salva. */
export const htmlAnexos = (anexos, novos = []) => {
  if (!anexos.length && !novos.length) return '';
  return `
    <div class="an-anexos">
      <span class="an-secao">Anexos <span class="counter-badge">${anexos.length + novos.length}</span></span>
      <div class="an-anexos-grade">${anexos.map((a) => htmlAnexo(a, false)).join('')}${novos.map((a) => htmlAnexo(a, true)).join('')}</div>
    </div>`;
};

export const htmlModelos = () => `
  <div class="an-modelos">
    <span class="an-secao">Começar de um modelo</span>
    <div class="an-modelos-lista">
      ${MODELOS.map(
        (m) => `<button type="button" class="an-modelo" data-modelo="${m.id}"><strong>${esc(m.nome)}</strong><span>${esc(m.dica)}</span></button>`
      ).join('')}
    </div>
  </div>`;

/** O aviso de que há alterações de antes, que não foram salvas (o navegador fechou, a página caiu). */
export const htmlRecuperar = (em) => `
  <div class="alert alert-warning an-recuperar" role="alert">
    <span>Você tinha alterações não salvas nesta anotação, de ${esc(dataEHora(em))}.</span>
    <span class="an-recuperar-acoes">
      <button type="button" class="copy-btn" data-acao="recuperar">Recuperar</button>
      <button type="button" class="copy-btn" data-acao="ignorar-rascunho">Descartar</button>
    </span>
  </div>`;

/**
 * O editor, desenhado a partir do rascunho (`campos`), não da anotação gravada.
 *
 * @param {object} dados
 * @param {object} dados.nota a anotação gravada (ou a nova, ainda sem gravar)
 * @param {object} [dados.campos] o rascunho: título, texto, etiquetas e lembrete
 * @param {boolean} [dados.nova] anotação que ainda não foi salva nenhuma vez
 * @param {object[]} [dados.anexosNovos] anexos que entram ao salvar
 */
export const htmlEditor = ({ nota, campos = camposDe(nota), agora, sugestoes, nova = false, anexosNovos = [] }) => {
  const naLixeira = Boolean(nota.excluidaEm);
  const vista = { ...nota, ...campos };
  const bloqueio = naLixeira ? ' disabled' : '';
  const acoes = naLixeira
    ? `<button type="button" class="copy-btn btn-primario" data-acao="restaurar">Restaurar</button>
       <button type="button" class="copy-btn an-perigo" data-acao="apagar-de-vez">Apagar de vez</button>`
    : `${nova ? '' : `<button type="button" class="copy-btn an-copiar" data-acao="copiar">Copiar texto</button>
       <button type="button" class="copy-btn an-fixar" data-acao="fixar" aria-pressed="${nota.fixada}">${nota.fixada ? 'Fixada' : 'Fixar'}</button>
       <button type="button" class="copy-btn an-resolver" data-acao="resolver">${nota.concluida ? 'Reabrir' : 'Resolvido'}</button>
       <button type="button" class="copy-btn an-perigo" data-acao="excluir">Excluir</button>`}
       <button type="button" class="copy-btn btn-primario an-salvar" data-acao="salvar" title="Salvar e começar outra (Ctrl+Enter) · Ctrl+S salva sem sair">Salvar</button>`;

  return `
  <div class="an-editor${nova ? ' an-editor-nova' : ''}${naLixeira ? ' an-na-lixeira' : ''}" data-an="editor" data-id="${esc(nota.id)}">
    <div class="an-editor-barra">
      <button type="button" class="an-voltar" data-acao="voltar">Anotações</button>
      <span class="an-status" data-an="status" aria-live="polite"></span>
      <div class="an-editor-acoes">${acoes}</div>
    </div>

    ${naLixeira ? `<div class="alert alert-warning"><span>Esta anotação está na lixeira desde ${esc(dataEHora(nota.excluidaEm))} e some de vez em 30 dias. Restaure para editar.</span></div>` : ''}
    <div data-an="recuperar"></div>
    ${nova ? htmlModelos() : ''}

    <input class="an-titulo" data-campo="titulo" value="${esc(campos.titulo)}" placeholder="${nova ? 'Nova anotação — ex.: Estorno do dia 25' : 'Título'}" maxlength="200" aria-label="Título" autocomplete="off"${bloqueio} />

    <div data-an="lembrete">${naLixeira ? '' : htmlLembrete(vista, agora)}</div>
    <div data-an="etiquetas">${naLixeira ? '' : htmlEtiquetasEditor(campos.etiquetas, sugestoes)}</div>

    ${
      naLixeira
        ? ''
        : `<div class="an-ferramentas">
      <button type="button" class="an-ferramenta" data-acao="inserir-data" title="Escreve a data e a hora de agora no texto">Inserir data</button>
      <button type="button" class="an-ferramenta an-ferramenta-checklist" data-acao="inserir-tarefa" title="Começa uma linha de tarefa: [ ]">Tarefa</button>
      <button type="button" class="an-ferramenta an-ferramenta-anexar" data-acao="anexar" title="Anexar prints e arquivos">Anexar</button>
      <span class="an-dica">Cole prints com Ctrl+V ou arraste arquivos para cá.</span>
    </div>`
    }

    <textarea class="an-texto" data-campo="texto" spellcheck="true" placeholder="Escreva aqui: o que aconteceu, com quem, o que falta fazer. Links viram botões; linhas com [ ] viram tarefas." aria-label="Texto da anotação"${bloqueio}>${esc(campos.texto)}</textarea>

    <div data-an="checklist">${htmlChecklist(campos.texto)}</div>
    <div data-an="links">${htmlLinks(campos.texto)}</div>
    <div data-an="anexos">${htmlAnexos(nota.anexos, anexosNovos)}</div>

    <p class="an-rodape">${
      nova
        ? 'Ainda não salva. <kbd>Ctrl</kbd>+<kbd>S</kbd> salva sem sair · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> salva e começa outra.'
        : `Criada em ${esc(dataEHora(nota.criadaEm))} · editada em ${esc(dataEHora(nota.atualizadaEm))} · <kbd>Ctrl</kbd>+<kbd>S</kbd> salva sem sair`
    }</p>
    <input type="file" multiple hidden data-an="arquivo" />
  </div>`;
};

/** O que o selo de gravação diz, pelo estado do rascunho. */
export const textoDoStatus = (estado, salvoEm = null) =>
  ({
    nova: 'Nova anotação',
    sujo: 'Alterações não salvas',
    salvando: 'Salvando…',
    salvo: salvoEm ? `Salvo às ${hhmm(salvoEm)}` : 'Salvo',
    erro: 'Não salvou — tente de novo'
  })[estado] ?? '';

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
