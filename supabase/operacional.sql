-- ============================================
--   MESA XP — Operacional (base de conhecimento da mesa)
-- ============================================
-- GERADO por scripts/gerar-sql-operacional.mjs a partir de src/modulos/operacional/conteudo.js.
-- Não edite à mão: mude a semente e rode `npm run sql:operacional`.
--
-- Para criar: cole tudo no SQL Editor do Supabase e execute. Pode rodar de novo: não duplica nada
-- e não desfaz o que a mesa já editou.

-- ─── Tópicos ───
create table if not exists public.operacional_topicos (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique,
    nome        text not null check (char_length(btrim(nome)) between 2 and 80),
    descricao   text not null default '',
    pai_id      uuid references public.operacional_topicos (id) on delete restrict,
    ordem       integer not null default 0,
    criado_em   timestamptz not null default now()
);

-- ─── Posts ───
-- Excluir é esconder: o app marca excluido_em e o post continua aqui.
-- versao sobe a cada gravação; o app só grava por cima da versão que abriu.
create table if not exists public.operacional_posts (
    id            uuid primary key default gen_random_uuid(),
    slug          text not null unique,
    topico_id     uuid not null references public.operacional_topicos (id) on delete restrict,
    titulo        text not null check (char_length(btrim(titulo)) between 2 and 160),
    conteudo      text not null default '',
    ordem         integer not null default 0,
    versao        integer not null default 1,
    criado_em     timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    excluido_em   timestamptz
);

create index if not exists operacional_posts_topico_idx on public.operacional_posts (topico_id);

-- ─── Histórico ───
-- Cada versão de cada post, gravada pelo gatilho abaixo. Sem login, qualquer um com o link edita;
-- daqui dá para recuperar um texto apagado ou estragado (pelo painel do Supabase).
create table if not exists public.operacional_revisoes (
    id          bigint generated always as identity primary key,
    post_id     uuid not null references public.operacional_posts (id) on delete cascade,
    versao      integer not null,
    topico_id   uuid not null,
    titulo      text not null,
    conteudo    text not null,
    excluido_em timestamptz,
    gravado_em  timestamptz not null default now()
);

create index if not exists operacional_revisoes_post_idx on public.operacional_revisoes (post_id, versao);

create or replace function public.operacional_carimbar() returns trigger
    language plpgsql as $$
begin
    new.atualizado_em := now();
    return new;
end;
$$;

drop trigger if exists operacional_posts_carimbo on public.operacional_posts;
create trigger operacional_posts_carimbo before update on public.operacional_posts
    for each row execute function public.operacional_carimbar();

-- security definer: grava o histórico mesmo sem a chave anon ter acesso à tabela de revisões.
create or replace function public.operacional_guardar_revisao() returns trigger
    language plpgsql security definer set search_path = public as $$
begin
    insert into public.operacional_revisoes (post_id, versao, topico_id, titulo, conteudo, excluido_em)
    values (new.id, new.versao, new.topico_id, new.titulo, new.conteudo, new.excluido_em);
    return new;
end;
$$;

drop trigger if exists operacional_posts_revisao on public.operacional_posts;
create trigger operacional_posts_revisao after insert or update on public.operacional_posts
    for each row execute function public.operacional_guardar_revisao();

-- ─── RLS ───
-- O app não tem login (pendência de segurança da fase 2, ver CLAUDE.md): a chave anon lê, cria e
-- altera tópicos e posts. De propósito, NÃO há política de DELETE — nada é apagado pelo app — e a
-- tabela de revisões não tem política nenhuma: só o painel do Supabase a lê.
alter table public.operacional_topicos  enable row level security;
alter table public.operacional_posts    enable row level security;
alter table public.operacional_revisoes enable row level security;

drop policy if exists "operacional ler"     on public.operacional_topicos;
drop policy if exists "operacional criar"   on public.operacional_topicos;
drop policy if exists "operacional alterar" on public.operacional_topicos;
create policy "operacional ler"     on public.operacional_topicos for select to anon, authenticated using (true);
create policy "operacional criar"   on public.operacional_topicos for insert to anon, authenticated with check (true);
create policy "operacional alterar" on public.operacional_topicos for update to anon, authenticated using (true) with check (true);

drop policy if exists "operacional ler"     on public.operacional_posts;
drop policy if exists "operacional criar"   on public.operacional_posts;
drop policy if exists "operacional alterar" on public.operacional_posts;
create policy "operacional ler"     on public.operacional_posts for select to anon, authenticated using (true);
create policy "operacional criar"   on public.operacional_posts for insert to anon, authenticated with check (true);
create policy "operacional alterar" on public.operacional_posts for update to anon, authenticated using (true) with check (true);

