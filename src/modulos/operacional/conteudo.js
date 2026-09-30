/**
 * O conteúdo inicial da base Operacional: a cópia do Slab da mesa ("Gregori's Team"), em 30/09/2026.
 *
 * É a semente do banco (supabase/operacional.sql é gerado daqui por scripts/gerar-sql-operacional.mjs)
 * e do modo local. Depois de semeado, o banco é a fonte: o que a mesa edita pela tela não volta para
 * este arquivo.
 *
 * O texto é o do Slab, como foi colado — inclusive os erros de digitação ("cncelar"), porque é o que
 * a mesa já usa. Só duas coisas foram normalizadas, e nenhuma aparece num e-mail: espaço no fim da
 * linha e linha feita só de espaços invisíveis (NBSP) viraram linha vazia.
 *
 * Posts com `conteudo: ''` vieram só com o título: o texto deles ainda não foi copiado do Slab. A tela
 * os mostra como pendentes, e não se inventa texto para eles.
 */

// O nome que aparece no alto da barra lateral. No Slab era "Gregori's Team"; a mesa pediu
// "Operacional Mesa" em 30/09/2026.
export const EQUIPE = 'Operacional Mesa';

/** Tópicos na ordem do Slab. `pai` é o slug do tópico acima; o primeiro é a raiz. */
export const TOPICOS = [
  {
    slug: 'mesa-de-operacoes-argentum',
    nome: 'Mesa de Operações Argentum',
    descricao: 'Material de conhecimento e uso de colaboradores da mesa de operações',
    pai: null
  },
  { slug: 'padroes-de-email', nome: 'Padrões de Email', descricao: '', pai: 'mesa-de-operacoes-argentum' },
  { slug: 'disparos', nome: 'Disparos', descricao: '', pai: 'mesa-de-operacoes-argentum' },
  { slug: 'passo-a-passo', nome: 'Passo a Passo', descricao: '', pai: 'mesa-de-operacoes-argentum' },
  { slug: 'padroes-de-fixing', nome: 'Padrões de Fixing', descricao: '', pai: 'mesa-de-operacoes-argentum' },
  { slug: 'execucao-de-ordens', nome: 'Execução de Ordens', descricao: '', pai: 'mesa-de-operacoes-argentum' }
].map((t, ordem) => ({ ...t, ordem }));

const OBS_LEILAO =
  'Toda solicitação lançada no sistema antes do leilão de encerramento sofrerá tentativa de processamento no mesmo dia. Toda solicitação lançada após o leilão de encerramento sofrerá tentativa de processamento no próximo dia útil.';

