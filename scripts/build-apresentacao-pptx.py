"""Gera o PowerPoint interativo do CEMOA (links internos + painel ao vivo)."""

from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt
from lxml import etree

NAVY = RGBColor(0x05, 0x15, 0x25)
NAVY2 = RGBColor(0x0A, 0x2B, 0x4D)
GOLD = RGBColor(0xF5, 0x9E, 0x0B)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
MUTE = RGBColor(0xC5, 0xD0, 0xDE)
BLUE = RGBColor(0x25, 0x63, 0xEB)

BASE = "http://127.0.0.1:43127"

SLIDES = [
    {
        "kicker": "Defesa Civil do Amazonas",
        "title": "CEMOA",
        "body": "Centro de Monitoramento e Alerta — a sala de operações dos 62 municípios em um só painel.",
        "bullets": [
            "Alertas, cota fluvial, chuva e risco no mesmo posto",
            "Dados ao vivo: CEMADEN, ANA, App SELVA e boletim CEMOA",
            "Chuva intensa: só o operador classifica",
            "Alagamento, movimento de massa e qualidade do ar: limiares automáticos",
        ],
        "live": f"{BASE}/apresentacao",
        "label": "Abrir apresentação no painel",
    },
    {
        "kicker": "Agenda",
        "title": "Roteiro desta reunião",
        "body": "Clique no tema para ir ao slide. Os botões amarelos abrem o produto correspondente no CEMOA.",
        "bullets": [],
        "agenda": True,
        "live": f"{BASE}/apresentacao",
        "label": "Modo apresentação (ao vivo)",
    },
    {
        "kicker": "Painel de Alertas",
        "title": "Chuva intensa",
        "body": "Somente o operador define o grau (clique, lote ou polígono). Os acumulados de 1 h e 6 h apoiam a fila do plantão, sem pintar o mapa sozinhos.",
        "bullets": ["Clique no município", "Classificar em lote (tecla L)", "Polígono para mancha"],
        "live": f"{BASE}/?tipo=CHUVA",
        "label": "Abrir chuva intensa",
    },
    {
        "kicker": "Painel de Alertas",
        "title": "Alagamento",
        "body": "A plataforma classifica ao atingir o limiar de 1 h. Interior 20 / 40 / 70 mm/h. Manaus: severo acima de 20 mm/h. O operador pode alterar depois.",
        "bullets": [],
        "live": f"{BASE}/?tipo=ALAGAMENTO",
        "label": "Abrir alagamento",
    },
    {
        "kicker": "Painel de Alertas",
        "title": "Movimento de massa",
        "body": "Classificação automática pelo acumulado de 24 h em municípios com setor mapeado. Interior 50 / 85 / 140 mm. Manaus: severo acima de 30 mm/24 h.",
        "bullets": [],
        "live": f"{BASE}/?tipo=MOVIMENTO",
        "label": "Abrir movimento de massa",
    },
    {
        "kicker": "Painel de Alertas",
        "title": "Incêndio e qualidade do ar",
        "body": "O App SELVA classifica o município com MP2,5 em tempo real (atual, 10 min ou 1 h). Não usa a média de 24 h. Boa não colore o mapa.",
        "bullets": ["Faixas: Boa 0–15 · Moderada 15–50 · Ruim 50–75 · Muito ruim 75–125 · Péssima >125 µg/m³"],
        "live": f"{BASE}/?tipo=INCENDIO",
        "label": "Abrir qualidade do ar",
    },
    {
        "kicker": "Sala de situação",
        "title": "O mapa no tamanho da parede",
        "body": "No painel, use Sala de situação para ocultar cabeçalho e lista. Restam o Amazonas, os totais do grau e o cronômetro.",
        "bullets": [],
        "live": f"{BASE}/?tipo=CHUVA",
        "label": "Abrir painel de alertas",
    },
    {
        "kicker": "Boletim Hidrológico",
        "title": "Estiagem e inundação",
        "body": "Cota do dia, status por calha e classificação em lote: cole os municípios por extenso, como no painel de alertas.",
        "bullets": [],
        "live": f"{BASE}/boletim",
        "label": "Abrir boletim",
    },
    {
        "kicker": "Meteorologia",
        "title": "Chuva no estado, agora",
        "body": "Mapa de acumulados CEMADEN (1 h, 6 h, 24 h e 72 h), com ANA onde não há pluviômetro, e satélite de apoio.",
        "bullets": [],
        "live": f"{BASE}/meteorologia",
        "label": "Abrir meteorologia",
    },
    {
        "kicker": "Gestão de Risco",
        "title": "IRE e IRG para priorizar",
        "body": "Índice dos 62 municípios e PNG institucional com os 10 primeiros de cada risco. O índice não altera o grau dos alertas.",
        "bullets": [],
        "live": f"{BASE}/risco",
        "label": "Abrir gestão de risco",
    },
    {
        "kicker": "Defesa Civil do Amazonas",
        "title": "Pronto para o plantão",
        "body": "O CEMOA concentra o monitoramento, a classificação e o produto cartográfico da operação.",
        "bullets": [
            "Painel ao vivo: 127.0.0.1:43127/apresentacao",
            "Chuva intensa e erosão: operador",
            "Alagamento, movimento de massa e qualidade do ar: automático + ajuste do operador",
        ],
        "live": f"{BASE}/apresentacao",
        "label": "Abrir apresentação ao vivo",
    },
]


