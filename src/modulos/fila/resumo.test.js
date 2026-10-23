import { describe, expect, it } from 'vitest';
import { extrairValorFinanceiro, dadosDoResumoDoDia, htmlResumoDoDia } from './resumo.js';

describe('Resumo do Dia - Extração de Financeiro', () => {
  it('extrai valor numérico direto de ordem.financeiro', () => {
    expect(extrairValorFinanceiro({ financeiro: 15420.5 })).toBe(15420.5);
  });

  it('extrai valor financeiro a partir de string formatada em reais', () => {
    expect(extrairValorFinanceiro({ financeiro: 'R$ 25.000,00' })).toBe(25000);
  });

  it('calcula valor multiplicando quantidade e preço', () => {
    expect(extrairValorFinanceiro({ quantidade: 200, preco: 35.5 })).toBe(7100);
  });

  it('calcula valor multiplicando cotas e preço com string em reais', () => {
    expect(extrairValorFinanceiro({ cotas: 1000, preco: '12,50' })).toBe(12500);
  });

  it('retorna null se não houver dados financeiros nem preço', () => {
    expect(extrairValorFinanceiro({ ativo: 'PETR4', quantidade: 100 })).toBeNull();
    expect(extrairValorFinanceiro({})).toBeNull();
  });
});

describe('Resumo do Dia - Consolidação e Métricas (dadosDoResumoDoDia)', () => {
  const diaAlvo = '2026-10-22';

  const pedidosExemplo = [
    {
      id: 'ped-1',
      dia: '2026-10-22',
      conta: '1234567',
      cliente: { nome: 'Carlos Silva', email: 'carlos@empresa.com' },
      assessor: { nome: 'Assessor Alpha', email: 'alpha@xp.com' },
      grupo: 'bolsa',
      estado: 'executado',
      criadoEm: new Date(2026, 9, 22, 10, 15).getTime(),
      assunto: 'Ordem de Bolsa',
      ordens: [
        { ativo: 'PETR4', operacao: 'C', quantidade: 500, preco: 36.0, financeiro: 18000 }
      ]
    },
    {
      id: 'ped-2',
      dia: '2026-10-22',
      conta: '1234567', // mesmo cliente/conta
      cliente: { nome: 'Carlos Silva', email: 'carlos@empresa.com' },
      assessor: { nome: 'Assessor Alpha', email: 'alpha@xp.com' },
      grupo: 'fundos-compra',
      estado: 'aprovado',
      criadoEm: new Date(2026, 9, 22, 11, 30).getTime(),
      assunto: 'Aplicação em Fundo',
      ordens: [
        { ativo: 'Kinea Chronos FIM', operacao: 'C', financeiro: 50000 }
      ]
    },
    {
      id: 'ped-3',
      dia: '2026-10-22',
      conta: '7654321', // outro cliente
      cliente: { nome: 'Mariana Lima', email: 'mariana@email.com' },
      assessor: { nome: 'Mesa', email: '' },
      grupo: 'tesouro',
      estado: 'enviado',
      criadoEm: new Date(2026, 9, 22, 14, 0).getTime(),
      assunto: 'Tesouro Direto',
      ordens: [
        { ativo: 'Tesouro Selic 2029', operacao: 'C', financeiro: 10000 },
        { ativo: 'Tesouro IPCA+ 2035', operacao: 'C', financeiro: 15000 }
      ]
    },
    {
      id: 'ped-outro-dia',
      dia: '2026-10-21',
      conta: '9999999',
      cliente: { nome: 'Outro Dia', email: '' },
      grupo: 'bolsa',
      estado: 'executado',
      ordens: [{ ativo: 'VALE3', financeiro: 100000 }]
    }
  ];

  it('filtra apenas pedidos do dia selecionado', () => {
    const dados = dadosDoResumoDoDia(pedidosExemplo, diaAlvo);
    expect(dados.dia).toBe('2026-10-22');
    expect(dados.diaFormatado).toBe('22/10/2026');
    expect(dados.totalPedidos).toBe(3);
    // ped-1 tem 1 ordem, ped-2 tem 1 ordem, ped-3 tem 2 ordens = total 4 ordens
    expect(dados.totalOrdens).toBe(4);
  });

  it('calcula o total de clientes únicos corretamente', () => {
    const dados = dadosDoResumoDoDia(pedidosExemplo, diaAlvo);
    // Carlos (1234567) e Mariana (7654321) = 2 clientes
    expect(dados.totalClientes).toBe(2);
  });

  it('calcula o volume financeiro acumulado', () => {
    const dados = dadosDoResumoDoDia(pedidosExemplo, diaAlvo);
    // 18.000 + 50.000 + 10.000 + 15.000 = 93.000
    expect(dados.financeiroTotal).toBe(93000);
    expect(dados.financeiroTotalFormatado).toContain('93.000,00');
  });

  it('contabiliza estados e identifica pendências', () => {
    const dados = dadosDoResumoDoDia(pedidosExemplo, diaAlvo);
    expect(dados.porEstado.executado).toBe(1);
    expect(dados.porEstado.aprovado).toBe(1);
    expect(dados.porEstado.enviado).toBe(1);
    expect(dados.porEstado.respondeu).toBe(0);
    expect(dados.porEstado.cancelado).toBe(0);

    // Pedidos ped-2 (aprovado) e ped-3 (enviado) estão pendentes
    expect(dados.pendentes).toHaveLength(2);
    expect(dados.pendentes.map((p) => p.id)).toEqual(['ped-2', 'ped-3']);
  });

  it('gera linhas detalhadas com todos os dados da ordem para tabela e excel', () => {
    const dados = dadosDoResumoDoDia(pedidosExemplo, diaAlvo);
    expect(dados.linhas).toHaveLength(4);

    const primeira = dados.linhas[0];
    expect(primeira.conta).toBe('1234567');
    expect(primeira.clienteNome).toBe('Carlos Silva');
    expect(primeira.ativo).toBe('PETR4');
    expect(primeira.operacaoNome).toBe('Compra');
    expect(primeira.financeiro).toBe(18000);
    expect(primeira.statusNome).toBe('Executado');
  });
});

