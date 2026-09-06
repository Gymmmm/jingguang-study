(() => {
  let crossrefConfig = null;
  let crossrefTextPromise = null;

  function crossrefKey(ref) {
    if (!ref || !ref.from || ref.from !== ref.to) return null;
    return `${ref.osis}.${ref.chapter}.${ref.from}`;
  }

  function osisToChinese(refText) {
    const m = String(refText || '').match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-([1-3]?[A-Za-z]+)\.(\d+)\.(\d+))?$/);
    if (!m) return { label: refText, query: refText };
    const [, osis, chapter, verse, osis2, chapter2, verse2] = m;
    const book = bibleBooks.find(x => x[0] === osis);
    const name = book?.[2] || book?.[1] || osis;
    if (!osis2) return { label: `${name}${chapter}:${verse}`, query: `${name}${chapter}:${verse}` };
    const book2 = bibleBooks.find(x => x[0] === osis2);
    const name2 = book2?.[2] || book2?.[1] || osis2;
    const sameBook = osis === osis2;
    const sameChapter = sameBook && chapter === chapter2;
    const label = sameChapter ? `${name}${chapter}:${verse}-${verse2}` : `${name}${chapter}:${verse}-${name2}${chapter2}:${verse2}`;
    return { label, query: label };
  }

  async function getCrossrefConfig() {
    if (crossrefConfig) return crossrefConfig;
    const r = await fetch('./data/crossrefs-source.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(`crossref config ${r.status}`);
    crossrefConfig = await r.json();
    return crossrefConfig;
  }

  async function getCrossrefText() {
    if (!crossrefTextPromise) {
      crossrefTextPromise = getCrossrefConfig().then(async cfg => {
        const r = await fetch(cfg.runtime_url);
        if (!r.ok) throw new Error(`crossref dataset ${r.status}`);
        return r.text();
      });
    }
    return crossrefTextPromise;
  }

  async function findCrossrefs(ref, limit = 16) {
    const key = crossrefKey(ref);
    if (!key) return [];
    const text = await getCrossrefText();
    const hits = [];
    for (const line of text.split('\n')) {
      if (!line || line[0] === '#') continue;
      const parts = line.split('\t');
      if (parts.length < 2 || parts[0] !== key) continue;
      hits.push({ from: parts[0], to: parts[1], votes: Number(parts[2] || 0) });
    }
    return hits.sort((a, b) => b.votes - a.votes).slice(0, limit);
  }

  async function renderCrossrefs(q) {
    const ref = parseBibleRef(q);
    const box = document.getElementById('crossrefsBox');
    if (!box || !ref) return;
    box.innerHTML = '<div class="empty">正在加载串珠资料…首次使用会下载约 2MB 的开放数据。</div>';
    try {
      const hits = await findCrossrefs(ref);
      if (!hits.length) {
        box.innerHTML = '<div class="empty">这一节暂时没有找到串珠记录。</div>';
        return;
      }
      const cfg = await getCrossrefConfig();
      box.innerHTML = `<div class="card"><div class="meta">圣经串珠 · OpenBible / TSK</div><h3>相关经文 ${hits.length} 条</h3><div class="chips">${hits.map(h => {
        const x = osisToChinese(h.to);
        return `<button class="chip" onclick="window.jgStudyCrossref('${esc(x.query)}')">${esc(x.label)}${h.votes ? ` · ${h.votes}` : ''}</button>`;
      }).join('')}</div><p class="muted" style="margin-top:10px">${esc(cfg.attribution || '')}</p></div>`;
    } catch (e) {
      console.error(e);
      box.innerHTML = '<div class="empty">串珠资料读取失败；圣经正文和预言之灵检索不受影响。</div>';
    }
  }

  window.jgStudyCrossref = q => {
    const input = document.getElementById('studyQ');
    if (input) input.value = q;
    runStudy('studyQ');
  };
  window.jgLoadCrossrefs = q => renderCrossrefs(q);

  const originalRunStudy = runStudy;
  runStudy = async function(id) {
    await originalRunStudy(id);
    const q = document.getElementById(id)?.value?.trim() || '';
    const ref = parseBibleRef(q);
    if (!ref || !ref.from || ref.from !== ref.to) return;
    const host = document.getElementById('studyResult');
    if (!host) return;
    host.insertAdjacentHTML('beforeend', `<div class="section-head" style="margin-top:18px"><h2>圣经串珠</h2><span>约34万条开放交叉经文</span></div><div id="crossrefsBox"><div class="card"><p>需要时再加载，不影响首页速度。</p><div class="actions"><button onclick="window.jgLoadCrossrefs('${esc(q)}')">展开相关经文</button></div></div></div>`);
  };
})();
