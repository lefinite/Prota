/** Versioned, inert tracking specification shared by review and Excel export. */
export const OPERATIONS = {show:'show(展示)',click:'click(点击)',stay:'stay(停留)',start:'start(应用启动)',slide:'slide(滑动)',submit:'submit(提交)',result:'result(结果)',error:'error(异常)',change:'change(变更)'};
const segment = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(value);
export const safePath = value => typeof value === 'string' && /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.html$/.test(value);
export const anchorSelector = anchor => anchor?.method === 'data-attribute'
  ? `[data-prota-track-id="${String(anchor.value).replace(/[\\"]/g,'\\$&')}"]` : anchor?.value;
export function trackingKey(naming, screen, event) {
  const parts=[naming?.application?.code,naming?.business?.code,screen?.code];
  if(event.controlType==='element')parts.push(event.block?.code,event.element?.code);
  return parts.every(segment)?parts.join('_'):'';
}
export function validateTrackingManifest(data, scope) {
  const v2=data?.schemaVersion===2;
  if(!data || ![1,2].includes(data.schemaVersion)||!data.scope||!Array.isArray(data.events)||data.events.length>(v2?2400:12))throw Error('埋点清单格式无效');
  for(const k of ['projectId','pageId','version'])if(data.scope[k]!==scope[k])throw Error('埋点清单与当前页面版本不匹配');
  const screens=new Map(),ids=new Set(),keys=new Set();
  if(v2){
    if(!data.naming?.application?.label||!data.naming?.business?.label||!segment(data.naming?.application?.code)||!segment(data.naming?.business?.code)||!['app','web','plugin','other'].includes(data.naming?.platform))throw Error('应用、业务线或端类型无效');
    if(!Array.isArray(data.screens)||!data.screens.length||data.screens.length>200)throw Error('业务页面清单无效');
    for(const screen of data.screens){
      if(!/^[a-z][a-z0-9_]*$/.test(screen.id||'')||screens.has(screen.id)||!screen.title||!segment(screen.code)||!safePath(screen.path))throw Error('业务页面标识或路径无效');
      if(!['reviewed','needs_review'].includes(screen.status))throw Error('业务页面缺少分析状态');
      if(screen.platform!==undefined&&!['app','web','plugin','other'].includes(screen.platform))throw Error('业务页面端类型无效');
      if(screen.status==='needs_review'&&!screen.reason)throw Error('未完成页面需要说明原因');
      if(data.scope.pageMode==='infinite-canvas'&&!/^[A-Za-z0-9_-]+$/.test(screen.boardId||''))throw Error('业务页面缺少所属画板');
      if(screen.route && (screen.route.hash!==undefined && (typeof screen.route.hash!=='string'||screen.route.hash && !screen.route.hash.startsWith('#')) || screen.route.search!==undefined && (typeof screen.route.search!=='string'||screen.route.search && !screen.route.search.startsWith('?'))))throw Error('页面路由格式无效');
      for(const anchor of [screen.anchor,...(Array.isArray(screen.navigation)?screen.navigation:[]).map(step=>step.anchor)].filter(Boolean))if(!['data-attribute','selector'].includes(anchor.method)||!anchor.value)throw Error('页面定位条件无效');
      if(screen.navigation && (!Array.isArray(screen.navigation)||screen.navigation.length>12||screen.navigation.some(step=>step.action!=='click'||!step.anchor)))throw Error('页面导航步骤无效');
      screens.set(screen.id,screen);
    }
  }
  for(const event of data.events){
    if(!/^[a-z][a-z0-9_]*$/.test(event.id||'')||ids.has(event.id)||!Array.isArray(event.targets))throw Error('埋点事件 ID 重复或无效');
    ids.add(event.id);
    if(v2){
      const screen=screens.get(event.screenId);
      if(!screen||!['page','element'].includes(event.controlType)||!event.title)throw Error('事件缺少所属业务页面或控件类型');
      if(event.controlType==='element'&&(!event.block?.label||!event.element?.label))throw Error('元素埋点缺少区块或元素名称');
      if(event.controlType==='page'&&(event.block||event.element))throw Error('页面埋点不能包含区块和元素');
      const key=trackingKey(data.naming,screen,event);
      if(!key||event.name!==key||keys.has(key))throw Error('埋点 key 不符合命名规范或重复');
      keys.add(key);
      if(event.registrationId!==undefined&&!/^(?:\d+)?$/.test(String(event.registrationId)))throw Error('平台埋点 ID 必须为已有数字编号或空值');
      if(!Array.isArray(event.operations)||!event.operations.length||event.operations.some(op=>!OPERATIONS[op])||new Set(event.operations).size!==event.operations.length)throw Error('事件操作类型无效');
      if(!Array.isArray(event.parameters)||event.parameters.length>5)throw Error('事件参数过多或格式无效');
      const names=new Set();
      for(const p of event.parameters){
        if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(p.name||'')||names.has(p.name)||!['string','int','number','boolean','enum'].includes(p.type)||!p.meaning||!p.source)throw Error('参数名称、类型、含义或来源无效');
        names.add(p.name);
        if(p.operation&&!event.operations.includes(p.operation))throw Error('参数操作类型与事件不匹配');
      }
    }
    for(const t of event.targets){
      if(!['page','canvas-board'].includes(t.kind)||!t.anchor||!['data-attribute','selector'].includes(t.anchor.method)||!t.anchor.value)throw Error('埋点目标格式无效');
      if(!safePath(t.path))throw Error('页面目标路径无效');
      if(!v2&&t.kind==='page'&&t.path!=='index.html')throw Error('页面目标路径无效');
      if(t.kind==='canvas-board'&&(!/^[A-Za-z0-9_-]+$/.test(t.boardId||'')||(!v2&&t.path!==`boards/${t.boardId}/index.html`)))throw Error('画板目标路径无效');
      if(v2){const screen=screens.get(event.screenId);if(t.path!==screen.path||(t.boardId||'')!==(screen.boardId||'')||(data.scope.pageMode==='infinite-canvas')!==(t.kind==='canvas-board'))throw Error('事件目标与业务页面不匹配');}
    }
  }
  if(v2)for(const screen of screens.values())if(data.events.filter(e=>e.screenId===screen.id).length>12)throw Error('单个业务页面最多保留 12 个事件');
  return data;
}
export function reviewScreens(manifest){
  if(manifest?.schemaVersion===2)return manifest.screens;
  const screens=new Map();
  for(const event of manifest?.events||[]){const t=event.targets[0],id=t?.boardId||'legacy';if(!screens.has(id))screens.set(id,{id,title:t?.boardId||'当前页面',path:t?.path||'index.html',boardId:t?.boardId,status:'reviewed'});}
  return [...screens.values()];
}
export function eventScreenId(event){return event.screenId||event.targets[0]?.boardId||'legacy';}
export function chineseName(manifest,event){
  if(manifest.schemaVersion!==2)return event.title;
  const screen=manifest.screens.find(s=>s.id===event.screenId);
  const labels=[manifest.naming.application.label,manifest.naming.business.label,screen?.title];
  if(event.controlType==='element')labels.push(event.block?.label,event.element?.label);
  return event.fullName||labels.filter(Boolean).join('_');
}
export function operationLabels(event){return (event.operations||[{view:'show',change:'change'}[event.trigger?.type]||event.trigger?.type||'click']).map(op=>OPERATIONS[op]||op).join('、');}
export const parameterType=param=>param.type==='enum'?'string':param.type;
export function parameterNotes(param){return [param.notes,param.allowedValues?.join(' / '),param.source].filter(Boolean).join('\n');}
export function excelSheets(manifest){
  const screens=reviewScreens(manifest),screenMap=new Map(screens.map(s=>[s.id,s]));
  const platform=screen=>screen?.platform||manifest.naming?.platform||'other';
  const labels={app:'App端',web:'Web端',plugin:'插件端',other:'埋点清单'};
  const platforms=new Set(screens.map(platform));if(!platforms.size)platforms.add(platform());
  const outputs=[];
  for(const p of ['app','web','plugin','other'].filter(p=>platforms.has(p))){
    const rows=[['埋点id','埋点key','埋点中文','支持的操作类型','上报字段名称','字段类型','字段含义','备注','所属页面','区块','触发条件']];
    for(const event of manifest.events){
      const screen=screenMap.get(eventScreenId(event));if(platform(screen)!==p)continue;
      const ops=event.operations||[{view:'show'}[event.trigger?.type]||event.trigger?.type||'click'];
      for(const op of ops){
        const params=(event.parameters||[]).filter(param=>!param.operation||param.operation===op);
        for(const param of params.length?params:[null])rows.push([event.registrationId||'',event.name,chineseName(manifest,event),OPERATIONS[op]||op,param?.name||'',param?parameterType(param):'',param?.meaning||param?.description||'',param?parameterNotes(param):event.notes||'',screen?.title||'',event.block?.label||'',event.trigger?.when||'']);
      }
    }
    outputs.push({name:labels[p],rows,widths:[12,64,38,22,22,12,32,65,24,22,65]});
  }
  const coverage=[['页面名称','页面简称','页面路径','画板','分析状态','说明','端类型']];
  for(const screen of screens)coverage.push([screen.title,screen.code||'',screen.path,screen.boardId||'',screen.status==='reviewed'?'已分析':'待核对',screen.reason||'',labels[platform(screen)]]);
  return [...outputs,{name:'页面覆盖',rows:coverage,widths:[26,22,52,24,14,65,14]}];
}
