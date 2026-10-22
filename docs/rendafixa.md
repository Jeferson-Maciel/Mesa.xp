# Renda Fixa

Parte da documentação da Mesa XP. O que vale sempre — dado de cliente, push, "nada é
adivinhado", as regras do robô, a verificação — e o mapa dos outros documentos estão no
[`CLAUDE.md`](../CLAUDE.md).

Página que lê no navegador a planilha de renda fixa exportada pela XP e gera um texto para WhatsApp
com a maior taxa por prazo e categoria. Código em `src/modulos/rendafixa/`. As regras de negócio
(filtros, janela de prazo, categorias, prazos exibidos, CDI+ × % do CDI) e o mapeamento das colunas
da XP estão no [README](../README.md#renda-fixa-como-o-motor-funciona); leia antes de mexer no motor e
atualize o README junto.

## Regras

- **O texto de `montarTexto` é o produto**: o assessor cola direto no WhatsApp do cliente.
  Asteriscos, `-> `, o travessão `–` nos isentos, `a.a.` e `% CDI` são formato visível ao cliente.
  Altere só quando pedido e mostre o antes/depois.
- **Toda regra de negócio fica em `motor.js`** (funções puras, sem DOM), **lendo as regras de
  `regras.js`**. `index.js` só apresenta.
- **A planilha nunca sai do navegador.** Esse sigilo é a promessa do produto; um teste confere que
  nenhum arquivo do módulo faz chamada de rede.
- Texto vindo da planilha ou do histórico que vai para `innerHTML` passa por `esc` (ou
  `mensagemEmHTML`, para o negrito do WhatsApp).
- Registros antigos do histórico (`rendafixa_history`, até 20) não têm `modo`, `arquivo` nem
  `itens`. Leia esses campos com reserva.

## As regras configuráveis (21/10/2026)

Pedido do usuário: "todas as configurações e regras que utilizamos modificáveis no site, sem login, no
navegador de cada um". **Uma configuração para cada mercado** (primário e secundário), guardada no
`localStorage` (`regrasSalvas.js`, chave `mesa_rendafixa_regras_v1`; não há dado de cliente nela).

- **`regras.js`** (puro, testado): o padrão de cada mercado, a validação, as diferenças para o padrão
  e o texto de copiar e colar. O que é configurável:
  - os **filtros**: o PU máximo, descartar o investidor qualificado, o profissional e a liquidez
    diária, e onde procurar a taxa quando a primeira coluna de taxa vem vazia;
  - os **prazos** exibidos de cada seção e os dos isentos (pré, % do CDI/CDI+, IPCA+), e os **tipos**
    tratados como isentos;
  - os **bancos** conhecidos (o emissor tirado do nome do título);
  - a **mensagem**: o cabeçalho, o título de cada seção, o modelo de cada linha (com `{prazo}`,
    `{tipo}`, `{taxa}` e `{emissor}`), mostrar o emissor ou não, as casas da taxa, tirar o ",00", o
    texto do prazo, a ordem das seções e um rodapé;
  - no **Avançado**: o tipo pelo nome por extenso, as siglas, os nomes das colunas (`trecho`, `=igual`,
    `^começa`, `trecho -exceto`) e as palavras que acham o cabeçalho.
- **O padrão reproduz o original**, com uma diferença decidida pelo usuário: com a primeira coluna de
  taxa vazia, a taxa é procurada **só nas outras colunas de taxa** (a Tax.Máx vale); o original lia
  qualquer célula com "%", e o ROA virava taxa. O jeito antigo é a opção `qualquer-celula`, e é com
  ele (`regrasDoOriginal`) que os goldens provam o porte fiel. Conferido em 21/10: nas três
  planilhas reais da XP, nos dois mercados, a mensagem com o padrão novo é idêntica à de ouro, e nem o
  funil muda; na sintética, só o funil ganha um "sem taxa" (a linha que só tinha o ROA).
- **A tela** (`telaDasRegras.js`): o botão **Regras** (atalho R) abre uma gaveta com as partes, os
  campos e, ao lado, a mensagem da planilha carregada com as regras de agora. O que muda vale na hora;
  um valor inválido fica em vermelho com o motivo, e **vale a última regra boa** — nada é trocado em
  silêncio. "Restaurar o padrão" por parte e geral; "Copiar do outro mercado" (o cabeçalho e o emissor
  ficam os do mercado); **"Copiar / Colar configuração"** para passar a um colega (os dois mercados;
  ao colar, a tela mostra o que vai mudar e pede "Aplicar"). Fora do padrão, o selo **"regras
  personalizadas · N"** aparece no painel do mercado, com o que mudou no título.
- **A mensagem sai por partes** (`montarMensagem`: o cabeçalho, um bloco por seção, o rodapé): o
  "copiar uma seção" junta o cabeçalho, o bloco dela e o rodapé. Uma particularidade do original fica:
  a mensagem termina com uma linha em branco, a menos que a última seção seja a dos isentos.

## Mapa

- `motor.js` — portado do RendaFixaDisparo sem mudar uma regra: o corpo é o mesmo, só o
  `module.exports` virou `export`. Desde 21/10/2026 cada item leva também `dias` (os dias corridos até
  o vencimento, `diasAteOVencimento`), para a equivalência dos isentos; os goldens conferem o resto
  do resultado sem ele. `processRows(rows, secundario, hoje)` devolve
  `{ totais, descartes, bloqueados, colunas, secoes }`; `montarTexto(resultado)` gera a mensagem, ou
  `''` sem oportunidade.
- `analise.js` — o que a tela mostra além do motor (21/10/2026), sem mudar a mensagem: o destaque de
  cada categoria (a maior taxa na unidade que mais aparece), a força de cada taxa, a equivalência do
  isento (a taxa ÷ (1 − alíquota do IR pelos dias), só para pré e % do CDI, e o tributado do mesmo
  prazo para comparar) e os trechos da mensagem, um por categoria, para copiar só ela.
- `planilha.js` — `lerPlanilha(dados, XLSX)`: primeira aba, datas como `Date`, linhas como matriz.
- `historico.js` — histórico e variações do dia (▲/▼ contra a última análise salva antes de hoje, no
  mesmo mercado).
- `render.js` — o HTML, em funções puras. `index.js` — estado, eventos, atalhos.

## Armadilhas

- O mapeamento de colunas é por trecho do cabeçalho normalizado. Na planilha da XP, *tipo* cai em
  **Ticker** (a última coluna que combina vence) e *taxa* cai em **Tax.Mín** (só aqui vence a
  primeira). Ao mudar uma palavra-chave, confira as 34 colunas da XP.
- Em `normalizeTipoLocal`, os nomes por extenso vêm antes das siglas porque "LCD" contém "lc".
  Tickers do secundário (`26I1LCD8XR3`) não identificam o tipo, e a coluna Instrumento resolve.
- O mesmo número de taxa muda de sentido conforme o indexador: pré = % a.a., CDI = % do CDI, CDI+ e
  IPCA = spread.
- A única diferença entre linha primária e secundária é a coluna "Data de Emissão" estar preenchida.
- O prazo é calculado contra `hoje`, que por padrão é `new Date()`. Para comparar saídas, passe uma
  data fixa.
- Datas são detectadas com `ehData` (e não `instanceof Date`) para funcionar com objetos vindos de
  outro realm.
- A regex de `removeAccents` usa os escapes `̀-ͯ` como texto; um teste confere que não
  viraram caracteres invisíveis.
- Sem Tax.Mín nem Tax.Máx, o motor lê como taxa a primeira célula da linha com "%" — que pode ser o
  ROA. É comportamento do original, registrado no golden da planilha sintética e no roadmap.

## SheetJS vendorizado

`src/vendor/xlsx.full.min.js` é o SheetJS **0.20.1** do CDN oficial, byte a byte (um teste confere
o sha256), com `LICENSE-sheetjs.txt`. **Não use o pacote `xlsx` do npm**: parou na 0.18.5, com
vulnerabilidades conhecidas; um teste recusa `xlsx` no `package.json`. O `package.json` com
`"type": "commonjs"` dentro de `src/vendor/` é o que deixa o Node (nos testes) carregar o arquivo
UMD; o build o importa pelo `import XLSX from`.

## Goldens e fixtures

O porte do motor é protegido por **golden files**.
`npm run golden:rendafixa -- <pasta do RendaFixaDisparo>` (`scripts/gerar-golden-rendafixa.mjs`)
roda o motor ORIGINAL do RendaFixaDisparo (`processRows` + `montarTexto`), com o SheetJS original e
a leitura do app original, na data fixa 23/09/2026 12:00 (fuso de Brasília), nos dois mercados, e
grava em
`golden/` o texto e o `processRows` inteiro. `motor.golden.test.js` exige do motor novo o mesmo
texto, caractere por caractere, e o mesmo resultado.

- **As exportações reais da XP ficam em `src/modulos/rendafixa/fixtures/*.xlsx` e nunca vão para o
  git** — o repositório é público. Estão no `.gitignore`. Sem elas, os goldens delas são pulados.
- Nome curto: `produtos-renda-fixa-emissao-bancaria (2).xlsx` entra como `xp-2.xlsx`, e o golden
  sai `xp-2.primario.json`. Com o nome da XP, o caminho do golden passava de 260 caracteres numa
  pasta funda e o Git no Windows não conseguia fazer o checkout.
- `fixtures/sintetica.js` é uma planilha inventada, com as 34 colunas da XP e uma linha por regra do
  motor. O golden dela roda sempre, inclusive no repositório público.
- `xp-8` é a primeira exportação puxada pelo botão Exportar do Hub (22/10/2026).
- Os goldens das exportações reais estão versionados: são texto derivado (taxas e nomes de produto
  da prateleira da XP, o mesmo tipo de dado do exemplo do README original).
- Uma exportação nova em `fixtures/` sem golden reprova o teste: rode o gerador.
- Depois que o motor mudar **de propósito**, os goldens passam a ser editados à mão, com o
  antes/depois à vista na revisão — rodar o gerador de novo compararia com o motor antigo.
- Os testes rodam no fuso `America/Sao_Paulo` (`vite.config.js`): a XP entrega o vencimento à
  meia-noite local, e em UTC o prazo mudaria.

## Tela

Mesmo fluxo do original — planilha → mercado → funil → cartões ou mensagem → copiar e salvar — no
visual da Mesa. Na fusão saíram a aurora, o vidro, o holofote, a ondinha, o voo até o histórico e a
espera artificial da leitura. Ficaram o funil (com os motivos de descarte e as colunas usadas), as
variações do dia, o histórico e os atalhos (A, M, V, C, S, T, ?).

**Repaginada em 21/10/2026**, a pedido do usuário ("mais bonito, criativo, mais animações, e o que
for útil"):

- **As boas-vindas**: sem planilha, uma ilustração (a planilha que vira curva, desenhada uma vez) e
  os três passos. Arrastando um arquivo, um véu cobre a aba com o alvo no meio.
- **Os destaques**: no alto dos cartões, a maior taxa de cada categoria, grande, com o prazo, o tipo
  e a mini curva (nos isentos, a equivalência). Clicar leva à seção, que acende uma vez.
- **As seções**: o gráfico de taxa × prazo largo, com os prazos embaixo e a maior taxa escrita; a
  linha e o ponto dela se acendem juntos ao passar o mouse; embaixo de cada linha, a força da taxa
  na categoria; a maior taxa com um fio aceso e o número na cor da categoria; e um **Copiar** que
  leva só aquela categoria, com o mesmo texto da mensagem.
- **Os isentos** mostram a taxa equivalente num título com IR (com a alíquota pelos dias) e se ela
  rende mais que o CDB da mensagem no mesmo prazo, em verde.
- **O seletor de mercado** diz quantas oportunidades cada um tem: os dois são calculados juntos, ao
  ler a planilha, e trocar não relê nada.
- **A mensagem** num celular, com a conversa do WhatsApp, a hora e os dois vistos; ao lado, as linhas,
  os caracteres, as categorias e os botões de copiar uma só.
- **Os números contam até o valor** (700 ms) ao chegar: taxas dos destaques e o funil. O HTML já traz
  o valor final, e sem movimento (`prefers-reduced-motion`) ele só aparece.
- A barra do alto (visão, Salvar, Copiar) gruda abaixo do topo ao rolar; no celular, não.

Todo movimento roda uma vez, ao chegar; o único laço é o ícone que salta enquanto se arrasta um
arquivo. O `verificar` confere o Copiar de uma seção, o realce da linha no gráfico, o destaque que
leva à seção e a contagem de cada mercado.

## A imagem e o simulador (21/10/2026)

- **Baixar imagem** (tecla I): as oportunidades num PNG de 1080 px de largura, para anexar no
  WhatsApp — as categorias com a cor delas, o prazo, o tipo e a taxa como na mensagem, e o emissor
  no secundário. `imagem.js`: o layout é puro e testado; o desenho é um canvas. A imagem é sempre
  clara, nos dois temas: vai para o celular do cliente (as cores são as das pedras no tema claro,
  escritas no arquivo porque o canvas não lê os tokens). Sai só para a pasta de downloads.
- **Simular um pré-fixado**, embaixo dos cartões: o título (os pré e os isentos pré com vencimento) e
  o valor dão o bruto no vencimento, o rendimento, o IR pela tabela regressiva (isento: zero), o
  líquido e a taxa líquida ao ano. A conta é a do mercado para título pré — 252 dias úteis, contados
  com os feriados da B3 (`src/comum/diasUteis.js`) — e é uma estimativa, dita na tela: não entram
  IOF, custódia nem o PU do dia no secundário (`simulador.js`).
