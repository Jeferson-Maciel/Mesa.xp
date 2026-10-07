import { describe, expect, it } from 'vitest';
import XLSX from '../../../../vendor/xlsx.full.min.js';
import { acharAssessor, lerAssessores, lerPlanilhaDosAssessores } from './assessores.js';
import { clienteParaOEmail, lerClienteDoRobo, nomeProprio } from './cliente.js';

// Nomes, e-mails e códigos inventados: o repositório é público.

describe('nomeProprio', () => {
  it('arruma o nome que o Hub manda em maiúsculas', () => {
    expect(nomeProprio('ANA PAULA DA SILVA')).toBe('Ana Paula da Silva');
    expect(nomeProprio('  JOSE   DOS SANTOS E SOUZA ')).toBe('Jose dos Santos e Souza');
  });

  it('não põe o acento que o Hub não mandou, e mantém o que veio', () => {
    expect(nomeProprio('JOAO CONCEICAO')).toBe('Joao Conceicao');
    expect(nomeProprio('JOÃO CONCEIÇÃO')).toBe('João Conceição');
  });

  it('cuida de hífen, apóstrofo e numeral romano', () => {
    expect(nomeProprio("MARIA-CLARA D'AVILA")).toBe("Maria-Clara D'Avila");
    expect(nomeProprio('PEDRO HENRIQUE ALVES II')).toBe('Pedro Henrique Alves II');
  });

  it('partícula só fica minúscula no meio do nome', () => {
    expect(nomeProprio('DE PAULA FERREIRA')).toBe('De Paula Ferreira');
  });
});

describe('lerClienteDoRobo', () => {
  const dados = { conta: '1234567', nome: 'ANA PAULA DA SILVA', email: 'ANA.SILVA@EXEMPLO.COM', assessorCodigo: 'a12345', assessorNome: 'Bruno Costa' };

  it('confere a conta e limpa os campos', () => {
    expect(lerClienteDoRobo(dados, '1234567')).toEqual({
      nome: 'ANA PAULA DA SILVA',
      email: 'ana.silva@exemplo.com',
      assessorCodigo: 'A12345',
      assessorNome: 'Bruno Costa'
    });
  });

  it('o cliente de outra conta não serve', () => {
    expect(lerClienteDoRobo(dados, '7654321')).toBeNull();
  });

  it('e-mail que não é um e-mail só fica de fora', () => {
    expect(lerClienteDoRobo({ ...dados, email: 'a@x.com; b@y.com' }, '1234567').email).toBeNull();
    expect(lerClienteDoRobo({ ...dados, email: '' }, '1234567').email).toBeNull();
  });
});

// A aba Contatos como ela vem: Status em caixa de seleção, dois códigos, um segundo "Nome" à
// direita, e-mail "-" e linha que não é pessoa.
const CONTATOS = [
  ['Status', 'Nome', 'Email', 'Líder', 'Time', 'Cluster', 'Código', 'Código em uso', 'Tipo Assessor', 'Região', 'Nome', '', ''],
  ['TRUE', 'Bruno Costa', 'bruno.costa@exemplo.com.br', 'Líder Um', 'Time A', 'D', 'A12345', 'A12345', 'Assessor Jr', 'Anywhere', 'Bruno Costa', '', 'Código'],
  ['TRUE', 'Carla Mendes', 'Carla.Mendes@exemplo.com.br', 'Líder Um', 'Time A', '', 'Sem código', 'A23456', '', 'Porto Alegre', 'Carla Mendes', '', 'Sem código'],
  ['TRUE', 'Escritório Digital', '-', '', 'Sem time', '-', 'A34567', 'A34567', '', '', 'Escritório Digital', '', 'A12345'],
  ['FALSE', 'Diego Rocha', 'diego.antigo@exemplo.com.br', '', '', '', 'A45678', 'A45678', '', '', 'Diego Rocha', '', ''],
  ['TRUE', 'Diego Rocha', 'diego.rocha@exemplo.com.br', '', '', '', 'A45678', 'A45678', '', '', 'Diego Rocha', '', ''],
  ['TRUE', 'Élio Prado', 'elio@exemplo.com.br', '', '', '', '-', '-', '', '', 'Élio Prado', '', '']
];

