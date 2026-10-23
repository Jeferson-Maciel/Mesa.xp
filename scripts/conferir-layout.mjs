import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const distNormal = join(raiz, 'dist/index.html');
const outputPath = 'C:/Users/chica/.gemini/antigravity-ide/brain/1e6a9c70-c884-43de-8288-e9037b62d7ff/conferencia_ordens.png';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(pathToFileURL(distNormal).href);
  await page.waitForLoadState('networkidle');

  const texto = `1234567
via email

V KLBN11 674qtds
C VULC3 R$ 11.800,00

Vendas | Quantidade Total
PAAG11 - Pátria Crédito Agrícola FiAgro
BGR Galpões Logistic
AZ Quest Panorama Da R$ 50.000,00
IMOV11 R$ 52.832,35
Brio Renda Mais FII R$ 52.000,00`;

  await page.fill('#modulo-ordens textarea', texto);
  await page.click('#btn-analisar');

  await page.waitForSelector('table.preview tbody tr');
  await page.waitForTimeout(300);

  const containerInfo = await page.evaluate(() => {
    const tableContainer = document.querySelector('.table-container');
    const cols = Array.from(document.querySelectorAll('.col-ativo .linha-campos'));
    const wraps = cols.map(c => {
      const children = Array.from(c.children);
      if (children.length <= 1) return false;
      const top0 = children[0].getBoundingClientRect().top;
      const top1 = children[1].getBoundingClientRect().top;
      return Math.abs(top0 - top1) > 5;
    });

    return {
      scrollWidth: tableContainer.scrollWidth,
      clientWidth: tableContainer.clientWidth,
      temRolagemHorizontal: tableContainer.scrollWidth > tableContainer.clientWidth,
      algumaCapsulaQuebrou: wraps.some(w => w)
    };
  });

  console.log('Diagnóstico do container:', JSON.stringify(containerInfo, null, 2));

  await page.screenshot({ path: outputPath, fullPage: false });
  console.log('Screenshot salvo em:', outputPath);

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
