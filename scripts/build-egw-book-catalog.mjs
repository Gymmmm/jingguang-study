import fs from 'node:fs/promises';

const source = process.argv[2];
if (!source) throw new Error('Provide the downloaded official Chinese books page.');
const html = await fs.readFile(source, 'utf8');
const books = [];
const seen = new Set();
const pattern = /<h4 class="book-title"><a href="\/zh\/book\/(\d+)\.0">([^<]+)<\/a>/g;
for (const match of html.matchAll(pattern)) {
  if (seen.has(match[1])) continue;
  seen.add(match[1]);
  books.push({
    id: Number(match[1]),
    title_cn: match[2].replaceAll('&amp;', '&').replaceAll('&#039;', "'").trim(),
    read_url: `https://m.egwwritings.org/zh/book/${match[1]}.0`,
    toc_url: `https://m.egwwritings.org/zh/book/${match[1]}/toc`
  });
}
if (books.length < 20) throw new Error(`Only found ${books.length} books; refusing incomplete catalog.`);
await fs.writeFile(new URL('../data/egw-official-books.json', import.meta.url), `${JSON.stringify({schema_version:1,source_url:'https://m.egwwritings.org/zh/folders/1296',books},null,2)}\n`);
console.log(`Official Chinese EGW books: ${books.length}`);
