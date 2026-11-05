"""Self-contained, read-only review experience for offline page archives.

All bridge scripts are injected into ZIP copies; original workspace files remain unchanged.
"""
import html
import json
import secrets

BRIDGE_TEMPLATE = r"""
<script data-prota-review-bridge>
(() => {
  const token = __TOKEN__;
  const targets = __TARGETS__;
  const pagePath = __PATH__;
  let inspect = true;
  const matches = () => {
    const found = [];
    for (const item of targets) {
      try {
        const selector = item.anchor.method === 'data-attribute'
          ? '[data-prota-track-id="' + CSS.escape(item.anchor.value) + '"]'
          : item.anchor.value;
        const selected = document.querySelectorAll(selector);
        if (selected.length === 1) found.push({id:item.eventId,el:selected[0]});
      } catch {}
    }
    return found;
  };
  const forward = data => parent.postMessage({...data,token}, '*');
  function report() {
    for (const {id,el} of matches()) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) forward({
        type:'prota:offline-review-rect',id,
        rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
        viewport:{width:innerWidth,height:innerHeight},pagePath
      });
    }
  }
  window.addEventListener('message', ev => {
    if (!ev.data || ev.data.token !== token) return;
    const data = ev.data;
    if (data.type === 'prota:offline-review-rect') {
      // Relay nested board coordinates through the canvas iframe.
      const frame = [...document.querySelectorAll('iframe')].find(x => x.contentWindow === ev.source);
      if (!frame) return;
      const outer = frame.getBoundingClientRect(), inner = data.rect;
      const scaleX = outer.width / Math.max(1,data.viewport?.width || outer.width);
      const scaleY = outer.height / Math.max(1,data.viewport?.height || outer.height);
      forward({...data,rect:{
        x:outer.x + inner.x*scaleX,y:outer.y + inner.y*scaleY,
        width:inner.width*scaleX,height:inner.height*scaleY
      },viewport:{width:innerWidth,height:innerHeight}});
      return;
    }
    if (data.type === 'prota:offline-review-selected') {
      forward(data);return;
    }
    if (data.type === 'prota:offline-review-inspect') inspect=Boolean(data.enabled);
    if (data.type === 'prota:offline-review-focus') {
      const found=matches().find(x=>x.id===data.id);
      if(found){
        found.el.scrollIntoView({block:'center',inline:'nearest'});
        found.el.style.outline='2px solid #b97722';
        setTimeout(()=>{found.el.style.outline=''},1600);
      }
    }
    if (data.type === 'prota:offline-review-ping' || data.type === 'prota:offline-review-focus' ||
        data.type === 'prota:offline-review-inspect') {
      for(const frame of document.querySelectorAll('iframe')) {
        try { frame.contentWindow.postMessage(data,'*'); } catch {}
      }
      report();
    }
  });
  function capture(event) {
    if(!inspect)return;
    if(event.type==='keydown' && !['Enter',' '].includes(event.key))return;
    const target=matches().find(({el})=>el===event.target || el.contains(event.target));
    if(!target)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(event.type==='click' || event.type==='keydown')
      forward({type:'prota:offline-review-selected',id:target.id});
  }
  for (const type of ['click','pointerdown','pointerup','submit','keydown'])
    document.addEventListener(type,capture,true);
  window.addEventListener('resize',report);
  window.addEventListener('scroll',report,true);
  setInterval(report,450);
})();
</script>
"""

