import fs from 'node:fs/promises';

const source = process.argv[2];
if (!source) throw new Error('Provide the downloaded official Chinese books page.');
const html = await fs.readFile(source, 'utf8');
const verifiedEditions = new Map(Object.entries({
  14540:['第1卷','1SMX'],14541:['第2卷','2SMX'],14542:['第3卷','3SMX'],
  14505:['第1卷','1SGS'],14506:['第2卷','2SGS'],14507:['第3卷','3SGS'],14508:['第4卷（上）','4aSGS'],14509:['第4卷（下）','4bSGS'],
  14606:['第1卷','1TTZ'],14607:['第2卷','2TTZ'],14559:['第3卷','3TTZ'],
  14549:['第1卷','1SPY'],14550:['第2卷','2SPY'],14551:['第3卷','3SPY'],14552:['第4卷','4SPY']
}));
const books = [];
const seen = new Set();
const pattern = /<h4 class="book-title"><a href="\/zh\/book\/(\d+)\.0">([^<]+)<\/a>/g;
for (const match of html.matchAll(pattern)) {
  if (seen.has(match[1])) continue;
  seen.add(match[1]);
  const edition=verifiedEditions.get(match[1]);
  books.push({
    id: Number(match[1]),
    title_cn: match[2].replaceAll('&amp;', '&').replaceAll('&#039;', "'").trim(),
    ...(edition?{volume_label:edition[0],book_code:edition[1]}:{}),
    read_url: `https://m.egwwritings.org/zh/book/${match[1]}.0`,
    toc_url: `https://m.egwwritings.org/zh/book/${match[1]}/toc`
  });
}
if (books.length < 20) throw new Error(`Only found ${books.length} books; refusing incomplete catalog.`);
await fs.writeFile(new URL('../data/egw-official-books.json', import.meta.url), `${JSON.stringify({schema_version:1,source_url:'https://m.egwwritings.org/zh/folders/1296',books},null,2)}\n`);
console.log(`Official Chinese EGW books: ${books.length}`);
