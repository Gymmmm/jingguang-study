(() => {
  'use strict';

  const detail = document.getElementById('detail');
  if (!detail) return;

  const readable = () => ['bible-reader', 'egw-reader'].includes(detail.dataset.readerKind || '');
  const q = (sel, root = detail) => root.querySelector(sel);

  function ttsMain() { return q('.readAloudBar [data-tts="toggle"]'); }
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
            <button type="button" data-reader-audio-step="-1" aria-label="上一段"><span>‹</span><small>上一段</small></button>
            <button type="button" class="readerSheetPlay" data-reader-sheet-tts><span>▶</span><small>朗读</small></button>
            <button type="button" data-reader-audio-step="1" aria-label="下一段"><span>›</span><small>下一段</small></button>
          </div>
          <div class="readerVoiceHint">使用设备系统默认中文语音</div>
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
          <h3>背景</h3>
          <div class="readerThemeRow">
            <button type="button" data-reader-theme="paper">暖白</button>
            <button type="button" data-reader-theme="sepia">米黄</button>
            <button type="button" data-reader-theme="green">护眼</button>
            <button type="button" data-reader-theme="dark">深色</button>
          </div>
        </div>
      </section>`;
    detail.appendChild(backdrop);
    return backdrop;
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
    if (!show) sheet.hidden = true;

    const s = state();
    const play = q('[data-reader-sheet-tts]', sheet);
    if (play) {
      q('span', play).textContent = s.speaking && !s.paused ? 'Ⅱ' : '▶';
      q('small', play).textContent = s.speaking && !s.paused ? '暂停' : (s.paused ? '继续' : '朗读');
    }

    sheet.querySelectorAll('[data-reader-rate]').forEach(btn => {
      btn.classList.toggle('active', Math.abs(Number(btn.dataset.readerRate) - Number(s.rate || 1)) < .01);
    });

    const prevStep = q('[data-reader-audio-step="-1"]', sheet);
    const nextStep = q('[data-reader-audio-step="1"]', sheet);
    if (prevStep) prevStep.disabled = !s.count || s.index <= 0;
    if (nextStep) nextStep.disabled = !s.count || s.index >= s.count - 1;

    const prev = quick('prev');
    const next = quick('next');
    const prevProxy = q('[data-reader-sheet-nav="prev"]', sheet);
    const nextProxy = q('[data-reader-sheet-nav="next"]', sheet);
    if (prevProxy) prevProxy.disabled = !prev || prev.disabled || prev.hidden;
    if (nextProxy) nextProxy.disabled = !next || next.disabled || next.hidden;

    const theme = document.documentElement.dataset.theme || 'paper';
    sheet.querySelectorAll('[data-reader-theme]').forEach(btn => btn.classList.toggle('active', btn.dataset.readerTheme === theme));
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
    const font = event.target.closest?.('[data-reader-font-proxy]');
    if (font) {
      q(`[data-font="${font.dataset.readerFontProxy}"]`)?.click();
      return;
    }
    if (event.target.closest?.('[data-reader-sheet-tts]')) {
      ttsMain()?.click();
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
    .readerAudioControl{display:grid;grid-template-columns:1fr 70px 1fr;align-items:center;margin:2px 0 6px}.readerAudioControl button{border:0!important;background:transparent!important;color:var(--text)!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}.readerAudioControl button:disabled{opacity:.28}.readerAudioControl button>span{font-size:21px;line-height:1}.readerAudioControl button>small{font-size:9px}
    .readerSheetPlay{width:62px;height:62px;min-height:62px!important;justify-self:center;border-radius:50%!important;background:var(--accent)!important;color:var(--surface)!important}.readerSheetPlay>span{font-size:20px!important;font-weight:800}.readerSheetPlay>small{font-size:9px!important}
    .readerVoiceHint{margin:0 0 10px;text-align:center;color:var(--muted);font-size:10px}
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