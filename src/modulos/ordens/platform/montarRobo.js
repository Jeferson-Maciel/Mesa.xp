/**
 * O robô do Hub como o Tampermonkey o recebe — o mesmo no "Copiar robô" da Mesa e no arquivo que o
 * site publica (`robo-hub.user.js`, robô 1.13.0), por onde cada máquina instala e se atualiza.
 *
 * Fica num arquivo sem dependência nenhuma porque o build (vite.config.js) também o usa.
 */

/** O endereço do robô no site: o Tampermonkey instala por ele, e busca nele a versão nova. */
export const ENDERECO_DO_ROBO = 'https://mesa-xp.vercel.app/robo-hub.user.js';

/**
 * O robô com a SnapDOM 3.2.0 (`src/vendor/snapdom.js`) no marcador do print. A troca é feita por uma
 * função, e não por um texto, para que um cifrão do código da biblioteca não seja lido como padrão de
 * substituição.
 *
 * @param {string} fonte    o robô, como está no repositório
 * @param {string} snapdom  a biblioteca do print
 */
export const montarRobo = (fonte, snapdom) => fonte.replace('/*@@SNAPDOM@@*/', () => snapdom);