const email = [
  {
    titulo: 'Confirmação de ordem Venda',
    conteudo: `Prezado(a) CLIENTE,
Conforme conversado, gostaria de realizar a ordem abaixo na conta XP XXXXX, conforme condições abaixo:

Ativo: XXX;
Quantidade: XXX;
Operação: Venda;

Condições:
PRINT DA COTAÇÃO



atte,


PARA AÇÕES:

Prezado(a) CLIENTE,
Conforme conversado, gostaria de realizar a ordem abaixo na conta XP XXXXXX:

Ativo: PETR4;
Quantidade: 318;
Preço: A mercado
Operação: Venda

Ativo: VALE3;
Valor: R$ 9.600,00;
Preço: A mercado
Operação: Compra

Observações importantes: ${OBS_LEILAO}

Aguardo confirmação para realizar a ordem

Att,`
  },
  {
    titulo: 'Confirmação de ordem Compra',
    conteudo: `Prezado(a) CLIENTE,
Conforme conversado, gostaria de realizar a ordem abaixo na conta XP XXXXX:

Ativo: XXX;
Quantidade: XXX;
Preço: A mercado
Operação: Compra

Observações importantes: ${OBS_LEILAO}

Aguardo confirmação para realizar a ordem.

Att,`
  },
  {
    titulo: 'Confirmação aplicação Tesouro Direto',
    conteudo: `Prezado(a) CLIENTE,

Conforme conversado, gostaria de realizar a ordem para a aplicação no Tesouro Direto abaixo na conta XP XXXXX:


Título: XXXXXX;
Taxa: XXX;
Vencimento: XXXXXX;
Valor a ser aplicado: XXXXX


Observação importante: O valor financeiro total da aplicação e o PU de compra dependem da cotação atual do mercado.

Aguardo confirmação para realizar a ordem.

Att,`
  },
  {
    titulo: 'Confirmação resgate Tesouro Direto',
    conteudo: `Prezado(a) CLIENTE,

Conforme conversado, gostaria de realizar a ordem para o resgate no Tesouro Direto abaixo na conta XP XXXXX:

Título: XXXXXXX;
Vencimento: XXXXXXXX;
Valor a ser resgatado: XXXXXXXX

Observação importante: O valor financeiro total do resgate e o PU de venda dependem da cotação atual do mercado.

Aguardo confirmação para realizar o resgate.

atte,`
  },
  {
    titulo: 'Confirmação de ordem e cancelamento de carteira',
    conteudo: `Prezado(a) CLIENTE,

Conforme conversado, gostaria de realizar a ordem abaixo: cancelamento das carteiras recomendadas CARTEIRAS na conta XP XXXXXX.



Observações importantes: ${OBS_LEILAO}

Aguardo confirmação para realizar a ordem

Att,`
  },
  {
    titulo: 'Confirmação de resgate',
    conteudo: `Prezado(a) CLIENTE.

Conforme conversado, gostaria de realizar a ordem para o resgate abaixo na conta XP XXXXX:

Ativo: XXXXXXXXX
Emissor: XXXXXXX
Vencimento: XXXXXXXX
Taxa: XXXXX
Quantidade a ser resgatada: X OU TOTAL

Observações importantes: Para ativos de Renda Fixa, com exceção de títulos públicos, CDBs, LCs, LCIs e LCAs, o valor do resgate citado acima é resultado da cotação feita no mercado secundário pela Mesa de Renda Fixa da XP e só é válido para tentativa de processamento caso a solicitação seja lançada até às 15:00h. Após isso, terá de ser feita uma nova cotação no próximo dia útil, que resultará em um novo valor a ser confirmado pelo cliente e inserido para processamento até às 15:00h do dia referido para ser válido. Já para títulos públicos, CDBs, LCs, LCIs e LCAs, o valor só é válido caso a solicitação seja lançada até às 17:00h. Após isso, terá de ser feita uma nova cotação no próximo dia útil, que resultará em um novo valor a ser confirmado pelo cliente e inserido para processamento até às 17:00h do dia referido para ser válido.

 Ordem acima é válida por 15 dias.

Aguardo confirmação para realizar o resgate.`
  },
  { titulo: 'Confirmação resgate fundos', conteudo: '' },
  {
    titulo: 'Confirmação zeragem estrutura',
    conteudo: `Prezado(a), Cliente
Gostaríamos de confirmar a saída da operação (nome estrutura) vigente em sua conta.

Código da Conta: XXXX
Venda do ativo-objeto*: ( ) Sim ( ) Não
Quantidade: XXX
Preço: R$ XXX

*Venda da ação sobre a qual foi feita a estrutura. Caso opte por não vender, o ativo estará sujeito às oscilações de mercado.
**Captura de tela da posição em questão:`
  },
  {
    titulo: 'Confirmação de aplicação',
    conteudo: `Prezado CLIENTE,

Conforme conversado, gostaria de realizar a aplicação na sua conta XP XXXXX:

Ativo: XXXXXXXXX;
Emissor: XXXXX
Taxa: XXXXX
Carência: No Vencimento
Vencimento: XXXXXXXX
Valor a ser aplicado: XXXXXXXX

Observações importantes: A taxa mínima representa o mínimo de rentabilidade aceito pelo cliente para realizar a aplicação. A ordem é válida para a taxa mínima especificada ou qualquer taxa maior. O valor financeiro total da aplicação e o PU de compra dependem da cotação feita no mercado secundário pela Mesa de Renda Fixa da XP e serão confirmados via nota de negociação que será enviada ao e-mail de cadastro do cliente. Para ativos de Renda Fixa, com exceção de títulos públicos, toda solicitação lançada no sistema antes das 15:00h sofrerá tentativa de processamento no mesmo dia e toda solicitação lançada após às 15:00h sofrerá tentativa de processamento no próximo dia útil, nesse caso, as datas de carência e de vencimento de CDBs, LCs, LCIs e LCAs estarão sujeitas a postergação de um dia útil. Já para Títulos Públicos, toda solicitação lançada no sistema antes das 17:00h sofrerá tentativa de processamento no mesmo dia e toda solicitação lançada após às 17:00h sofrerá tentativa de processamento no próximo dia útil.

Ordem acima é válida por 15 dias.

Aguardo confirmação para realizar a aplicação.

Att,`
  },
  {
    titulo: 'Cancelamento de Carteira',
    conteudo: `Prezado(a) CLIENTE,

Gostaria de confirmar o cancelamento das carteiras recomendadas CARTEIRAS na conta XP XXXXXX.

Aguardo confirmação.

Att,`
  },
  { titulo: 'Confirmação aplicação Fundos', conteudo: '' },
  {
    titulo: 'Confirmação zeragem SWAP',
    conteudo: `Prezado(a) CLIENTE,

Conforme conversado, gostaria de realizar a ordem abaixo na conta XP XXXXXX:

Zeragem SWAP CRA JBS - SET/2037;
Cliente Paga R$ 1.027,74
(PRINT DA COTAÇÃO)

Obs: Créditos e débitos podem variar de acordo com as condições do mercado ao executar a operação.

Aguardo confirmação.

Att,

-----------------------------------------------------------------------------------------

Email para XP: swap.rf@xpi.com.br

Zeragem - SWAP Cetip - Cód. Cliente

Código do cliente XXXXXX
Ativo objeto XXXX


atte,`
  },
  {
    titulo: 'Subscrição – Exercício',
    conteudo: `Prezado(a) CLIENTE,

 Conforme conversado, gostaria de realizar a ordem para o exercício do direito de subscrição na sua conta XP XXXXX:

 Ativo: XXX;
 Código do direito de subscrição: XXXX;
 Ao Preço unitário de: R$ XXX;
 Quantidade: XXX;

 Aguardo confirmação para realizar a operação.

Att,`
  },
  {
    titulo: 'Cancelamento de Custódia Remunerada',
    conteudo: `Prezado(a) CLIENTE,

Gostaria de confirmar o cancelamento do serviço de custódia remunerada na conta XP XXXXXX.

Ressaltando que ao clicar em confirmar, o serviço de Custódia Remunerada será imediatamente cancelado e caso haja algum contrato de aluguel em aberto, ele será liquidado em até D+4 após o cancelamento do serviço.

Aguardo confirmação para o cancelamento

Att,`
  }
];

