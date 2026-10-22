SANS="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
MONO="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
def box(x,y,w,h,title,lines,accent,tag=None,fill="#151833"):
    o=f'<g transform="translate({x} {y})"><rect width="{w}" height="{h}" rx="18" fill="{fill}" stroke="{accent}" stroke-opacity=".75" stroke-width="1.5"/>'
    if tag: o+=f'<text x="24" y="34" font-family="{MONO}" font-size="16" font-weight="700" fill="{accent}" letter-spacing="1">{tag}</text>'
    o+=f'<text x="24" y="{66 if tag else 44}" font-size="24" font-weight="800" fill="#ffffff">{title}</text>'
    yy=(66 if tag else 44)+34
    for l in lines:
        o+=f'<text x="24" y="{yy}" font-size="19" fill="#c3c5e6">{l}</text>'; yy+=28
    return o+'</g>'
def arrow(d):
    return f'<path d="{d}" fill="none" stroke="#9d94ff" stroke-width="2.2" marker-end="url(#ah)"/>'
def flow(zh):
    T = (dict(title='Prota 如何运行', sub='全部在你的电脑上运行；只有你点击分享时，才会把选中的版本发布为静态网页。',
      a=('Portal','浏览器界面',['项目 · 页面 · 版本','标注 · PRD · 分享']),
      b=('本机桥接服务','Python',['读写工作区','截图 · 打包 · 发布']),
      c=('Agent 网关','Node',['技能 · 设计模板','接入你自己的模型 API']),
      d=('工作区','你的磁盘',['每个页面的每一版 v1…vN','PRD · 思维导图 · 流程图']),
      e=('分享链接','静态部署',['浏览器里体验 Demo、看文档']),
      f=('ZIP 下载','原型 + PRD',['交给 AI 编程工具当上下文'])) if zh else
     dict(title='How Prota runs', sub='Everything runs on your machine. Only the versions you choose to share are published as static pages.',
      a=('Portal','BROWSER UI',['Projects · pages · versions','Annotations · PRD · share']),
      b=('Local bridge','PYTHON',['Reads and writes the workspace','Screenshots · ZIP · publish']),
      c=('Agent gateway','NODE',['Skills · design templates','Your own model API']),
      d=('Workspace','YOUR DISK',['Every version, v1 … vN','PRD · mind maps · flowcharts']),
      e=('Share link','STATIC DEPLOY',['Demo + docs in the browser']),
      f=('ZIP download','PROTOTYPE + PRD',['Context for AI coding tools'])))
    s=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="560" viewBox="0 0 1200 560" role="img" aria-labelledby="t d" font-family="{SANS}">
<title id="t">{T["title"]}</title><desc id="d">{T["sub"]}</desc>
<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#9d94ff"/></marker></defs>
<rect width="1200" height="560" rx="28" fill="#0b0d1f"/>
<text x="56" y="70" font-size="40" font-weight="800" fill="#ffffff">{T["title"]}</text>
<text x="56" y="108" font-size="19" fill="#9fa3cc">{T["sub"]}</text>
'''
    a,b,c,d,e,f=T['a'],T['b'],T['c'],T['d'],T['e'],T['f']
    s+=box(56,150,300,170,a[0],a[2],'#9d94ff',a[1])
    s+=box(440,150,316,170,b[0],b[2],'#5eead4',b[1])
    s+=box(440,350,316,170,c[0],c[2],'#5eead4',c[1])
    s+=box(850,150,300,170,d[0],d[2],'#fbbf24',d[1])
    for yy,it in [(346,e),(442,f)]:
        s+=f'<g transform="translate(850 {yy})"><rect width="300" height="84" rx="18" fill="#151833" stroke="#9d94ff" stroke-opacity=".75" stroke-width="1.5"/><text x="24" y="36" font-size="22" font-weight="800" fill="#ffffff">{it[0]}</text><text x="24" y="66" font-size="18" fill="#c3c5e6">{it[2][0]}</text></g>'
    s+=arrow('M356 235 H 434')+arrow('M206 320 V 435 H 434')
    s+=arrow('M756 235 H 844')+arrow('M756 435 C 805 435, 805 300, 844 290')
    s+=arrow('M1000 320 V 340')
    s+='</svg>'
    return s
for lang,zh in [('en',False),('zh',True)]:
    open(f'assets/readme/how-it-works-{lang}.svg','w').write(flow(zh))
