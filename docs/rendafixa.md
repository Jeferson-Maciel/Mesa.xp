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
- **Toda regra de negócio fica em `motor.js`** (funções puras, sem DOM). `index.js` só apresenta.
- **A planilha nunca sai do navegador.** Esse sigilo é a promessa do produto; um teste confere que
  nenhum arquivo do módulo faz chamada de rede.
- Texto vindo da planilha ou do histórico que vai para `innerHTML` passa por `esc` (ou
  `mensagemEmHTML`, para o negrito do WhatsApp).
- Registros antigos do histórico (`rendafixa_history`, até 20) não têm `modo`, `arquivo` nem
  `itens`. Leia esses campos com reserva.

## Mapa

- `motor.js` — portado do RendaFixaDisparo sem mudar uma regra: o corpo é o mesmo, só o
  `module.exports` virou `export`. `processRows(rows, secundario, hoje)` devolve
  `{ totais, descartes, bloqueados, colunas, secoes }`; `montarTexto(resultado)` gera a mensagem, ou
  `''` sem oportunidade.
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
- Os goldens das exportações reais estão versionados: são texto derivado (taxas e nomes de produto
  da prateleira da XP, o mesmo tipo de dado do exemplo do README original).
- Uma exportação nova em `fixtures/` sem golden reprova o teste: rode o gerador.
- Depois que o motor mudar **de propósito**, os goldens passam a ser editados à mão, com o
  antes/depois à vista na revisão — rodar o gerador de novo compararia com o motor antigo.
- Os testes rodam no fuso `America/Sao_Paulo` (`vite.config.js`): a XP entrega o vencimento à
  meia-noite local, e em UTC o prazo mudaria.

## Tela

Mesmo fluxo do original — planilha → mercado → funil → cartões ou mensagem → copiar e salvar — no
visual do Ordens. Saíram a aurora, o vidro, a contagem animada, o holofote, a ondinha, o voo até o
histórico e a espera artificial da leitura. Ficaram o funil (com os motivos de descarte e as
colunas usadas), as variações do dia, a prévia da mensagem com o negrito, o histórico e os atalhos
(A, M, V, C, S, T, ?).
