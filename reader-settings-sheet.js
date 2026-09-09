(() => {
  'use strict';

  const detail = document.getElementById('detail');
  if (!detail) return;

  const readable = () => ['bible-reader', 'egw-reader'].includes(detail.dataset.readerKind || '');
  const q = (sel, root = detail) => root.querySelector(sel);

  function ttsMain() { return q('.readAloudBar [data-tts="toggle"]'); }
  function ttsRate() { return q('.readAloudBar [data-tts="rate"]'); }
  function quick(direction) { return q(`[data-reader-quick="${direction}"]`); }

  function ensureTrigger() {
    const tools = q('.fontTools');
    if (!tools) return null;
    let btn = tools.querySelector('[data-reader-settings-open]');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'readerSettingsTrigger';
    btn.dataset.readerSettingsOpen = '1';
    btn.setAttribute('aria-label', '阅读设置');
    btn.textContent = 'Aa';
    tools.prepend(btn);
    return btn;
  }

  function ensureSheet() {
    let backdrop = q('#readerSettingsBackdrop');
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'readerSettingsBackdrop';
    backdrop.className = 'readerSettingsBackdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="readerSettingsSheet" role="dialog" aria-modal="true" aria-label="阅读设置">
        <div class="readerSettingsHandle" aria-hidden="true"></div>
        <header class="readerSettingsHead"><h2>阅读设置</h2><button type="button" data-reader-settings-close aria-label="关闭">×</button></header>

        <div class="readerSettingsGroup">
          <h3>字号</h3>
          <div class="readerFontControl">
            <button type="button" data-reader-font-proxy="-1" aria-label="减小字号">A−</button>
            <span>阅读字号</span>
            <button type="button" data-reader-font-proxy="1" aria-label="加大字号">A+</button>
          </div>
        </div>

        <div class="readerSettingsGroup">
          <h3>朗读</h3>
          <div class="readerAudioControl">
            <button type="button" data-reader-audio-skip="back" disabled aria-label="向前十五秒">↶<small>15</small></button>
            <button type="button" class="readerSheetPlay" data-reader-sheet-tts><span>▶</span><small>朗读</small></button>
            <button type="button" data-reader-audio-skip="forward" disabled aria-label="向后十五秒">↷<small>15</small></button>
          </div>
          <div class="readerRateRow" aria-label="朗读速度">
            ${[0.8,1,1.2,1.5,2].map(v => `<button type="button" data-reader-rate="${v}">${v}×</button>`).join('')}
          </div>
        </div>

        <div class="readerSettingsGroup">
          <h3>阅读导航</h3>
          <div class="readerChapterControl">
            <button type="button" data-reader-sheet-nav="prev">‹ 上一章</button>
            <button type="button" data-reader-sheet-nav="next">下一章 ›</button>
          </div>
        </div>

        <div class="readerSettingsGroup">
          <h3>主题</h3>
          <div class="readerThemeRow">
            <button type="button" data-reader-theme="paper">跟随系统</button>
            <button type="button" data-reader-theme="sepia">浅色</button>
            <button type="button" data-reader-theme="green">护眼</button>
            <button type="button" data-reader-theme="dark">深色</button>
          </div>
        </div>
      </section>`;
    detail.appendChild(backdrop);
    return backdrop;
  }

  function currentRate() {
    const text = String(ttsRate()?.textContent || '1×').replace('×','');
    const value = Number(text);
    return Number.isFinite(value) ? value : 1;
  }

  function sync() {
    const trigger = ensureTrigger();
    const sheet = ensureSheet();
    const show = detail.open && readable();
    if (trigger) trigger.hidden = !show;
    if (!show) sheet.hidden = true;

    const source = ttsMain();
    const play = q('[data-reader-sheet-tts]', sheet);
    if (source && play) {
      const text = String(source.textContent || '朗读');
      const active = text.includes('暂停');
      const paused = text.includes('继续');
      q('span', play).textContent = active ? 'Ⅱ' : '▶';
      q('small', play).textContent = active ? '暂停' : (paused ? '继续' : '朗读');
    }

    const rate = currentRate();
    sheet.querySelectorAll('[data-reader-rate]').forEach(btn => {
      btn.classList.toggle('active', Math.abs(Number(btn.dataset.readerRate) - rate) < .01);
    });

    const prev = quick('prev');
    const next = quick('next');
    const prevProxy = q('[data-reader-sheet-nav="prev"]', sheet);
    const nextProxy = q('[data-reader-sheet-nav="next"]', sheet);
    if (prevProxy) prevProxy.disabled = !prev || prev.disabled || prev.hidden;
    if (nextProxy) nextProxy.disabled = !next || next.disabled || next.hidden;

    const theme = document.documentElement.dataset.theme || 'paper';
    sheet.querySelectorAll('[data-reader-theme]').forEach(btn => btn.classList.toggle('active', btn.dataset.readerTheme === theme));
  }

  function setRate(target) {
    const source = ttsRate();
    if (!source) return;
    const wanted = Number(target);
    for (let i = 0; i < 6; i += 1) {
      if (Math.abs(currentRate() - wanted) < .01) break;
      source.click();
    }
    sync();
  }

  detail.addEventListener('click', event => {
    const open = event.target.closest?.('[data-reader-settings-open]');
    if (open) {
      const sheet = ensureSheet();
      sheet.hidden = false;
      sync();
      return;
    }
    if (event.target.id === 'readerSettingsBackdrop' || event.target.closest?.('[data-reader-settings-close]')) {
      ensureSheet().hidden = true;
      return;
    }
    const font = event.target.closest?.('[data-reader-font-proxy]');
    if (font) {
      q(`[data-font="${font.dataset.readerFontProxy}"]`)?.click();
      return;
    }
    if (event.target.closest?.('[data-reader-sheet-tts]')) {
      ttsMain()?.click();
      sync();
      return;
    }
    const rate = event.target.closest?.('[data-reader-rate]');
    if (rate) {
      setRate(rate.dataset.readerRate);
      return;
    }
    const nav = event.target.closest?.('[data-reader-sheet-nav]');
    if (nav) {
      const target = quick(nav.dataset.readerSheetNav);
      if (target && !target.disabled && !target.hidden) {
        ensureSheet().hidden = true;
        target.click();
      }
      return;
    }
    const theme = event.target.closest?.('[data-reader-theme]');
    if (theme) {
      const select = document.getElementById('themeSelect');
      if (select) {
        select.value = theme.dataset.readerTheme;
        select.dispatchEvent(new Event('change', { bubbles:true }));
      }
      sync();
    }
  });

  detail.addEventListener('close', () => { ensureSheet().hidden = true; });

  const previousRefresh = window.jgRefreshReadAloud;
  if (typeof previousRefresh === 'function' && !previousRefresh.__jgSettingsWrapped) {
    const wrapped = function (...args) {
      const out = previousRefresh.apply(this, args);
      queueMicrotask(sync);
      return out;
    };
    wrapped.__jgSettingsWrapped = true;
    window.jgRefreshReadAloud = wrapped;
  }

  const style = document.createElement('style');
  style.textContent = `
    .fontTools>[data-font]{display:none!important}
    .readerSettingsTrigger[hidden]{display:none!important}
    .readerSettingsBackdrop[hidden]{display:none!important}
    .readerSettingsBackdrop{position:fixed;inset:0;z-index:80;display:flex;align-items:flex-end;background:rgba(22,24,22,.34)}
    .readerSettingsSheet{width:min(720px,100%);max-height:82%;margin:0 auto;padding:9px 18px calc(24px + env(safe-area-inset-bottom));overflow:auto;border-radius:22px 22px 0 0;background:var(--surface);color:var(--text);box-shadow:0 -20px 55px rgba(20,24,21,.14)}
    .readerSettingsHandle{width:38px;height:4px;margin:0 auto 12px;border-radius:99px;background:var(--line)}
    .readerSettingsHead{position:static!important;display:flex!important;align-items:center!important;justify-content:space-between!important;padding:0 0 12px!important;border:0!important;background:transparent!important}
    .readerSettingsHead h2{margin:0;font-size:19px}.readerSettingsHead button{width:44px;min-width:44px!important;border:0!important;background:transparent!important;color:var(--text)!important;font-size:28px!important;font-weight:300!important}
    .readerSettingsGroup{padding:12px 0;border-top:1px solid var(--line)}.readerSettingsGroup:first-of-type{border-top:0}
    .readerSettingsGroup h3{margin:0 0 10px;font-size:14px}
    .readerFontControl{display:grid;grid-template-columns:58px 1fr 58px;align-items:center;min-height:58px;border:1px solid var(--line);border-radius:12px;background:var(--soft)}
    .readerFontControl span{text-align:center;color:var(--muted);font-size:12px}.readerFontControl button{border:0!important;background:transparent!important;color:var(--text)!important;font-size:19px!important}
    .readerAudioControl{display:grid;grid-template-columns:1fr 70px 1fr;align-items:center;margin:2px 0 12px}.readerAudioControl button{border:0!important;background:transparent!important;color:var(--text)!important}.readerAudioControl button:disabled{opacity:.28}.readerAudioControl button>small{font-size:9px}
    .readerSheetPlay{width:62px;height:62px;min-height:62px!important;justify-self:center;border-radius:50%!important;background:var(--accent)!important;color:var(--surface)!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}.readerSheetPlay>span{font-size:20px;font-weight:800}.readerSheetPlay>small{font-size:9px!important}
    .readerRateRow{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.readerRateRow button,.readerThemeRow button,.readerChapterControl button{min-height:44px!important;border:1px solid var(--line)!important;border-radius:10px!important;background:var(--soft)!important;color:var(--text)!important;font-size:11px!important}.readerRateRow button.active,.readerThemeRow button.active{border-color:var(--accent)!important;background:color-mix(in srgb,var(--accent) 12%,var(--surface))!important;color:var(--accent)!important;font-weight:800!important}
    .readerChapterControl{display:grid;grid-template-columns:1fr 1fr;gap:9px}.readerChapterControl button:disabled{opacity:.3}
    .readerThemeRow{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    @media(max-width:390px){.readerSettingsSheet{padding-left:14px;padding-right:14px}.readerThemeRow{gap:6px}.readerRateRow{gap:5px}}
  `;
  document.head.appendChild(style);
  ensureTrigger();
  ensureSheet();
  sync();
})();
