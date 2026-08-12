# -*- coding: utf-8 -*-
"""Teste F1: valida todos os data/*.js — JSON puro, contagens, referências cruzadas."""
import json, re, os, sys, glob

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db, erros = {}, []

for path in sorted(glob.glob(os.path.join(BASE, "data", "*.js"))):
    txt = open(path, encoding="utf-8").read()
    m = re.search(r"window\.DB\.(\w+)\s*=\s*(.*);\s*$", txt, re.S)
    if not m:
        erros.append(f"{os.path.basename(path)}: padrão window.DB.x = JSON; não encontrado"); continue
    try:
        db[m.group(1)] = json.loads(m.group(2))
    except Exception as e:
        erros.append(f"{os.path.basename(path)}: JSON inválido → {e}")

def check(cond, msg):
    if not cond: erros.append(msg)

check(len(db.get("plano", [])) == 47, f"plano: esperado 47, veio {len(db.get('plano', []))}")
check(len(db.get("iniciativas", [])) == 27, "iniciativas != 27")
check(len(db.get("canais", [])) == 10, "canais != 10")
check(len(db.get("nos", {}).get("nos", [])) == 7, "nós != 7")
check(len(db.get("nos", {}).get("slas", [])) == 2, "SLAs != 2")
check(len(db.get("agenda", {}).get("encontros", [])) == 20, "encontros != 20 (10 canais × 2 ciclos)")
check(len(db.get("projetos", [])) == 27, f"projetos: esperado 27, veio {len(db.get('projetos', []))}")

ids = {a["id"] for a in db.get("plano", [])}
for a in db.get("plano", []):
    for d in a["dep"]:
        check(d in ids, f"{a['id']}: dependência inexistente {d}")
    for k in ("como", "monitor", "ferramenta"):
        check(bool(a.get(k)), f"{a['id']}: solução sem campo {k}")
    if a.get("prazo_iso"):
        check(re.fullmatch(r"2026-\d2-\d2".replace("\\d2", r"\d{2}"), a["prazo_iso"]), f"{a['id']}: prazo_iso malformado")

canal_ids = {c["id"] for c in db.get("canais", [])}
inic = {i["nome"] for i in db.get("iniciativas", [])}
for nome, linha in db.get("matriz", {}).items():
    check(nome in inic, f"matriz: iniciativa desconhecida {nome}")
    for cid in linha: check(cid in canal_ids, f"matriz[{nome}]: canal desconhecido {cid}")
for e in db.get("agenda", {}).get("encontros", []):
    check(e["canal"] in canal_ids, f"encontro {e['id']}: canal desconhecido")
for n in db.get("nos", {}).get("nos", []):
    for aid in n["acoes"]: check(aid in ids, f"nó {n['no']}: ação inexistente {aid}")

NUCLEOS_VALIDOS = {"Inovação para competitividade", "Inovação territorial", "Startups", "Tecnologias portadoras de futuro"}
projetos = db.get("projetos", [])
inic_projetos = []
for p in projetos:
    check(p.get("nucleo") in NUCLEOS_VALIDOS, f"projetos: núcleo inválido {p.get('nucleo')!r} em {p.get('iniciativa')!r}")
    check(bool(p.get("iniciativa")) and isinstance(p.get("iniciativa"), str), f"projetos: iniciativa vazia/ausente {p!r}")
    reps = p.get("representantes")
    check(isinstance(reps, list) and len(reps) >= 1, f"projetos[{p.get('iniciativa')}]: representantes vazio ou ausente")
    if isinstance(reps, list):
        for r in reps:
            check(isinstance(r, str) and bool(r.strip()), f"projetos[{p.get('iniciativa')}]: representante vazio/inválido {r!r}")
    inic_projetos.append(p.get("iniciativa"))
check(len(inic_projetos) == len(set(inic_projetos)), "projetos: iniciativa duplicada")

if erros:
    print("FALHOU:"); [print(" -", e) for e in erros]; sys.exit(1)
print(f"F1 OK — {len(db['plano'])} ações · {len(db['iniciativas'])} iniciativas · {len(db['canais'])} canais · 7 nós · 2 SLAs · {len(db['agenda']['encontros'])} encontros")

reps_distintos = {r for p in projetos for r in p.get("representantes", [])}
por_nucleo = {n: sum(1 for p in projetos if p.get("nucleo") == n) for n in NUCLEOS_VALIDOS}
print(f"projetos OK — {len(projetos)} projetos · {len(reps_distintos)} representantes distintos")
for n in sorted(por_nucleo):
    print(f"  - {n}: {por_nucleo[n]}")
