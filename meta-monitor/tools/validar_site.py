# -*- coding: utf-8 -*-
"""Testes F3–F5: cada página parseia, todo script/css/link local existe, ids obrigatórios presentes."""
import os, sys
from html.parser import HTMLParser

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OBRIG = {
    "index.html": ["trilho", "kpis", "radar", "atrasadas", "prox", "log"],
    "plano.html": ["tabela", "f-frente", "f-status", "f-resp", "f-busca"],
    "caminho.html": ["lista-nos", "slas", "folga"],
    "agenda.html": ["ciclos", "encontros"],
    "demandas.html": ["matriz", "legenda"],
    "participantes.html": ["pessoas", "pendencias"],
    "editor.html": ["ed-conjunto", "ed-area", "ed-baixar"],
}

class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=set(); self.refs=[]; self.err=None
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if "id" in d: self.ids.add(d["id"])
        if tag == "script" and d.get("src"): self.refs.append(d["src"])
        if tag == "link" and d.get("href"): self.refs.append(d["href"])
        if tag == "a" and d.get("href"): self.refs.append(d["href"])

erros = []
paginas = [p for p in OBRIG if os.path.exists(os.path.join(BASE, p))]
for pg in sys.argv[1:] or paginas:
    path = os.path.join(BASE, pg)
    if not os.path.exists(path):
        erros.append(f"{pg}: arquivo não existe"); continue
    html = open(path, encoding="utf-8").read()
    p = P()
    try: p.feed(html)
    except Exception as e: erros.append(f"{pg}: parse falhou {e}"); continue
    for r in p.refs:
        if r.startswith(("http", "#", "mailto")): continue
        alvo = r.split("#")[0]
        if alvo and not os.path.exists(os.path.join(BASE, alvo)):
            erros.append(f"{pg}: referência quebrada → {r}")
    for oid in OBRIG.get(pg, []):
        if oid not in p.ids: erros.append(f"{pg}: id obrigatório ausente → #{oid}")

if erros:
    print("FALHOU:"); [print(" -", e) for e in erros]; sys.exit(1)
print("validar_site OK:", ", ".join(sys.argv[1:] or paginas))
