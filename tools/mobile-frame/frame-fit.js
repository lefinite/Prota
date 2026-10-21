/* Self-contained mobile preview fitting. Copies live beside each Demo version. */
function installProtaMobileFrameFit(win, fallback = {}) {
  const doc = win.document;
  const phone = doc.querySelector('.phone-shell');
  const stage = phone?.closest('.demo-stage');
  if (!phone || !stage || win.__protaFrameFit || win.__PROTA_DISABLE_FRAME_FIT__) return;
  win.__protaFrameFit = true;

  // Restore only frame geometry/decoration from desktop rules. Short desktop
  // windows must not activate the legacy height-based, frameless layout.
  const properties = ['width', 'height', 'padding', 'border-radius', 'box-shadow', 'background'];
  const base = { ...fallback.phone };
  const screenBase = { ...fallback.screen };
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule.selectorText === '.phone-shell') {
          for (const key of properties) {
            const value = rule.style.getPropertyValue(key);
            if (value) base[key] = value;
          }
        }
        if (rule.selectorText === '.phone-screen') {
          const value = rule.style.getPropertyValue('border-radius');
          if (value) screenBase['border-radius'] = value;
        }
      }
    } catch (_) { /* Remote font sheets are not readable. */ }
  }
  const declarations = values => Object.entries(values)
    .map(([key, value]) => `${key}:${value} !important;`).join('');
  const style = doc.createElement('style');
  style.id = '__prota_frame_fit';
  style.textContent = `
    html[data-prota-frame-fit] { height:100%; overflow:hidden; }
    html[data-prota-frame-fit] body { height:100%; min-height:0; margin:0; overflow:hidden; }
    html[data-prota-frame-fit] .demo-stage {
      position:relative; width:100%; height:100%; min-height:0 !important;
      padding:0 !important; overflow:hidden; display:block !important;
    }
    html[data-prota-frame-fit="desktop"] .phone-shell {
      ${declarations(base)}
      position:absolute !important; margin:0 !important; max-width:none !important;
      max-height:none !important; flex-shrink:0; left:var(--prota-phone-center, 50%); top:50%;
      transform:translate(-50%, -50%) scale(var(--prota-frame-scale, 1)) !important;
      transform-origin:center !important;
    }
    html[data-prota-frame-fit="desktop"] .phone-screen { ${declarations(screenBase)} }
    html[data-prota-frame-fit="native"] .phone-shell {
      position:absolute !important; inset:0 !important; margin:0 !important;
      width:100% !important; height:100% !important; max-width:none !important;
      max-height:none !important; padding:0 !important; border-radius:0 !important;
      box-shadow:none !important; transform:none !important;
    }
    html[data-prota-frame-fit="native"] .phone-screen { border-radius:0 !important; }
    html[data-prota-frame-fit="native"] .volume-key,
    html[data-prota-frame-fit="native"] .demo-tools { display:none !important; }
    html[data-prota-frame-fit="desktop"] .demo-stage > .demo-tools {
      position:absolute; left:var(--prota-tools-left); top:50%;
      transform:translateY(-50%); max-height:calc(100% - 48px); overflow:auto;
    }
  `;
  doc.head.appendChild(style);
  let pending = false;
  function fit() {
    pending = false;
    let host = win;
    let insidePhone = false;
    try {
      host = win.top;
      insidePhone = Boolean(win.frameElement?.closest('.phone-shell'));
    } catch (_) { host = win; }
    const native = insidePhone || (host.matchMedia('(pointer: coarse)').matches
      && host.matchMedia('(max-width: 600px)').matches);
    doc.documentElement.dataset.protaFrameFit = native ? 'native' : 'desktop';
    if (!native) {
      const width = phone.offsetWidth;
      const height = phone.offsetHeight;
      if (!width || !height) return;
      const tools = stage.querySelector(':scope > .demo-tools');
      const toolsWidth = tools && win.getComputedStyle(tools).display !== 'none' ? tools.offsetWidth : 0;
      const gap = toolsWidth ? 40 : 0;
      const scale = Math.max(0.01, Math.min(1,
        (stage.clientWidth - toolsWidth - gap - 48) / width,
        (stage.clientHeight - 48) / height));
      const center = (stage.clientWidth - toolsWidth - gap) / 2;
      phone.style.setProperty('--prota-frame-scale', String(scale));
      phone.style.setProperty('--prota-phone-center', `${center}px`);
      stage.style.setProperty('--prota-tools-left', `${center + width * scale / 2 + gap}px`);
    }
    // Existing inspector and marker observers listen to resize.
    doc.dispatchEvent(new win.CustomEvent('prota:frame-fit'));
  }
  function schedule() {
    if (!pending) { pending = true; win.requestAnimationFrame(fit); }
  }
  win.addEventListener('resize', schedule);
  win.visualViewport?.addEventListener('resize', schedule);
  const observer = new win.ResizeObserver(schedule);
  observer.observe(stage);
  fit();
}
