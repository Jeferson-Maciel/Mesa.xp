import { aviso } from '../../ui/avisos.js';
import { esc } from '../../ui/html.js';
import { abrirJanela } from '../../ui/janela.js';
import {
  MERCADOS,
  NOMES_DAS_SECOES,
  ROTULOS,
  comValor,
  diferencas,
  diferencasDoPadrao,
  lerConfiguracao,
  regrasPadrao,
  textoDaConfiguracao,
  validarRegras,
  valorDe
} from './regras.js';
import { lerRegrasSalvas, salvarRegras } from './regrasSalvas.js';

/**
 * A gaveta "Regras" do Renda Fixa (decidido com o usuário em 21/10/2026): tudo o que faz a aba
 * funcionar, editável, uma configuração por mercado, guardada neste navegador. O que muda vale na
 * hora; um valor inválido fica em vermelho com o motivo e não vale (vale a última regra boa). Ao lado,
 * a mensagem da planilha carregada com as regras de agora.
 */

export const NOMES_DOS_MERCADOS = { primario: 'Emissão primária', secundario: 'Mercado secundário' };

const COLUNAS = ['tipo', 'instrumento', 'taxa', 'indexador', 'vencimento', 'liquidez', 'emissor', 'emissao', 'pu', 'publico', 'isento'];

/** As partes da gaveta, com os campos de cada uma: [caminho, tipo, opções]. */
export const PARTES = [
  {
    id: 'filtros',
    titulo: 'Filtros',
    campos: [
      ['filtros.puMaximo', 'numero', { dica: 'Acima deste preço unitário, o título fica de fora, com o motivo.' }],
      ['filtros.descartarQualificado', 'booleano'],
      ['filtros.descartarProfissional', 'booleano'],
      ['filtros.descartarLiquidezDiaria', 'booleano'],
      [
        'filtros.taxaFora',
        'escolha',
        {
          dica: 'Quando a primeira coluna de taxa vem vazia.',
          opcoes: [
            ['colunas-de-taxa', 'Procurar só nas colunas de taxa (Tax.Máx…)'],
            ['qualquer-celula', 'Procurar em qualquer célula com "%" (o original: o ROA podia virar taxa)']
          ]
        }
      ]
    ]
  },
  {
    id: 'prazos',
    titulo: 'Prazos na mensagem',
    dica: 'Em anos cheios, separados por vírgula. Vazio: a seção não sai.',
    campos: [['prazos.pre', 'anos'], ['prazos.pos', 'anos'], ['prazos.ipca', 'anos']]
  },
  {
    id: 'isentos',
    titulo: 'Isentos de IR',
    campos: [['isentos.tipos', 'siglas'], ['isentos.pre', 'anos'], ['isentos.cdi', 'anos'], ['isentos.ipca', 'anos']]
  },
  {
    id: 'bancos',
    titulo: 'Bancos conhecidos',
    dica: 'Para achar o emissor no nome do título quando a planilha não tem a coluna. Um por linha.',
    campos: [['bancos', 'linhas']]
  },
  {
    id: 'mensagem',
    titulo: 'Mensagem',
    dica: 'Marcadores das linhas: {prazo}, {tipo}, {taxa} e {emissor} (que vira " (BANCO)", ou nada).',
    campos: [
      ['mensagem.cabecalho', 'texto-longo'],
      ['mensagem.titulos.pre', 'texto'],
      ['mensagem.titulos.pos', 'texto'],
      ['mensagem.titulos.ipca', 'texto'],
      ['mensagem.titulos.isentos', 'texto'],
      ['mensagem.linhas.pre', 'texto'],
      ['mensagem.linhas.posCdiMais', 'texto'],
      ['mensagem.linhas.posCdi', 'texto'],
      ['mensagem.linhas.ipca', 'texto'],
      ['mensagem.linhas.isentoPre', 'texto'],
      ['mensagem.linhas.isentoCdiMais', 'texto'],
      ['mensagem.linhas.isentoCdi', 'texto'],
      ['mensagem.linhas.isentoIpca', 'texto'],
      ['mensagem.mostrarEmissor', 'booleano'],
      ['mensagem.casas', 'inteiro'],
      ['mensagem.tirarZeros', 'booleano'],
      ['mensagem.prazoUm', 'texto'],
      ['mensagem.prazoVarios', 'texto'],
      ['mensagem.ordem', 'ordem'],
      ['mensagem.rodape', 'texto-longo']
    ]
  },
  {
    id: 'avancado',
    titulo: 'Avançado',
    fechada: true,
    dica:
      'Como a planilha é lida. Colunas: o nome do cabeçalho sem acento; "trecho" = contém, "=texto" = igual, "^texto" = começa com, "trecho -outro" = contém um e não o outro. Tipo pelo nome: "trecho = SIGLA", um por linha, na ordem em que valem.',
    campos: [
      ['avancado.tiposPorNome', 'pares'],
      ['avancado.siglas', 'siglas'],
      ...COLUNAS.map((c) => [`avancado.colunas.${c}`, 'lista']),
      ['avancado.palavrasDoCabecalho', 'lista']
    ]
  }
];

