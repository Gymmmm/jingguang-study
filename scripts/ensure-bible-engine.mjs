import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const html = await fs.readFile(new URL('index.html', root), 'utf8');
const required = [
  "./data/bible-source.json",
  "./data/bible-books.json",
  "function parseBibleRef",
  "async function loadBibleBook",
  "async function biblePassage",
  "async function openBible"
];
const missing = required.filter(x => !html.includes(x));
if (missing.length) {
  for (const item of missing) console.error(`Missing native Bible integration marker: ${item}`);
  process.exit(1);
}
console.log('Native 66-book Bible integration is present in index.html.');
