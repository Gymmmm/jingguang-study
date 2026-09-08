import fs from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const source=await fs.readFile(new URL('api/egw-read.js',root),'utf8');
const moduleUrl=`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const {blocks,chapterLinks,splitLocator,title}=await import(moduleUrl);
const cases=[
  ['ages-desire.html','历代愿望',3],
  ['great-controversy.html','善恶之争',3],
  ['counsels-on-diet.html','论饮食',2]
];
let failed=0;

for(const [file,expectedTitle,minChapters] of cases){
  const html=await fs.readFile(new URL(`tests/fixtures/egw/${file}`,root),'utf8');
  const chapters=chapterLinks(html,'https://text.egwwritings.org/book/b1');
  const parsed=blocks(html).filter(x=>x.type==='paragraph');
  const actualTitle=title(html);
  if(!actualTitle.includes(expectedTitle)||chapters.length<minChapters||parsed.length<2||parsed.some(x=>!x.locator)){
    console.error(`${file}: parser regression`,{actualTitle,chapters:chapters.length,paragraphs:parsed.length});failed+=1;
  }
}

const locator=splitLocator('足够长的中文正文用于测试定位信息是否保留。 (FE. 272) {CSW 89.1}');
if(locator.locator!=='(FE. 272) {CSW 89.1}'){
  console.error('locator regression',locator);failed+=1;
}
if(failed)process.exit(1);
console.log(`EGW parser fixtures passed: ${cases.length}`);