/* ── Valor ↔ campo ─────────────────────────────────────────────────────────────────────── */

/** O texto do campo para um valor das regras. */
export const textoDoCampo = (tipo, valor) => {
  if (tipo === 'anos' || tipo === 'siglas' || tipo === 'lista') return (valor ?? []).join(', ');
  if (tipo === 'linhas') return (valor ?? []).join('\n');
  if (tipo === 'pares') return (valor ?? []).map(([trecho, sigla]) => `${trecho} = ${sigla}`).join('\n');
  return valor === undefined || valor === null || Number.isNaN(valor) ? '' : String(valor);
};

/** O valor das regras a partir do que está no campo. O que não se lê vira um valor inválido, que a validação aponta. */
export const lerCampo = (tipo, texto) => {
  const t = String(texto ?? '');
  if (tipo === 'numero') {
    const limpo = t.trim().replace(/\s/g, '');
    if (!limpo) return NaN;
    return Number(limpo.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(limpo) ? limpo.replace(/\./g, '').replace(',', '.') : limpo);
  }
  if (tipo === 'inteiro') return t.trim() === '' ? NaN : Number(t.trim());
  if (tipo === 'anos') return t.split(/[,;\s]+/).filter(Boolean).map((x) => (/^\d+$/.test(x) ? Number(x) : NaN));
  if (tipo === 'siglas') return t.split(/[,;\s]+/).filter(Boolean).map((x) => x.toUpperCase());
  if (tipo === 'lista') return t.split(',').map((x) => x.trim()).filter(Boolean);
  if (tipo === 'linhas') return t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (tipo === 'pares') {
    return t
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const i = l.lastIndexOf('=');
        return i < 1 ? ['', ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      });
  }
  return t;
};

/* ── A marcação ────────────────────────────────────────────────────────────────────────── */

