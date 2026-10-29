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
  function render(source, { baseUrl } = {}) {
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
          (['TH','TD'].includes(el.tagName) && attr.name === 'align' && ['left','center','right'].includes(attr.value)) ||
          (el.tagName === 'OL' && attr.name === 'start' && /^\d+$/.test(attr.value)) ||
          (el.tagName === 'INPUT' && ['type', 'checked', 'disabled'].includes(attr.name));
        if (!safe) el.removeAttribute(attr.name);
      }
      // PRD attachments resolve beside their document rather than the canvas version.
      const urlAttribute = el.tagName === 'A' ? 'href' : el.tagName === 'IMG' ? 'src' : null;
      if (baseUrl && urlAttribute && el.hasAttribute(urlAttribute)) {
        try {
          el.setAttribute(urlAttribute, new URL(el.getAttribute(urlAttribute), new URL(baseUrl, location.href)).href);
        } catch { el.removeAttribute(urlAttribute); }
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

/* Shared Markdown authoring surface. No network dependencies; render uses CanvasMarkdown. */
(() => {
  'use strict';
  const commands = [
    ['heading','heading-2','标题'],['bold','bold','粗体 ⌘/Ctrl+B'],['italic','italic','斜体 ⌘/Ctrl+I'],
    ['list','list','无序列表'],['task','list-todo','任务列表'],['quote','quote','引用'],
    ['code','code-xml','代码块'],['link','link','链接 ⌘/Ctrl+K'],['table','table-2','表格'],
  ];
  function transform(source, start, end, command) {
    const selected=source.slice(start,end), line=source.lastIndexOf('\n',start-1)+1;
    const wrap=(a,b=a,fallback='文字')=>({start,end,text:a+(selected||fallback)+b,select:[start+a.length,start+a.length+(selected||fallback).length]});
    if(command==='bold')return wrap('**');
    if(command==='italic')return wrap('*');
    if(command==='link')return wrap('[','](https://example.com)','链接文字');
    if(command==='code')return wrap('```\n','\n```','代码');
    if(command==='table')return {start,end,text:'\n| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n'};
    const prefix={heading:'## ',list:'- ',task:'- [ ] ',quote:'> '}[command];
    if(prefix) {
      const last=source.indexOf('\n',Math.max(start,end-1)), stop=last<0?source.length:last;
      return {start:line,end:stop,text:source.slice(line,stop).split('\n').map(text=>prefix+text).join('\n')};
    }
    return {start,end,text:selected};
  }
  function icon(name) {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for(const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'18',height:'18',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,value);
    svg.innerHTML=window.ProtaCanvasIcons[name];
    return svg;
  }
  function toolbar(onCommand) {
    const bar=document.createElement('div');bar.className='markdown-toolbar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Markdown 格式');
    for(const [id,iconName,title]of commands){const button=document.createElement('button');button.type='button';button.append(icon(iconName));button.title=title;button.setAttribute('aria-label',title);button.dataset.markdownCommand=id;
      button.onpointerdown=e=>e.preventDefault();button.onclick=()=>onCommand(id);bar.append(button);}
    return bar;
  }
  function dialog({source='',baseUrl='',title='编辑 Markdown',onSave,onCancel}) {
    const previous=document.activeElement, root=document.createElement('dialog');root.className='markdown-editor-dialog';root.setAttribute('aria-label',title);
    root.innerHTML='<header class="markdown-editor-header"><strong></strong><div class="markdown-editor-modes" role="group" aria-label="编辑视图"><button type="button" data-mode="source">源码</button><button type="button" data-mode="split">双栏</button><button type="button" data-mode="preview">预览</button></div><button type="button" data-close aria-label="关闭编辑器">×</button></header><div class="markdown-editor-format"></div><div class="markdown-editor-panes"><textarea aria-label="Markdown 源码" spellcheck="false"></textarea><article class="markdown-body markdown-editor-preview" aria-label="Markdown 预览"></article></div><footer class="markdown-editor-footer"><span data-count></span><span data-error role="alert"></span><button type="button" data-cancel>取消</button><button type="button" class="primary" data-save>保存</button></footer>';
    root.querySelector('strong').textContent=title;
    root.querySelector('[data-close]').replaceChildren(icon('x'));
    const input=root.querySelector('textarea'), preview=root.querySelector('article'), error=root.querySelector('[data-error]'), save=root.querySelector('[data-save]');
    input.value=source;let busy=false, mode=innerWidth<640?'source':'split', renderFrame=0;
    const update=()=>{preview.replaceChildren(window.CanvasMarkdown.render(input.value,{baseUrl}));root.querySelector('[data-count]').textContent=`${input.value.replace(/\s/g,'').length} 字`;};
    const setMode=next=>{mode=next;root.dataset.mode=next;for(const button of root.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===next));};
    const close=cancel=>{if(busy)return;cancelAnimationFrame(renderFrame);root.close();root.remove();previous?.focus?.();if(cancel)onCancel?.();};
    const commit=async()=>{if(busy)return;busy=true;save.disabled=true;save.textContent='保存中…';input.readOnly=true;error.textContent='';try{await onSave(input.value);busy=false;close(false);}catch(e){error.textContent=e.message||'保存失败，请重试';}finally{busy=false;input.readOnly=false;save.disabled=false;save.textContent='保存';}};
    const apply=command=>{if(busy)return;const edit=transform(input.value,input.selectionStart,input.selectionEnd,command);input.focus();input.setSelectionRange(edit.start,edit.end);document.execCommand('insertText',false,edit.text);if(edit.select)input.setSelectionRange(...edit.select);update();};
    root.querySelector('.markdown-editor-format').append(toolbar(apply));
    root.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>setMode(button.dataset.mode));
    root.querySelector('[data-close]').onclick=root.querySelector('[data-cancel]').onclick=()=>close(true);save.onclick=commit;
    root.addEventListener('cancel',e=>{e.preventDefault();close(true);});
    root.addEventListener('keydown',e=>{e.stopPropagation();if(e.isComposing)return;const mod=e.metaKey||e.ctrlKey;if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();commit();return;}if(mod&&['b','i','k'].includes(e.key.toLowerCase())){e.preventDefault();apply({b:'bold',i:'italic',k:'link'}[e.key.toLowerCase()]);}});
    input.addEventListener('keydown',e=>{
      if(e.isComposing)return;
      if(e.key==='Tab'){e.preventDefault();document.execCommand('insertText',false,'  ');return;}
      if(e.key==='Enter'&&!e.shiftKey){const start=input.selectionStart,line=input.value.slice(0,start).split('\n').at(-1),match=line.match(/^(\s*)([-*+] |\d+\. )(\[[ xX]\] )?/);if(match){e.preventDefault();if(line.trim()===match[0].trim()){input.setSelectionRange(start-line.length,start);document.execCommand('insertText',false,'');}else{const marker=/\d/.test(match[2])?`${parseInt(match[2])+1}. `:match[2];document.execCommand('insertText',false,'\n'+match[1]+marker+(match[3]?'[ ] ':''));}}}
    });
    input.oninput=()=>{cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(update);};
    document.body.append(root);setMode(mode);update();root.showModal();input.focus();input.setSelectionRange(input.value.length,input.value.length);
    return {close:()=>close(true),getSource:()=>input.value};
  }
  window.CanvasMarkdownEditor=Object.freeze({toolbar,transform,dialog});
})();
