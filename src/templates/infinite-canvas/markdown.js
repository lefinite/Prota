/* Local Markdown preview. Raw HTML is displayed as text; output is allowlisted. */
(() => {
  'use strict';
  const runtimeUrl=new URL('./canvas-mermaid.js',document.currentScript.src).href;
  let mermaidRuntime;
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
    const diagrams=[...template.content.querySelectorAll('pre > code.language-mermaid')];
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
    for(const code of diagrams){
      const figure=document.createElement('figure');figure.className='canvas-mermaid';
      const source=document.createElement('pre');source.hidden=true;source.dataset.mermaidSource='';source.textContent=code.textContent;
      const status=document.createElement('p');status.setAttribute('role','status');status.textContent='正在绘制图表…';
      figure.append(source,status);code.parentElement.replaceWith(figure);
    }
    return template.content;
  }
  async function mount(container,{onResize}={}) {
    await Promise.all([...container.querySelectorAll('.canvas-mermaid')].map(async figure=>{
      if(figure.dataset.state)return;
      figure.dataset.state='loading';
      const source=figure.querySelector('[data-mermaid-source]').textContent;
      try {
        mermaidRuntime ||= new Promise((resolve,reject)=>{
          if(window.ProtaCanvasMermaid){resolve(window.ProtaCanvasMermaid);return;}
          const script=document.createElement('script');script.src=runtimeUrl;
          script.onload=()=>resolve(window.ProtaCanvasMermaid);
          script.onerror=()=>{mermaidRuntime=null;script.remove();reject(new Error('图表资源未能加载'));};
          document.head.append(script);
        });
        const {renderMermaidSvg}=await mermaidRuntime;
        const svg=await renderMermaidSvg(source);
        if(!figure.isConnected)return;
        // SVG images isolate Mermaid's .node classes from canvas selection and styles.
        const diagram=document.createElement('div');diagram.className='canvas-mermaid-diagram';
        const image=document.createElement('img');image.alt='Mermaid 图表';
        image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);diagram.append(image);
        figure.querySelector('[role=status]')?.remove();figure.append(diagram);
        await image.decode();if(!figure.isConnected)return;figure.dataset.state='ready';
      } catch {
        if(!figure.isConnected)return;
        figure.dataset.state='error';
        let status=figure.querySelector('[role=status]');if(!status){status=document.createElement('p');status.setAttribute('role','status');figure.append(status);}
        status.textContent='图表无法渲染，请检查 Mermaid 语法。';
        figure.querySelector('pre').hidden=false;
      }
      onResize?.();
    }));
  }
  window.CanvasMarkdown = Object.freeze({ render, mount });
})();