const disparos = [
  {
    titulo: 'Tabela de Cetipados',
    conteudo: `*Tabela de Cetipados (12/09/2024):*

*ROA.E. 2,15%*
MARE11

*ROA.E. 1,95%*
CPHF11
VGPR11
XPHF11

*ROA.E. 1,85%*
PAAG11
XPAG11

*ROA.E. 1,75%*
AZPR11
IMOV11
VGIE11 (IQ)

*Deságio Venda 0,5%*
AUGM11 (IQ)

*Deságio Venda 1,5%*
TGRI11
PIER11 (IQ)
JGPT11
RBRJ11
AVBI11

*Deságio Venda 1,75%*
CYHF11
JGPI11
VICA11

*Deságio Venda 2,0%*
MCCE11
AZPR11

*Deságio Venda 2,25%*
TGRE11
IMOV11
VGIE11 (IQ)

*Deságio Venda 2,5%*
PAAG11

*Deságio Venda 3,0%*
CPHF11
VGPR11
XPAG11

*Deságio Venda 3,25%*
XPHF11

*Deságio Venda 4%*
MARE11`
  },
  {
    titulo: 'Trade Idea Destaque',
    conteudo: `Trade Idea Destaque

Compra INBR32

Estratégia: Cup and Handle

Stop Gain: 17%
Stop Loss: 7%

Analista Filipe Borges | Benndorf Research

(Colocar print do histórico do analista)

---------------------->Por volta das 10:30~11hs <————————`
  },
  {
    titulo: 'Disparo RF',
    conteudo: `PARA AS 10H E 10MIN

*Oportunidades de RENDA FIXA hoje!* ⭐

*Taxas pré fixadas:*
-> 1 ano - CDB 13,76% a.a.
-> 2 anos - CDB 13,62% a.a.
-> 3 anos - CDB 13,55% a.a.
-> 4 anos - CDB 13,75% a.a.
-> 5 anos - CDB 13,95% a.a.
-> 6 anos - CDB 14,05% a.a.
-> 7 anos - CDB 13,90% a.a.

*Taxas Pós-fixadas:*
-> 2 anos - CDB 109% CDI
-> 4 anos - CDB 110% CDI
-> 6 anos - CDB 104,50% CDI

*Taxas IPCA+:*
-> 1 ano - CDB IPCA +8,87% a.a.
-> 2 anos - CDB IPCA + 8,31% a.a.
-> 3 anos - CDB IPCA + 8,05% a.a.

*LCAs/LCIs ISENTA DE IR*
-> 1 ano – LCA 11,45% a.a.
-> 2 anos – LCA 11,16% a.a.
-> 3 anos – LCA 11,22% a.a.
-> 2 anos – LCA IPCA +5,68%
-> 1 anos – LCI 100% CDI`
  }
];