const htmlCampo = ([caminho, tipo, opcoes = {}], regras) => {
  const valor = valorDe(regras, caminho);
  const rotulo = esc(ROTULOS[caminho] ?? caminho);
  const dica = opcoes.dica ? `<small class="rf-campo-dica">${esc(opcoes.dica)}</small>` : '';
  const erro = `<small class="rf-campo-erro" data-erro="${esc(caminho)}" hidden></small>`;
  const atributos = `data-regra="${esc(caminho)}" data-tipo="${tipo}"`;

  if (tipo === 'booleano') {
    return `<div class="rf-campo rf-campo-chave"><label><input type="checkbox" ${atributos}${valor ? ' checked' : ''} /> <span>${rotulo}</span></label>${dica}${erro}</div>`;
  }
  if (tipo === 'escolha') {
    const itens = opcoes.opcoes.map(([v, nome]) => `<option value="${esc(v)}"${v === valor ? ' selected' : ''}>${esc(nome)}</option>`).join('');
    return `<div class="rf-campo"><label><span>${rotulo}</span><select ${atributos}>${itens}</select></label>${dica}${erro}</div>`;
  }
  if (tipo === 'ordem') {
    const itens = (valor ?? [])
      .map(
        (secao, i, todas) => `<li>
          <span>${esc(NOMES_DAS_SECOES[secao] ?? secao)}</span>
          <button type="button" class="rf-ordem-btn" data-acao="subir" data-secao="${esc(secao)}" aria-label="Subir ${esc(NOMES_DAS_SECOES[secao] ?? secao)}"${i === 0 ? ' disabled' : ''}>↑</button>
          <button type="button" class="rf-ordem-btn" data-acao="descer" data-secao="${esc(secao)}" aria-label="Descer ${esc(NOMES_DAS_SECOES[secao] ?? secao)}"${i === todas.length - 1 ? ' disabled' : ''}>↓</button>
        </li>`
      )
      .join('');
    return `<div class="rf-campo"><span class="rf-campo-rotulo">${rotulo}</span><ol class="rf-ordem" ${atributos}>${itens}</ol>${erro}</div>`;
  }
  const longo = tipo === 'texto-longo' || tipo === 'linhas' || tipo === 'pares';
  const linhas = tipo === 'pares' ? 6 : tipo === 'linhas' ? 5 : 2;
  const campo = longo
    ? `<textarea ${atributos} rows="${linhas}" spellcheck="false">${esc(textoDoCampo(tipo, valor))}</textarea>`
    : `<input type="text" ${atributos} value="${esc(textoDoCampo(tipo, valor))}" spellcheck="false"${tipo === 'numero' || tipo === 'inteiro' ? ' inputmode="decimal"' : ''} />`;
  return `<div class="rf-campo${longo ? ' rf-campo-largo' : ''}"><label><span>${rotulo}</span>${campo}</label>${dica}${erro}</div>`;
};

/** As partes da gaveta, para as regras de um mercado. */
export const htmlFormularioDasRegras = (regras) =>
  PARTES.map(
    (parte) => `
    <details class="rf-regras-parte" data-parte="${parte.id}"${parte.fechada ? '' : ' open'}>
      <summary>${esc(parte.titulo)}</summary>
      ${parte.dica ? `<p class="rf-nota">${esc(parte.dica)}</p>` : ''}
      <div class="rf-regras-campos">${parte.campos.map((c) => htmlCampo(c, regras)).join('')}</div>
      <button type="button" class="rf-link" data-acao="restaurar-parte" data-parte="${parte.id}">Restaurar o padrão: ${esc(parte.titulo)}</button>
    </details>`
  ).join('');

/** O que muda ao colar uma configuração, mercado a mercado. */
export const htmlResumoDaColagem = (atual, colada) => {
  const linhas = MERCADOS.map((mercado) => {
    const mudancas = diferencas(atual[mercado], colada[mercado]);
    const itens = mudancas.length
      ? mudancas.map((d) => `<li>${esc(d.rotulo)}: <s>${esc(d.de)}</s> → <b>${esc(d.para)}</b></li>`).join('')
      : '<li>nada muda</li>';
    return `<div><strong>${esc(NOMES_DOS_MERCADOS[mercado])}</strong><ul>${itens}</ul></div>`;
  }).join('');
  return `<div class="rf-regras-resumo">${linhas}</div>`;
};

/** O título do selo "regras personalizadas": o que difere do padrão. */
export const tituloDoSelo = (mudancas) => mudancas.map((d) => `${d.rotulo}: ${d.de} → ${d.para}`).join('\n');

/* ── A gaveta ──────────────────────────────────────────────────────────────────────────── */

const copiarObjeto = (v) => JSON.parse(JSON.stringify(v));

/**
 * Liga a gaveta das regras dentro da aba.
 *
 * @param {object} opcoes
 * @param {HTMLElement} opcoes.raiz        o `.rf`
 * @param {(config: object) => void} opcoes.aoMudar  as regras válidas mudaram (refazer a análise)
 * @param {(regras: object, mercado: string) => string|null} opcoes.previa  a mensagem com estas regras, ou null sem planilha
 * @returns {{config: () => object, abrir: (mercado: string) => void, atualizarSelo: (mercado: string) => void}}
 */