describe('lerAssessores', () => {
  const assessores = lerAssessores(CONTATOS);

  it('fica só com quem tem e-mail, com os dois códigos e o primeiro Nome', () => {
    expect(assessores.map((a) => a.nome)).toEqual(['Bruno Costa', 'Carla Mendes', 'Diego Rocha', 'Diego Rocha', 'Élio Prado']);
    expect(assessores[1]).toEqual({ nome: 'Carla Mendes', email: 'carla.mendes@exemplo.com.br', codigos: ['A23456'], ativo: true });
    expect(assessores[2].ativo).toBe(false);
  });

  it('acha o cabeçalho mesmo com linha antes dele', () => {
    expect(lerAssessores([['Planilha da mesa'], ...CONTATOS])).toHaveLength(5);
  });

  it('recusa outra aba, sem Nome e Email', () => {
    expect(() => lerAssessores([['Ativo', 'C/V'], ['PETR4', 'C']])).toThrow(/Contatos/);
  });
});

describe('lerPlanilhaDosAssessores', () => {
  const xlsx = (abas) => {
    const livro = XLSX.utils.book_new();
    for (const [nome, linhas] of abas) XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet(linhas), nome);
    return XLSX.write(livro, { type: 'array', bookType: 'xlsx' });
  };

  it('no .xlsx com todas as abas, acha a Contatos', () => {
    const dados = xlsx([['Assessores ativos', [['Código', 'Total'], ['A12345', '3']]], ['Contatos', CONTATOS]]);
    expect(lerPlanilhaDosAssessores(dados, XLSX).map((a) => a.email)).toContain('bruno.costa@exemplo.com.br');
  });

  it('lê o .csv baixado da aba', () => {
    const csv = CONTATOS.map((l) => l.join(',')).join('\n');
    expect(lerPlanilhaDosAssessores(new TextEncoder().encode(csv), XLSX)).toHaveLength(5);
  });

  it('a planilha do secundário não passa por planilha dos assessores', () => {
    expect(() => lerPlanilhaDosAssessores(xlsx([['Fundos', [['Fundo', 'PU'], ['VGPR11', '8,00']]]]), XLSX)).toThrow(/Contatos/);
  });
});

describe('acharAssessor', () => {
  const assessores = lerAssessores(CONTATOS);

  it('pelo código em uso', () => {
    expect(acharAssessor(assessores, { codigo: 'A23456', nome: 'Outro Nome' })).toEqual({ nome: 'Carla Mendes', email: 'carla.mendes@exemplo.com.br' });
  });

  it('com dois e-mails para o mesmo código, vale o do ativo', () => {
    expect(acharAssessor(assessores, { codigo: 'A45678' }).email).toBe('diego.rocha@exemplo.com.br');
  });

  it('sem o código na planilha, pelo nome escrito igual, sem ligar para acento e maiúscula', () => {
    expect(acharAssessor(assessores, { codigo: 'A99999', nome: 'ELIO PRADO' })).toEqual({ nome: 'Élio Prado', email: 'elio@exemplo.com.br', peloNome: true });
  });

  it('nunca chuta: nome parecido não serve', () => {
    expect(acharAssessor(assessores, { codigo: 'A99999', nome: 'Bruno Costa Neto' })).toEqual({ motivo: 'fora-da-planilha' });
  });

  it('dois e-mails sem como decidir ficam sem cópia', () => {
    const duvida = [
      { nome: 'Fulano', email: 'a@exemplo.com', codigos: ['A1'], ativo: true },
      { nome: 'Fulano', email: 'b@exemplo.com', codigos: ['A1'], ativo: true }
    ];
    expect(acharAssessor(duvida, { codigo: 'A1' })).toEqual({ motivo: 'ambiguo' });
  });

  it('diz quando falta a planilha ou o assessor', () => {
    expect(acharAssessor(null, { codigo: 'A12345' })).toEqual({ motivo: 'sem-planilha' });
    expect(acharAssessor(assessores, { codigo: null, nome: null })).toEqual({ motivo: 'sem-assessor' });
  });
});

describe('clienteParaOEmail', () => {
  it('junta o nome arrumado, o e-mail do cliente e o do assessor', () => {
    const dados = lerClienteDoRobo({ conta: '1234567', nome: 'ANA PAULA DA SILVA', email: 'ANA@EXEMPLO.COM', assessorCodigo: 'A12345', assessorNome: 'Bruno Costa' }, '1234567');
    expect(clienteParaOEmail(dados, lerAssessores(CONTATOS))).toEqual({
      nome: 'Ana Paula da Silva',
      email: 'ana@exemplo.com',
      assessor: { codigo: 'A12345', nome: 'Bruno Costa', email: 'bruno.costa@exemplo.com.br', peloNome: false, motivo: null }
    });
  });
});