VIEWER_TEMPLATE = r"""<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prota 埋点审阅</title>
<style>
*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,-apple-system,sans-serif;background:#f7f8fa;color:#21242b}
header{height:54px;display:flex;align-items:center;justify-content:space-between;background:#fff;border-bottom:1px solid #e4e6ea;padding:0 18px}
main{display:grid;grid-template-columns:minmax(0,1fr) 340px;height:calc(100vh - 54px)}
.preview{position:relative;overflow:hidden;background:#fff}iframe{width:100%;height:100%;border:0}
#layer{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.marker{position:absolute;transform:translate(-50%,-50%);border-radius:100%;width:25px;height:25px;border:2px solid white;color:white;background:#b97722;font-size:12px;pointer-events:auto;cursor:pointer}
aside{background:white;overflow:auto;border-left:1px solid #e5e7eb;padding:16px}
.item{width:100%;text-align:left;padding:12px;margin-bottom:8px;border:1px solid #e5e7eb;border-radius:9px;background:#fff;cursor:pointer;color:inherit}
.item.active{border-color:#b97722;background:#fffaf4}
.item strong{display:block;margin-bottom:4px}.item small{color:#717784}.item p{margin:7px 0;font-size:12px}
button{font:inherit}header button{border:1px solid #ddd;background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}
@media(max-width:740px){main{grid-template-columns:1fr;grid-template-rows:55vh 1fr}aside{border-top:1px solid #ddd;border-left:0}}
</style></head><body><header><strong>Prota · 埋点方案审阅</strong><div><button id="mode">选择控件</button> <a href="__DEMO__">打开原型</a></div></header>
<main><section class="preview"><iframe id="demo" src="__DEMO__"></iframe><div id="layer"></div></section><aside><h3>埋点清单 · <span id="count"></span></h3><p style="font-size:12px;color:#666">仅用于设计交付，不会发送统计数据。</p><div id="items"></div></aside></main>
<script>
(() => {
  const token=__TOKEN__, manifest=__MANIFEST__;
  const entries=manifest?.events || [];
  const iframe=document.getElementById('demo'), layer=document.getElementById('layer');
  const list=document.getElementById('items');
  const els=new Map();
  let inspect=true,active='';
  const safe = x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  document.getElementById('count').textContent=String(entries.length);
  list.innerHTML=entries.map((e,i)=>'<button class="item" data-id="'+safe(e.id)+'"><strong>'+(i+1)+'. '+safe(e.title)+' · '+safe(e.priority)+'</strong><small>'+safe(e.name)+'</small><p>'+safe(e.purpose)+'</p><p>'+safe(e.trigger?.when)+'</p><p>'+safe(e.decision)+'</p></button>').join('');
  function post(type,extra={}){iframe.contentWindow?.postMessage({type,token,...extra},'*')}
  function select(id){active=id;for(const el of list.children)el.classList.toggle('active',el.dataset.id===id);post('prota:offline-review-focus',{id});}
  list.addEventListener('click',e=>{const item=e.target.closest('[data-id]');if(item)select(item.dataset.id)});
  document.getElementById('mode').onclick=()=>{inspect=!inspect;document.getElementById('mode').textContent=inspect?'选择控件':'预览交互';post('prota:offline-review-inspect',{enabled:inspect})};
  layer.addEventListener('click',e=>{const marker=e.target.closest('[data-id]');if(marker)select(marker.dataset.id)});
  window.addEventListener('message',ev=>{
    if(ev.source!==iframe.contentWindow || ev.data?.token!==token)return;
    const d=ev.data;
    if(d.type==='prota:offline-review-selected')select(d.id);
    if(d.type==='prota:offline-review-rect' && entries.some(e=>e.id===d.id)){
      const r=d.rect;
      if(!r||!Number.isFinite(r.x)||!Number.isFinite(r.y))return;
      let badge=els.get(d.id);
      if(!badge){badge=document.createElement('button');badge.className='marker';badge.dataset.id=d.id;badge.textContent=String(entries.findIndex(e=>e.id===d.id)+1);layer.appendChild(badge);els.set(d.id,badge);}
      const box=iframe.getBoundingClientRect();
      badge.style.left=(r.x*(box.width/Math.max(1,d.viewport?.width || box.width)))+'px';
      badge.style.top=(r.y*(box.height/Math.max(1,d.viewport?.height || box.height)))+'px';
      badge.hidden=r.x<0||r.y<0||r.x>box.width||r.y>box.height;
    }
  });
  iframe.addEventListener('load',()=>{layer.replaceChildren();els.clear();post('prota:offline-review-inspect',{enabled:inspect});post('prota:offline-review-ping')});
  setInterval(()=>post('prota:offline-review-ping'),900);
})();
</script></body></html>"""


def build_review_bundle(version, manifest):
    """Return (viewer_html, {relative-version-html-path: injected script})."""
    token = secrets.token_hex(16)
    token_json = json.dumps(token)
    items_by_path = {}
    if isinstance(manifest, dict):
        for event in manifest.get('events', []):
            if not isinstance(event, dict):
                continue
            for target in event.get('targets', []):
                if not isinstance(target, dict) or target.get('status') == 'needs_review':
                    continue
                path = target.get('path')
                if not isinstance(path, str) or not (path == 'index.html' or path.startswith('boards/')):
                    continue
                if '..' in path or '\\' in path or not path.endswith('.html'):
                    continue
                anchor = target.get('anchor')
                if not isinstance(anchor, dict) or anchor.get('method') not in ('data-attribute','selector'):
                    continue
                items_by_path.setdefault(path, []).append({'eventId':event.get('id'), 'anchor':anchor})
    viewer = (VIEWER_TEMPLATE.replace('__TOKEN__',token_json)
              .replace('__MANIFEST__',json.dumps(manifest or {'events': []},ensure_ascii=False).replace('</','<\\/'))
              .replace('__DEMO__',html.escape(f'{version}/index.html', quote=True)))
    scripts={}
    for file_path in ['index.html', *items_by_path]:
        code = (BRIDGE_TEMPLATE.replace('__TOKEN__',token_json)
                .replace('__TARGETS__',json.dumps(items_by_path.get(file_path,[]),ensure_ascii=False).replace('</','<\\/'))
                .replace('__PATH__',json.dumps(file_path)))
        scripts[file_path]=code
    return viewer, scripts