describe('Resumo do Dia - Renderização HTML (htmlResumoDoDia)', () => {
  it('renderiza os cards de métricas (KPIs)', () => {
    const dados = dadosDoResumoDoDia([], '2026-10-22');
    const html = htmlResumoDoDia(dados);

    expect(html).toContain('Volume Total Movimentado');
    expect(html).toContain('Pedidos / Ordens');
    expect(html).toContain('Executados');
    expect(html).toContain('Aguardando / Pendentes');
    expect(html).toContain('Clientes Atendidos');
  });

  it('renderiza os botões de ação (Excel, PDF, Copiar Texto)', () => {
    const dados = dadosDoResumoDoDia([], '2026-10-22');
    const html = htmlResumoDoDia(dados);

    expect(html).toContain('data-resumo-acao="excel"');
    expect(html).toContain('Exportar Excel (.xlsx)');
    expect(html).toContain('data-resumo-acao="pdf"');
    expect(html).toContain('Salvar como PDF / Imprimir');
    expect(html).toContain('data-resumo-acao="copiar"');
    expect(html).toContain('Copiar Texto');
  });

  it('mostra mensagem amigável quando não há ordens no dia', () => {
    const dados = dadosDoResumoDoDia([], '2026-10-22');
    const html = htmlResumoDoDia(dados);

    expect(html).toContain('Nenhum pedido ou ordem registrado neste dia.');
  });

  it('renderiza linhas da tabela e seção de pendências quando houver ordens', () => {
    const pedidos = [
      {
        id: 'p1',
        dia: '2026-10-22',
        conta: '102030',
        cliente: { nome: 'Investidor XP', email: 'xp@invest.com' },
        assessor: { nome: 'Mesa' },
        grupo: 'bolsa',
        estado: 'aprovado',
        criadoEm: Date.now(),
        ordens: [{ ativo: 'VALE3', operacao: 'V', quantidade: 300, preco: 62.1, financeiro: 18630 }]
      }
    ];

    const dados = dadosDoResumoDoDia(pedidos, '2026-10-22');
    const html = htmlResumoDoDia(dados);

    expect(html).toContain('102030');
    expect(html).toContain('Investidor XP');
    expect(html).toContain('VALE3');
    expect(html).toContain('fl-resumo-pendencias');
    expect(html).toContain('Pedidos que ficaram pendentes para o fechamento');
  });
});
