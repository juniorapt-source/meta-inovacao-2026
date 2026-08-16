# -*- coding: utf-8 -*-
"""Teste F1: valida todos os data/*.js — JSON puro, contagens, referências cruzadas."""
import json, re, os, sys, glob

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db, erros = {}, []

def blocos_de(txt):
    """Extrai todas as atribuições window.DB.<chave> = <JSON>; de um arquivo, na ordem em que
    aparecem — a maioria dos arquivos tem uma só, mas data/urc.js tem duas. Acha o fim de cada
    valor balanceando colchetes/chaves e respeitando aspas, em vez de cortar no primeiro ';'
    (que pode aparecer dentro de uma string, ex.: um texto de "como executar")."""
    resultado = {}
    for m in re.finditer(r"window\.DB\.(\w+)\s*=\s*", txt):
        chave = m.group(1)
        i = m.end()
        while i < len(txt) and txt[i].isspace(): i += 1
        if i >= len(txt) or txt[i] not in "{[":
            continue  # ex.: "window.DB = window.DB || {}"
        depth, in_str, escape, j = 0, False, False, i
        while j < len(txt):
            c = txt[j]
            if in_str:
                if escape: escape = False
                elif c == "\\": escape = True
                elif c == '"': in_str = False
            else:
                if c == '"': in_str = True
                elif c in "{[": depth += 1
                elif c in "}]":
                    depth -= 1
                    if depth == 0: j += 1; break
            j += 1
        resultado[chave] = txt[i:j]
    return resultado

for path in sorted(glob.glob(os.path.join(BASE, "data", "*.js"))):
    txt = open(path, encoding="utf-8").read()
    blocos = blocos_de(txt)
    if not blocos:
        erros.append(f"{os.path.basename(path)}: padrão window.DB.x = JSON; não encontrado"); continue
    for chave, valor_txt in blocos.items():
        try:
            db[chave] = json.loads(valor_txt)
        except Exception as e:
            erros.append(f"{os.path.basename(path)}: JSON inválido em {chave} → {e}")

def check(cond, msg):
    if not cond: erros.append(msg)

check(len(db.get("plano", [])) == 47, f"plano: esperado 47, veio {len(db.get('plano', []))}")
# data/iniciativas.js foi aposentado (governança do golden record, camada 1): a lista
# canônica de iniciativas agora é data/projetos.js. A contagem == 27 é conferida abaixo
# via db["projetos"].
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
# iniciativas canônicas = as de data/projetos.js (golden record / fonte única)
inic = {p["iniciativa"] for p in db.get("projetos", [])}
for nome, linha in db.get("matriz", {}).items():
    check(nome in inic, f"matriz: iniciativa desconhecida {nome}")
    for cid in linha: check(cid in canal_ids, f"matriz[{nome}]: canal desconhecido {cid}")
for e in db.get("agenda", {}).get("encontros", []):
    check(e["canal"] in canal_ids, f"encontro {e['id']}: canal desconhecido")
for n in db.get("nos", {}).get("nos", []):
    for aid in n["acoes"]: check(aid in ids, f"nó {n['no']}: ação inexistente {aid}")

# Title Case com preposições/artigos em minúsculas — padrão institucional. Lista fechada;
# "Gestão do Conhecimento e Processos" é núcleo válido mesmo sem projeto de portfólio hoje
# (é usado em data/pessoas.js). editor.html tem sua própria constante NUCLEOS_VALIDOS que
# precisa bater exatamente com esta.
NUCLEOS_VALIDOS = {"Inovação para Competitividade", "Inovação Territorial", "Startups",
                    "Tecnologias Portadoras de Futuro", "Gestão do Conhecimento e Processos"}
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

# mesma lista fechada vale pro campo nucleo em data/pessoas.js — é o que evita a divergência
# silenciosa de nomenclatura que motivou este guardrail (ex.: "Inovação para Escala e Startups").
for p in db.get("pessoas", []):
    if "nucleo" in p:
        check(p["nucleo"] in NUCLEOS_VALIDOS, f"pessoas.js: núcleo inválido {p['nucleo']!r} em {p.get('nome')!r}")

# projetos.js é a fonte canônica de autoria por iniciativa — qualquer outro dataset que
# cite uma iniciativa precisa apontar pra um nome que exista aqui.
inic_proj = set(inic_projetos)
for nome in db.get("matriz", {}).keys():
    check(nome in inic_proj, f"matriz.js: iniciativa {nome!r} não cadastrada em data/projetos.js")

# guardrail anti-duplicação: nenhum outro data/*.js pode reintroduzir um campo de autoria
# (isso é o que causou o "Criss"/"Cris" e o "Dario / Rafa" divergindo do array de projetos.js)
CAMPO_AUTORIA = re.compile(r"respons|dono|gestor|representante|owner", re.I)