const passoAPasso = [
  {
    titulo: 'Relatórios',
    conteudo: `Fixing mensal — Cotizador > Relatórios Gerenciais > Fixing > Selecionar o mês inteiro

RF com Ágio — HUB > Relatórios > Produtos > Renda Fixa > MTM Ágios > Filtrar > Ágio médio é maior que 1% > Exportar dados

Mapa de oportunidades — Cotizador > Mapa de Oportunidades > Painel Clientes > Exportar Dados

Vencimento RF — HUB > Produtos > Renda Fixa > Acompanhamento > Exportação > Exportar posição geral de renda fixa > Filtrar apenas a data de vencimento (geralmente boto 30d, perguntar pro bernardo)

Antecipação (A partir das 11:30h) - Cotizador > Antecipação > Exportar Posições Disponiveis`
  },
  {
    titulo: 'Contratar/Cancelar Custódia remunerada',
    conteudo: `As formas de contratar/cancelar são:

Via cliente: Na sua conta da XP Cliente via site XP > Menu > Produtos RV > Custódia Remunerada> Contratar/Cancelar

ou

Via assessor: Ter o "de acordo" do cliente através modelo de auditoria via email ou telefone, após, enviar email para btcvarejo@xpi.com.br (somente para cncelar). Para contratar pode ser enviado push.`
  },
  {
    titulo: 'Posições',
    conteudo: `Ações e opções - HUB > Gestão >  Renda Variável > Custódia > Produto > Seleciona tudo, desmarca tudo deixando apenas Ação e Opção > Exportar Dados
FIIs - Mesmo passo a passo de cima, apenas alterar para Fundo Imobiliário.

Cetipado - HUB > Gestão > Fundos de Investimento > Base AUC > Classe XP > Marcar apenas Fundo Listado > Exportar Dados.
Fundos investimento - Mesmo passo a passo de cima, apenas selecionar tudo e desmarcar "Fundos Listados".`
  }
];

// Só os títulos vieram do Slab: o texto destes ainda não foi copiado.
const fixing = [
  'Rubi', 'Financiamento', 'Smart Coupon', 'Booster', 'Fence', 'POP',
  'Spider', 'Collar', 'DOC', 'Put', 'Call', 'Alocação Estratégica'
].map((titulo) => ({ titulo, conteudo: '' }));

const execucao = [
  {
    titulo: 'Cetipados',
    conteudo: `Todas ordens de cetipados devem ser auditadas por email, utilizar emails padronizados.
Não é possível auditar ordem de compra e venda no mesmo email de cetipados.
Ordens de compra, a cotação para o email deve ser abaixo do valor solicitado, nas ordens de venda o oposto.`
  },
  { titulo: 'Ações e Fundos Listados', conteudo: '' }
];

/** Slug estável a partir do título: minúsculo, sem acento, só letras, números e hífen. */
export const slugDe = (texto) =>
  String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const doTopico = (topico, posts) => posts.map((p, ordem) => ({ slug: slugDe(p.titulo), topico, ordem, ...p }));

/** Posts na ordem em que o Slab os lista em cada tópico. */
export const POSTS = [
  ...doTopico('padroes-de-email', email),
  ...doTopico('disparos', disparos),
  ...doTopico('passo-a-passo', passoAPasso),
  ...doTopico('padroes-de-fixing', fixing),
  ...doTopico('execucao-de-ordens', execucao)
];
