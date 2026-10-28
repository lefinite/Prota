/* Local Markdown preview. Raw HTML is displayed as text; output is allowlisted. */
(() => {
  'use strict';
  const allowed = new Set('P BR HR H1 H2 H3 H4 H5 H6 STRONG EM DEL BLOCKQUOTE UL OL LI PRE CODE A IMG TABLE THEAD TBODY TR TH TD INPUT'.split(' '));
  const escape = value => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const parser = new window.marked.Marked({
    gfm: true,
    breaks: true,
    renderer: { html: ({text}) => escape(text) },
  });
  function safeUrl(value, image = false) {
    try {
      const url = new URL(value, 'https://canvas.invalid/');
      return ['http:', 'https:', ...(image ? [] : ['mailto:'])].includes(url.protocol);
    } catch { return false; }
  }
  function render(source) {
    const template = document.createElement('template');
    template.innerHTML = parser.parse(String(source));
    for (const el of [...template.content.querySelectorAll('*')]) {
      if (!allowed.has(el.tagName)) {
        el.replaceWith(document.createTextNode(el.textContent));
        continue;
      }
      for (const attr of [...el.attributes]) {
        const safe = (['title', 'alt'].includes(attr.name)) ||
          (el.tagName === 'A' && attr.name === 'href' && safeUrl(attr.value)) ||
          (el.tagName === 'IMG' && attr.name === 'src' && safeUrl(attr.value, true)) ||
          (el.tagName === 'OL' && attr.name === 'start' && /^\d+$/.test(attr.value)) ||
          (el.tagName === 'INPUT' && ['type', 'checked', 'disabled'].includes(attr.name));
        if (!safe) el.removeAttribute(attr.name);
      }
      if (el.tagName === 'A') {
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
      }
      if (el.tagName === 'IMG') {
        el.loading = 'lazy';
        el.referrerPolicy = 'no-referrer';
      }
      if (el.tagName === 'INPUT') {
        el.type = 'checkbox';
        el.disabled = true;
      }
    }
    for (const node of [...template.content.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
    }
    return template.content;
  }
  window.CanvasMarkdown = Object.freeze({ render });
})();
