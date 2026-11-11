"""Self-contained, read-only review experience for offline page archives.

All bridge scripts are injected into ZIP copies; original workspace files remain unchanged.
"""
import html
import json
import secrets
import re
from pathlib import Path
import posixpath

BRIDGE_TEMPLATE = r"""
<script data-prota-review-bridge>
(() => {
  const token = __TOKEN__;
  const targets = __TARGETS__;
  const pagePath = __PATH__;
  const destinations = __DESTINATIONS__;
  let navigating = false;
  const matches = () => {
    const found = [];
    for (const item of targets) {
      try {
        const screen=item.screen;
        if(screen?.route?.hash!==undefined && location.hash!==screen.route.hash)continue;
        if(screen?.route?.search!==undefined && location.search!==screen.route.search)continue;
        if(screen?.anchor){const selector=screen.anchor.method==='data-attribute'?'[data-prota-track-id="'+CSS.escape(screen.anchor.value)+'"]':screen.anchor.value;const roots=document.querySelectorAll(selector);if(roots.length!==1||!roots[0].getClientRects().length)continue;}
        const selector = item.anchor.method === 'data-attribute'
          ? '[data-prota-track-id="' + CSS.escape(item.anchor.value) + '"]'
          : item.anchor.value;
        const root=screen?.anchor?document.querySelector(screen.anchor.method==='data-attribute'?'[data-prota-track-id="'+CSS.escape(screen.anchor.value)+'"]':screen.anchor.value):document;
        const selected = [...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)].filter(el=>el.getClientRects().length);
        if (selected.length === 1 && selected[0].getClientRects().length) found.push({id:item.eventId,el:selected[0],controlType:item.controlType,markerId:item.markerId});
      } catch {}
    }
    return found;
  };
  const forward = data => parent.postMessage({...data,token}, '*');
  function report() {
    forward({type:'prota:offline-review-clear',pagePath});
    for (const {id,el,markerId} of matches()) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) forward({
        type:'prota:offline-review-rect',id,markerId,
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
    if (data.type === 'prota:offline-review-clear') {forward(data);return;}
    if (data.type === 'prota:offline-review-selected') {
      forward(data);return;
    }
    if (data.type === 'prota:offline-review-focus') {
      const found=matches().find(x=>x.id===data.id);
      const destination=destinations.find(x=>x.eventId===data.id);
      if(!found&&destination&&!navigating){
        const screen=destination.screen;
        const url=new URL(destination.url,location.href);url.hash=screen?.route?.hash||'';url.search=screen?.route?.search||'';
        if(url.pathname!==location.pathname||url.hash!==location.hash||url.search!==location.search){location.href=url.href;return;}
        if(screen?.navigation?.length){navigating=true;(async()=>{for(const step of screen.navigation){const until=Date.now()+2000;let el;while(Date.now()<until&&!el){try{const selector=step.anchor.method==='data-attribute'?'[data-prota-track-id="'+CSS.escape(step.anchor.value)+'"]':step.anchor.value;const list=document.querySelectorAll(selector);if(list.length===1&&list[0].getClientRects().length)el=list[0];}catch{}if(!el)await new Promise(r=>setTimeout(r,60));}if(!el)break;el.click();await new Promise(r=>setTimeout(r,60));}navigating=false;report();})();}
      }
      if(found){
        found.el.scrollIntoView({block:'center',inline:'nearest'});
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
  document.addEventListener('click',event=>{
    if(navigating)return;
    const target=matches().filter(x=>x.controlType!=='page').find(({el})=>el===event.target||el.contains(event.target));
    if(target)forward({type:'prota:offline-review-selected',id:target.id});
  },true);
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
.marker{position:absolute;transform:translate(-50%,-50%);border-radius:7px;min-width:27px;height:24px;border:2px solid white;color:white;background:#7c6cff;font-size:12px;pointer-events:auto;cursor:pointer}
aside{background:white;overflow:auto;border-left:1px solid #e5e7eb;padding:16px}
.item{width:100%;text-align:left;padding:12px;margin-bottom:8px;border:1px solid #e5e7eb;border-radius:9px;background:#fff;cursor:pointer;color:inherit}
.marker.active{outline:2px solid #7c6cff;outline-offset:2px}.item.active{border-color:#7c6cff;background:#f7f5ff}
.item strong{display:block;margin-bottom:4px}.item small{color:#717784}.item p{margin:7px 0;font-size:12px}
button{font:inherit}header button{border:1px solid #ddd;background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}
@media(max-width:740px){main{grid-template-columns:1fr;grid-template-rows:55vh 1fr}aside{border-top:1px solid #ddd;border-left:0}}
</style></head><body><header><strong>Prota · 埋点方案审阅</strong><div><button id="download">下载 Excel</button> <a href="__DEMO__">打开原型</a></div></header>
<main><section class="preview"><iframe id="demo" src="__DEMO__"></iframe><div id="layer"></div></section><aside><h3>埋点方案</h3><div id="items"></div></aside></main>
<script>
__EXPORT_JS__
(() => {
  const token=__TOKEN__, manifest=__MANIFEST__;
  const entries=manifest?.events || [];
  const iframe=document.getElementById('demo'), layer=document.getElementById('layer');
  const list=document.getElementById('items');
  const els=new Map();
  let active='',pending='';
  const safe = x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const screens=reviewScreens(manifest);
  list.innerHTML=screens.map(screen=>'<section><h4>'+safe(screen.title)+'</h4>'+entries.filter(e=>eventScreenId(e)===screen.id).map(e=>'<button class="item" data-id="'+safe(e.id)+'"><strong>'+String(entries.indexOf(e)+1).padStart(2,'0')+' '+safe(e.title)+'</strong><small>'+safe(e.name)+'</small><p>'+safe(operationLabels(e))+' · '+safe(e.trigger?.when)+'</p>'+(e.parameters?.length?'<table style="width:100%;text-align:left;font-size:12px"><thead><tr><th>上报字段</th><th>类型</th><th>含义 / 取值</th></tr></thead><tbody>'+e.parameters.map(p=>'<tr><td>'+safe(p.name)+'</td><td>'+safe(parameterType(p))+'</td><td>'+safe(p.meaning||p.source)+' '+safe(p.allowedValues?.join(' / ')||p.notes||'')+'</td></tr>').join('')+'</tbody></table>':'')+'</button>').join('')+(!entries.some(e=>eventScreenId(e)===screen.id)?'<p>'+safe(screen.reason||'无需新增埋点')+'</p>':'')+'</section>').join('');
  function post(type,extra={}){iframe.contentWindow?.postMessage({type,token,...extra},'*')}
  function select(id,navigate=true){active=id;pending=navigate?id:'';for(const el of [...list.querySelectorAll('.item'),...els.values()])el.classList.toggle('active',el.dataset.id===id);if(navigate)post('prota:offline-review-focus',{id});list.querySelector('.item.active')?.scrollIntoView({block:'nearest'});}
  list.addEventListener('click',e=>{const item=e.target.closest('[data-id]');if(item)select(item.dataset.id)});
  document.getElementById('download').onclick=()=>downloadTrackingWorkbook({...manifest,scope:manifest.scope||{pageId:'demo',version:'__VERSION__'}});
  layer.addEventListener('click',e=>{const marker=e.target.closest('[data-id]');if(marker)select(marker.dataset.id)});
  window.addEventListener('message',ev=>{
    if(ev.source!==iframe.contentWindow || ev.data?.token!==token)return;
    const d=ev.data;
    if(d.type==='prota:offline-review-selected')select(d.id,false);
    if(d.type==='prota:offline-review-clear'){for(const badge of els.values())if(badge.dataset.path===d.pagePath)badge.hidden=true;}
    if(d.type==='prota:offline-review-rect' && entries.some(e=>e.id===d.id)){
      if(pending===d.id)pending='';
      const r=d.rect;
      if(!r||!Number.isFinite(r.x)||!Number.isFinite(r.y))return;
      const markerKey=d.markerId||d.id;let badge=els.get(markerKey);
      if(!badge){badge=document.createElement('button');badge.className='marker';badge.dataset.id=d.id;badge.textContent=String(entries.findIndex(e=>e.id===d.id)+1).padStart(2,'0');layer.appendChild(badge);els.set(markerKey,badge);}
      const box=iframe.getBoundingClientRect();
      badge.classList.toggle('active',active===d.id);badge.dataset.path=d.pagePath;badge.dataset.seen=String(Date.now());
      badge.style.left=(r.x*(box.width/Math.max(1,d.viewport?.width || box.width)))+'px';
      badge.style.top=(r.y*(box.height/Math.max(1,d.viewport?.height || box.height)))+'px';
      badge.hidden=r.x<0||r.y<0||r.x>box.width||r.y>box.height;
    }
  });
  iframe.addEventListener('load',()=>{layer.replaceChildren();els.clear();post('prota:offline-review-ping');if(pending)post('prota:offline-review-focus',{id:pending});});
  setInterval(()=>{post('prota:offline-review-ping');if(pending)post('prota:offline-review-focus',{id:pending});for(const badge of els.values())if(Date.now()-Number(badge.dataset.seen)>1200)badge.hidden=true;},600);
})();
</script></body></html>"""


