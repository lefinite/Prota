T={
'en':dict(kicker='Open-source AI agent for product managers',
 h1='One sentence in.',h2='A clickable demo',h3='and a full PRD out.',
 sub='Prota plans, designs and builds the pages, then writes the PRD from what it built. Share it with one link or hand it to your AI coding tool.',
 chips=['160+ design templates','Mobile & Web','Every version kept','Circle to edit'],
 flow=['Idea','Demo','PRD','Share','AI coding'],
 prompt='Plan a weekend-trip app: weather, places, timeline and packing list.',
 steps=[('Plan','product thinking'),('Design','DESIGN.md · tokens'),('Build','index.html  +468')],
 note='Make this button pop',prd='PRD · Weekend Trip',prdl=['Scope & rules','Feature mind map','Core flowchart','Feature screenshots'],
 share='Share link copied',url='Demo + PRD in one link',zip='ZIP → AI coding tool',agent='Prota Agent',ready='Done'),
'zh':dict(kicker='面向产品经理的开源 AI Agent',
 h1='一句话想法，',h2='变成能点的 Demo',h3='和完整的 PRD。',
 sub='Prota 自己拆解、设计、写页面，再根据做出来的东西写出 PRD。一个链接分享给团队，或交给 AI 编程工具继续开发。',
 chips=['160+ 设计模板','手机端 / Web','每个版本都保留','圈选局部修改'],
 flow=['想法','Demo','PRD','分享','AI 编程'],
 prompt='做一个周末出行计划 App：天气、目的地、行程和打包清单。',
 steps=[('产品思考','拆解需求'),('页面设计','DESIGN.md · tokens'),('写代码','index.html  +468')],
 note='这个按钮再醒目一点',prd='PRD · 周末出行计划',prdl=['产品范围与规则','功能思维导图','核心流程图','功能截图'],
 share='分享链接已复制',url='Demo + PRD，一个链接',zip='ZIP → AI 编程工具',agent='Prota Agent',ready='已完成')}
CSS=open('hero.css').read()
for L,t in T.items():
  chips=''.join(f'<span class="chip">{c}</span>' for c in t['chips'])
  flow='<i>→</i>'.join(f'<b>{f}</b>' for f in t['flow'])
  steps=''.join(f'<div class="st"><span class="ok">✓</span><b>{a}</b><em>{b}</em></div>' for a,b in t['steps'])
  prdl=''.join(f'<li>{x}</li>' for x in t['prdl'])
  html=f'''<!doctype html><html lang="{L}"><meta charset="utf-8"><style>{CSS}</style><body class="{L}"><div id="c">
<div class="glow g1"></div><div class="glow g2"></div><div class="grid"></div>
<div class="left">
 <img class="logo" src="a/logo.svg">
 <div class="kick"><span class="dot"></span>{t['kicker']}</div>
 <h1>{t['h1']}<br>{t['h2']}<br><span class="grad">{t['h3']}</span></h1>
 <p class="sub">{t['sub']}</p>
 <div class="chips">{chips}</div>
 <div class="flow">{flow}</div>
</div>
<div class="stage">
 <div class="phone back"><img src="a/proto-{L}-v4x.png"><span class="vt">V4</span></div>
 <div class="phone front"><img src="a/proto-{L}-v5b.png"><span class="vt on">V5</span>
   <div class="ring"></div></div>
 <div class="note"><span class="pin">1</span>{t['note']}</div>
 <div class="agent"><div class="ah"><img src="a/logo.svg" class="am"><span>{t['agent']}</span><span class="rd"><i></i>{t['ready']}</span></div>
   <div class="bub">{t['prompt']}</div>{steps}</div>
 <div class="prd"><div class="ph"><span class="doc"></span>{t['prd']}</div><img src="a/mind-{L}.png"><ul>{prdl}</ul></div>
 <div class="share"><span class="lk">🔗</span><b>{t['share']}</b><span class="url">{t['url']}</span></div>
 <div class="zip">{t['zip']}</div>
</div></div></body></html>'''
  open(f'hero-{L}.html','w').write(html)
