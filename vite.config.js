import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * O build sai num `index.html` só, com JS, CSS e ícone dentro dele.
 *
 * A ferramenta é usada offline, aberta com dois cliques. Nesse modo (`file://`) o navegador
 * bloqueia `<script type="module" src>` e lê `/assets/...` como a raiz do drive: a tela aparece
 * pintada e nada funciona. Um script embutido não é buscado em lugar nenhum, então roda.
 *
 * O plugin falha o build em vez de deixar um arquivo para trás: um `import()` dinâmico criaria um
 * segundo pedaço de JS, e o `index.html` sairia dependendo dele sem ninguém perceber.
 */
const arquivoUnico = () => {
  let pastaPublica;

  return {
    name: 'arquivo-unico',
    apply: 'build',
    enforce: 'post',

    configResolved(config) {
      pastaPublica = config.publicDir;
    },

    generateBundle(_, bundle) {
      const pagina = bundle['index.html'];
      let html = String(pagina.source);

      const embutidos = new Set();

      // A substituição usa função, não texto: um `$&` no código minificado seria lido como
      // padrão de substituição e corromperia o script.
      const embutir = (padrao, conteudo, nome) => {
        const antes = html;
        html = html.replace(padrao, () => conteudo);
        if (html === antes) this.error(`${nome} não está referenciado no index.html`);
        embutidos.add(nome);
        delete bundle[nome];
      };

      for (const [nome, saida] of Object.entries(bundle)) {
        const caminho = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        if (saida.type === 'chunk') {
          // `<\/script` é o mesmo texto para o JS, mas não fecha a tag para o HTML.
          const codigo = saida.code.replace(/<\/script/gi, '<\\/script');
          embutir(
            new RegExp(`<script[^>]*src="[^"]*${caminho}"[^>]*></script>`),
            `<script type="module">${codigo}</script>`,
            nome
          );
        } else if (nome.endsWith('.css')) {
          const estilo = String(saida.source);
          if (/<\/style/i.test(estilo)) this.error(`${nome} contém </style>`);
          embutir(new RegExp(`<link[^>]*href="[^"]*${caminho}"[^>]*>`), `<style>${estilo}</style>`, nome);
        }
      }

      const icone = readFileSync(resolve(pastaPublica, 'favicon.svg'), 'utf8');
      html = html.replace(
        /(<link rel="icon"[^>]*href=")[^"]*"/,
        (_, inicio) => `${inicio}data:image/svg+xml,${encodeURIComponent(icone)}"`
      );

      // Conta pelo que foi embutido, não pelo bundle: o Rolldown só aplica o `delete` depois que o
      // hook termina, e até lá o arquivo apagado continua listado.
      const sobras = Object.keys(bundle).filter((nome) => nome !== 'index.html' && !embutidos.has(nome));
      if (sobras.length > 0) this.error(`o build deixou arquivos fora do index.html: ${sobras.join(', ')}`);

      pagina.source = html;
    }
  };
};

export default defineConfig({
  base: './',
  plugins: [arquivoUnico()],
  build: {
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    copyPublicDir: false
  }
});
