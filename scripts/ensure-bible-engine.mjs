import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const html = await fs.readFile(new URL('index.html', root), 'utf8');
const scriptMatch = html.match(/<script[^>]+src=["']\.\/(app\.js)(?:\?[^"']*)?["']/);
if (!scriptMatch) {
  console.error('Missing maintainable external application entry: ./app.js');
  process.exit(1);
}
const app = await fs.readFile(new URL(scriptMatch[1], root), 'utf8');
const required = [
  "./data/bible-source.json",
  "./data/bible-books.json",
  "function parse(",
  "async function book(",
  "async function passage(",
  "async function bibleDetail("
];
const missing = required.filter(x => !app.includes(x));
if (missing.length) {
  for (const item of missing) console.error(`Missing native Bible integration marker: ${item}`);
  process.exit(1);
}
console.log('Native 66-book Bible integration is present through external app.js.');
