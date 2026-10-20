# Сборка однофайлового превью для артефакта claude.ai: python3 tools/preview.py out.html
# (модули склеиваются, data/*.json встраиваются; в самом приложении не используется)
import re, json, sys, pathlib
R=pathlib.Path(__file__).resolve().parent.parent; out=pathlib.Path(sys.argv[1])
order=["markup","data","render","db","scenes","sky","fsrs","cards","quiz","tip","review","unit","words","fluency","games","app"]
js=["window.__M={};"]
for name in order:
    src=(R/f"js/{name}.js").read_text(encoding="utf-8")
    exports=[]
    def imp(m):
        names=[n.strip() for n in m.group(1).split(",") if n.strip()]
        parts=[(f"{a}: {b}" if " as " in n else n) for n in names for a,b in [(n.split(" as ")+[n])[:2]]]
        return "const { "+", ".join(parts)+" } = __M."+m.group(2)+";"
    src=re.sub(r'import\s*\{([^}]*)\}\s*from\s*"\./(\w+)\.js";',imp,src)
    for m in re.finditer(r'^export\s+(?:async\s+)?(?:function|const|let)\s+(\w+)',src,re.M): exports.append(m.group(1))
    src=re.sub(r'^export\s+',"",src,flags=re.M)
    js.append(f"{{ /* {name}.js */\n{src}\n__M.{name} = {{ {', '.join(exports)} }};\n}}")
data={}
for p in (R/"data").rglob("*.json"): data[str(p.relative_to(R/"data"))]=json.loads(p.read_text(encoding="utf-8"))
pre="const __DATA="+json.dumps(data,ensure_ascii=False)+";\nconst __fetch=window.fetch.bind(window);window.fetch=(u,o)=>{const m=String(u).match(/^data\\/(.+)$/);return m&&__DATA[m[1]]?Promise.resolve(new Response(JSON.stringify(__DATA[m[1]]),{headers:{'content-type':'application/json'}})):__fetch(u,o)};\n"
html=(R/"index.html").read_text(encoding="utf-8")
body=html.split("<body>")[1].split("</body>")[0]
body=body.replace('<script type="module" src="js/app.js"></script>',"<script>\n"+pre+"\n".join(js).replace("</script","<\\/script")+"\n</script>")
css=(R/"css/app.css").read_text(encoding="utf-8")
head='<title>空 Sora N3</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Zen+Maru+Gothic:wght@500;700;900&display=swap">\n<style>\n'+css+'\n</style>\n'
out.write_text((head+body).replace("\"Офлайн недоступен\"","\"Превью · офлайн после установки\""),encoding="utf-8"); print(len(head+body))
