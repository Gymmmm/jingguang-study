(() => {
  'use strict';

  const detail = document.getElementById('detail');
  if (!detail) return;

  const readable = () => ['bible-reader', 'egw-reader'].includes(detail.dataset.readerKind || '');
  const q = (sel, root = detail) => root.querySelector(sel);
  const FONT_KEY = 'jg_v10_bible_font';

  function ttsMain() { return q('.readAloudBar [data-tts="toggle"]'); }
  function quick(direction) { return q(`[data-reader-quick="${direction}"]`); }
  function favoriteSource() { return detail.querySelector('[data-egw-native-favorite], [data-favorite-bible]'); }

  function currentFont() {
    const raw = parseInt(localStorage.getItem(FONT_KEY) || getComputedStyle(document.documentElement).getPropertyValue('--reader-font') || '19', 10);
    return Number.isFinite(raw) ? Math.max(14, Math.min(28, raw)) : 19;
  }

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
    // Keep a single Aa affordance; hide any leftover overflow trigger.
    tools.querySelectorAll('[data-reader-more]').forEach(el => { el.hidden = true; });
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

        <div class="readerSettingsGroup readerSettingsFontGroup">
          <h3>字号</h3>
          <div class="readerFontSliderRow">
            <span aria-hidden="true">A−</span>
            <input type="range" min="14" max="28" step="1" value="19" data-reader-font-slider aria-label="字号">
            <span aria-hidden="true">A+</span>
          </div>
        </div>

        <div class="readerSettingsGroup">
          <h3>朗读</h3>
          <div class="readerAudioControl">
            <button type="button" data-reader-audio-step="-1" aria-label="后退">
              <span class="readerSkipIcon">↺15</span>
            </button>
            <button type="button" class="readerSheetPlay" data-reader-sheet-tts aria-label="朗读">
              <span>▶</span>
            </button>
            <button type="button" data-reader-audio-step="1" aria-label="前进">
              <span class="readerSkipIcon">↻15</span>
            </button>
          </div>
          <div class="readerRateRow" aria-label="朗读速度">
            ${[0.8,1,1.2,1.5,2].map(v => `<button type="button" data-reader-rate="${v}">${v}x</button>`).join('')}
          </div>
        </div>

        <div class="readerSettingsGroup readerSettingsCompactGroup">
          <h3>主题</h3>
          <div class="readerThemeRow">
            <button type="button" data-reader-theme="system"><i class="readerThemeIcon" aria-hidden="true">☼⚙</i><span>跟随系统</span></button>
            <button type="button" data-reader-theme="paper"><i class="readerThemeIcon" aria-hidden="true">☀</i><span>浅色</span></button>
            <button type="button" data-reader-theme="sepia"><i class="readerThemeIcon" aria-hidden="true">◉</i><span>护眼</span></button>
            <button type="button" data-reader-theme="dark"><i class="readerThemeIcon" aria-hidden="true">☾</i><span>深色</span></button>
          </div>
        </div>

        <div class="readerSettingsGroup readerSettingsCompactGroup readerSettingsExtra" hidden>
          <h3>更多</h3>
          <div class="readerExtraActions">
            <button type="button" data-reader-sheet-toc>目录</button>
            <button type="button" data-reader-sheet-favorite>收藏</button>
            <button type="button" data-reader-sheet-nav="prev">‹ 上一章</button>
            <button type="button" data-reader-sheet-nav="next">下一章 ›</button>
            <button type="button" data-reader-verify hidden>核验官方原始出处</button>
          </div>
        </div>
      </section>`;
    detail.appendChild(backdrop);
    return backdrop;
  }

  function applySystemTheme() {
    const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const value = dark ? 'dark' : 'paper';
    const select = document.getElementById('themeSelect');
    if (select) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    localStorage.setItem('jg_v10_theme_pref', 'system');
  }

  function setTheme(value) {
    if (value === 'system') {
      applySystemTheme();
      return;
    }
    localStorage.setItem('jg_v10_theme_pref', value);
    const select = document.getElementById('themeSelect');
    if (select) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function state() {
    return typeof window.jgReadAloudState === 'function'
      ? window.jgReadAloudState()
      : { speaking:false, paused:false, rate:1, index:0, count:0 };
  }

  function sync() {
    const trigger = ensureTrigger();
    const sheet = ensureSheet();
    const show = detail.open && readable();
    if (trigger) trigger.hidden = !show;
    const more = q('.readerMoreTrigger');
    if (more) more.hidden = true;
    if (!show) sheet.hidden = true;

    const s = state();
    const play = q('[data-reader-sheet-tts]', sheet);
    if (play) {
      const span = q('span', play);
      const label = s.speaking && !s.paused ? '暂停' : (s.paused ? '继续' : '朗读');
      if (span) span.textContent = s.speaking && !s.paused ? 'Ⅱ' : (s.paused ? '▶' : '▶');
      play.setAttribute('aria-label', label);
      play.title = label;
    }

    sheet.querySelectorAll('[data-reader-rate]').forEach(btn => {
      btn.classList.toggle('active', Math.abs(Number(btn.dataset.readerRate) - Number(s.rate || 1)) < .01);
    });

    const prevStep = q('[data-reader-audio-step="-1"]', sheet);
    const nextStep = q('[data-reader-audio-step="1"]', sheet);
    if (prevStep) prevStep.disabled = !s.count || s.index <= 0;
    if (nextStep) nextStep.disabled = !s.count || s.index >= s.count - 1;

    const slider = q('[data-reader-font-slider]', sheet);
    if (slider) slider.value = String(currentFont());

    const pref = localStorage.getItem('jg_v10_theme_pref') || (document.documentElement.dataset.theme || 'paper');
    const theme = pref === 'system' ? 'system' : (document.documentElement.dataset.theme || 'paper');
    sheet.querySelectorAll('[data-reader-theme]').forEach(btn => btn.classList.toggle('active', btn.dataset.readerTheme === theme));

    const prev = quick('prev') || detail.querySelector('.readerNav button,.egwChapterPager button');
    const next = detail.querySelectorAll('.readerNav button,.egwChapterPager button');
    // Keep chapter nav available in sheet extras
    const extra = q('.readerSettingsExtra', sheet);
    if (extra) extra.hidden = false;
    const verify = q('[data-reader-verify]', sheet);
    const official = detail.querySelector('[data-official-source]');
    if (verify) {
      verify.hidden = !official;
    }

    const favBtn = q('[data-reader-sheet-favorite]', sheet);
    if (favBtn) {
      const src = favoriteSource();
      const on = /已收藏|★/.test(String(src?.textContent || ''));
      favBtn.textContent = on ? '★ 已收藏' : '☆ 收藏';
      favBtn.setAttribute('aria-label', on ? '取消收藏' : '收藏本章');
      favBtn.disabled = !src;
    }
    const tocBtn = q('[data-reader-sheet-toc]', sheet);
    if (tocBtn) {
      tocBtn.setAttribute('aria-label', detail.dataset.readerKind === 'egw-reader' ? '返回本书目录' : '返回目录');
    }
  }

  function setFontSize(n) {
    const size = Math.max(14, Math.min(28, Number(n) || 19));
    document.documentElement.style.setProperty('--reader-font', size + 'px');
    localStorage.setItem(FONT_KEY, String(size));
    const slider = q('[data-reader-font-slider]');
    if (slider) slider.value = String(size);
  }

  detail.addEventListener('click', event => {
    const open = event.target.closest?.('[data-reader-settings-open]');
    if (open) {
      ensureSheet().hidden = false;
      sync();
      return;
    }
    if (event.target.id === 'readerSettingsBackdrop' || event.target.closest?.('[data-reader-settings-close]')) {
      ensureSheet().hidden = true;
      return;
    }
    if (event.target.closest?.('[data-reader-sheet-tts]')) {
      if (typeof window.jgReadAloudToggle === 'function') window.jgReadAloudToggle();
      else ttsMain()?.click();
      return;
    }
    const step = event.target.closest?.('[data-reader-audio-step]');
    if (step) {
      window.jgReadAloudStep?.(Number(step.dataset.readerAudioStep));
      return;
    }
    const rate = event.target.closest?.('[data-reader-rate]');
    if (rate) {
      window.jgSetReadAloudRate?.(Number(rate.dataset.readerRate));
      return;
    }
    const nav = event.target.closest?.('[data-reader-sheet-nav]');
    if (nav) {
      const dir = nav.dataset.readerSheetNav;
      const label = dir === 'prev' ? '上一章' : '下一章';
      const candidates = [
        ...detail.querySelectorAll('#readerBottomNav button,.readerNav button,.egwChapterPager button')
      ];
      const target = candidates.find(btn => String(btn.textContent || '').includes(label));
      if (target && !target.disabled && !target.hidden) {
        ensureSheet().hidden = true;
        target.click();
      }
      return;
    }
    if (event.target.closest?.('[data-reader-sheet-toc]')) {
      ensureSheet().hidden = true;
      detail.querySelector('#back')?.click();
      return;
    }
    if (event.target.closest?.('[data-reader-sheet-favorite]')) {
      const src = favoriteSource();
      if (src) {
        src.click();
        queueMicrotask(sync);
      }
      return;
    }
    const verify = event.target.closest?.('[data-reader-verify]');
    if (verify) {
      detail.querySelector('[data-official-source]')?.click();
      return;
    }
    const theme = event.target.closest?.('[data-reader-theme]');
    if (theme) {
      setTheme(theme.dataset.readerTheme);
      sync();
    }
  });

  detail.addEventListener('input', event => {
    const slider = event.target.closest?.('[data-reader-font-slider]');
    if (slider) setFontSize(slider.value);
  });

  detail.addEventListener('jg-read-aloud-state', sync);
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

  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (localStorage.getItem('jg_v10_theme_pref') === 'system') applySystemTheme();
      });
    } catch (_) {}
  }

  const style = document.createElement('style');
  style.textContent = `
    .fontTools>[data-font]{display:none!important}
    .readerSettingsTrigger[hidden],.readerMoreTrigger[hidden],.readerSettingsBackdrop[hidden]{display:none!important}
    .readerSettingsTrigger{font-size:15px!important;letter-spacing:-.02em;min-width:40px!important}
    .readerMoreTrigger{display:none!important}
    .readerSettingsBackdrop{position:fixed;inset:0;z-index:80;display:flex;align-items:flex-end;background:rgba(22,24,22,.36)}
    .readerSettingsSheet{width:min(720px,100%);max-height:86%;margin:0 auto;padding:8px 18px calc(22px + env(safe-area-inset-bottom));overflow:auto;border-radius:22px 22px 0 0;background:var(--surface);color:var(--text);box-shadow:0 -18px 48px rgba(20,24,21,.13)}
    .readerSettingsHandle{width:36px;height:4px;margin:0 auto 8px;border-radius:99px;background:var(--line)}
    .readerSettingsHead{position:static!important;display:flex!important;align-items:center!important;justify-content:space-between!important;padding:0 0 7px!important;border:0!important;background:transparent!important}
    .readerSettingsHead h2{margin:0;font-size:17px;font-weight:700}.readerSettingsHead button{width:40px;min-width:40px!important;min-height:40px!important;border:0!important;background:transparent!important;color:var(--muted)!important;font-size:25px!important;font-weight:300!important}
    .readerSettingsGroup{padding:14px 0;border-top:1px solid var(--line)}.readerSettingsGroup:first-of-type{border-top:0}
    .readerSettingsGroup h3{margin:0 0 10px;font-size:13px;font-weight:700;color:var(--text)}
    .readerFontSliderRow{display:grid;grid-template-columns:28px 1fr 28px;align-items:center;gap:10px}
    .readerFontSliderRow span{text-align:center;color:var(--muted);font-size:14px;font-weight:700}
    .readerFontSliderRow input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:99px;background:var(--line);outline:none}
    .readerFontSliderRow input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--accent);border:0;box-shadow:0 2px 8px color-mix(in srgb,var(--accent) 35%,transparent)}
    .readerAudioControl{display:grid;grid-template-columns:1fr 64px 1fr;align-items:center;margin:0 0 12px}
    .readerAudioControl button{border:0!important;background:transparent!important;color:var(--text)!important;display:flex;align-items:center;justify-content:center;min-height:48px!important}
    .readerAudioControl button:disabled{opacity:.24}
    .readerSkipIcon{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:1.5px solid var(--line);border-radius:50%;font-size:12px;font-weight:700;color:var(--text)}
    .readerSettingsSheet button.readerSheetPlay{width:58px;height:58px;min-height:58px!important;justify-self:center;border:0!important;border-radius:50%!important;background:var(--accent)!important;color:#fff!important;box-shadow:0 6px 16px color-mix(in srgb,var(--accent) 28%,transparent)}
    .readerSettingsSheet button.readerSheetPlay>span{font-size:18px!important;font-weight:800;color:#fff!important}
    .readerRateRow{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
    .readerRateRow button{min-height:36px!important;border:1px solid var(--line)!important;border-radius:9px!important;background:var(--soft)!important;color:var(--muted)!important;font-size:12px!important}
    .readerRateRow button.active{border-color:var(--accent)!important;background:var(--accent)!important;color:#fff!important;font-weight:700!important}
    .readerThemeRow{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .readerThemeRow button{min-height:72px!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1.5px solid var(--line)!important;border-radius:12px!important;background:var(--surface)!important;color:var(--muted)!important;font-size:11px!important;padding:8px 4px!important}
    .readerThemeRow button.active{border-color:var(--accent)!important;background:var(--accent-soft)!important;color:var(--accent)!important;font-weight:700!important}
    .readerThemeIcon{font-size:18px;line-height:1;font-style:normal}
    .readerExtraActions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .readerExtraActions button{min-height:42px!important;border:1px solid var(--line)!important;border-radius:10px!important;background:transparent!important;color:var(--text)!important;font-size:12px!important}
    .readerExtraActions [data-reader-sheet-toc],
    .readerExtraActions [data-reader-sheet-favorite]{font-weight:650!important}
    .readerExtraActions [data-reader-verify]{grid-column:1/-1;color:var(--accent)!important;font-weight:650!important}
    .readerExtraActions button:disabled{opacity:.28}
    .bibleReaderIntro{text-align:center;padding:6px 0 18px;border-bottom:1px solid var(--line);margin-bottom:14px}
    .bibleReaderIntro .bibleBookName{color:var(--muted);font-size:12px;margin-bottom:4px}
    .bibleReaderIntro h1{margin:0;font-family:var(--font-reading);font-size:22px;line-height:1.35;font-weight:700;color:var(--text)}
    #detail[data-reader-kind="bible-reader"]>header>#back,
    #detail[data-reader-kind="egw-reader"]>header>#back{font-weight:600}
    @media(max-width:390px){.readerSettingsSheet{padding-left:14px;padding-right:14px}.readerThemeRow,.readerRateRow{gap:5px}.bibleReaderIntro h1{font-size:20px}}
  `;
  document.head.appendChild(style);
  ensureTrigger();
  ensureSheet();
  sync();
})();
