// A board owns its application state. Never restore by replaying user actions.
(function(root) {
  'use strict';
  const LIMIT = 262144;
  const copy = value => {
    const seen = new Set();
    const visit = (v, depth = 0) => {
      if (depth > 40) throw Error('画板状态层级过深');
      if (v === null || typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v)) return;
      if (typeof v !== 'object' || seen.has(v) || !Array.isArray(v) && Object.prototype.toString.call(v) !== '[object Object]') throw Error('画板状态必须是可保存的数据');
      seen.add(v);
      for (const [key, item] of Object.entries(v)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('画板状态字段无效');
        visit(item, depth + 1);
      }
      seen.delete(v);
    };
    visit(value);
    const json = JSON.stringify(value);
    if (json.length > LIMIT) throw Error('画板状态超过 256 KB，请精简展示数据');
    return JSON.parse(json);
  };
  function adapter(frame) {
    const win = frame.contentWindow, doc = frame.contentDocument;
    if (!doc?.body || doc.readyState === 'loading') throw Error('画板尚未加载完成，请稍后重试');
    if (win.ProtaBoardState?.capture && win.ProtaBoardState?.restore) return win.ProtaBoardState;
    // Existing plain JS demos often expose a global lexical `state` + `render`.
    // Run static code in the board realm to reach that lexical binding, without
    // evaluating any captured data or traversing framework internals.
    if (!win.__protaBoardStateAuto) {
      const script = doc.createElement('script');
      script.textContent = `(() => {
        try {
          if (typeof state !== 'object' || !state || Array.isArray(state) || typeof render !== 'function') return;
          window.__protaBoardStateAuto = {
            version: 1,
            capture: () => state,
            restore: async value => {
              for (const key of Object.keys(state)) if (!Object.hasOwn(value, key)) delete state[key];
              Object.assign(state, value);
              await render();
            }
          };
        } catch {}
      })();`;
      doc.head.append(script); script.remove();
    }
    if (win.__protaBoardStateAuto) return win.__protaBoardStateAuto;
    throw Error('此画板需要先适配状态保存');
  }
  const deadline = promise => {
    let timer;
    return Promise.race([Promise.resolve(promise), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('画板状态操作超时，请重试')), 4000); })]).finally(() => clearTimeout(timer));
  };
  function route(frame, src) {
    const base = new URL(src, root.location.href), folder = new URL('.', base), url = new URL(frame.contentWindow.location.href);
    if (url.origin !== folder.origin || !url.pathname.startsWith(folder.pathname)) throw Error('只能固定当前画板目录内的页面');
    return url.pathname.slice(folder.pathname.length) + url.search + url.hash;
  }
  function urlFor(pin, src) {
    const folder = new URL('.', new URL(src, root.location.href)), url = new URL(pin.route, folder);
    if (url.origin !== folder.origin || !url.pathname.startsWith(folder.pathname)) throw Error('固定状态的页面路径无效');
    return url.href;
  }
  function selector(el) {
    if (el.id && el.ownerDocument.querySelectorAll('#' + root.CSS.escape(el.id)).length === 1) return '#' + root.CSS.escape(el.id);
    const parts = [];
    while (el && el !== el.ownerDocument.documentElement) {
      const siblings = [...el.parentElement.children].filter(n => n.localName === el.localName);
      parts.unshift(el.localName + ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')');
      el = el.parentElement;
    }
    return 'html>' + parts.join('>');
  }
  function captureUI(frame) {
    const doc = frame.contentDocument, win = frame.contentWindow;
    const controls = [...doc.querySelectorAll('input,textarea,select,details')].filter(el => !['password', 'file', 'hidden'].includes(el.type)).map(el => ({
      selector: selector(el), tag: el.localName, type: el.type || '',
      ...(el.localName === 'details' ? {open: el.open} : el.localName === 'select' ? {selected: [...el.options].map(o => o.selected)} : {value: el.value, checked: Boolean(el.checked)})
    }));
    const scroll = [...doc.body.querySelectorAll('*')].filter(el => el.scrollTop || el.scrollLeft).map(el => ({selector:selector(el), x:el.scrollLeft, y:el.scrollTop}));
    return {controls, scroll, x:win.scrollX, y:win.scrollY};
  }
  function restoreUI(frame, ui) {
    const doc = frame.contentDocument;
    let skippedControls = 0;
    for (const item of ui.controls) {
      let el;
      try { el = doc.querySelector(item.selector); } catch { /* An old selector may no longer be supported. */ }
      if (!el || el.localName !== item.tag || (el.type || '') !== item.type || item.tag === 'select' && el.options.length !== item.selected.length) {
        skippedControls++;
        continue;
      }
      // Set native properties only: dispatching change/input can submit requests.
      if (item.tag === 'details') el.open = item.open;
      else if (item.tag === 'select') [...el.options].forEach((o,i) => o.selected = Boolean(item.selected[i]));
      else { el.value = item.value; el.checked = item.checked; }
    }
    for (const item of ui.scroll) {
      try { doc.querySelector(item.selector)?.scrollTo(item.x, item.y); } catch { /* Ignore obsolete scroll targets. */ }
    }
    frame.contentWindow.scrollTo(ui.x, ui.y);
    return { skippedControls };
  }
  async function restore(frame, pin, src) {
    const api = adapter(frame);
    if ((api.version || 1) !== pin.adapterVersion) throw Error('页面状态接口已变化，请重新固定');
    const url = urlFor(pin, src);
    frame.contentWindow.history.replaceState(null, '', url);
    await deadline(api.restore(copy(pin.data)));
    return restoreUI(frame, pin.ui);
  }
  async function capture(frame, src) {
    const api = adapter(frame);
    const pin = copy({version:1, adapterVersion:api.version || 1, route:route(frame,src), data:copy(await deadline(api.capture())), ui:captureUI(frame)});
    // Verify in a fresh realm. Testing restore on the current page would let a
    // no-op restore pass, only to lose the state on the next refresh.
    const trial = root.document.createElement('iframe');
    trial.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    trial.setAttribute('aria-hidden', 'true'); trial.tabIndex = -1;
    Object.assign(trial.style, {position:'fixed', left:'-100000px', top:'0', width:frame.clientWidth+'px', height:frame.clientHeight+'px', border:'0', pointerEvents:'none'});
    try {
      await deadline(new Promise((resolve,reject) => {
        trial.onload = resolve; trial.onerror = () => reject(Error('无法验证画板状态，请重试'));
        trial.src = urlFor(pin, src); root.document.body.append(trial);
      }));
      if (Boolean(trial.contentWindow.ProtaBoardState) !== Boolean(frame.contentWindow.ProtaBoardState)) throw Error('画板状态接口已变化，请保存代码后重新固定');
      const restored = await restore(trial, pin, src);
      if (restored.skippedControls) throw Error('页面控件已变化，请重新固定状态');
      if (JSON.stringify(copy(await deadline(adapter(trial).capture()))) !== JSON.stringify(pin.data)) throw Error('画板未能完整恢复，请先适配状态保存');
    } finally { trial.remove(); }
    return pin;
  }
  root.CanvasBoardState = {capture, restore, urlFor};
})(window);