export const ligarRegras = ({ raiz, aoMudar, previa }) => {
  const dialogo = raiz.querySelector('[data-rf="regras"]');
  const botao = raiz.querySelector('[data-rf="abrir-regras"]');
  const selo = raiz.querySelector('[data-rf="selo-regras"]');
  const parte = (nome) => dialogo.querySelector(`[data-rf-regras="${nome}"]`);

  const salvas = lerRegrasSalvas();
  if (salvas.corrompidas.length) aviso('As regras guardadas do Renda Fixa não eram válidas e voltaram ao padrão.', { tipo: 'erro' });
  const estado = { config: salvas.config, rascunho: copiarObjeto(salvas.config), mercado: 'primario', colada: null, mercadoDoSelo: 'primario', avisouQueNaoSalvou: false };

  const renderFormulario = () => {
    parte('form').innerHTML = htmlFormularioDasRegras(estado.rascunho[estado.mercado]);
    for (const b of parte('mercado').querySelectorAll('[data-mercado]')) {
      const ativo = b.dataset.mercado === estado.mercado;
      b.setAttribute('aria-checked', String(ativo));
      b.classList.toggle('ativo', ativo);
    }
    conferir({ aplicar: false });
  };

  const atualizarPrevia = (erros) => {
    const texto = previa(estado.config[estado.mercado], estado.mercado);
    parte('previa').textContent = texto ?? 'Carregue uma planilha para ver aqui a mensagem com estas regras.';
    parte('previa').classList.toggle('rf-vazia', texto === null);
    const n = Object.keys(erros).length;
    parte('previa-nota').textContent = n ? `${n === 1 ? 'Um campo está' : `${n} campos estão`} em vermelho: até corrigir, vale a última regra boa.` : '';
    const mudancas = diferencasDoPadrao(estado.config[estado.mercado], estado.mercado);
    parte('resumo').textContent = mudancas.length ? `${mudancas.length} ${mudancas.length === 1 ? 'regra difere' : 'regras diferem'} do padrão neste mercado.` : 'Este mercado está no padrão.';
  };

  // Valida o rascunho: marca os campos com erro e, sem erro, aplica (guarda, refaz a análise).
  const conferir = ({ aplicar = true } = {}) => {
    const erros = validarRegras(estado.rascunho[estado.mercado]);
    for (const marca of dialogo.querySelectorAll('[data-erro]')) {
      const motivo = erros[marca.dataset.erro];
      marca.hidden = !motivo;
      marca.textContent = motivo ?? '';
      dialogo.querySelector(`[data-regra="${marca.dataset.erro}"]`)?.setAttribute('aria-invalid', String(Boolean(motivo)));
    }
    if (aplicar && Object.keys(erros).length === 0 && JSON.stringify(estado.rascunho[estado.mercado]) !== JSON.stringify(estado.config[estado.mercado])) {
      estado.config = { ...estado.config, [estado.mercado]: copiarObjeto(estado.rascunho[estado.mercado]) };
      guardar();
    }
    atualizarPrevia(erros);
  };

  const guardar = () => {
    if (!salvarRegras(estado.config) && !estado.avisouQueNaoSalvou) {
      estado.avisouQueNaoSalvou = true;
      aviso('O navegador não deixou guardar as regras: elas valem até fechar a página.', { tipo: 'erro' });
    }
    aoMudar(estado.config);
    atualizarSelo(estado.mercadoDoSelo);
  };

  const atualizarSelo = (mercado) => {
    estado.mercadoDoSelo = mercado;
    const mudancas = diferencasDoPadrao(estado.config[mercado], mercado);
    selo.hidden = mudancas.length === 0;
    selo.textContent = `regras personalizadas · ${mudancas.length}`;
    selo.title = `${tituloDoSelo(mudancas)}\n\nClique para ver e mudar as regras.`;
  };

  const abrir = (mercado) => {
    estado.mercado = mercado;
    estado.rascunho = copiarObjeto(estado.config);
    fecharColagem();
    renderFormulario();
    abrirJanela(dialogo, botao);
  };

  const fecharColagem = () => {
    estado.colada = null;
    parte('colar').hidden = true;
    parte('colar-texto').value = '';
    parte('colar-resumo').innerHTML = '';
    parte('aplicar-colar').hidden = true;
  };

  const copiarTexto = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      return false;
    }
  };

  /* Os campos: cada mudança entra no rascunho, que é conferido. */
  parte('form').addEventListener('input', (e) => {
    const campo = e.target.closest('[data-regra]');
    if (!campo || campo.dataset.tipo === 'ordem') return;
    const valor = campo.dataset.tipo === 'booleano' ? campo.checked : lerCampo(campo.dataset.tipo, campo.value);
    estado.rascunho[estado.mercado] = comValor(estado.rascunho[estado.mercado], campo.dataset.regra, valor);
    conferir();
  });

  dialogo.addEventListener('click', async (e) => {
    if (e.target === dialogo || e.target.closest('[data-fechar]')) return dialogo.close();
    const mercado = e.target.closest('[data-rf-regras="mercado"] [data-mercado]');
    if (mercado) {
      estado.mercado = mercado.dataset.mercado;
      renderFormulario();
      return;
    }
    const botaoAcao = e.target.closest('[data-acao]');
    if (!botaoAcao) return;
    const { acao } = botaoAcao.dataset;
    const m = estado.mercado;

    if (acao === 'subir' || acao === 'descer') {
      const ordem = [...estado.rascunho[m].mensagem.ordem];
      const i = ordem.indexOf(botaoAcao.dataset.secao);
      const j = acao === 'subir' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= ordem.length) return;
      [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
      estado.rascunho[m] = comValor(estado.rascunho[m], 'mensagem.ordem', ordem);
      const aberta = [...parte('form').querySelectorAll('details')].map((d) => d.open);
      renderFormulario();
      parte('form').querySelectorAll('details').forEach((d, k) => (d.open = aberta[k]));
      conferir();
      parte('form').querySelector(`[data-acao="${acao}"][data-secao="${botaoAcao.dataset.secao}"]:not(:disabled)`)?.focus();
      return;
    }
    if (acao === 'restaurar-parte') {
      const daParte = PARTES.find((p) => p.id === botaoAcao.dataset.parte);
      const padrao = regrasPadrao(m);
      for (const [caminho] of daParte.campos) estado.rascunho[m] = comValor(estado.rascunho[m], caminho, valorDe(padrao, caminho));
      renderFormulario();
      parte('form').querySelector(`[data-parte="${daParte.id}"]`).open = true;
      conferir();
      aviso(`${daParte.titulo}: de volta ao padrão.`);
      return;
    }
    if (acao === 'restaurar-tudo') {
      estado.rascunho[m] = regrasPadrao(m);
      renderFormulario();
      conferir();
      aviso(`As regras de ${NOMES_DOS_MERCADOS[m].toLowerCase()} voltaram ao padrão.`);
      return;
    }
    if (acao === 'copiar-outro') {
      const outro = m === 'primario' ? 'secundario' : 'primario';
      // O cabeçalho e o emissor costumam ser do mercado: ficam os deste.
      const copia = copiarObjeto(estado.config[outro]);
      copia.mensagem.cabecalho = estado.rascunho[m].mensagem.cabecalho;
      copia.mensagem.mostrarEmissor = estado.rascunho[m].mensagem.mostrarEmissor;
      estado.rascunho[m] = copia;
      renderFormulario();
      conferir();
      aviso(`Copiadas as regras de ${NOMES_DOS_MERCADOS[outro].toLowerCase()} (o cabeçalho e o emissor ficam os deste mercado).`);
      return;
    }
    if (acao === 'copiar-config') {
      const ok = await copiarTexto(textoDaConfiguracao(estado.config));
      aviso(ok ? 'Configuração copiada: mande ao colega, que cola em "Colar configuração".' : 'Não consegui copiar a configuração.', { tipo: ok ? 'info' : 'erro' });
      return;
    }
    if (acao === 'colar-config') {
      parte('colar').hidden = false;
      parte('colar-texto').focus();
      return;
    }
    if (acao === 'cancelar-colar') return fecharColagem();
    if (acao === 'conferir-colar') {
      try {
        estado.colada = lerConfiguracao(parte('colar-texto').value);
        parte('colar-resumo').innerHTML = htmlResumoDaColagem(estado.config, estado.colada);
        parte('aplicar-colar').hidden = false;
      } catch (erro) {
        estado.colada = null;
        parte('colar-resumo').innerHTML = `<p class="rf-campo-erro">${esc(erro.message)}</p>`;
        parte('aplicar-colar').hidden = true;
      }
      return;
    }
    if (acao === 'aplicar-colar' && estado.colada) {
      estado.config = copiarObjeto(estado.colada);
      estado.rascunho = copiarObjeto(estado.colada);
      fecharColagem();
      guardar();
      renderFormulario();
      aviso('Configuração aplicada nos dois mercados.');
    }
  });

  botao.addEventListener('click', () => abrir(estado.mercadoDoSelo));
  selo.addEventListener('click', () => abrir(estado.mercadoDoSelo));

  return {
    config: () => estado.config,
    abrir,
    atualizarSelo,
    /** A planilha mudou: a prévia da gaveta aberta acompanha. */
    atualizarPrevia: () => dialogo.open && atualizarPrevia(validarRegras(estado.rascunho[estado.mercado]))
  };
};

