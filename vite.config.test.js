import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * O sistema é usado offline, aberto com dois cliques (`file://`). Nesse modo o navegador bloqueia
 * `<script type="module" src>` e lê `/assets/...` como a raiz do drive — a tela aparece e nada
 * funciona. Por isso o build tem que sair num `index.html` só, sem apontar para arquivo nenhum.
 */

const raiz = fileURLToPath(new URL('.', import.meta.url));

let saidas;
let html;

beforeAll(async () => {
  const resultado = await build({
    root: raiz,
    configFile: fileURLToPath(new URL('./vite.config.js', import.meta.url)),
    logLevel: 'silent',
    build: { write: false }
  });
  saidas = (Array.isArray(resultado) ? resultado[0] : resultado).output;
  html = saidas.find((s) => s.fileName === 'index.html').source;
}, 60_000);

describe('build de arquivo único', () => {
  it('não gera JS nem CSS à parte: tudo mora no index.html', () => {
    expect(saidas.map((s) => s.fileName)).toEqual(['index.html']);
  });

  // Só a marcação: o JS embutido tem strings com `href="` (o SheetJS escreve HTML de planilha).
  it('não aponta para arquivo nenhum', () => {
    const marcacao = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '<script></script>')
      .replace(/<style>[\s\S]*?<\/style>/g, '<style></style>');
    expect(marcacao).not.toMatch(/<script[^>]*\ssrc=/);
    expect(marcacao).not.toMatch(/<link[^>]*rel="stylesheet"/);
    expect(marcacao).not.toMatch(/(?:src|href)="(?!data:)[^"#]/);
  });

  // Um import() dinâmico que sobrasse no código tentaria buscar um arquivo que não existe.
  it('não deixa import() dinâmico no código', () => {
    const [, codigo] = html.match(/<script type="module">([\s\S]*?)<\/script>/);
    expect(codigo).not.toMatch(/import\s*\(/);
  });

  it('embute o script e o estilo', () => {
    expect(html).toMatch(/<script type="module">/);
    expect(html).toMatch(/<style>/);
    expect(html).toContain('<title>Mesa XP</title>');
  });

  it('embute o ícone da aba', () => {
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,/);
  });

  // Um `</script>` dentro do código fecharia a tag no meio do bundle.
  it('não deixa o código fechar a própria tag', () => {
    const [, codigo] = html.match(/<script type="module">([\s\S]*?)<\/script>/);
    expect(codigo).not.toMatch(/<\/script/i);
    expect(codigo.length).toBeGreaterThan(1_000);
  });

  // Um literal de cada parte, que sobrevive à minificação: se algum módulo ficasse fora do
  // arquivo, a aba dele abriria vazia.
  it('embute a casca e as três ferramentas', () => {
    const [, codigo] = html.match(/<script type="module">([\s\S]*?)<\/script>/);
    expect(codigo).toContain('Esta ferramenta não abriu');
    expect(codigo).toContain('A mercado');
    expect(codigo).toContain('Oportunidades de RENDA FIXA hoje!');
    expect(codigo).toContain('0.20.1');
  });
});
