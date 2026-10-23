/**
 * Resumo Executivo e Operacional do Dia da Fila.
 *
 * Gera métricas consolidadas (pedidos, ordens, clientes únicos, volume financeiro),
 * visão em tabela detalhada de todas as ordens, exportação em planilha Excel (.xlsx via SheetJS),
 * geração de relatório para impressão/PDF (@media print) e cópia de texto para WhatsApp/Slack.
 */

import { esc } from '../../ui/html.js';
import { abrirJanela } from '../../ui/janela.js';
import { sheetjs } from '../../vendor/sheetjs.js';
import { NOMES_DOS_GRUPOS, resumoDoDia } from '../../comum/fila/regras.js';
import { formatarFinanceiro, lerFinanceiro } from '../ordens/core/util/dinheiro.js';

export const ESTADOS_NOMES = {
  executado: 'Executado',
  aprovado: 'Aprovado a executar',
  respondeu: 'Respondeu (a conferir)',
  enviado: 'Aguardando o cliente',
  cancelado: 'Cancelado'
};

const OPERACAO_NOMES = {
  C: 'Compra',
  V: 'Venda'
};

export const formatarHora = (timestamp) => {
  if (!timestamp) return '--:--';
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const extrairValorFinanceiro = (ordem) => {
  if (typeof ordem.financeiro === 'number' && Number.isFinite(ordem.financeiro) && ordem.financeiro > 0) {
    return ordem.financeiro;
  }
  if (typeof ordem.financeiro === 'string') {
    const lido = lerFinanceiro(ordem.financeiro);
    if (lido && lido > 0) return lido;
  }
  const qtd = Number(ordem.cotas ?? ordem.quantidade);
  let precoNum = null;
  if (typeof ordem.preco === 'number' && Number.isFinite(ordem.preco)) {
    precoNum = ordem.preco;
  } else if (typeof ordem.preco === 'string') {
    precoNum = lerFinanceiro(ordem.preco);
  }
  if (Number.isFinite(qtd) && qtd > 0 && Number.isFinite(precoNum) && precoNum > 0) {
    return qtd * precoNum;
  }
  return null;
};

/**
 * Consolida e calcula todas as estatísticas e ordens do dia para o resumo executivo.
 *
 * @param {object[]} pedidos lista de todos os pedidos da fila
 * @param {string} dia dia no formato AAAA-MM-DD
 */
export const dadosDoResumoDoDia = (pedidos = [], dia) => {
  const doDia = (pedidos || []).filter((p) => p.dia === dia);
  const [ano, mes, d] = dia ? dia.split('-') : ['', '', ''];
  const diaFormatado = dia ? `${d}/${mes}/${ano}` : '';

  const contas = new Set();
  const linhas = [];
  let financeiroTotal = 0;
  let ordensComFinanceiro = 0;

  const porEstado = {
    executado: 0,
    aprovado: 0,
    respondeu: 0,
    enviado: 0,
    cancelado: 0
  };

  const porGrupo = {
    bolsa: 0,
    'fundos-compra': 0,
    'fundos-venda': 0,
    tesouro: 0,
    'tesouro-resgate': 0
  };

  for (const p of doDia) {
    contas.add(String(p.conta));
    if (porEstado[p.estado] !== undefined) {
      porEstado[p.estado]++;
    }
    if (porGrupo[p.grupo] !== undefined) {
      porGrupo[p.grupo]++;
    }

    const ordensLista = Array.isArray(p.ordens) && p.ordens.length ? p.ordens : [{ ativo: 'Geral', operacao: '' }];

    for (const o of ordensLista) {
      const valorFin = extrairValorFinanceiro(o);
      if (valorFin) {
        financeiroTotal += valorFin;
        ordensComFinanceiro++;
      }

      const opNome = p.grupo === 'tesouro' ? 'Aplicação' : p.grupo === 'tesouro-resgate' ? 'Resgate' : (OPERACAO_NOMES[o.operacao] ?? o.operacao ?? '');

      linhas.push({
        pedidoId: p.id,
        hora: formatarHora(p.criadoEm),
        conta: String(p.conta),
        clienteNome: p.cliente?.nome || 'Cliente não identificado',
        clienteEmail: p.cliente?.email || '',
        assessorNome: p.assessor?.nome || p.assessor?.email || 'Mesa',
        assessorEmail: p.assessor?.email || '',
        grupoNome: NOMES_DOS_GRUPOS[p.grupo] || p.grupo,
        grupoSlug: p.grupo,
        operacaoNome: opNome,
        operacaoCodigo: o.operacao,
        ativo: o.ativo || '',
        quantidade: o.quantidade ?? null,
        cotas: o.cotas ?? null,
        preco: o.preco ?? null,
        financeiro: valorFin,
        financeiroFormatado: valorFin ? formatarFinanceiro(valorFin) : (o.preco ? `Preço ${o.preco}` : 'A mercado'),
        statusNome: ESTADOS_NOMES[p.estado] || p.estado,
        statusSlug: p.estado,
        assunto: p.assunto || ''
      });
    }
  }

  const pendentes = doDia.filter((p) => p.estado !== 'executado' && p.estado !== 'cancelado');

  return {
    dia,
    diaFormatado,
    totalPedidos: doDia.length,
    totalOrdens: linhas.length,
    totalClientes: contas.size,
    financeiroTotal,
    financeiroTotalFormatado: formatarFinanceiro(financeiroTotal),
    ordensComFinanceiro,
    porEstado,
    porGrupo,
    linhas,
    pendentes,
    resumoTexto: resumoDoDia(pedidos, dia)
  };
};

/**
 * Gera a planilha Excel (.xlsx) com a biblioteca SheetJS e dispara o download.
 */
export const exportarExcelDoResumo = (dados) => {
  const XLSX = sheetjs();
  const linhasPlanilha = dados.linhas.map((l) => ({
    'Data/Hora': `${dados.diaFormatado} ${l.hora}`,
    'Conta XP': l.conta,
    'Cliente': l.clienteNome,
    'E-mail Cliente': l.clienteEmail,
    'Assessor': l.assessorNome,
    'Mercado': l.grupoNome,
    'Operação': l.operacaoNome,
    'Ativo': l.ativo,
    'Quantidade': l.quantidade ?? '',
    'Cotas Auditadas': l.cotas ?? '',
    'Preço / PU': l.preco ?? '',
    'Financeiro (R$)': l.financeiro ? l.financeiro : '',
    'Status': l.statusNome,
    'Assunto': l.assunto
  }));

  const ws = XLSX.utils.json_to_sheet(linhasPlanilha);
  ws['!cols'] = [
    { wch: 17 }, // Data/Hora
    { wch: 11 }, // Conta XP
    { wch: 28 }, // Cliente
    { wch: 24 }, // E-mail
    { wch: 22 }, // Assessor
    { wch: 18 }, // Mercado
    { wch: 11 }, // Operação
    { wch: 14 }, // Ativo
    { wch: 12 }, // Quantidade
    { wch: 14 }, // Cotas
    { wch: 14 }, // Preço/PU
    { wch: 18 }, // Financeiro
    { wch: 22 }, // Status
    { wch: 32 }  // Assunto
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resumo do Dia');
  XLSX.writeFile(wb, `resumo-mesa-xp-${dados.dia}.xlsx`);
};

/**
 * Renderiza o HTML completo do modal de resumo operacional.
 */
export const htmlResumoDoDia = (dados) => {
  const { diaFormatado, totalPedidos, totalOrdens, totalClientes, financeiroTotalFormatado, porEstado, linhas, pendentes } = dados;

  const totalPendentes = porEstado.aprovado + porEstado.respondeu + porEstado.enviado;

  const kpisHtml = `
    <div class="fl-resumo-kpis">
      <div class="fl-resumo-kpi-card destaque">
        <span class="fl-resumo-kpi-rotulo">Volume Total Movimentado</span>
        <strong class="fl-resumo-kpi-valor">${esc(financeiroTotalFormatado || 'R$ 0,00')}</strong>
        <span class="fl-resumo-kpi-detalhe">${dados.ordensComFinanceiro} de ${totalOrdens} ordens com financeiro</span>
      </div>

      <div class="fl-resumo-kpi-card">
        <span class="fl-resumo-kpi-rotulo">Pedidos / Ordens</span>
        <strong class="fl-resumo-kpi-valor">${totalPedidos} pedidos</strong>
        <span class="fl-resumo-kpi-detalhe">${totalOrdens} ordens registradas</span>
      </div>

      <div class="fl-resumo-kpi-card sucesso">
        <span class="fl-resumo-kpi-rotulo">Executados</span>
        <strong class="fl-resumo-kpi-valor">${porEstado.executado} concluídos</strong>
        <span class="fl-resumo-kpi-detalhe">Boletados com sucesso</span>
      </div>

      <div class="fl-resumo-kpi-card atencao">
        <span class="fl-resumo-kpi-rotulo">Aguardando / Pendentes</span>
        <strong class="fl-resumo-kpi-valor">${totalPendentes} pendentes</strong>
        <span class="fl-resumo-kpi-detalhe">${porEstado.aprovado} aprovados · ${porEstado.enviado} enviados</span>
      </div>

      <div class="fl-resumo-kpi-card">
        <span class="fl-resumo-kpi-rotulo">Clientes Atendidos</span>
        <strong class="fl-resumo-kpi-valor">${totalClientes} contas</strong>
        <span class="fl-resumo-kpi-detalhe">Contas distintas no dia</span>
      </div>
    </div>
  `;

  let linhasTabelaHtml = '';
  if (!linhas.length) {
    linhasTabelaHtml = `<tr><td colspan="10" class="fl-resumo-vazio">Nenhum pedido ou ordem registrado neste dia.</td></tr>`;
  } else {
    linhasTabelaHtml = linhas
      .map(
        (l) => `
      <tr data-estado="${esc(l.statusSlug)}">
        <td class="fl-resumo-td-hora">${esc(l.hora)}</td>
        <td class="fl-resumo-td-conta"><strong>${esc(l.conta)}</strong></td>
        <td class="fl-resumo-td-cliente" title="${esc(l.clienteEmail)}">${esc(l.clienteNome)}</td>
        <td class="fl-resumo-td-assessor">${esc(l.assessorNome)}</td>
        <td class="fl-resumo-td-mercado"><span class="fl-resumo-chip">${esc(l.grupoNome)}</span></td>
        <td class="fl-resumo-td-ativo">
          <span class="fl-op fl-op-${l.operacaoCodigo === 'V' ? 'v' : 'c'}">${esc(l.operacaoNome)}</span>
          <strong>${esc(l.ativo)}</strong>
        </td>
        <td class="fl-resumo-td-qtd">${esc(l.cotas ? `${l.cotas} cotas` : l.quantidade ? `${l.quantidade}` : '—')}</td>
        <td class="fl-resumo-td-preco">${esc(l.preco ? `R$ ${l.preco}` : '—')}</td>
        <td class="fl-resumo-td-financeiro"><strong>${esc(l.financeiroFormatado)}</strong></td>
        <td class="fl-resumo-td-status"><span class="fl-resumo-badge" data-estado="${esc(l.statusSlug)}">${esc(l.statusNome)}</span></td>
      </tr>
    `
      )
      .join('');
  }

  let pendenciasHtml = '';
  if (pendentes.length > 0) {
    pendenciasHtml = `
      <div class="fl-resumo-pendencias">
        <h4>⚠️ Pedidos que ficaram pendentes para o fechamento (${pendentes.length}):</h4>
        <ul>
          ${pendentes
            .map(
              (p) => `
            <li>
              <strong>Conta ${esc(p.conta)}</strong>${p.cliente?.nome ? ` (${esc(p.cliente.nome)})` : ''} ·
              ${esc(NOMES_DOS_GRUPOS[p.grupo] || p.grupo)}:
              ${esc(p.ordens.map((o) => o.ativo).join(', '))} —
              <span class="fl-resumo-badge" data-estado="${esc(p.estado)}">${esc(ESTADOS_NOMES[p.estado] || p.estado)}</span>
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
    `;
  }

  return `
    <header class="fl-resumo-cabecalho">
      <div class="fl-resumo-titulo-grupo">
        <div class="fl-resumo-icone-grafico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
        </div>
        <div>
          <h2>Resumo Operacional do Dia</h2>
          <p class="fl-resumo-subtitulo">${esc(diaFormatado)} · Relatório Executivo de Ordens e Fechamento</p>
        </div>
      </div>

      <div class="fl-resumo-acoes">
        <button type="button" class="fl-btn-resumo fl-btn-excel" data-resumo-acao="excel" title="Baixar relatório formatado em Excel (.xlsx)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="14" y2="9"/></svg>
          Exportar Excel (.xlsx)
        </button>

        <button type="button" class="fl-btn-resumo fl-btn-pdf" data-resumo-acao="pdf" title="Salvar relatório como PDF ou Imprimir">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Salvar como PDF / Imprimir
        </button>

        <button type="button" class="fl-btn-resumo" data-resumo-acao="copiar" title="Copiar resumo em texto para WhatsApp/Slack">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Copiar Texto
        </button>

        <button type="button" class="fl-btn-resumo-fechar" data-resumo-acao="fechar" aria-label="Fechar resumo">&times;</button>
      </div>
    </header>

    <div class="fl-resumo-corpo">
      ${kpisHtml}

      <div class="fl-resumo-tabela-secao">
        <div class="fl-resumo-tabela-topo">
          <h3>Todas as Ordens e Operações do Dia (${totalOrdens})</h3>
        </div>

        <div class="fl-resumo-tabela-container">
          <table class="fl-resumo-tabela">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Conta</th>
                <th>Cliente</th>
                <th>Assessor</th>
                <th>Mercado</th>
                <th>Operação & Ativo</th>
                <th>Quantidade</th>
                <th>Preço / PU</th>
                <th>Financeiro</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${linhasTabelaHtml}
            </tbody>
          </table>
        </div>
      </div>

      ${pendenciasHtml}
    </div>
  `;
};

/**
 * Cria o elemento `<dialog>` do resumo do dia se não existir e liga as interações.
 */
export const ligarModalResumo = (secaoFila, { obterPedidos, obterDia, aoAvisar, aoCopiar }) => {
  if (typeof document === 'undefined') return { abrir: () => {}, fechar: () => {} };

  let dialogo = secaoFila.querySelector('[data-fl="resumo-dialogo"]');
  if (!dialogo) {
    dialogo = document.createElement('dialog');
    dialogo.className = 'fl-resumo-dialogo';
    dialogo.setAttribute('data-fl', 'resumo-dialogo');
    dialogo.setAttribute('aria-label', 'Resumo Operacional do Dia');
    secaoFila.appendChild(dialogo);
  }

  let dadosAtuais = null;

  const fechar = () => {
    if (dialogo.open) dialogo.close();
  };

  const abrir = (origem = null) => {
    const pedidos = obterPedidos?.() || [];
    const dia = obterDia?.() || '';
    dadosAtuais = dadosDoResumoDoDia(pedidos, dia);
    dialogo.innerHTML = htmlResumoDoDia(dadosAtuais);

    abrirJanela(dialogo, origem);
  };

  // Delegação de cliques dentro do diálogo
  dialogo.addEventListener('click', async (e) => {
    if (e.target === dialogo) {
      fechar();
      return;
    }

    const btnAcao = e.target.closest('[data-resumo-acao]');
    if (!btnAcao) return;

    const acao = btnAcao.dataset.resumoAcao;

    if (acao === 'fechar') {
      fechar();
    } else if (acao === 'excel') {
      if (!dadosAtuais || !dadosAtuais.linhas.length) {
        aoAvisar?.('Não há ordens para exportar neste dia.', { tipo: 'atencao' });
        return;
      }
      try {
        exportarExcelDoResumo(dadosAtuais);
        aoAvisar?.('Planilha Excel gerada com sucesso!', { tipo: 'info' });
      } catch (err) {
        console.error('Falha ao exportar Excel:', err);
        aoAvisar?.('Erro ao gerar planilha Excel.', { tipo: 'erro' });
      }
    } else if (acao === 'pdf') {
      window.print();
    } else if (acao === 'copiar') {
      if (!dadosAtuais) return;
      const ok = await aoCopiar?.(dadosAtuais.resumoTexto);
      aoAvisar?.(ok ? 'Resumo em texto copiado para a área de transferência!' : 'Falha ao copiar texto.', { tipo: ok ? 'info' : 'erro' });
    }
  });

  return { abrir, fechar, dialogo };
};
