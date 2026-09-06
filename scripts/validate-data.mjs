import fs from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await fs.readFile(new URL(path, ROOT), 'utf8'));

const egwDoc = await readJson('data/egw-index.json');
const relDoc = await readJson('data/bible-egw-relations.json');
const schemaDoc = await readJson('data/sermon-project-schema.json');

const errors = [];
const warnings = [];
const requiredEgwFields = ['id','author','title_cn','book_code','chapter','locator','language','source_type','source_url','bible_refs','topics','summary'];
const records = Array.isArray(egwDoc.records) ? egwDoc.records : [];
const relations = Array.isArray(relDoc.relations) ? relDoc.relations : [];

if (!records.length) errors.push('egw-index.json: records is empty or missing');
if (!relations.length) errors.push('bible-egw-relations.json: relations is empty or missing');
if (!schemaDoc?.project || !Array.isArray(schemaDoc?.source_hierarchy)) errors.push('sermon-project-schema.json: project/source_hierarchy missing');

const ids = new Set();
for (const [i, r] of records.entries()) {
  for (const f of requiredEgwFields) {
    const v = r?.[f];
    const emptyArray = Array.isArray(v) && v.length === 0;
    if (v === undefined || v === null || v === '' || emptyArray) errors.push(`egw record #${i + 1} (${r?.id || 'no-id'}): missing ${f}`);
  }
  if (r?.id) {
    if (ids.has(r.id)) errors.push(`duplicate EGW id: ${r.id}`);
    ids.add(r.id);
  }
  if (r?.language !== 'zh') warnings.push(`${r?.id}: language is ${r?.language}, expected zh for current Chinese index`);
  if (r?.source_url && !/^https:\/\/(m\.|text\.)?egwwritings\.org\//.test(r.source_url)) warnings.push(`${r?.id}: source_url is not an egwwritings.org URL`);
}

const relKeys = new Set();
for (const [i, r] of relations.entries()) {
  if (!r?.bible_ref) errors.push(`relation #${i + 1}: missing bible_ref`);
  const key = `${r?.bible_ref || ''}|${r?.normalized || ''}`;
  if (relKeys.has(key)) errors.push(`duplicate relation: ${key}`);
  relKeys.add(key);
  if (!Array.isArray(r?.themes) || !r.themes.length) warnings.push(`${r?.bible_ref}: themes empty`);
  if (!Array.isArray(r?.related_bible)) warnings.push(`${r?.bible_ref}: related_bible missing`);
  if (!Array.isArray(r?.egw_ids) || !r.egw_ids.length) warnings.push(`${r?.bible_ref}: egw_ids empty`);
  for (const id of r?.egw_ids || []) if (!ids.has(id)) errors.push(`${r?.bible_ref}: references missing EGW id ${id}`);
}

const expectedHierarchy = ['bible','egw','note','ai'];
const hierarchy = schemaDoc?.source_hierarchy || [];
for (let i = 0; i < expectedHierarchy.length; i++) {
  if (hierarchy[i]?.type !== expectedHierarchy[i]) errors.push(`source_hierarchy level ${i + 1}: expected ${expectedHierarchy[i]}`);
}

const project = schemaDoc?.project || {};
for (const f of ['id','title','status','audience','duration_minutes','core_bible_refs','materials','outline','application','appeal','research_notes','created_at','updated_at']) {
  if (!(f in project)) errors.push(`sermon project schema missing field: ${f}`);
}

console.log(`EGW records: ${records.length}`);
console.log(`Bible→EGW relations: ${relations.length}`);
console.log(`Warnings: ${warnings.length}`);
for (const w of warnings) console.warn(`WARN: ${w}`);

if (errors.length) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}

console.log('Data integrity check passed.');
