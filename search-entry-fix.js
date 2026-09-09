(() => {
  'use strict';

  function run(form) {
    const input = form?.querySelector('input[name="q"]');
    const q = String(input?.value || '').trim();
    if (!q) {
      input?.focus();
      return;
    }
    if (typeof window.search === 'function') window.search(q);
    else if (typeof search === 'function') search(q);
  }

  document.querySelectorAll('form[data-search]').forEach(form => {
    const input = form.querySelector('input[name="q"]');
    const button = form.querySelector('button');
    if (!input) return;

    input.style.pointerEvents = 'auto';
    input.style.touchAction = 'manipulation';
    input.style.webkitUserSelect = 'text';
    input.style.userSelect = 'text';

    input.addEventListener('pointerdown', event => {
      event.stopPropagation();
    });
    input.addEventListener('touchstart', event => {
      event.stopPropagation();
    }, { passive:true });
    input.addEventListener('click', event => {
      event.stopPropagation();
      input.focus();
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      event.stopPropagation();
      run(form);
    });

    button?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      run(form);
    });
  });
})();
