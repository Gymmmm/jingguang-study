import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const file = new URL('index.html', root);
let html = await fs.readFile(file, 'utf8');
const hook = '<script src="./bible-engine.js"></script>';

if (!html.includes(hook)) {
  if (!html.includes('</body>')) throw new Error('index.html has no </body> marker');
  html = html.replace('</body>', `${hook}</body>`);
  await fs.writeFile(file, html);
  console.log('Installed bible-engine.js hook into index.html');
} else {
  console.log('Bible engine hook already present');
}
