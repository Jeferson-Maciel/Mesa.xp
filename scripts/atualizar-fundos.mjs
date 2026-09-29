/**
 * Regenera `src/modulos/ordens/core/validate/fundosXP.js` a partir da prateleira de fundos da XP.
 *
 * Diferente da lista da B3, esta não tem fonte pública para baixar: a prateleira de distribuição
 * é da XP e não é publicada como dado aberto. O caminho é copiar a listagem do portal e colar num
 * arquivo de texto.
 *
 * Uso:  node scripts/atualizar-fundos.mjs caminho/para/prateleira.txt
 *
 * O formato esperado é o que sai da cópia direta do portal: o nome do fundo numa linha, alguns
 * campos abaixo, e a linha `Comprar` ou `Avise-me` fechando cada fundo.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const entrada = process.argv[2];
if (!entrada) {
  console.error('Informe o arquivo com a listagem copiada do portal.');
  console.error('Uso: node scripts/atualizar-fundos.mjs prateleira.txt');
  process.exit(1);
}

const linhas = readFileSync(entrada, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

const blocos = [];
let atual = [];
for (const linha of linhas) {
  atual.push(linha);
  if (linha === 'Comprar' || linha === 'Avise-me') {
    blocos.push(atual);
    atual = [];
  }
}

/** `RZDS11 - Riza Domus FII` — alguns fundos da prateleira também são negociados em bolsa. */
const TICKER_NO_NOME = /^([A-Z]{4}\d{0,2})\s*[–-]\s*(.+)$/;

const registros = blocos.map((bloco) => {
  const encontrado = bloco[0].match(TICKER_NO_NOME);
  const iPreco = bloco.findIndex((l) => /^R\$\s/.test(l));

  return {
    nome: encontrado ? encontrado[2].trim() : bloco[0],
    ticker: encontrado ? encontrado[1] : null,
    qtdMinima: iPreco > 0 ? bloco[iPreco - 1] : null
  };
});

const semQtd = registros.filter((r) => !r.qtdMinima);
if (semQtd.length > 0) {
  console.error('Não achei a quantidade mínima destes, o formato pode ter mudado:');
  for (const r of semQtd) console.error('  ' + r.nome);
  process.exit(1);
}

if (registros.length < 20) {
  console.error(`Só ${registros.length} fundos — listagem suspeita, arquivo não reescrito.`);
  process.exit(1);
}

const corpo = registros
  .map(
    (r) =>
      `  { nome: ${JSON.stringify(r.nome)}, ticker: ${r.ticker ? JSON.stringify(r.ticker) : 'null'}, qtdMinima: ${JSON.stringify(r.qtdMinima)} }`
  )
  .join(',\n');

const hoje = new Date().toISOString().slice(0, 10);
const comTicker = registros.filter((r) => r.ticker).length;

const conteudo = `// GERADO a partir da prateleira de fundos da XP, capturada em ${hoje}.
// ${registros.length} fundos, ${comTicker} deles com ticker em bolsa.
//
// Guardamos só o que é estável: nome comercial, ticker e quantidade mínima. Preço unitário,
// quantidade disponível, deságio e rentabilidade mudam todo dia — embuti-los seria carregar
// dado vencido dentro de um sistema cuja regra é não inventar dado. A quantidade mínima entra
// como AVISO e nunca como bloqueio, justamente porque também pode mudar.
//
// Para atualizar: copie a lista do portal e rode \`npm run fundos:update -- arquivo.txt\`.

export const CAPTURADO_EM = '${hoje}';

export const FUNDOS_XP = [
${corpo}
];
`;

writeFileSync(new URL('../src/modulos/ordens/core/validate/fundosXP.js', import.meta.url), conteudo);
console.log(`${registros.length} fundos escritos (${comTicker} com ticker).`);
console.log('Rode `npm test` em seguida: os testes checam nomes reais contra a lista.');
