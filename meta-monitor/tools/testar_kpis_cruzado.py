# Teste F3: KPIs do JS (node) == KPIs recalculados em Python (contagem independente)
import json, re, subprocess, sys, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
txt = open(os.path.join(BASE,"data/plano.js"),encoding="utf-8").read()
plano = json.loads(txt.split("window.DB.")[-1].split("=",1)[1].strip().rstrip(";"))
hoje = "2026-08-11"; lim = "2026-08-18"
py = {"total":len(plano),
 "concluido":sum(1 for a in plano if a["status"]=="Concluído"),
 "andamento":sum(1 for a in plano if a["status"]=="Em andamento"),
 "nao":sum(1 for a in plano if a["status"] not in ("Concluído","Em andamento")),
 "atrasadas":sum(1 for a in plano if a["prazo_iso"] and a["status"]!="Concluído" and a["prazo_iso"]<hoje),
 "prox7":sum(1 for a in plano if a["prazo_iso"] and a["status"]!="Concluído" and hoje<=a["prazo_iso"]<=lim),
 "janela":sum(1 for a in plano if not a["prazo_iso"] and a["prazo"])}
js = json.loads(subprocess.check_output(["node","-e",
 'const C=require(process.argv[1]);const fs=require("fs");'
 'const t=fs.readFileSync(process.argv[2],"utf8");'
 'const p=JSON.parse(t.split("window.DB.").pop().split("=").slice(1).join("=").trim().replace(/;\\s*$/,""));'
 'process.stdout.write(JSON.stringify(C.kpis(p,"2026-08-11")));',
 os.path.join(BASE,"js/calc.js"), os.path.join(BASE,"data/plano.js")]).decode())
if py != js:
    print("FALHOU: divergência PY×JS"); print("PY:",py); print("JS:",js); sys.exit(1)
print("KPIs cruzados OK:", json.dumps(js, ensure_ascii=False))
