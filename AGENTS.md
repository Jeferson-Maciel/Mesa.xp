# AGENTS.md — Mesa XP

As ferramentas da mesa de operações de um escritório credenciado à XP, num link só e em cinco
abas: **Ordens**, **Renda Fixa**, **Calendário**, **Operacional** e **Anotações**. É JS puro com
Vite, e o build gera **um arquivo só** (`dist/index.html`), que roda no Netlify e aberto do disco.

Este arquivo é o resumo para qualquer agente (Claude, Codex, Antigravity…).

## Leia antes de mexer

1. [`CLAUDE.md`](CLAUDE.md) — **a fonte da verdade**: regras de negócio, arquitetura, armadilhas e
   verificação. Em caso de conflito, vale ele.
2. [`docs/CONTEXTO.md`](docs/CONTEXTO.md) — **onde paramos**: o que funciona, o que foi testado no
   Hub de verdade, o que está no ar e o que falta.
3. [`docs/FORMATOS-DE-SAIDA.md`](docs/FORMATOS-DE-SAIDA.md) — os literais das saídas do Ordens.
   Leia antes de tocar num formatador.
4. [`docs/ROADMAP.md`](docs/ROADMAP.md) — defeitos conhecidos e sugestões. Ideia nova vai para lá,
   não direto para o código.

## Comandos

```bash
npm install
npm test            # Vitest — 948 testes
npm run build       # dist/index.html, um arquivo só
npm run verificar   # Playwright: abre o dist/ e confere as cinco abas e o robô do Hub
npm run verificar:supabase   # grava no banco da mesa — só fora do expediente e com o OK do usuário
```

Requer Node 22+. **Pronto só depois de `npm test`, `npm run build` e `npm run verificar` passarem.**

## Regras que não se negociam

- **Nada é adivinhado.** No Ordens, faltou dado ou houve ambiguidade, a saída é bloqueada e o que
  falta fica à vista. Quantidade e financeiro nunca trocam de lugar. A única exceção é a compra de
  fundo no secundário, convertida pela conta da boleta. As 11 invariantes estão no `CLAUDE.md`.
- **Test-first.** O caso de negócio vira teste antes do código. Pedido real colado pela mesa vira
  teste antes da correção.
- **Arquivo único.** Nada de CDN, `import()` dinâmico, `fetch` de arquivo local nem service worker:
  o build falha se sobrar arquivo.
- **CSS:** sempre pelos tokens (`--fundo`, `--acento`…), nunca por cor literal. Cada módulo fica no
  escopo dele (`.rf`, `.cal`, `.op`, `:where(#modulo-ordens)`).
- **Datas** pela chave local `YYYY-MM-DD`, nunca `toISOString()`.
- **Texto do usuário ou do banco vai para `innerHTML` só por `esc`.**
- **Dados reais da XP** — planilhas, capturas do Hub, contas de cliente — **nunca vão para o git**:
  o repositório é público. Nos testes, use contas fictícias (`1234567`).
- **O robô do Hub** (`src/modulos/ordens/platform/robo-hub.user.js`, Tampermonkey):
  - não lê token, senha nem cabeçalho;
  - não chama a API do Hub por conta própria: só escuta o `fetch` (e, na aba de clientes, o XHR) do
    próprio app e troca a rota das abas dele;
  - nunca passa da etapa 1 da boleta;
  - nunca põe parâmetro no endereço do Hub, porque isso o trava;
  - da ficha do cliente só traz nome, e-mail e assessor, e nada do cliente fica guardado: nem no
    Tampermonkey depois da busca, nem na Mesa fora da memória da página.

  Mudou o comportamento dele, suba a `@version`: a Mesa compara a versão e pede a cópia nova.
- **Commit, push, deploy e SQL no banco só com o OK do usuário.**
- **Em português:** nomes de domínio (`conta`, `quantidade`, `financeiro`), textos de interface e
  comentários. Termos técnicos ficam em inglês (`parse`, `format`).

## Onde fica cada coisa

```
src/main.js, src/shell/     a casca: abas por hash (#ordens…), atalhos Alt+1 a Alt+5
src/ui/                     tema, tokens, componentes e avisos compartilhados
src/modulos/ordens/         core/ (parse, validate, secundario, cliente, format), ui/, platform/ (robô, favorito)
src/modulos/rendafixa/      motor.js + goldens contra o motor original
src/modulos/calendario/     repositório com adaptadores Supabase e local
src/modulos/operacional/    a base do Slab: repositório, semente, SQL gerado
src/modulos/anotacoes/      IndexedDB, lembretes, backup
supabase/                   schema.sql (Calendário) e operacional.sql (gerado)
scripts/                    atualizar tickers e fundos, goldens, verificar no navegador
```

A branch `antigravity/operacional` é de outro agente e não foi revisada: não a misture com `main`.
