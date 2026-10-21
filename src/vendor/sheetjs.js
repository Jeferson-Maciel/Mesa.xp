import codigo from './xlsx.full.min.js?raw';

/**
 * O SheetJS só no primeiro uso (21/10/2026, "rápido e leve").
 *
 * São 938 KB — 41% do JS da Mesa — que toda carga compilava e executava, embora só sirvam quando
 * alguém escolhe uma planilha (a do Renda Fixa, a do secundário, a dos assessores). O arquivo único
 * não deixa usar `import()` dinâmico, então ele entra como texto e vira código aqui, na primeira
 * chamada; as seguintes devolvem a mesma biblioteca. O texto é o arquivo vendorizado, byte a byte
 * (`vendor.test.js` confere o hash).
 *
 * @returns {typeof import('./xlsx.full.min.js')}
 */
let biblioteca = null;
export const sheetjs = () => {
  if (!biblioteca) {
    const exportado = {};
    // O SheetJS se instala em `exports` quando ele existe (o mesmo caminho do CommonJS).
    new Function('exports', `${codigo}\n//# sourceURL=xlsx.full.min.js`)(exportado);
    biblioteca = exportado;
  }
  return biblioteca;
};
