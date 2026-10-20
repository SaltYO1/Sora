# Форматирование словаря и кандзи: одна запись — одна строка. python3 tools/fmt.py
import json, pathlib
R = pathlib.Path(__file__).resolve().parent.parent / "data"
def dump(path, top):
    d = json.loads((R / path).read_text(encoding="utf-8"))
    out = ["{"]
    keys = list(d)
    for i, k in enumerate(keys):
        v = d[k]; comma = "," if i < len(keys) - 1 else ""
        if k in top and isinstance(v, dict):
            out.append(f' "{k}": {{')
            ids = list(v)
            for j, id in enumerate(ids):
                out.append(f'  {json.dumps(id, ensure_ascii=False)}: {json.dumps(v[id], ensure_ascii=False)}' + ("," if j < len(ids) - 1 else ""))
            out.append(" }" + comma)
        else:
            out.append(f' {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}{comma}')
    out.append("}")
    (R / path).write_text("\n".join(out) + "\n", encoding="utf-8")
dump("dict.json", {"words", "particles"})
dump("kanji.json", {"items"})
