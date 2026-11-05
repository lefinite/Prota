/* Classic-script bootstrap: works unchanged on localhost, private static hosting and file://. */
(() => {
  if (window.__protaCanvasBooting) return;
  window.__protaCanvasBooting = true;
  const base = new URL('.', document.currentScript.src);
  const load = name => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(name, base).href;
    script.onload = resolve; script.onerror = () => reject(new Error('未能加载 ' + name));
    document.head.append(script);
  });
  const fail = error => {
    const panel = document.getElementById('canvas-startup-error') || document.getElementById('canvas-boot-error') || document.body.appendChild(document.createElement('p'));
    panel.hidden = false; panel.style.display = 'grid'; panel.setAttribute('role', 'alert');
    const detail = document.getElementById('canvas-startup-detail') || panel;
    detail.textContent = error.message + '。布局与业务画板未被修改，请重新加载。';
    document.documentElement.dataset.protaCanvasReady = 'false';
    if (parent !== window) parent.postMessage({type:'prota:canvas-startup-failed'}, location.origin === 'null' ? '*' : location.origin);
  };
  (async () => {
    if (!window.PROTA_CANVAS) throw new Error('画布文档未能加载');
    await load('runtime-manifest.js');
    const manifest = window.__protaCanvasRuntimeManifest;
    if (!manifest.documentSchemas.includes(window.PROTA_CANVAS.schemaVersion)) throw new Error('当前编辑器不兼容此画布文档版本');
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('styles.css', base).href;
    const styled = new Promise((resolve, reject) => { css.onload = resolve; css.onerror = () => reject(new Error('未能加载 styles.css')); });
    document.head.append(css);
    await load('editor-shell.js');
    for (const name of manifest.scripts) await load(name);
    await styled;
    Object.assign(window.protaCanvas, {runtimeHash:manifest.runtimeHash, shellFormat:'shared-v1', documentSchema:window.PROTA_CANVAS.schemaVersion});
    window.__protaCanvasStartupComplete();
    window.dispatchEvent(new Event('prota:canvas-ready'));
  })().catch(fail);
})();
