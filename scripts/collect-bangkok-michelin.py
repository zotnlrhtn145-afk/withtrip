import re,json,html,urllib.request,concurrent.futures,collections
BASE='https://guide.michelin.com'
URL=BASE+'/en/th/bangkok-region/bangkok/restaurants'
def read(page):
    if page==1:s=open('/tmp/bangkok-michelin.html').read()
    else:s=open('/tmp/bangkok-michelin-'+str(page)+'.html').read()
    out=[]
    for c in re.split(r'(?=data-index="\d+" data-id=)',s)[1:]:
        def attr(k):
            m=re.search(re.escape(k)+r'="([^"]*)"',c)
            return html.unescape(m.group(1)) if m else None
        if out and attr('data-index')=='0':break
        a=re.search(r'<h3[^>]*>\s*<a href="([^"]+)"[^>]*>(.*?)</a>',c,re.S)
        if not a:raise ValueError('Missing official link')
        raw=attr('data-dtm-distinction')
        grade={'':'셀렉티드','bib':'빕구르망','1 star':'1스타','2 star':'2스타','3 star':'3스타','2 stars':'2스타','3 stars':'3스타'}.get(raw)
        if not grade:raise ValueError('Unknown distinction '+str(raw))
        scores=re.findall(r'<div class="card__menu-footer--score[^>]*>(.*?)</div>',c,re.S)
        food=html.unescape(re.sub('<[^>]+>',' ',scores[1])).strip() if len(scores)>1 else ''
        food=' '.join(food.split()); parts=food.split('·',1)
        path=a.group(1)
        row={'url':BASE+path,'name':html.unescape(re.sub('<[^>]+>','',a.group(2))).strip(),'name_slug':path.rsplit('/',1)[-1],
             'city':attr('data-dtm-city'),'country_code':attr('data-restaurant-country').upper(),
             'region_slug':path.split('/')[2],'distinction':grade,'award_year':2026,
             'lat':float(attr('data-lat')),'lng':float(attr('data-lng')),
             'price_range':parts[0].strip() if len(parts)>1 else None,'cuisine':parts[-1].strip()}
        if row['country_code']!='TH' or not (12<row['lat']<15 and 99<row['lng']<102):raise ValueError('Unexpected country/coordinates')
        out.append(row)
    return out
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:pages=list(ex.map(read,range(1,6)))
rows=[r for p in pages for r in p]
assert len(rows)==len({r['url'] for r in rows})==209,(len(rows),len({r['url'] for r in rows}))
counts=collections.Counter(r['distinction'] for r in rows)
assert counts=={'3스타':2,'2스타':8,'1스타':31,'빕구르망':38,'셀렉티드':130},counts
with open('/tmp/bangkok-michelin-verified.json','w') as f:json.dump(rows,f,ensure_ascii=False,indent=2)
print(json.dumps({'pages':[len(p) for p in pages],'places':len(rows),'distinctions':counts},ensure_ascii=False))