-- ─── Realtime ───
do $$
begin
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'operacional_topicos') then
        alter publication supabase_realtime add table public.operacional_topicos;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'operacional_posts') then
        alter publication supabase_realtime add table public.operacional_posts;
    end if;
end;
$$;

-- ─── Semente: a cópia do Slab da mesa (30/09/2026) ───
-- Posts com conteúdo vazio vieram do Slab só com o título.
insert into public.operacional_topicos (slug, nome, descricao, pai_id, ordem)
values ('mesa-de-operacoes-argentum', 'Mesa de Operações Argentum', 'Material de conhecimento e uso de colaboradores da mesa de operações', null, 0)
on conflict (slug) do nothing;

insert into public.operacional_topicos (slug, nome, descricao, pai_id, ordem)
select v.slug, v.nome, v.descricao, pai.id, v.ordem
from (values
    ('padroes-de-email', 'Padrões de Email', '', 'mesa-de-operacoes-argentum', 1),
    ('disparos', 'Disparos', '', 'mesa-de-operacoes-argentum', 2),
    ('passo-a-passo', 'Passo a Passo', '', 'mesa-de-operacoes-argentum', 3),
    ('padroes-de-fixing', 'Padrões de Fixing', '', 'mesa-de-operacoes-argentum', 4),
    ('execucao-de-ordens', 'Execução de Ordens', '', 'mesa-de-operacoes-argentum', 5)
) as v (slug, nome, descricao, pai, ordem)
join public.operacional_topicos pai on pai.slug = v.pai
on conflict (slug) do nothing;