def build_review_bundle(version, manifest):
    """Return (viewer_html, {relative-version-html-path: injected script})."""
    token = secrets.token_hex(16)
    token_json = json.dumps(token)
    items_by_path = {}
    screen_map = {s['id']:s for s in (manifest or {}).get('screens',[]) if isinstance(s,dict) and 'id' in s}
    if isinstance(manifest, dict):
        for event in manifest.get('events', []):
            if not isinstance(event, dict):
                continue
            for target_index, target in enumerate(event.get('targets', [])):
                if not isinstance(target, dict) or target.get('status') == 'needs_review':
                    continue
                path = target.get('path')
                if not isinstance(path, str) or not re.fullmatch(r'(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+\.html',path):
                    continue
                if '..' in path or '\\' in path or not path.endswith('.html'):
                    continue
                anchor = target.get('anchor')
                if not isinstance(anchor, dict) or anchor.get('method') not in ('data-attribute','selector'):
                    continue
                items_by_path.setdefault(path, []).append({'eventId':event.get('id'), 'markerId':str(event.get('id'))+':'+str(target_index), 'anchor':anchor,'screen':screen_map.get(event.get('screenId')),'controlType':event.get('controlType'),'boardId':target.get('boardId')})
    export_js = '\n'.join((Path(__file__).resolve().parent.parent / 'portal/modules/tracking' / name).read_text(encoding='utf-8') for name in ('model.js','excel.js'))
    export_js = re.sub(r'^import .*?;\n', '', export_js, flags=re.M).replace('export ', '')
    viewer = (VIEWER_TEMPLATE.replace('__TOKEN__',token_json)
              .replace('__MANIFEST__',json.dumps(manifest or {'events': []},ensure_ascii=False).replace('</','<\\/'))
              .replace('__EXPORT_JS__',export_js).replace('__VERSION__',html.escape(version,quote=True))
              .replace('__DEMO__',html.escape(f'{version}/index.html', quote=True)))
    scripts={}
    for file_path in ['index.html', *items_by_path]:
        board = file_path.split('/')[1] if file_path.startswith('boards/') else None
        destinations = [dict(item,url=posixpath.relpath(path,posixpath.dirname(file_path) or '.')) for path,items in items_by_path.items() for item in items if item.get('boardId')==board]
        code = (BRIDGE_TEMPLATE.replace('__TOKEN__',token_json)
                .replace('__DESTINATIONS__',json.dumps(destinations,ensure_ascii=False).replace('</','<\\/'))
                .replace('__TARGETS__',json.dumps(items_by_path.get(file_path,[]),ensure_ascii=False).replace('</','<\\/'))
                .replace('__PATH__',json.dumps(file_path)))
        scripts[file_path]=code
    return viewer, scripts
