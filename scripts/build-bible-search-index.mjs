import fs from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await fs.readFile(new URL('data/bible-books.json',root),'utf8'));
const rows=[];

for(const [osis,full,short] of catalog.books||[]){
  const data=JSON.parse(await fs.readFile(new URL(`data/bible/${osis}.json`,root),'utf8'));
  for(const chapter of data.chapters||[]){
    for(const verse of chapter.verses||[]){
      rows.push([osis,full,short,chapter.chapter,verse.number,String(verse.text||'')]);
    }
  }
}

const output={version:1,translation:'cuvs',count:rows.length,verses:rows};
await fs.writeFile(new URL('data/bible-search.json',root),JSON.stringify(output));
console.log(`Bible search index: ${rows.length} verses`);