insert into public.operacional_posts (slug, topico_id, titulo, conteudo, ordem)
select v.slug, t.id, v.titulo, v.conteudo, v.ordem
from (values
    ('confirmacao-de-ordem-venda', 'padroes-de-email', 'Confirmação de ordem Venda', $slab$Prezado(a) CLIENTE,
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

Observações importantes: Toda solicitação lançada no sistema antes do leilão de encerramento sofrerá tentativa de processamento no mesmo dia. Toda solicitação lançada após o leilão de encerramento sofrerá tentativa de processamento no próximo dia útil.

Aguardo confirmação para realizar a ordem

Att,$slab$, 0),
    ('confirmacao-de-ordem-compra', 'padroes-de-email', 'Confirmação de ordem Compra', $slab$Prezado(a) CLIENTE,
Conforme conversado, gostaria de realizar a ordem abaixo na conta XP XXXXX:

Ativo: XXX;
Quantidade: XXX;
Preço: A mercado
Operação: Compra

Observações importantes: Toda solicitação lançada no sistema antes do leilão de encerramento sofrerá tentativa de processamento no mesmo dia. Toda solicitação lançada após o leilão de encerramento sofrerá tentativa de processamento no próximo dia útil.

Aguardo confirmação para realizar a ordem.

Att,$slab$, 1),
    ('confirmacao-aplicacao-tesouro-direto', 'padroes-de-email', 'Confirmação aplicação Tesouro Direto', $slab$Prezado(a) CLIENTE,

Conforme conversado, gostaria de realizar a ordem para a aplicação no Tesouro Direto abaixo na conta XP XXXXX:


Título: XXXXXX;
Taxa: XXX;
Vencimento: XXXXXX;
Valor a ser aplicado: XXXXX


Observação importante: O valor financeiro total da aplicação e o PU de compra dependem da cotação atual do mercado.

Aguardo confirmação para realizar a ordem.

Att,$slab$, 2),
    ('confirmacao-resgate-tesouro-direto', 'padroes-de-email', 'Confirmação resgate Tesouro Direto', $slab$Prezado(a) CLIENTE,

Conforme conversado, gostaria de realizar a ordem para o resgate no Tesouro Direto abaixo na conta XP XXXXX:

Título: XXXXXXX;
Vencimento: XXXXXXXX;
Valor a ser resgatado: XXXXXXXX

Observação importante: O valor financeiro total do resgate e o PU de venda dependem da cotação atual do mercado.

Aguardo confirmação para realizar o resgate.

atte,$slab$, 3),
    ('confirmacao-de-ordem-e-cancelamento-de-carteira', 'padroes-de-email', 'Confirmação de ordem e cancelamento de carteira', $slab$Prezado(a) CLIENTE,

Conforme conversado, gostaria de realizar a ordem abaixo: cancelamento das carteiras recomendadas CARTEIRAS na conta XP XXXXXX.



Observações importantes: Toda solicitação lançada no sistema antes do leilão de encerramento sofrerá tentativa de processamento no mesmo dia. Toda solicitação lançada após o leilão de encerramento sofrerá tentativa de processamento no próximo dia útil.

Aguardo confirmação para realizar a ordem

Att,$slab$, 4),
    ('confirmacao-de-resgate', 'padroes-de-email', 'Confirmação de resgate', $slab$Prezado(a) CLIENTE.

Conforme conversado, gostaria de realizar a ordem para o resgate abaixo na conta XP XXXXX:

Ativo: XXXXXXXXX
Emissor: XXXXXXX
Vencimento: XXXXXXXX
Taxa: XXXXX
Quantidade a ser resgatada: X OU TOTAL

Observações importantes: Para ativos de Renda Fixa, com exceção de títulos públicos, CDBs, LCs, LCIs e LCAs, o valor do resgate citado acima é resultado da cotação feita no mercado secundário pela Mesa de Renda Fixa da XP e só é válido para tentativa de processamento caso a solicitação seja lançada até às 15:00h. Após isso, terá de ser feita uma nova cotação no próximo dia útil, que resultará em um novo valor a ser confirmado pelo cliente e inserido para processamento até às 15:00h do dia referido para ser válido. Já para títulos públicos, CDBs, LCs, LCIs e LCAs, o valor só é válido caso a solicitação seja lançada até às 17:00h. Após isso, terá de ser feita uma nova cotação no próximo dia útil, que resultará em um novo valor a ser confirmado pelo cliente e inserido para processamento até às 17:00h do dia referido para ser válido.

 Ordem acima é válida por 15 dias.

Aguardo confirmação para realizar o resgate.$slab$, 5),
    ('confirmacao-resgate-fundos', 'padroes-de-email', 'Confirmação resgate fundos', $slab$$slab$, 6),
    ('confirmacao-zeragem-estrutura', 'padroes-de-email', 'Confirmação zeragem estrutura', $slab$Prezado(a), Cliente
Gostaríamos de confirmar a saída da operação (nome estrutura) vigente em sua conta.

Código da Conta: XXXX
Venda do ativo-objeto*: ( ) Sim ( ) Não
Quantidade: XXX
Preço: R$ XXX

*Venda da ação sobre a qual foi feita a estrutura. Caso opte por não vender, o ativo estará sujeito às oscilações de mercado.
**Captura de tela da posição em questão:$slab$, 7),
    ('confirmacao-de-aplicacao', 'padroes-de-email', 'Confirmação de aplicação', $slab$Prezado CLIENTE,

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

Att,$slab$, 8),
    ('cancelamento-de-carteira', 'padroes-de-email', 'Cancelamento de Carteira', $slab$Prezado(a) CLIENTE,

Gostaria de confirmar o cancelamento das carteiras recomendadas CARTEIRAS na conta XP XXXXXX.

Aguardo confirmação.

Att,$slab$, 9),
    ('confirmacao-aplicacao-fundos', 'padroes-de-email', 'Confirmação aplicação Fundos', $slab$$slab$, 10),
    ('confirmacao-zeragem-swap', 'padroes-de-email', 'Confirmação zeragem SWAP', $slab$Prezado(a) CLIENTE,

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


atte,$slab$, 11),
    ('subscricao-exercicio', 'padroes-de-email', 'Subscrição – Exercício', $slab$Prezado(a) CLIENTE,

 Conforme conversado, gostaria de realizar a ordem para o exercício do direito de subscrição na sua conta XP XXXXX:

 Ativo: XXX;
 Código do direito de subscrição: XXXX;
 Ao Preço unitário de: R$ XXX;
 Quantidade: XXX;

 Aguardo confirmação para realizar a operação.

Att,$slab$, 12),
    ('cancelamento-de-custodia-remunerada', 'padroes-de-email', 'Cancelamento de Custódia Remunerada', $slab$Prezado(a) CLIENTE,

Gostaria de confirmar o cancelamento do serviço de custódia remunerada na conta XP XXXXXX.

Ressaltando que ao clicar em confirmar, o serviço de Custódia Remunerada será imediatamente cancelado e caso haja algum contrato de aluguel em aberto, ele será liquidado em até D+4 após o cancelamento do serviço.

Aguardo confirmação para o cancelamento

Att,$slab$, 13),
    ('tabela-de-cetipados', 'disparos', 'Tabela de Cetipados', $slab$*Tabela de Cetipados (12/09/2024):*

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
MARE11$slab$, 0),
    ('trade-idea-destaque', 'disparos', 'Trade Idea Destaque', $slab$Trade Idea Destaque

Compra INBR32

Estratégia: Cup and Handle

Stop Gain: 17%
Stop Loss: 7%

Analista Filipe Borges | Benndorf Research

(Colocar print do histórico do analista)

---------------------->Por volta das 10:30~11hs <————————$slab$, 1),
    ('disparo-rf', 'disparos', 'Disparo RF', $slab$PARA AS 10H E 10MIN

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
-> 1 anos – LCI 100% CDI$slab$, 2),
    ('relatorios', 'passo-a-passo', 'Relatórios', $slab$Fixing mensal — Cotizador > Relatórios Gerenciais > Fixing > Selecionar o mês inteiro

RF com Ágio — HUB > Relatórios > Produtos > Renda Fixa > MTM Ágios > Filtrar > Ágio médio é maior que 1% > Exportar dados

Mapa de oportunidades — Cotizador > Mapa de Oportunidades > Painel Clientes > Exportar Dados

Vencimento RF — HUB > Produtos > Renda Fixa > Acompanhamento > Exportação > Exportar posição geral de renda fixa > Filtrar apenas a data de vencimento (geralmente boto 30d, perguntar pro bernardo)

Antecipação (A partir das 11:30h) - Cotizador > Antecipação > Exportar Posições Disponiveis$slab$, 0),
    ('contratar-cancelar-custodia-remunerada', 'passo-a-passo', 'Contratar/Cancelar Custódia remunerada', $slab$As formas de contratar/cancelar são:

Via cliente: Na sua conta da XP Cliente via site XP > Menu > Produtos RV > Custódia Remunerada> Contratar/Cancelar

ou

Via assessor: Ter o "de acordo" do cliente através modelo de auditoria via email ou telefone, após, enviar email para btcvarejo@xpi.com.br (somente para cncelar). Para contratar pode ser enviado push.$slab$, 1),
    ('posicoes', 'passo-a-passo', 'Posições', $slab$Ações e opções - HUB > Gestão >  Renda Variável > Custódia > Produto > Seleciona tudo, desmarca tudo deixando apenas Ação e Opção > Exportar Dados
FIIs - Mesmo passo a passo de cima, apenas alterar para Fundo Imobiliário.

Cetipado - HUB > Gestão > Fundos de Investimento > Base AUC > Classe XP > Marcar apenas Fundo Listado > Exportar Dados.
Fundos investimento - Mesmo passo a passo de cima, apenas selecionar tudo e desmarcar "Fundos Listados".$slab$, 2),
    ('rubi', 'padroes-de-fixing', 'Rubi', $slab$$slab$, 0),
    ('financiamento', 'padroes-de-fixing', 'Financiamento', $slab$$slab$, 1),
    ('smart-coupon', 'padroes-de-fixing', 'Smart Coupon', $slab$$slab$, 2),
    ('booster', 'padroes-de-fixing', 'Booster', $slab$$slab$, 3),
    ('fence', 'padroes-de-fixing', 'Fence', $slab$$slab$, 4),
    ('pop', 'padroes-de-fixing', 'POP', $slab$$slab$, 5),
    ('spider', 'padroes-de-fixing', 'Spider', $slab$$slab$, 6),
    ('collar', 'padroes-de-fixing', 'Collar', $slab$$slab$, 7),
    ('doc', 'padroes-de-fixing', 'DOC', $slab$$slab$, 8),
    ('put', 'padroes-de-fixing', 'Put', $slab$$slab$, 9),
    ('call', 'padroes-de-fixing', 'Call', $slab$$slab$, 10),
    ('alocacao-estrategica', 'padroes-de-fixing', 'Alocação Estratégica', $slab$$slab$, 11),
    ('cetipados', 'execucao-de-ordens', 'Cetipados', $slab$Todas ordens de cetipados devem ser auditadas por email, utilizar emails padronizados.
Não é possível auditar ordem de compra e venda no mesmo email de cetipados.
Ordens de compra, a cotação para o email deve ser abaixo do valor solicitado, nas ordens de venda o oposto.$slab$, 0),
    ('acoes-e-fundos-listados', 'execucao-de-ordens', 'Ações e Fundos Listados', $slab$$slab$, 1)
) as v (slug, topico, titulo, conteudo, ordem)
join public.operacional_topicos t on t.slug = v.topico
on conflict (slug) do nothing;