# exceção pontual e documentada: "plano.responsavel_id" (BACKLOG #004/#003, prompt "Minhas
# ações") é a versão estruturada (ids estáveis de data/pessoas.js.responsaveis) do campo
# "resp" que já existe ação a ação em data/plano.js há muito mais tempo do que este
# guardrail — mesmo domínio (quem executa a AÇÃO do plano de governança), não a autoria de
# INICIATIVA que data/projetos.js protege. Gerado só por tools/gerar_responsavel_id.js a
# partir do próprio "resp" (nunca editado à mão); "node tools/gerar_responsavel_id.js
# --check" (rodado nos testes, ver README) falha se os dois ficarem fora de sincronia —
# isso fecha a mesma lacuna de drift que motivou o guardrail, sem duplicar autoria de fato.
CAMPOS_PERMITIDOS_POR_EXCECAO = {("plano", "responsavel_id")}

def campos_suspeitos(obj, origem, nome_ds, caminho=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{caminho}.{k}" if caminho else k
            if CAMPO_AUTORIA.search(k) and (nome_ds, k) not in CAMPOS_PERMITIDOS_POR_EXCECAO:
                erros.append(f"{origem}: campo {p!r} duplica autoria — fonte canônica é data/projetos.js")
            campos_suspeitos(v, origem, nome_ds, p)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            campos_suspeitos(v, origem, nome_ds, f"{caminho}[{i}]")

# exceções ao guardrail: "projetos" é a fonte canônica de autoria por INICIATIVA da UI;
# "urc_lideranca"/"urc_canais" são a fonte canônica de responsáveis pela relação com a URC —
# domínio diferente, "responsaveis" ali é legítimo, não duplicação.
DATASETS_AUTORIA_PROPRIA = {"projetos", "urc_lideranca", "urc_canais"}
for nome_ds, dados in db.items():
    if nome_ds in DATASETS_AUTORIA_PROPRIA: continue
    campos_suspeitos(dados, f"data/{nome_ds}.js", nome_ds)

# --- URC: liderança + responsáveis por canal (data/urc.js) ---
CANAIS_URC = ["CNR", "Assessoria de Negócios", "Portal", "Loja", "Marketing Cloud",
              "Foco+", "Rede própria e parceira", "DXP"]
urc_lid = db.get("urc_lideranca", [])
urc_canais = db.get("urc_canais", [])

check(len(urc_lid) >= 1, "urc_lideranca: vazio")
nomes_lideranca = set()
for p in urc_lid:
    check(bool(p.get("nome")) and isinstance(p.get("nome"), str), f"urc_lideranca: nome vazio/ausente em {p!r}")
    check(bool(p.get("papel")) and isinstance(p.get("papel"), str), f"urc_lideranca: papel vazio/ausente em {p!r}")
    check("email" in p, f"urc_lideranca: campo email ausente em {p!r}")
    if p.get("email"): check("@" in p["email"], f"urc_lideranca: email inválido em {p!r}")
    nomes_lideranca.add(p.get("nome"))

nomes_canais = [c.get("canal") for c in urc_canais]
check(nomes_canais == CANAIS_URC, f"urc_canais: esperava exatamente os 8 canais na ordem canônica, veio {nomes_canais}")

nomes_operacionais = {}
for c in urc_canais:
    check(isinstance(c.get("responsaveis"), list), f"urc_canais[{c.get('canal')}]: responsaveis precisa ser lista")
    for r in c.get("responsaveis", []):
        check(bool(r.get("nome")) and isinstance(r.get("nome"), str), f"urc_canais[{c.get('canal')}]: responsável sem nome {r!r}")
        if r.get("email"): check("@" in r["email"], f"urc_canais[{c.get('canal')}]: email inválido {r!r}")
        check(r.get("nome") not in nomes_lideranca,
              f"urc_canais[{c.get('canal')}]: {r.get('nome')!r} é liderança da URC — liderança é transversal, não entra em canal")
        nomes_operacionais.setdefault(r.get("nome"), []).append(c.get("canal"))

if erros:
    print("FALHOU:"); [print(" -", e) for e in erros]; sys.exit(1)
print(f"F1 OK — {len(db['plano'])} ações · {len(db.get('projetos', []))} iniciativas · {len(db['canais'])} canais · 7 nós · 2 SLAs · {len(db['agenda']['encontros'])} encontros")

reps_distintos = {r for p in projetos for r in p.get("representantes", [])}
por_nucleo = {n: sum(1 for p in projetos if p.get("nucleo") == n) for n in NUCLEOS_VALIDOS}
print(f"projetos OK — {len(projetos)} projetos · {len(reps_distintos)} representantes distintos")
for n in sorted(por_nucleo):
    print(f"  - {n}: {por_nucleo[n]}")

canais_indicados = sum(1 for c in urc_canais if c.get("responsaveis"))
print(f"urc OK — {len(urc_lid)} líderes · {canais_indicados} de {len(urc_canais)} canais indicados · {len(nomes_operacionais)} operacionais distintos")
for nome, cs in nomes_operacionais.items():
    if len(cs) >= 2:
        print(f"  AVISO: {nome!r} aparece em {len(cs)} canais ({', '.join(cs)}) — confirmar se é intencional.")
