const dialog = document.getElementById('showcaseDialog');
const trigger = document.getElementById('showcaseOpen');
const css = getComputedStyle(document.documentElement);
document.querySelectorAll('[data-color-token]').forEach(node => {
  node.textContent = css.getPropertyValue(`--pui-color-${node.dataset.colorToken}`).trim().toUpperCase();
});
const close = () => dialog.close();
trigger.addEventListener('click', () => dialog.showModal());
document.getElementById('showcaseClose').addEventListener('click', close);
document.getElementById('showcaseCancel').addEventListener('click', close);
document.getElementById('showcaseConfirm').addEventListener('click', close);
dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
dialog.addEventListener('close', () => trigger.focus());
