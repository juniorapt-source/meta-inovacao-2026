# -*- coding: utf-8 -*-
"""Testes F3–F5: cada página parseia, todo script/css/link local existe, ids obrigatórios presentes."""
import subprocess, tempfile, re as _re
import os, sys
from html.parser import HTMLParser

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OBRIG = {
    "index.html": ["trilho", "kpis", "radar", "atrasadas", "prox", "frase-contexto", "portfolio"],
    "plano.html": ["tabela", "f-frente", "f-status", "f-resp", "f-busca"],
    "minhas-acoes.html": ["ver-como", "resumo-cabecalho", "secao-nos", "secao-acoes", "secao-atividades"],
    "caminho.html": ["lista-nos", "slas", "legenda-vocab"],
    "agenda.html": ["ciclos", "encontros", "legenda-vocab"],
    "demandas.html": ["matriz", "legenda"],
    "participantes.html": ["pessoas", "pendencias"],
    "projetos.html": ["secoes", "f-nucleo", "f-busca", "contagem"],
    "plano-acao.html": ["pa-nav", "pa-painel"],
    "corsario.html": ["crs-frota-wrap", "crs-controles", "crs-segmento", "crs-grid", "crs-matriz-wrap", "crs-matriz"],
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


def _checar_inline(paginas):
    erros = []
    for p in paginas:
        html = open(p, encoding="utf-8").read()
        blocos = _re.findall(r"<script>(.*?)</script>", html, _re.S)
        if not blocos:
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
            f.write("\n".join(blocos)); tmp = f.name
        r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
        if r.returncode != 0:
            erros.append(f"{p}: sintaxe do script embutido → " + next((l for l in r.stderr.splitlines() if "Error" in l), r.stderr.strip().splitlines()[-1]))
    if erros:
        print("FALHOU (inline JS):"); [print(" -", e) for e in erros]; raise SystemExit(1)
    print("inline JS OK:", ", ".join(paginas))

if __name__ == "__main__":
    import sys as _sys
    _checar_inline(_sys.argv[1:] or ["index.html","plano.html","minhas-acoes.html","caminho.html","agenda.html","demandas.html","participantes.html","projetos.html","plano-acao.html","corsario.html","editor.html"])
