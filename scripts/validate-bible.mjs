import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const source = JSON.parse(await fs.readFile(new URL('data/bible-source.json', root), 'utf8'));
const bookDoc = JSON.parse(await fs.readFile(new URL('data/bible-books.json', root), 'utf8'));
const errors = [];
const books = Array.isArray(bookDoc.books) ? bookDoc.books : [];
const translation = source?.translations?.[source?.default_translation || 'cuvs'];

if (books.length !== 66) errors.push(`Expected 66 canonical books, got ${books.length}`);
if (!translation) errors.push('Default Bible translation missing');
if (translation?.license !== 'public-domain') errors.push(`Expected public-domain license, got ${translation?.license}`);
if (translation?.base_url !== './data/bible/') errors.push(`Bible base_url must use the local mirror, got ${translation?.base_url}`);

const ids = new Set();
for (const rec of books) {
  const [id,name,short] = rec;
  if (!id || !name || !short) errors.push(`Invalid book map row: ${JSON.stringify(rec)}`);
  if (ids.has(id)) errors.push(`Duplicate book id: ${id}`);
  ids.add(id);
}

if (!errors.length) {
  let totalChapters = 0;
  let totalVerses = 0;
  for (const [id] of books) {
    let data;
    try { data=JSON.parse(await fs.readFile(new URL(`${translation.base_url}${id}.json`,root),'utf8')); }
    catch (e) { errors.push(`${id}: local source unavailable`); continue; }
    if (data.book !== id || !Array.isArray(data.chapters) || !data.chapters.length) {
      errors.push(`${id}: malformed book JSON`); continue;
    }
    totalChapters += data.chapters.length;
    for (const ch of data.chapters) {
      if (!Array.isArray(ch.verses) || !ch.verses.length) errors.push(`${id} ${ch.chapter}: empty verses`);
      for (const v of ch.verses || []) {
        if (!Number.isInteger(v.number) || !String(v.text || '').trim()) errors.push(`${id} ${ch.chapter}:${v.number}: invalid verse`);
        totalVerses += 1;
      }
    }
  }
  if (totalChapters < 1180) errors.push(`Chapter count suspiciously low: ${totalChapters}`);
  if (totalVerses < 31000) errors.push(`Verse count suspiciously low: ${totalVerses}`);
  console.log(`Local Bible chapters: ${totalChapters}`);
  console.log(`Local Bible verses: ${totalVerses}`);
  try {
    const search=JSON.parse(await fs.readFile(new URL(translation.search_index,root),'utf8'));
    if(search.translation!=='cuvs'||search.count!==totalVerses||search.verses?.length!==totalVerses)errors.push('Bible search index is missing or stale; run node scripts/build-bible-search-index.mjs');
  } catch (e) {
    errors.push('Bible search index unavailable; run node scripts/build-bible-search-index.mjs');
  }
}

console.log(`Canonical Bible books: ${books.length}`);
if (errors.length) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}
console.log('Bible source validation passed.');
