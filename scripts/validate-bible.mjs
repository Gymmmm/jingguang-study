import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const bible = JSON.parse(await fs.readFile(new URL('data/bible-cuv-simplified.json', root), 'utf8'));
const source = JSON.parse(await fs.readFile(new URL('data/bible-source.json', root), 'utf8'));
const errors = [];

if (source.license !== 'Public Domain') errors.push('Bible source license must be Public Domain');
if (!Array.isArray(bible.books) || bible.books.length !== 66) errors.push(`Expected 66 books, got ${bible.books?.length ?? 0}`);

let chapters = 0;
let verses = 0;
const ids = new Set();
for (const book of bible.books || []) {
  if (!book.id || !book.name || !Array.isArray(book.chapters)) errors.push(`Invalid book record: ${book?.id || 'unknown'}`);
  if (ids.has(book.id)) errors.push(`Duplicate book id: ${book.id}`);
  ids.add(book.id);
  chapters += book.chapters.length;
  for (const chapter of book.chapters) {
    if (!Number.isInteger(chapter.number) || chapter.number < 1) errors.push(`${book.id}: invalid chapter number`);
    if (!Array.isArray(chapter.verses) || !chapter.verses.length) errors.push(`${book.id} ${chapter.number}: no verses`);
    for (const verse of chapter.verses || []) {
      if (!Number.isInteger(verse.number) || verse.number < 1 || !String(verse.text || '').trim()) errors.push(`${book.id} ${chapter.number}:${verse.number}: invalid verse`);
      verses += 1;
    }
  }
}

if (chapters < 1180) errors.push(`Chapter count suspiciously low: ${chapters}`);
if (verses < 31000) errors.push(`Verse count suspiciously low: ${verses}`);

console.log(`Bible books: ${bible.books?.length || 0}`);
console.log(`Bible chapters: ${chapters}`);
console.log(`Bible verses: ${verses}`);
if (errors.length) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}
console.log('Bible dataset validation passed.');
