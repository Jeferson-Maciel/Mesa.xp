# Auditoria Pragmática de Layout, UX/UI e Ergonomia — Mesa XP

> **Documento Técnico de Engenharia de Produto e Ergonomia de Mesas de Operações**  
> **Diretriz Central:** *Zero firula, zero perda de performance, foco absoluto em velocidade de execução, prevenção de erros (fat-finger) e redução de atrito no dia a dia.*  
> **Referências de Mercado Analisadas:** Bloomberg Terminal (Launchpad/AIM), Sinacor (B3), Nelogica Profit Pro, XP Hub e Linear App.

---

## 1. Premissas Realistas de Design para Mesa Financeira

Diferente de aplicativos SaaS convencionais, onde o design busca impressionar com ilustrações, espaços vazios generosos e animações suaves, uma mesa de operações de assessoria lida com **dinheiro, prazos de leilão rígidos e volume intenso de ordens**. 

### Os 4 Mandamentos Pragmáticos:
1. **Zero Rolagem Desnecessária (*Above the Fold*)**: Cada vez que o operador precisa rolar a página para baixo para achar o botão *"Abrir no Outlook"*, ele perde 2 a 3 segundos. Multiplicado por 80 ordens no dia, são 4 minutos perdidos em movimentos mecânicos inúteis.
2. **Zero Layout Jitter (Estabilidade Visual Absoluta)**: Números, cotas, preços e relógios **devem** ser renderizados com numerais tabulares monoespaçados (`Cascadia Mono`, `SF Mono`). Números proporcionais fazem colunas tremerem horizontalmente a cada atualização de cotação, gerando astenopia (cansaço visual).
3. **Cores como Ferramentas Funcionais, Não Decoração**:
   - 🟢 **Verde** (#5ccb97): **Exclusivo** para Compra, Aplicação e Ordem Executada com sucesso.
   - 🔴 **Vermelho** (#f08a80): **Exclusivo** para Venda, Resgate e Erro Crítico impeditivo.
   - 🟡 **Âmbar** (#eeb259): **Exclusivo** para Alertas de Prazo (leilão a menos de 30/15 min) e Pendências.
   - Cores de marca ou de aba nunca competem com esses três sinais vitais.
4. **Performance Nativa de 60 FPS**: Nenhuma biblioteca pesada de animação, nenhum framework de componentes externo. Todo o ganho ergonômico deve ser obtido através de puro HTML semântico, CSS Grid/Flexbox moderno e atalhos de teclado nativos.

---

## 2. Auditoria Tela a Tela: O Que Manter, Tirar, Ajustar e Adicionar

```
                                  MAPA DO FLUXO OPERACIONAL
 ┌────────────────┐       ┌────────────────┐       ┌────────────────┐       ┌────────────────┐
 │ 1. ENTRADA     │  ──>  │ 2. CONFIRMAÇÃO │  ──>  │ 3. APROVAÇÃO   │  ──>  │ 4. EXECUÇÃO    │
 │ (Texto Cliente)│       │ (E-mail / Wpp) │       │ (Outlook / Fila│       │ (Hub / Sinacor)│
 └────────────────┘       └────────────────┘       └────────────────┘       └────────────────┘
      Ordens                   Ordens                    Fila                  Fila / Hub
```

---

### 2.1. Módulo Ordens (Onde o Operador Passa 60% do Tempo)

#### 🔴 Diagnóstico Realista de Atrito:
- **Disposição Vertical Ineficiente**: A caixa de texto de entrada fica no topo e os cartões de confirmação gerados ficam embaixo. O operador cola, rola a página, clica em "Abrir no Outlook", rola de volta para a próxima.
- **Painel Lateral Direito Ocioso**: Os blocos *"Sem o robô"* (Carregar fundos) e *"Assessores"* (Planilha) ocupam ~300px de largura o dia todo, mas só são usados uma vez ao abrir o sistema de manhã.
- **Atraso de Foco/Clique**: Ao editar um campo numérico no cartão e clicar direto no botão "Copiar", o evento `change` repinta o DOM antes de registrar o clique, forçando o operador a clicar duas vezes.

#### 💡 O Que Ajustar (Sem inventar moda):
1. **Split View Lado a Lado (370px / 1fr)**:
   - **Coluna Esquerda**: Área de digitação/colagem de texto com HUD compacto no topo (apenas: `Status Robô ● | Cotação 10:14 | [Limpar]`).
   - **Coluna Direita**: Prévia instantânea dos cartões auditados com os botões de ação à vista **sem rolagem lateral** (> 970px livres para a tabela).
2. **Atalho de Disparo Imediato (`Ctrl + Enter`)**:
   - Com o cursor na caixa de texto, pressionar `Ctrl + Enter` aciona imediatamente a análise com efeito tátil no botão principal.
3. **Condensar o Painel Lateral**:
   - Os botões "Carregar fundos" e "Planilha de Assessores" viram pequenos ícones ou menu colapsável discreto no topo, devolvendo toda a largura útil da tela para a operação.

---

### 2.2. Módulo Fila do Dia (A Caixa de Entrada e Controle de Prazos)

#### 🔴 Diagnóstico Realista de Atrito:
- **Navegação 100% Dependente do Mouse**: Para aprovar ou executar 10 pedidos em fila, o operador é obrigado a mover o cursor do mouse e clicar um a um nos botões de cada cartão.
- **Troca Constante de Abas**: O operador está na tela de Ordens e precisa ficar alternando com Alt+2 para ver se o cliente respondeu ao e-mail.

#### 💡 O Que Ajustar:
1. **Navegação Rápida por Teclado (Padrão Bloomberg / Gmail)**:
   - Teclas `J` e `K`: Move a seleção para o pedido abaixo/acima na lista.
   - Tecla `E`: Marca o pedido selecionado como **Executado** na hora.
   - Tecla `L`: Abre o modal de **Lote Simples / TWAP**.
   - Tecla `F`: Abre a **Ficha de Execução**.
   - Tecla `B`: Abre a boleta do fundo ou tesouro no Hub.
   - Tecla `M`: Abre o menu de ações adicionais.
   - Tecla `T`: Alterna entre visão em Cartões e Tabela compacta.
   - Teclas `1`, `2`, `3`, `4`: Alterna entre as pastas da Fila.
2. **Modo Tabela Compacta como Padrão de Fechamento**:
   - Para quem opera mais de 15 pedidos no dia, o modo Tabela com altura de linha densa (34px) permite ver até 20 ordens simultaneamente na mesma tela, com colunas alinhadas: *Hora | Conta | Cliente | Ativo | Operação | Financeiro | Ações*.
3. **Ações em Lote para Fechamento**:
   - Checkbox rápido para "Selecionar Todos os Aprovados" e botão único "Marcar Selecionados como Executados" (poupa dezenas de cliques às 17h50).

---

### 2.3. Módulo Renda Fixa (Emissão Bancária Primário & Secundário)

#### 🔴 Diagnóstico Realista de Atrito:
- **Tabela e Mensagem Espremidas Verticalmente**: O simulador de pré-fixado no topo empurra a tabela de oportunidades para baixo.
- **Disparo Manual para WhatsApp**: O botão copia o texto para a área de transferência, mas o operador ainda precisa alternar para o WhatsApp Web/Desktop e colar manualmente.

#### 💡 O Que Ajustar:
1. **Visualização Paralela (Oportunidades ↔ Prévia da Mensagem)**:
   - Coluna de oportunidades à esquerda com filtros rápidos por chips (*CDB*, *LCI/LCA*, *CRI/CRA*).
   - Coluna da mensagem formatada à direita, atualizada automaticamente ao marcar/desmarcar ativos.
2. **Indicador de Equivalência CDI Líquido**:
   - No simulador pré-fixado, ao lado da taxa bruta (ex: `14,20% a.a.`), exibir uma etiqueta: `% do CDI Líquido` (calculado contra a taxa CDI anual configurável em tempo real), economizando tempo de conta mental do assessor.

---

### 2.4. Módulo Fundos (Prateleira do Secundário)

#### 🔴 Diagnóstico Realista de Atrito:
- **Muitas Colunas Pouco Relevantes no Pregão**: Detalhes cadastrais estáticos competem com o dado que realmente importa: **Deságio (%)** e **Estoque Disponível**.

#### 💡 O Que Ajustar:
1. **Heatmap Discreto no Deságio**:
   - Destaque em tom de verde sutil (fundo com opacidade de 10% a 20%) nas células com maior deságio, permitindo bater o olho instantaneamente nas melhores oportunidades de ganho para o cliente.
2. **Atalho Direto para a Boleta do Fundo**:
   - Clique único no ticker do fundo aciona o robô do Tampermonkey para abrir a boleta exata no Hub, sem cliques intermediários.

---

### 2.5. Shell & Top Bar (Navegação Global)

#### 🔴 Diagnóstico Realista de Atrito:
- **Abas Ocultando Nome em Zoom Padrão**: A regra `@media (max-width: 1380px)` forçava colapso dos nomes de abas em monitores comuns de 1366px no zoom padrão de 100%.

#### 💡 O Que Ajustar:
1. **Responsividade Baseada em Container Queries**:
   - Removida a media query de 1380px e adotado container query com corte progressivo em 500px, exibindo ícone + nome de todas as 7 abas em 100% de zoom em 1366px, 1440px e 1536px.
2. **Agrupamento Semântico com Separador Discreto**:
   - **Grupo Operacional**: `[Ordens] [Fila (3)] [Fundos] [Renda Fixa]`
   - *(micro-separador vertical cinza)*
   - **Grupo Mesa & Gestão**: `[Calendário] [Operacional] [Anotações]`

---

## 3. Matriz Realista: O Que Manter, Tirar, Ajustar e Adicionar

| Componente / Área | 🟢 MANTER (Não mexer) | 🔴 TIRAR (Descarte) | 🟡 AJUSTAR (Ergonomia) | 🟣 ADICIONAR (Ganho Real) |
| :--- | :--- | :--- | :--- | :--- |
| **Ordens: Entrada** | Parser tolerante em linguagem natural. | Painel lateral vertical largo (300px). | Layout Amplo assimétrico (370px / 1fr). | Atalho `Ctrl+Enter` para gerar confirmação instantânea. |
| **Ordens: Cartões** | Modelos auditados de e-mail e Sinacor. | Botões secundários com mesmo peso visual. | Destaque forte no botão principal (*Abrir no Outlook*). | Botão One-Click "Inverter Cesta" (Compra ↔ Venda). |
| **Fila: Pastas** | Conceito Zero Inbox (*Aprovação e execução*). | — | Pasta ativa com destaque visual e anel pulsante no leilão. | Contador de volume financeiro total da pasta em tooltip. |
| **Fila: Lista/Tabela** | Alertas sonoros e visuais contidos. | Menus que exigem 3 cliques para ações básicas. | Altura de linha compacta (34px) no modo Tabela. | Navegação por teclado (`J`/`K`/`E`/`L`/`F`/`B`/`M`/`T`/`1`-`4`). |
| **Renda Fixa** | Importação direta via memória (Zero Downloads). | Modais de alerta desnecessários. | Layout paralelo (Grade de ativos à esquerda, Mensagem à direita). | Equivalência automática em % do CDI Líquido no simulador. |
| **Fundos** | Cálculo automático de ROA e spread. | Colunas cadastrais estáticas. | Heatmap suave nos maiores deságios da prateleira. | Tag de Investidor Qualificado/Profissional explícita. |
| **Top Bar (Header)** | Modo escuro grafite azulado, som, manual. | Breakpoint rígido de 1380px. | Container queries com corte progressivo em 500px. | Nomes e ícones visíveis em 1366px a 100% de zoom. |

---

## 4. Status de Implementação das Fases

### ✅ Fase 1: Velocidade de Teclado & Zero Risco (CONCLUÍDA)
- **Status**: **100% Implementada, Testada e Validada no Navegador**
- **Funcionalidades Entregues**:
  1. **Ordens (`Ctrl + Enter`)**: aciona diretamente a análise do texto com feedback tátil no botão principal.
  2. **Fila do Dia (Navegação & Execução por Teclado)**:
     - `J` e `K`: navegação rápida entre pedidos com destaque visual(`.fl-destaque`) e rolagem automática suave.
     - `E`: marca o pedido como Executado (ou aprovado).
     - `L` e `F`: modal de Lote Simples/TWAP ou Ficha de Execução.
     - `B`: abre a boleta do ativo no Hub.
     - `M`: menu de ações adicionais.
     - `T`: alterna entre Cartões e Tabela compacta.
     - `1`, `2`, `3`, `4`: alternância direta entre pastas.
     - Bloqueio automático durante digitação em campos editáveis.
  3. **Qualidade**: 1.465 testes unitários passando (`npm test`), 100% aprovado no Playwright Chromium.

### ✅ Fase 2: Layout Amplo de Ordens & Eliminação de Rolagem Horizontal (CONCLUÍDA)
- **Status**: **100% Implementada, Testada e Validada no Navegador**
- **Funcionalidades Entregues**:
  1. **Coluna de Preview Ampla (Prioridade Total à Tabela de Ordens)**:
     - `grid-template-columns: minmax(320px, 370px) minmax(0, 1fr);` com largura máxima de 1540px.
     - Caixa de entrada em 370px e **mais de 970px livres para a tabela de ordens**.
     - **Barra de rolagem horizontal 100% eliminada** (`scrollWidth: 970 == clientWidth: 970`).
  2. **Alinhamento Perfeito das Cápsulas de Ativos**:
     - `.col-ativo .linha-campos` com `display: flex; align-items: center; gap: 6px; white-space: nowrap;`.
     - Pílulas de classe (`[AÇÃO]`, `[FUNDO]`, `[TESOURO]`) alinhadas horizontalmente ao lado do ticker sem quebrar linha.
  3. **HUD Operacional Compacto**:
     - Chips de Total R$, Total de Contas, Ativos e Status da Cotação no topo de Ordens.

### ✅ Fase 3: Densidade Informacional na Fila e Renda Fixa (CONCLUÍDA)
- **Status**: **100% Implementada, Testada e Validada no Navegador**
- **Funcionalidades Entregues**:
  1. **Fila do Dia — Modo Tabela Compacto de Alta Densidade (Linhas de 34px)**:
     - Padding vertical reduzido para `0.28rem var(--esp-3)` com `vertical-align: middle`.
     - Números tabulares `font-variant-numeric: tabular-nums` e botões de 26px.
     - Dobro de pedidos visíveis simultaneamente na viewport do operador.
  2. **Renda Fixa — Simulador com % do CDI Líquido & CDI Customizável**:
     - Cálculo de rentabilidade líquida comparada ao CDI: `percCdiLiquido = (taxaLiquida / taxaCdi) * 100`.
     - Campo de CDI de referência anual editável (padrão 10,65% a.a.) com recálculo instantâneo em tempo real.
  3. **Correção de Zoom do Header**:
     - Removida a media query de 1380px e ajustado container query para 500px, exibindo ícone + nome de todas as 7 abas em 100% de zoom em 1366px.

### ⏳ Fase 4: Ordens Avançadas e Execução em Lote (Roadmap Futuro)
- **Status**: **Aguardando aprovação do usuário para início**
- **Funcionalidades Planejadas**:
  1. Botão One-Click "Inverter Cesta" (Flip Compra ↔ Venda) preservando ativos e quantidades.
  2. Desmembramento automático de lote padrão e fracionário (`PETR4` x 100 + `PETR4F` x 50).
  3. Fechamento e execução em lote na Fila do dia.
  4. Detecção e descarte inteligente de tabela de posições colada (`Ativo / Qtd. Teórica / Qtd. Atual`).