def set_run(run, text, size=18, bold=False, color=WHITE, font="Calibri"):
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = font


def add_bg(slide, prs):
    fill = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    fill.line.fill.background()
    fill.fill.solid()
    fill.fill.fore_color.rgb = NAVY
    spTree = slide.shapes._spTree
    sp = fill._element
    spTree.remove(sp)
    spTree.insert(2, sp)


def add_text_box(slide, l, t, w, h, text, size=18, bold=False, color=WHITE, align=PP_ALIGN.LEFT):
    box = slide.shapes.add_textbox(l, t, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    set_run(p.add_run() if p.runs else p.runs[0] if False else _first_run(p), text, size, bold, color)
    return box


def _first_run(p):
    if p.runs:
        return p.runs[0]
    return p.add_run()


def add_box_text(slide, l, t, w, h, lines):
    box = slide.shapes.add_textbox(l, t, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = line.get("align", PP_ALIGN.LEFT)
        p.space_after = Pt(line.get("after", 8))
        run = p.add_run()
        set_run(run, line["text"], line.get("size", 18), line.get("bold", False), line.get("color", WHITE))
    return box


def add_link_shape(slide, l, t, w, h, label, url):
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, l, t, w, h)
    shp.fill.solid()
    shp.fill.fore_color.rgb = GOLD
    shp.line.fill.background()
    tf = shp.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    set_run(run, label, 14, True, NAVY)
    shp.click_action.hyperlink.address = url
    return shp


def add_nav_chip(slide, l, t, w, h, label, target_slide):
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, l, t, w, h)
    shp.fill.solid()
    shp.fill.fore_color.rgb = NAVY2
    shp.line.color.rgb = GOLD
    tf = shp.text_frame
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    set_run(run, label, 11, True, WHITE)
    try:
        shp.click_action.target_slide = target_slide
    except Exception:
        pass
    return shp


def add_slide_jump(shape, r_id: str):
    """Internal jump via relationship id (python-pptx click_action.target_slide fallback)."""
    cNvPr = shape._element.find(".//" + qn("p:cNvPr"))
    if cNvPr is None:
        return
    hlink = etree.SubElement(cNvPr, qn("a:hlinkClick"))
    hlink.set("r:id", r_id)
    hlink.set("action", "ppaction://hlinksldjump")


def main():
    out = Path(__file__).resolve().parents[1] / "public" / "cemoa-apresentacao.pptx"
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank = prs.slide_layouts[6]
    built = []

    for spec in SLIDES:
        slide = prs.slides.add_slide(blank)
        add_bg(slide, prs)
        add_box_text(
            slide,
            Inches(0.7),
            Inches(0.35),
            Inches(10),
            Inches(0.4),
            [{"text": spec["kicker"].upper(), "size": 14, "bold": True, "color": GOLD, "after": 0}],
        )
        add_box_text(
            slide,
            Inches(0.7),
            Inches(0.85),
            Inches(12),
            Inches(1.5),
            [{"text": spec["title"], "size": 40, "bold": True, "color": WHITE, "after": 6}],
        )
        add_box_text(
            slide,
            Inches(0.7),
            Inches(2.4),
            Inches(12),
            Inches(1.4),
            [{"text": spec["body"], "size": 20, "color": MUTE, "after": 10}],
        )
        if spec.get("bullets"):
            lines = []
            for b in spec["bullets"]:
                lines.append({"text": f"•  {b}", "size": 18, "color": WHITE, "after": 10})
            add_box_text(slide, Inches(0.7), Inches(3.9), Inches(12), Inches(2.2), lines)
        add_link_shape(slide, Inches(0.7), Inches(6.55), Inches(4.4), Inches(0.48), spec["label"], spec["live"])
        built.append(slide)

    # Agenda chips linking to later slides
    agenda = built[1]
    topics = [
        (2, "Chuva intensa"),
        (3, "Alagamento"),
        (4, "Movimento de massa"),
        (5, "Qualidade do ar"),
        (6, "Sala de situação"),
        (7, "Boletim"),
        (8, "Meteorologia"),
        (9, "Gestão de risco"),
    ]
    x0 = Inches(0.7)
    y = Inches(3.95)
    w = Inches(2.85)
    h = Inches(0.42)
    gap = Inches(0.18)
    for i, (idx, label) in enumerate(topics):
        col = i % 4
        row = i // 4
        chip = add_nav_chip(
            agenda,
            x0 + col * (w + gap),
            y + row * (h + gap),
            w,
            h,
            label,
            built[idx],
        )
        # Ensure relationship exists
        try:
            chip.click_action.target_slide = built[idx]
        except Exception:
            pass

    # Footer nav on every slide: Início | Anterior conceptually via first/last chips
    for i, slide in enumerate(built):
        add_nav_chip(slide, Inches(9.15), Inches(6.55), Inches(1.2), Inches(0.48), "Início", built[0])
        nxt = built[min(i + 1, len(built) - 1)]
        add_nav_chip(slide, Inches(10.5), Inches(6.55), Inches(1.2), Inches(0.48), "Próximo", nxt)
        add_link_shape(slide, Inches(11.85), Inches(6.55), Inches(1.05), Inches(0.48), "Painel", f"{BASE}/apresentacao")

    prs.save(out)
    print(out)


if __name__ == "__main__":
    main()
