import './ui/base.css';
import './ui/componentes.css';
import './shell/casca.css';

import { iniciarCalendario } from './modulos/calendario/index.js';
import { iniciarOperacional } from './modulos/operacional/index.js';
import { iniciarOrdens } from './modulos/ordens/index.js';
import { iniciarRendaFixa } from './modulos/rendafixa/index.js';
import { ligarAbas } from './shell/abas.js';
import { esc } from './ui/html.js';
import { ligarBotaoDeTema } from './ui/tema.js';

/**
 * A casca: tema, abas e o início de cada ferramenta.
 *
 * Nenhuma regra de negócio mora aqui nem em `shell/` — cada ferramenta é um módulo em
 * `modulos/`, e a casca só decide qual está à vista.
 */

const falhar = (id, secao, erro) => {
  console.error(`Falha ao iniciar ${id}:`, erro);
  secao.innerHTML = `
    <div class="falha-modulo">
      <div class="alert alert-danger">Esta ferramenta não abriu: ${esc(erro?.message ?? erro)}. As outras abas seguem funcionando.</div>
    </div>`;
};

ligarBotaoDeTema(document.getElementById('btn-tema'));

// O Ordens inicia com a página, como sempre: é a aba padrão e não depende de rede.
iniciarOrdens(document.getElementById('modulo-ordens'));

ligarAbas({
  preguicosos: {
    rendafixa: iniciarRendaFixa,
    calendario: iniciarCalendario,
    operacional: iniciarOperacional
  },
  aoFalhar: falhar
});