/** A marcação da gaveta (vai no fim da aba). */
export const MARCACAO_DAS_REGRAS = `
  <dialog class="rf-regras" data-rf="regras" aria-labelledby="rf-regras-titulo">
    <div class="rf-regras-topo">
      <h2 class="panel-title" id="rf-regras-titulo">Regras do Renda Fixa</h2>
      <div class="segmentado" role="radiogroup" aria-label="Mercado destas regras" data-rf-regras="mercado">
        ${MERCADOS.map((m) => `<button type="button" class="seg" role="radio" data-mercado="${m}">${NOMES_DOS_MERCADOS[m]}</button>`).join('')}
      </div>
      <button type="button" class="icon-close-btn" data-fechar aria-label="Fechar">&times;</button>
    </div>
    <p class="rf-nota"><span data-rf-regras="resumo"></span> Valem neste navegador; o que você muda vale na hora.</p>
    <div class="rf-regras-grade">
      <form class="rf-regras-form" data-rf-regras="form" novalidate></form>
      <aside class="rf-regras-lado">
        <h3>A mensagem com estas regras</h3>
        <pre class="rf-regras-previa" data-rf-regras="previa"></pre>
        <p class="rf-campo-erro" data-rf-regras="previa-nota"></p>
      </aside>
    </div>
    <div class="rf-regras-colar" data-rf-regras="colar" hidden>
      <label><span>Cole a configuração que um colega copiou</span><textarea data-rf-regras="colar-texto" rows="4" spellcheck="false"></textarea></label>
      <div data-rf-regras="colar-resumo"></div>
      <div class="rf-regras-acoes">
        <button type="button" class="copy-btn" data-acao="conferir-colar">Conferir</button>
        <button type="button" class="copy-btn btn-primario" data-acao="aplicar-colar" data-rf-regras="aplicar-colar" hidden>Aplicar</button>
        <button type="button" class="rf-link" data-acao="cancelar-colar">Cancelar</button>
      </div>
    </div>
    <div class="rf-regras-acoes rf-regras-rodape">
      <button type="button" class="copy-btn" data-acao="copiar-outro">Copiar do outro mercado</button>
      <button type="button" class="copy-btn" data-acao="copiar-config">Copiar configuração</button>
      <button type="button" class="copy-btn" data-acao="colar-config">Colar configuração</button>
      <button type="button" class="rf-link" data-acao="restaurar-tudo">Restaurar o padrão deste mercado</button>
    </div>
  </dialog>`;