/* Shared Markdown authoring surface. No network dependencies; render uses CanvasMarkdown. */
(() => {
  'use strict';
  const commands = [
    ['heading','heading-2','标题'],['bold','bold','粗体 ⌘/Ctrl+B'],['italic','italic','斜体 ⌘/Ctrl+I'],
    ['list','list','无序列表'],['task','list-todo','任务列表'],['quote','quote','引用'],
    ['code','code-xml','代码块'],['link','link','链接 ⌘/Ctrl+K'],['table','table-2','表格'],
  ];
  // Both editing surfaces use native textareas and source offsets.
  function snapshot(el) {
    return {source:el.value,start:el.selectionStart,end:el.selectionEnd,
      select:(start,end)=>el.setSelectionRange(start,end)};
  }
  function replace(el,edit) {
    el.focus();snapshot(el).select(edit.start,edit.end);
    // Native insertion keeps browser undo/redo and IME working for both surfaces.
    document.execCommand('insertText',false,edit.text);
    if(edit.select)snapshot(el).select(...edit.select);
    el.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function linesAt(source,start,end) {
    const from=start===0?0:source.lastIndexOf('\n',start-1)+1;
    const last=source.indexOf('\n',Math.max(start,end>start?end-1:end));
    return [from,last<0?source.length:last];
  }
  function indent(source,start,end,outdent=false) {
    const [from,to]=linesAt(source,start,end);let offset=from,a=start,b=end;
    const text=source.slice(from,to).split('\n').map(line=>{
      const removed=outdent?(line.match(/^(?: {1,4}|\t)/)?.[0].length||0):0;
      const map=pos=>pos<offset?pos:pos+ (outdent?-Math.min(removed,pos-offset):4);
      a+=map(start)-start;b+=map(end)-end;
      offset+=line.length+1;
      return outdent?line.slice(removed):'    '+line;
    }).join('\n');
    return {start:from,end:to,text,select:start===end?[a,a]:[a,b]};
  }
  function transform(source, start, end, command) {
    const selected=source.slice(start,end);
    const wrap=(a,b=a,fallback='文字')=>{
      if(source.slice(start-a.length,start)===a&&source.slice(end,end+b.length)===b)
        return {start:start-a.length,end:end+b.length,text:selected,select:[start-a.length,end-a.length]};
      return {start,end,text:a+(selected||fallback)+b,select:[start+a.length,start+a.length+(selected||fallback).length]};
    };
    if(command==='indent'||command==='outdent')return indent(source,start,end,command==='outdent');
    if(command==='bold')return wrap('**');
    if(command==='italic')return wrap('*');
    if(command==='link')return wrap('[','](https://example.com)','链接文字');
    if(command==='code')return wrap('```\n','\n```','代码');
    if(command==='table')return {start,end,text:'\n| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n'};
    const [from,to]=linesAt(source,start,end),lines=source.slice(from,to).split('\n');
    const patterns={heading:/^#{1,6} +/,list:/^[-*+] +(?:\[[ xX]\] +)?/,ordered:/^\d+[.)] +/,task:/^[-*+] +\[[ xX]\] +/,quote:/^> ?/};
    const prefix={heading:'## ',list:'- ',ordered:'1. ',task:'- [ ] ',quote:'> '}[command];
    if(prefix){
      const remove=lines.every(line=>patterns[command].test(line.trimStart()));
      return {start:from,end:to,text:lines.map((line,i)=>{
        const leading=line.match(/^[ \t]*/)[0],body=line.slice(leading.length);
        if(remove)return leading+body.replace(patterns[command],'');
        const clean=['list','ordered','task'].includes(command)?body.replace(/^(?:[-*+]|\d+[.)]) +(?:\[[ xX]\] +)?/,''):body;
        return leading+(command==='ordered'?`${i+1}. `:prefix)+clean;
      }).join('\n')};
    }
    return {start,end,text:selected};
  }
  function keyEdit(source,start,end,key,shift=false) {
    if(key==='Tab')return indent(source,start,end,shift);
    if(key!=='Enter')return null;
    if(shift)return {start,end,text:'\n'};
    const from=start===0?0:source.lastIndexOf('\n',start-1)+1;
    const line=source.slice(from,start),whole=source.slice(from,source.indexOf('\n',start)<0?source.length:source.indexOf('\n',start));
    // Fenced code never continues list-looking content.
    let fence=null;
    for(const text of source.slice(0,from).split('\n')){
      const m=text.match(/^\s*(?:>\s*)*(`{3,}|~{3,})/);
      if(m){if(!fence)fence=m[1];else if(m[1][0]===fence[0]&&m[1].length>=fence.length)fence=null;}
    }
    const pad=line.match(/^[ \t]*/)[0];
    if(fence)return {start,end,text:'\n'+pad};
    const match=line.match(/^([ \t]*)((?:> ?)*)(?:(- |\* |\+ |(\d+)([.)]) +)(\[[ xX]\] +)?)?/);
    const [prefix,space,quote,marker,number,delimiter,task]=match;
    if((marker||quote)&&!whole.slice(prefix.length).trim()){
      if(space)return {...indent(source,from,from,true),select:undefined};
      if(marker&&quote)return {start:from,end,text:space+quote};
      if(quote)return {start:from,end,text:space+quote.replace(/> ?$/,'')};
      return {start:from,end,text:''};
    }
    const next=number?`${Number(number)+1}${delimiter} `:marker||'';
    return {start,end,text:'\n'+space+quote+next+(task?'[ ] ':'')};
  }
  function handleKey(event,el) {
    if(event.isComposing||event.keyCode===229||el.readOnly)return false;
    const mod=event.metaKey||event.ctrlKey,key=event.key.toLowerCase();
    const command=mod&&!event.shiftKey?{b:'bold',i:'italic',k:'link'}[key]:null;
    if(!command && (mod||event.altKey||!['Tab','Enter'].includes(event.key)))return false;
    const state=snapshot(el),edit=command?transform(state.source,state.start,state.end,command):keyEdit(state.source,state.start,state.end,event.key,event.shiftKey);
    if(!edit)return false;
    event.preventDefault();event.stopPropagation();replace(el,edit);return true;
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
    const update=()=>{preview.replaceChildren(window.CanvasMarkdown.render(input.value,{baseUrl}));void window.CanvasMarkdown.mount(preview);root.querySelector('[data-count]').textContent=`${input.value.replace(/\s/g,'').length} 字`;};
    const setMode=next=>{mode=next;root.dataset.mode=next;for(const button of root.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===next));};
    const close=cancel=>{if(busy)return;cancelAnimationFrame(renderFrame);root.close();root.remove();previous?.focus?.();if(cancel)onCancel?.();};
    const commit=async()=>{if(busy)return;busy=true;save.disabled=true;save.textContent='保存中…';input.readOnly=true;error.textContent='';try{await onSave(input.value);busy=false;close(false);}catch(e){error.textContent=e.message||'保存失败，请重试';}finally{busy=false;input.readOnly=false;save.disabled=false;save.textContent='保存';}};
    const apply=command=>{if(busy)return;replace(input,transform(input.value,input.selectionStart,input.selectionEnd,command));update();};
    root.querySelector('.markdown-editor-format').append(toolbar(apply));
    root.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>setMode(button.dataset.mode));
    root.querySelector('[data-close]').onclick=root.querySelector('[data-cancel]').onclick=()=>close(true);save.onclick=commit;
    root.addEventListener('cancel',e=>{e.preventDefault();close(true);});
    root.addEventListener('keydown',e=>{e.stopPropagation();if(e.isComposing)return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();commit();}});
    input.addEventListener('keydown',e=>handleKey(e,input));
    input.oninput=()=>{cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(update);};
    document.body.append(root);setMode(mode);update();root.showModal();input.focus();input.setSelectionRange(input.value.length,input.value.length);
    return {close:()=>close(true),getSource:()=>input.value};
  }
  window.CanvasMarkdownEditor=Object.freeze({toolbar,transform,dialog,snapshot,replace,handleKey,keyEdit});
})();
